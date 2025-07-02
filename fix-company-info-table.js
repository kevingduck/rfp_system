const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rfp_database.db');
const db = new sqlite3.Database(dbPath);

console.log('Updating company_info table...');

// First, let's check what columns already exist
db.all("PRAGMA table_info(company_info)", (err, rows) => {
  if (err) {
    console.error('Error checking table:', err);
    db.close();
    return;
  }

  const existingColumns = rows.map(row => row.name);
  console.log('Existing columns:', existingColumns);

  // Define all columns that should exist
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

  // Add missing columns
  const columnsToAdd = requiredColumns.filter(col => !existingColumns.includes(col.name));

  if (columnsToAdd.length === 0) {
    console.log('✓ All columns already exist!');
    db.close();
    return;
  }

  console.log('Adding missing columns:', columnsToAdd.map(c => c.name));

  // Add each missing column
  let completed = 0;
  columnsToAdd.forEach(column => {
    db.run(`ALTER TABLE company_info ADD COLUMN ${column.name} ${column.type}`, (err) => {
      if (err) {
        console.error(`Error adding column ${column.name}:`, err);
      } else {
        console.log(`✓ Added column: ${column.name}`);
      }
      
      completed++;
      if (completed === columnsToAdd.length) {
        console.log('✓ All columns added successfully!');
        db.close();
      }
    });
  });
});