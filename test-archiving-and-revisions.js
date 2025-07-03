#!/usr/bin/env node

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_dCvligO3L1wn@ep-falling-wildflower-a8kgw5zi-pooler.eastus2.azure.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test data
const testProjectId = uuidv4();
const testOrgId = uuidv4();
const testDraftId = uuidv4();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTests() {
  let client;
  
  try {
    log('Starting comprehensive test suite for archiving and revision features...', 'blue');
    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
    
    // Test 1: Check if new columns exist
    log('\n1. Testing database schema updates...', 'yellow');
    
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' 
      AND column_name IN ('archived_at', 'archived_by')
    `);
    
    if (columnsCheck.rows.length === 2) {
      log('✓ Archive columns added to projects table', 'green');
    } else {
      throw new Error('Archive columns missing from projects table');
    }
    
    // Check new tables
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('draft_revisions', 'project_activity')
      AND table_schema = 'public'
    `);
    
    if (tablesCheck.rows.length === 2) {
      log('✓ New tables created successfully', 'green');
    } else {
      throw new Error('New tables not created');
    }
    
    // Test 2: Create test project
    log('\n2. Testing project creation and archiving...', 'yellow');
    
    // Create organization
    await client.query(
      'INSERT INTO organizations (id, name) VALUES ($1, $2)',
      [testOrgId, 'Test Organization']
    );
    
    // Create project
    await client.query(
      `INSERT INTO projects (id, name, project_type, organization_id) 
       VALUES ($1, $2, $3, $4)`,
      [testProjectId, 'Test Project', 'RFP', testOrgId]
    );
    log('✓ Test project created', 'green');
    
    // Test 3: Archive project
    await client.query(
      `UPDATE projects 
       SET archived_at = CURRENT_TIMESTAMP, archived_by = 'test_user'
       WHERE id = $1`,
      [testProjectId]
    );
    
    const archivedProject = await client.query(
      'SELECT archived_at, archived_by FROM projects WHERE id = $1',
      [testProjectId]
    );
    
    if (archivedProject.rows[0].archived_at && archivedProject.rows[0].archived_by === 'test_user') {
      log('✓ Project archived successfully', 'green');
    } else {
      throw new Error('Project archiving failed');
    }
    
    // Test 4: Restore project
    await client.query(
      `UPDATE projects 
       SET archived_at = NULL, archived_by = NULL
       WHERE id = $1`,
      [testProjectId]
    );
    
    const restoredProject = await client.query(
      'SELECT archived_at, archived_by FROM projects WHERE id = $1',
      [testProjectId]
    );
    
    if (!restoredProject.rows[0].archived_at && !restoredProject.rows[0].archived_by) {
      log('✓ Project restored successfully', 'green');
    } else {
      throw new Error('Project restoration failed');
    }
    
    // Test 5: Draft revisions
    log('\n3. Testing draft revision system...', 'yellow');
    
    // Create initial draft
    await client.query(
      `INSERT INTO drafts (id, project_id, content, metadata, current_version)
       VALUES ($1, $2, $3, $4, $5)`,
      [testDraftId, testProjectId, JSON.stringify({ test: 'content' }), JSON.stringify({ test: 'metadata' }), 1]
    );
    log('✓ Draft created', 'green');
    
    // Create initial revision
    const revisionId1 = uuidv4();
    await client.query(
      `INSERT INTO draft_revisions (id, draft_id, project_id, version_number, content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [revisionId1, testDraftId, testProjectId, 1, JSON.stringify({ test: 'content' }), JSON.stringify({ test: 'metadata' })]
    );
    log('✓ Initial revision created', 'green');
    
    // Update draft and create new revision
    const revisionId2 = uuidv4();
    await client.query(
      `UPDATE drafts 
       SET content = $1, current_version = 2
       WHERE id = $2`,
      [JSON.stringify({ test: 'updated content' }), testDraftId]
    );
    
    await client.query(
      `INSERT INTO draft_revisions (id, draft_id, project_id, version_number, content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [revisionId2, testDraftId, testProjectId, 2, JSON.stringify({ test: 'updated content' }), JSON.stringify({ test: 'metadata' })]
    );
    log('✓ Draft updated with new revision', 'green');
    
    // Check revision count
    const revisionCount = await client.query(
      'SELECT COUNT(*) as count FROM draft_revisions WHERE project_id = $1',
      [testProjectId]
    );
    
    if (revisionCount.rows[0].count === '2') {
      log('✓ Correct number of revisions stored', 'green');
    } else {
      throw new Error('Revision count incorrect');
    }
    
    // Test 6: Project activity logging
    log('\n4. Testing activity logging...', 'yellow');
    
    const activityId = uuidv4();
    await client.query(
      `INSERT INTO project_activity (id, project_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [activityId, testProjectId, 'test_action', 'Test activity']
    );
    
    const activity = await client.query(
      'SELECT * FROM project_activity WHERE project_id = $1',
      [testProjectId]
    );
    
    if (activity.rows.length > 0) {
      log('✓ Activity logging working', 'green');
    } else {
      throw new Error('Activity logging failed');
    }
    
    // Test 7: API endpoints
    log('\n5. Testing API endpoints...', 'yellow');
    log('Note: Start the dev server and run the following tests manually:', 'blue');
    log('- PATCH /api/projects/[id] with { action: "archive" }', 'blue');
    log('- PATCH /api/projects/[id] with { action: "restore" }', 'blue');
    log('- DELETE /api/projects/[id]', 'blue');
    log('- GET /api/projects/[id]/draft/revisions', 'blue');
    log('- POST /api/projects/[id]/draft/revisions with { revisionId: "..." }', 'blue');
    
    // Cleanup test data
    log('\n6. Cleaning up test data...', 'yellow');
    await client.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
    await client.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    log('✓ Test data cleaned up', 'green');
    
    // Commit transaction
    await client.query('COMMIT');
    
    log('\n✅ All tests passed successfully!', 'green');
    log('\nNext steps:', 'yellow');
    log('1. Run the migration script: node migrations/add-archiving-and-revisions.js', 'blue');
    log('2. Test the UI features in the browser', 'blue');
    log('3. Deploy to production', 'blue');
    
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    log(`\n❌ Test failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run tests
runTests()
  .then(() => {
    log('\nTest suite completed successfully!', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log(`\nTest suite failed: ${error.message}`, 'red');
    process.exit(1);
  });