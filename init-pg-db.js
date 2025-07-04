const { Pool } = require('pg');

// Always use the full connection string directly
const connectionString = 'postgresql://neondb_owner:npg_dCvligO3L1wn@ep-falling-wildflower-a8kgw5zi-pooler.eastus2.azure.neon.tech/neondb?sslmode=require';

console.log('Connecting to Neon database...');

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initializeDatabase() {
  let client;
  
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('Connected successfully');
    
    console.log('Creating tables...');
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_type TEXT CHECK(project_type IN ('RFI', 'RFP')) NOT NULL DEFAULT 'RFP',
        organization_id TEXT,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        archived_at TIMESTAMP DEFAULT NULL,
        archived_by TEXT DEFAULT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        file_path TEXT, -- alias for compatibility
        file_type TEXT,
        mimetype TEXT,
        size INTEGER,
        content TEXT,
        metadata TEXT,
        summary_cache TEXT,
        summary_generated_at TIMESTAMP,
        is_main_document BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS web_sources (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        content TEXT,
        summary_cache TEXT,
        summary_generated_at TIMESTAMP,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS company_info (
        id SERIAL PRIMARY KEY,
        company_name TEXT,
        description TEXT,
        services TEXT,
        capabilities TEXT,
        differentiators TEXT,
        experience TEXT,
        certifications TEXT,
        team_size TEXT,
        website TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rfi_questions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_type TEXT DEFAULT 'text',
        category TEXT,
        answer TEXT,
        position INTEGER DEFAULT 0,
        order_index INTEGER DEFAULT 0, -- alias for compatibility
        required BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS company_knowledge (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_filename TEXT,
        file_type TEXT,
        category TEXT NOT NULL,
        content TEXT,
        metadata TEXT,
        summary_cache TEXT,
        summary_generated_at TIMESTAMP,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        content TEXT NOT NULL,
        format TEXT DEFAULT 'markdown',
        metadata TEXT,
        current_version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

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

    console.log('Creating indexes...');
    
    // Add is_main_document column if it doesn't exist (must be done before creating index)
    await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_main_document BOOLEAN DEFAULT FALSE`);
    
    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_main ON documents(project_id, is_main_document) WHERE is_main_document = TRUE`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_web_sources_project ON web_sources(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rfi_questions_project ON rfi_questions(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rfi_questions_position ON rfi_questions(project_id, position)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_company_knowledge_category ON company_knowledge(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_drafts_project ON drafts(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_archived_at ON projects(archived_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_draft_revisions_project ON draft_revisions(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_draft_revisions_draft ON draft_revisions(draft_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_draft_revisions_version ON draft_revisions(project_id, version_number DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_activity_project ON project_activity(project_id, performed_at DESC)`);

    console.log('Creating triggers...');
    
    // Create update trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
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

    // Create triggers
    await client.query(`
      DROP TRIGGER IF EXISTS update_company_info_timestamp ON company_info;
      CREATE TRIGGER update_company_info_timestamp 
      BEFORE UPDATE ON company_info 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_drafts_timestamp ON drafts;
      CREATE TRIGGER update_drafts_timestamp 
      BEFORE UPDATE ON drafts 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create trigger to enforce single main document
    await client.query(`
      DROP TRIGGER IF EXISTS enforce_single_main_document_trigger ON documents;
      CREATE TRIGGER enforce_single_main_document_trigger
      BEFORE INSERT OR UPDATE ON documents
      FOR EACH ROW
      EXECUTE FUNCTION enforce_single_main_document();
    `);

    console.log('Applying schema fixes...');
    
    // Add missing columns if tables already exist
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT`);
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS type TEXT`);
    
    // Fix documents table
    await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT`);
    await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type TEXT`);
    await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    
    // Fix rfi_questions table
    await client.query(`ALTER TABLE rfi_questions ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'text'`);
    await client.query(`ALTER TABLE rfi_questions ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0`);
    
    // Fix company_knowledge table
    await client.query(`ALTER TABLE company_knowledge ADD COLUMN IF NOT EXISTS original_filename TEXT`);
    await client.query(`ALTER TABLE company_knowledge ADD COLUMN IF NOT EXISTS file_type TEXT`);
    
    // Add new columns for archiving and versioning
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NULL`);
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_by TEXT DEFAULT NULL`);
    await client.query(`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1`);
    
    console.log('✓ PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

initializeDatabase()
  .then(() => {
    console.log('Database initialization completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    console.error('Full error:', JSON.stringify(error, null, 2));
    process.exit(1);
  });