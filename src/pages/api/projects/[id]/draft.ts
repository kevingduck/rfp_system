import type { NextApiRequest, NextApiResponse } from 'next';
import { openDb } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = await openDb();

  if (req.method === 'GET') {
    try {
      // Get the most recent draft for this project
      const draft = await db.get(
        `SELECT * FROM drafts 
         WHERE project_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        id
      );

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
      await db.run(
        'DELETE FROM drafts WHERE project_id = ?',
        id
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
      const draft = await db.get(
        'SELECT id FROM drafts WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
        id
      );

      if (!draft) {
        return res.status(404).json({ error: 'No draft found to update' });
      }

      await db.run(
        `UPDATE drafts 
         SET content = ?, metadata = ?, updated_at = datetime('now')
         WHERE id = ?`,
        JSON.stringify(sections),
        JSON.stringify(metadata),
        draft.id
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