import type { NextApiRequest, NextApiResponse } from 'next';
import { openDb } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const db = await openDb();

  switch (req.method) {
    case 'GET':
      try {
        const project = await db.get(
          `SELECT p.*, o.name as organization_name 
           FROM projects p 
           LEFT JOIN organizations o ON p.organization_id = o.id 
           WHERE p.id = ?`,
          [id]
        );

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        res.status(200).json(project);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch project' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}