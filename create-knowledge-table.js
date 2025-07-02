const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rfp_database.db');
const db = new sqlite3.Database(dbPath);

console.log('Creating company knowledge base table...');

const createTableSQL = `
  CREATE TABLE IF NOT EXISTS company_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    content TEXT,
    metadata TEXT,
    file_type TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, filename)
  )
`;

const createTriggerSQL = `
  CREATE TRIGGER IF NOT EXISTS validate_category
  BEFORE INSERT ON company_knowledge
  FOR EACH ROW
  WHEN NEW.category NOT IN ('won_proposals', 'sow', 'k12_erate', 'engineering', 'project_plans', 'legal', 'other')
  BEGIN
    SELECT RAISE(FAIL, 'Invalid category');
  END
`;

db.serialize(() => {
  db.run(createTableSQL, (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('✓ Table created successfully');
    }
  });

  db.run(createTriggerSQL, (err) => {
    if (err) {
      console.error('Error creating trigger:', err);
    } else {
      console.log('✓ Trigger created successfully');
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