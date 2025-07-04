import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  if (req.method === 'GET') {
    try {
      // Get the most recent draft for this project
      const result = await query(
        `SELECT * FROM drafts 
         WHERE project_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [id]
      );
      const draft = result.rows[0];

      if (!draft) {
        return res.status(404).json({ error: 'No draft found' });
      }

      // Parse the JSON content and metadata
      const draftData = {
        id: draft.id,
        projectId: draft.project_id,
        sections: JSON.parse(draft.content),
        metadata: draft.metadata ? JSON.parse(draft.metadata) : null,
        createdAt: draft.created_at,
        updatedAt: draft.updated_at
      };

      res.json(draftData);
    } catch (error) {
      console.error('Failed to fetch draft:', error);
      res.status(500).json({ error: 'Failed to fetch draft' });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Delete all drafts for this project
      await query(
        'DELETE FROM drafts WHERE project_id = $1',
        [id]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete draft:', error);
      res.status(500).json({ error: 'Failed to delete draft' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { sections, metadata } = req.body;

      // Get the most recent draft with current version and content
      const draftResult = await query(
        'SELECT id, current_version, content FROM drafts WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
        [id]
      );
      const draft = draftResult.rows[0];

      if (!draft) {
        return res.status(404).json({ error: 'No draft found to update' });
      }

      // Check if the content has actually changed
      const currentContent = JSON.parse(draft.content);
      const hasChanged = JSON.stringify(currentContent) !== JSON.stringify(sections);

      if (!hasChanged) {
        // No changes, don't create a new revision
        return res.json({ success: true, version: draft.current_version || 1, noChanges: true });
      }

      // Get current version and increment
      const currentVersion = draft.current_version || 1;
      const newVersion = currentVersion + 1;

      // Create a revision for the previous content if this is not the first save after generation
      const revisionsResult = await query(
        'SELECT COUNT(*) as count FROM draft_revisions WHERE draft_id = $1',
        [draft.id]
      );
      const revisionCount = parseInt(revisionsResult.rows[0].count);

      // Only create a revision if there are already revisions (meaning this isn't the first edit)
      if (revisionCount > 0) {
        // Check if we need to create a revision for the current state before updating
        const lastRevisionResult = await query(
          'SELECT content FROM draft_revisions WHERE draft_id = $1 ORDER BY version_number DESC LIMIT 1',
          [draft.id]
        );
        const lastRevision = lastRevisionResult.rows[0];
        
        if (!lastRevision || JSON.stringify(JSON.parse(lastRevision.content)) !== JSON.stringify(currentContent)) {
          // Create a revision for the current state before updating
          await query(
            `INSERT INTO draft_revisions (id, draft_id, project_id, version_number, content, metadata, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              uuidv4(),
              draft.id,
              id,
              currentVersion,
              draft.content, // Use the existing content
              JSON.stringify(metadata),
              null // No user system yet
            ]
          );
        }
      }

      // Update the draft
      await query(
        `UPDATE drafts 
         SET content = $1, metadata = $2, current_version = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [JSON.stringify(sections), JSON.stringify(metadata), newVersion, draft.id]
      );

      // Create a revision for the new state
      await query(
        `INSERT INTO draft_revisions (id, draft_id, project_id, version_number, content, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          draft.id,
          id,
          newVersion,
          JSON.stringify(sections),
          JSON.stringify(metadata),
          null // No user system yet
        ]
      );

      // Log the activity
      await query(
        `INSERT INTO project_activity (id, project_id, action_type, action_details, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          uuidv4(),
          id,
          'draft_updated',
          `Draft updated to version ${newVersion}`,
          JSON.stringify({ version: newVersion })
        ]
      );

      res.json({ success: true, version: newVersion });
    } catch (error) {
      console.error('Failed to update draft:', error);
      res.status(500).json({ error: 'Failed to update draft' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}