import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { openDb } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await openDb();

  switch (req.method) {
    case 'GET':
      try {
        const projects = await db.all(
          `SELECT p.*, o.name as organization_name 
           FROM projects p 
           LEFT JOIN organizations o ON p.organization_id = o.id 
           ORDER BY p.created_at DESC`
        );
        res.status(200).json(projects);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch projects' });
      }
      break;

    case 'POST':
      try {
        const { name, projectType, organizationName, description } = req.body;
        
        if (!name || !projectType) {
          return res.status(400).json({ error: 'Project name and type are required' });
        }
        
        if (!['RFI', 'RFP'].includes(projectType)) {
          return res.status(400).json({ error: 'Invalid project type' });
        }

        let organizationId = null;
        if (organizationName) {
          const orgId = uuidv4();
          await db.run(
            'INSERT INTO organizations (id, name) VALUES (?, ?)',
            [orgId, organizationName]
          );
          organizationId = orgId;
        }

        const projectId = uuidv4();
        await db.run(
          `INSERT INTO projects (id, name, project_type, organization_id, description) 
           VALUES (?, ?, ?, ?, ?)`,
          [projectId, name, projectType, organizationId, description]
        );

        const project = await db.get(
          'SELECT * FROM projects WHERE id = ?',
          [projectId]
        );

        res.status(201).json(project);
      } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project', details: error instanceof Error ? error.message : 'Unknown error' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}