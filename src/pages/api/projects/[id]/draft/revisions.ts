import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  switch (req.method) {
    case 'GET':
      try {
        // Get all revisions for this project
        const result = await query(
          `SELECT dr.*, d.id as draft_id
           FROM draft_revisions dr
           INNER JOIN drafts d ON dr.draft_id = d.id
           WHERE dr.project_id = $1
           ORDER BY dr.version_number DESC`,
          [id]
        );

        const revisions = result.rows.map(row => ({
          id: row.id,
          draftId: row.draft_id,
          projectId: row.project_id,
          versionNumber: row.version_number,
          content: JSON.parse(row.content),
          metadata: row.metadata ? JSON.parse(row.metadata) : null,
          createdAt: row.created_at,
          createdBy: row.created_by
        }));

        res.status(200).json(revisions);
      } catch (error) {
        console.error('Failed to fetch draft revisions:', error);
        res.status(500).json({ error: 'Failed to fetch draft revisions' });
      }
      break;

    case 'POST':
      try {
        const { revisionId, restoredBy } = req.body;

        if (!revisionId) {
          return res.status(400).json({ error: 'Revision ID is required' });
        }

        // Get the revision to restore
        const revisionResult = await query(
          `SELECT * FROM draft_revisions WHERE id = $1 AND project_id = $2`,
          [revisionId, id]
        );
        const revision = revisionResult.rows[0];

        if (!revision) {
          return res.status(404).json({ error: 'Revision not found' });
        }

        // Get the current draft
        const draftResult = await query(
          `SELECT * FROM drafts WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [id]
        );
        const currentDraft = draftResult.rows[0];

        if (!currentDraft) {
          return res.status(404).json({ error: 'No draft found for this project' });
        }

        // Create a new revision for the current state before restoring
        const currentVersion = currentDraft.current_version || 1;
        await query(
          `INSERT INTO draft_revisions (id, draft_id, project_id, version_number, content, metadata, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            currentDraft.id,
            id,
            currentVersion,
            currentDraft.content,
            currentDraft.metadata,
            restoredBy || null
          ]
        );

        // Update the draft with the restored content
        const newVersion = currentVersion + 1;
        await query(
          `UPDATE drafts 
           SET content = $1, 
               metadata = $2, 
               current_version = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [revision.content, revision.metadata, newVersion, currentDraft.id]
        );

        // Create a new revision for the restored state
        await query(
          `INSERT INTO draft_revisions (id, draft_id, project_id, version_number, content, metadata, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            currentDraft.id,
            id,
            newVersion,
            revision.content,
            revision.metadata,
            restoredBy || null
          ]
        );

        // Log the activity
        await query(
          `INSERT INTO project_activity (id, project_id, action_type, action_details, performed_by, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            uuidv4(),
            id,
            'draft_restored',
            `Draft restored to version ${revision.version_number}`,
            restoredBy || null,
            JSON.stringify({ revisionId, fromVersion: revision.version_number, toVersion: newVersion })
          ]
        );

        res.status(200).json({ 
          success: true, 
          message: 'Draft restored successfully',
          newVersion
        });
      } catch (error) {
        console.error('Failed to restore draft revision:', error);
        res.status(500).json({ error: 'Failed to restore draft revision' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}