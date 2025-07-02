import { Pool } from 'pg';

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set!');
  console.error('Please add DATABASE_URL to your .env.local file');
  console.error('Example: DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require');
}

const connectionString = process.env.DATABASE_URL || '';

// Create pool with error handling
export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  // Add connection pooling settings
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // how long to wait for a connection
});

// Add pool error handler
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Direct query function for PostgreSQL with error handling
export async function query(text: string, params?: any[]) {
  try {
    return await pool.query(text, params);
  } catch (error: any) {
    // Add better error logging
    console.error('Database query error:', {
      query: text,
      params: params,
      error: error.message,
      code: error.code,
      detail: error.detail
    });
    throw error;
  }
}

// Helper functions to match SQLite API
export async function openDb() {
  try {
    // Test the connection
    await pool.query('SELECT 1');
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Failed to connect to database');
  }
  
  return {
    get: async (query: string, params?: any[]): Promise<any> => {
      // Handle parameter placeholders - convert ? to $1, $2, etc.
      let pgQuery = query;
      let paramIndex = 1;
      while (pgQuery.includes('?')) {
        pgQuery = pgQuery.replace('?', `$${paramIndex}`);
        paramIndex++;
      }
      
      const result = await pool.query(pgQuery, params);
      return result.rows[0];
    },
    
    all: async (query: string, params?: any[]): Promise<any[]> => {
      // Handle parameter placeholders - convert ? to $1, $2, etc.
      let pgQuery = query;
      let paramIndex = 1;
      while (pgQuery.includes('?')) {
        pgQuery = pgQuery.replace('?', `$${paramIndex}`);
        paramIndex++;
      }
      
      const result = await pool.query(pgQuery, params);
      return result.rows;
    },
    
    run: async (query: string, params?: any[]): Promise<{ lastID?: string | number; changes?: number }> => {
      // Handle parameter placeholders - convert ? to $1, $2, etc.
      let pgQuery = query;
      let paramIndex = 1;
      while (pgQuery.includes('?')) {
        pgQuery = pgQuery.replace('?', `$${paramIndex}`);
        paramIndex++;
      }
      
      // Add RETURNING id for INSERT statements
      if (pgQuery.trim().toUpperCase().startsWith('INSERT') && !pgQuery.includes('RETURNING')) {
        pgQuery = pgQuery.trim().replace(/;?\s*$/, ' RETURNING id');
      }
      
      const result = await pool.query(pgQuery, params);
      return {
        lastID: result.rows[0]?.id,
        changes: result.rowCount || 0
      };
    },
    
    exec: async (query: string): Promise<void> => {
      await pool.query(query);
    }
  };
}

// Initialize database tables
export async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
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

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_web_sources_project ON web_sources(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rfi_questions_project ON rfi_questions(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rfi_questions_position ON rfi_questions(project_id, position)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_company_knowledge_category ON company_knowledge(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_drafts_project ON drafts(project_id)`);

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
    client.release();
  }
}