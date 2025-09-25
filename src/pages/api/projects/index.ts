import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      try {
        const result = await query(
          `SELECT p.*, o.name as organization_name 
           FROM projects p 
           LEFT JOIN organizations o ON p.organization_id = o.id 
           ORDER BY p.created_at DESC`
        );
        res.status(200).json(result.rows);
      } catch (error: any) {
        console.error('Failed to fetch projects:', error);
        res.status(500).json({ 
          error: 'Failed to fetch projects',
          details: error.message,
          code: error.code 
        });
      }
      break;

    case 'POST':
      try {
        const { name, projectType, organizationName, description } = req.body;
        
        if (!name || !projectType) {
          return res.status(400).json({ error: 'Project name and type are required' });
        }
        
        if (!['RFI', 'RFP', 'FORM_470'].includes(projectType)) {
          return res.status(400).json({ error: 'Invalid project type' });
        }

        let organizationId = null;
        if (organizationName) {
          const orgId = uuidv4();
          await query(
            'INSERT INTO organizations (id, name) VALUES ($1, $2)',
            [orgId, organizationName]
          );
          organizationId = orgId;
        }

        const projectId = uuidv4();
        await query(
          `INSERT INTO projects (id, name, project_type, organization_id, description) 
           VALUES ($1, $2, $3, $4, $5)`,
          [projectId, name, projectType, organizationId, description]
        );

        const projectResult = await query(
          'SELECT * FROM projects WHERE id = $1',
          [projectId]
        );

        res.status(201).json(projectResult.rows[0]);
      } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project', details: error instanceof Error ? error.message : 'Unknown error' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}