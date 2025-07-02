const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rfp_database.db');
const db = new sqlite3.Database(dbPath);

console.log('Creating drafts table...');

const createTableSQL = `
  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`;

const createIndexSQL = `
  CREATE INDEX IF NOT EXISTS idx_drafts_project_id ON drafts(project_id)
`;

db.serialize(() => {
  db.run(createTableSQL, (err) => {
    if (err) {
      console.error('Error creating drafts table:', err);
    } else {
      console.log('✓ Drafts table created successfully');
    }
  });

  db.run(createIndexSQL, (err) => {
    if (err) {
      console.error('Error creating index:', err);
    } else {
      console.log('✓ Index created successfully');
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('✓ Database migration complete!');
  }
});