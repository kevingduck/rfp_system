import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  switch (req.method) {
    case 'GET':
      try {
        const result = await query(
          'SELECT * FROM web_sources WHERE project_id = $1 ORDER BY scraped_at DESC',
          [id]
        );
        const sources = result.rows;

        res.status(200).json(sources);
      } catch (error) {
        console.error('Failed to fetch web sources:', error);
        res.status(500).json({ error: 'Failed to fetch web sources' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}