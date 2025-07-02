import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

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

      // Update the most recent draft
      const draftResult = await query(
        'SELECT id FROM drafts WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
        [id]
      );
      const draft = draftResult.rows[0];

      if (!draft) {
        return res.status(404).json({ error: 'No draft found to update' });
      }

      await query(
        `UPDATE drafts 
         SET content = $1, metadata = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [JSON.stringify(sections), JSON.stringify(metadata), draft.id]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to update draft:', error);
      res.status(500).json({ error: 'Failed to update draft' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}