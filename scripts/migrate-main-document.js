#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Set up TypeScript paths
require('tsconfig-paths/register');

// Import the pool from TypeScript module
const { pool } = require('../src/lib/pg-db.ts');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running main document migration...');
    
    // Add the column if it doesn't exist
    await client.query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS is_main_document BOOLEAN DEFAULT FALSE
    `);
    
    // Create index for faster lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_main 
      ON documents(project_id, is_main_document) 
      WHERE is_main_document = TRUE
    `);
    
    // Create function to enforce single main document
    await client.query(`
      CREATE OR REPLACE FUNCTION enforce_single_main_document()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.is_main_document = TRUE THEN
          -- Reset any existing main document for this project
          UPDATE documents 
          SET is_main_document = FALSE 
          WHERE project_id = NEW.project_id 
            AND id != NEW.id 
            AND is_main_document = TRUE;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create trigger to enforce single main document
    await client.query(`
      DROP TRIGGER IF EXISTS enforce_single_main_document_trigger ON documents;
      CREATE TRIGGER enforce_single_main_document_trigger
      BEFORE INSERT OR UPDATE ON documents
      FOR EACH ROW
      EXECUTE FUNCTION enforce_single_main_document();
    `);
    
    // Auto-detect and set main documents for existing projects
    const projects = await client.query('SELECT id, project_type FROM projects');
    
    for (const project of projects.rows) {
      // Find the most likely main document
      const result = await client.query(`
        SELECT id, filename 
        FROM documents 
        WHERE project_id = $1 
        ORDER BY 
          CASE 
            WHEN LOWER(filename) LIKE '%rfi%' AND $2 = 'RFI' THEN 1
            WHEN LOWER(filename) LIKE '%rfp%' AND $2 = 'RFP' THEN 1
            WHEN LOWER(filename) LIKE '%request%' THEN 2
            ELSE 3
          END,
          uploaded_at ASC
        LIMIT 1
      `, [project.id, project.project_type]);
      
      if (result.rows.length > 0) {
        await client.query(
          'UPDATE documents SET is_main_document = TRUE WHERE id = $1',
          [result.rows[0].id]
        );
        console.log(`✓ Set main document for project ${project.id}: ${result.rows[0].filename}`);
      }
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);