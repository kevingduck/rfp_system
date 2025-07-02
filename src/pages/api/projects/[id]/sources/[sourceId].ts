import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, sourceId } = req.query;

  if (!id || !sourceId || typeof id !== 'string' || typeof sourceId !== 'string') {
    return res.status(400).json({ error: 'Invalid project or source ID' });
  }

  switch (req.method) {
    case 'DELETE':
      try {
        // Delete from database
        await query(
          'DELETE FROM web_sources WHERE id = $1 AND project_id = $2',
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