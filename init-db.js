const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('Initializing database...');

const db = new sqlite3.Database(path.join(__dirname, 'rfp_database.db'));

// Create all tables in the correct order
const tables = [
  // Organizations table
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Projects table
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_type TEXT CHECK(project_type IN ('RFI', 'RFP')) NOT NULL DEFAULT 'RFP',
    organization_id TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
  )`,
  
  // Documents table
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    mimetype TEXT,
    size INTEGER,
    content TEXT,
    metadata TEXT,
    summary_cache TEXT,
    summary_generated_at DATETIME,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  
  // Web sources table
  `CREATE TABLE IF NOT EXISTS web_sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    content TEXT,
    summary_cache TEXT,
    summary_generated_at DATETIME,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  
  // Company info table
  `CREATE TABLE IF NOT EXISTS company_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // RFI questions table
  `CREATE TABLE IF NOT EXISTS rfi_questions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    category TEXT,
    answer TEXT,
    position INTEGER DEFAULT 0,
    required BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  
  // Company knowledge table (from create-knowledge-table.js)
  `CREATE TABLE IF NOT EXISTS company_knowledge (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT,
    metadata TEXT,
    summary_cache TEXT,
    summary_generated_at DATETIME,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Drafts table (from create-drafts-table.js)
  `CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    content TEXT NOT NULL,
    format TEXT DEFAULT 'markdown',
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`
];

// Create indexes
const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_web_sources_project ON web_sources(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rfi_questions_project ON rfi_questions(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rfi_questions_position ON rfi_questions(project_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_company_knowledge_category ON company_knowledge(category)`,
  `CREATE INDEX IF NOT EXISTS idx_drafts_project ON drafts(project_id)`
];

// Create triggers
const triggers = [
  `CREATE TRIGGER IF NOT EXISTS update_company_info_timestamp 
   AFTER UPDATE ON company_info 
   BEGIN 
     UPDATE company_info SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
   END`,
   
  `CREATE TRIGGER IF NOT EXISTS update_company_knowledge_timestamp 
   AFTER UPDATE ON company_knowledge 
   BEGIN 
     UPDATE company_knowledge SET uploaded_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
   END`
];

// Execute all SQL
db.serialize(() => {
  // Create tables
  tables.forEach((sql, index) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`Error creating table ${index + 1}:`, err);
      } else {
        console.log(`✓ Table ${index + 1} created`);
      }
    });
  });
  
  // Create indexes
  indexes.forEach((sql, index) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`Error creating index ${index + 1}:`, err);
      } else {
        console.log(`✓ Index ${index + 1} created`);
      }
    });
  });
  
  // Create triggers
  triggers.forEach((sql, index) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`Error creating trigger ${index + 1}:`, err);
      } else {
        console.log(`✓ Trigger ${index + 1} created`);
      }
    });
  });
});

// Close database
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('✓ Database initialization complete!');
  }
});