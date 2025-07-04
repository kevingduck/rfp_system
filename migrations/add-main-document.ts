import { pool } from '../src/lib/pg-db';

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running main document migration...');
    
    // Add the column if it doesn't exist
    await client.query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS is_main_document BOOLEAN DEFAULT FALSE
    `);
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration().catch(console.error);
}

export { runMigration };