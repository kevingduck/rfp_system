# Archiving & Revision History Test Checklist

## Project Archiving Features

### 1. Archive/Delete Buttons on Project List
- [ ] Navigate to homepage (http://localhost:3001)
- [ ] Verify each project card shows an "Archive" button
- [ ] Click "Archive" on a project
- [ ] Confirm the archive dialog appears
- [ ] Verify project is archived (shows archived date and opacity change)

### 2. Filter Toggles
- [ ] Verify filter buttons appear: "Active", "Archived", "All"
- [ ] Click "Active" - only non-archived projects should show
- [ ] Click "Archived" - only archived projects should show
- [ ] Click "All" - all projects should show

### 3. Restore/Delete Archived Projects
- [ ] Filter to show archived projects
- [ ] Verify archived projects show "Restore" and "Delete" buttons
- [ ] Click "Restore" on an archived project
- [ ] Verify project is restored and moves back to active
- [ ] Click "Delete" on an archived project
- [ ] Confirm delete dialog appears
- [ ] Verify project remains archived (soft delete)

## Draft Revision History

### 4. Generate Draft with Revisions
- [ ] Open a project and generate a draft
- [ ] Verify draft is created successfully
- [ ] Edit a section in the draft and save
- [ ] Verify save completes successfully

### 5. Version History UI
- [ ] In draft preview, click "Version History" button
- [ ] Verify revision panel appears in sidebar
- [ ] Check that revisions show:
  - Version number
  - Timestamp
  - Created by (null for now)
- [ ] Verify revision list shows all versions

### 6. Restore Previous Version
- [ ] Generate multiple draft versions by editing and saving
- [ ] Open version history
- [ ] Click restore button on an older version
- [ ] Confirm restore dialog
- [ ] Verify draft content reverts to selected version
- [ ] Check that a new revision is created for the restore

## API Testing

### 7. Archive/Restore API
- [ ] Test PATCH /api/projects/[id] with { action: "archive" }
- [ ] Test PATCH /api/projects/[id] with { action: "restore" }
- [ ] Verify responses are successful

### 8. Revisions API
- [ ] Test GET /api/projects/[id]/draft/revisions
- [ ] Verify it returns list of revisions with proper structure
- [ ] Test POST /api/projects/[id]/draft/revisions with valid revisionId
- [ ] Verify restoration creates new revision

## Database Verification

### 9. Check Database State
- [ ] Verify archived_at is set when archiving
- [ ] Verify archived_at is null when restoring
- [ ] Check draft_revisions table has entries for each save
- [ ] Check project_activity table logs all actions
- [ ] Verify current_version increments in drafts table

## Edge Cases

### 10. Error Handling
- [ ] Try to restore a non-existent revision
- [ ] Archive and restore rapidly to test race conditions
- [ ] Generate draft, archive project, then try to edit draft
- [ ] Test with projects that have no drafts

## Performance

### 11. Load Testing
- [ ] Create project with many revisions (10+)
- [ ] Verify revision list loads quickly
- [ ] Test pagination if needed for large revision lists
- [ ] Check that filters work efficiently with many projects

## User Experience

### 12. UI/UX Verification
- [ ] All actions have appropriate loading states
- [ ] Confirmation dialogs prevent accidental actions
- [ ] Error messages are clear and helpful
- [ ] Archived projects are visually distinct
- [ ] Version history is easy to understand and navigate

## Final Checks

### 13. Production Readiness
- [ ] No console errors in browser
- [ ] All features work as expected
- [ ] Database migrations run successfully
- [ ] No breaking changes to existing functionality
- [ ] Performance is acceptable

---

## Sign-off
- [ ] All tests passed
- [ ] Ready for deployment to Render

Date tested: _______________
Tested by: _______________