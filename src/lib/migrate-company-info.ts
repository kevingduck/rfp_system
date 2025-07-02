import { openDb } from './db';

async function migrateCompanyInfo() {
  const db = await openDb();
  
  console.log('Starting company_info table migration...');
  
  try {
    // Check existing columns
    const tableInfo = await db.all('PRAGMA table_info(company_info)');
    const existingColumns = tableInfo.map(col => col.name);
    
    // Add new columns if they don't exist
    const newColumns = [
      { name: 'services', type: 'TEXT' },
      { name: 'differentiators', type: 'TEXT' },
      { name: 'experience', type: 'TEXT' },
      { name: 'team_size', type: 'TEXT' },
    ];
    
    for (const column of newColumns) {
      if (!existingColumns.includes(column.name)) {
        await db.run(`ALTER TABLE company_info ADD COLUMN ${column.name} ${column.type}`);
        console.log(`Added column: ${column.name}`);
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.close();
  }
}

// Run the migration
migrateCompanyInfo();