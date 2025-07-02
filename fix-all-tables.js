const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rfp_database.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting database fixes...\n');

// Fix 1: Create company_knowledge table
function createKnowledgeTable(callback) {
  console.log('1. Creating company_knowledge table...');
  
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

  db.run(createTableSQL, (err) => {
    if (err && !err.message.includes('already exists')) {
      console.error('Error creating knowledge table:', err);
    } else {
      console.log('✓ Knowledge table ready\n');
    }
    callback();
  });
}

// Fix 2: Update company_info table
function fixCompanyInfoTable(callback) {
  console.log('2. Updating company_info table...');
  
  db.all("PRAGMA table_info(company_info)", (err, rows) => {
    if (err) {
      console.error('Error checking company_info table:', err);
      callback();
      return;
    }

    const existingColumns = rows.map(row => row.name);
    
    const requiredColumns = [
      { name: 'company_name', type: 'TEXT' },
      { name: 'description', type: 'TEXT' },
      { name: 'services', type: 'TEXT' },
      { name: 'capabilities', type: 'TEXT' },
      { name: 'differentiators', type: 'TEXT' },
      { name: 'experience', type: 'TEXT' },
      { name: 'certifications', type: 'TEXT' },
      { name: 'team_size', type: 'TEXT' },
      { name: 'website', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'address', type: 'TEXT' }
    ];

    const columnsToAdd = requiredColumns.filter(col => !existingColumns.includes(col.name));

    if (columnsToAdd.length === 0) {
      console.log('✓ All company_info columns exist\n');
      callback();
      return;
    }

    let completed = 0;
    columnsToAdd.forEach(column => {
      db.run(`ALTER TABLE company_info ADD COLUMN ${column.name} ${column.type}`, (err) => {
        if (err) {
          console.error(`Error adding ${column.name}:`, err);
        } else {
          console.log(`✓ Added ${column.name}`);
        }
        
        completed++;
        if (completed === columnsToAdd.length) {
          console.log('✓ Company info table updated\n');
          callback();
        }
      });
    });
  });
}

// Run all fixes in sequence
createKnowledgeTable(() => {
  fixCompanyInfoTable(() => {
    console.log('✅ All database fixes complete!');
    console.log('\nYour RFP system should now work properly.');
    console.log('Try refreshing the page and using the features.');
    db.close();
  });
});