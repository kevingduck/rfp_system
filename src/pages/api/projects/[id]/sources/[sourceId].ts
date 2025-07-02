import type { NextApiRequest, NextApiResponse } from 'next';
import { openDb } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, sourceId } = req.query;

  if (!id || !sourceId || typeof id !== 'string' || typeof sourceId !== 'string') {
    return res.status(400).json({ error: 'Invalid project or source ID' });
  }

  const db = await openDb();

  switch (req.method) {
    case 'DELETE':
      try {
        // Delete from database
        await db.run(
          'DELETE FROM web_sources WHERE id = ? AND project_id = ?',
          [sourceId, id]
        );

        res.status(200).json({ success: true });
      } catch (error) {
        console.error('Failed to delete web source:', error);
        res.status(500).json({ error: 'Failed to delete web source' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}