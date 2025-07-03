const { Pool } = require('pg');

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_dCvligO3L1wn@ep-falling-wildflower-a8kgw5zi-pooler.eastus2.azure.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  let client;
  
  try {
    console.log('Starting migration: Add archiving and revision history...');
    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
    
    console.log('1. Adding archive columns to projects table...');
    // Add archived_at column to projects table
    await client.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NULL
    `);
    
    // Add archived_by column for future multi-user support
    await client.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL
    `);
    
    // Create index on archived_at for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_archived_at 
      ON projects(archived_at)
    `);
    
    console.log('2. Creating draft_revisions table...');
    // Create draft_revisions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS draft_revisions (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT DEFAULT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes for draft_revisions
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_draft_revisions_project 
      ON draft_revisions(project_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_draft_revisions_draft 
      ON draft_revisions(draft_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_draft_revisions_version 
      ON draft_revisions(project_id, version_number DESC)
    `);
    
    console.log('3. Creating project_activity table...');
    // Create project_activity table for audit trail
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_activity (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_details TEXT,
        performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        performed_by TEXT DEFAULT NULL,
        metadata TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
    
    // Create index for project_activity
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_activity_project 
      ON project_activity(project_id, performed_at DESC)
    `);
    
    console.log('4. Adding current_version to drafts table...');
    // Add current_version column to drafts table
    await client.query(`
      ALTER TABLE drafts 
      ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1
    `);
    
    console.log('5. Migrating existing drafts to revision history...');
    // Migrate existing drafts to have an initial revision
    const existingDrafts = await client.query(`
      SELECT id, project_id, content, metadata, created_at 
      FROM drafts
    `);
    
    for (const draft of existingDrafts.rows) {
      // Check if this draft already has a revision
      const revisionCheck = await client.query(
        'SELECT COUNT(*) as count FROM draft_revisions WHERE draft_id = $1',
        [draft.id]
      );
      
      if (revisionCheck.rows[0].count === '0') {
        // Create initial revision for existing draft
        const { v4: uuidv4 } = require('uuid');
        await client.query(`
          INSERT INTO draft_revisions (id, draft_id, project_id, version_number, content, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          uuidv4(),
          draft.id,
          draft.project_id,
          1,
          draft.content,
          draft.metadata,
          draft.created_at
        ]);
      }
    }
    
    console.log('6. Creating helper functions...');
    // Create a function to log project activity
    await client.query(`
      CREATE OR REPLACE FUNCTION log_project_activity(
        p_project_id TEXT,
        p_action_type TEXT,
        p_action_details TEXT,
        p_performed_by TEXT DEFAULT NULL,
        p_metadata TEXT DEFAULT NULL
      )
      RETURNS VOID AS $$
      DECLARE
        v_id TEXT;
      BEGIN
        v_id := gen_random_uuid()::TEXT;
        INSERT INTO project_activity (id, project_id, action_type, action_details, performed_by, metadata)
        VALUES (v_id, p_project_id, p_action_type, p_action_details, p_performed_by, p_metadata);
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✓ Migration completed successfully!');
    
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });