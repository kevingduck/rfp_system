const { openDb } = require('./db');

async function migrate() {
  const db = await openDb();
  
  // Create company knowledge base table
  await db.exec(`
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
  `);

  // Add categories enum-like check
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS validate_category
    BEFORE INSERT ON company_knowledge
    FOR EACH ROW
    WHEN NEW.category NOT IN ('won_proposals', 'sow', 'k12_erate', 'engineering', 'project_plans', 'legal', 'other')
    BEGIN
      SELECT RAISE(FAIL, 'Invalid category');
    END
  `);

  console.log('Company knowledge base migration completed');
  await db.close();
}

migrate().catch(console.error);