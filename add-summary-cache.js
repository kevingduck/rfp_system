const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rfp_database.db');
const db = new sqlite3.Database(dbPath);

console.log('Adding summary cache columns to documents and web_sources tables...');

db.serialize(() => {
  // Add summary cache to documents table
  db.run(`ALTER TABLE documents ADD COLUMN summary_cache TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ summary_cache column already exists in documents table');
      } else {
        console.error('Error adding summary_cache to documents:', err);
      }
    } else {
      console.log('✓ Added summary_cache column to documents table');
    }
  });

  db.run(`ALTER TABLE documents ADD COLUMN summary_generated_at DATETIME`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ summary_generated_at column already exists in documents table');
      } else {
        console.error('Error adding summary_generated_at to documents:', err);
      }
    } else {
      console.log('✓ Added summary_generated_at column to documents table');
    }
  });

  // Add summary cache to web_sources table
  db.run(`ALTER TABLE web_sources ADD COLUMN summary_cache TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ summary_cache column already exists in web_sources table');
      } else {
        console.error('Error adding summary_cache to web_sources:', err);
      }
    } else {
      console.log('✓ Added summary_cache column to web_sources table');
    }
  });

  db.run(`ALTER TABLE web_sources ADD COLUMN summary_generated_at DATETIME`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ summary_generated_at column already exists in web_sources table');
      } else {
        console.error('Error adding summary_generated_at to web_sources:', err);
      }
    } else {
      console.log('✓ Added summary_generated_at column to web_sources table');
    }
  });

  // Also add to company_knowledge table
  db.run(`ALTER TABLE company_knowledge ADD COLUMN summary_cache TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ summary_cache column already exists in company_knowledge table');
      } else if (err.message.includes('no such table')) {
        console.log('⚠ company_knowledge table does not exist yet');
      } else {
        console.error('Error adding summary_cache to company_knowledge:', err);
      }
    } else {
      console.log('✓ Added summary_cache column to company_knowledge table');
    }
  });

  db.run(`ALTER TABLE company_knowledge ADD COLUMN summary_generated_at DATETIME`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ summary_generated_at column already exists in company_knowledge table');
      } else if (err.message.includes('no such table')) {
        console.log('⚠ company_knowledge table does not exist yet');
      } else {
        console.error('Error adding summary_generated_at to company_knowledge:', err);
      }
    } else {
      console.log('✓ Added summary_generated_at column to company_knowledge table');
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