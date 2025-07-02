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
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        mimetype TEXT,
        size INTEGER,
        content TEXT,
        metadata TEXT,
        summary_cache TEXT,
        summary_generated_at TIMESTAMP,
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
        category TEXT,
        answer TEXT,
        position INTEGER DEFAULT 0,
        required BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS company_knowledge (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    console.log('Creating indexes...');
    
    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_web_sources_project ON web_sources(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rfi_questions_project ON rfi_questions(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rfi_questions_position ON rfi_questions(project_id, position)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_company_knowledge_category ON company_knowledge(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_drafts_project ON drafts(project_id)`);

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