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
        const result = await query(
          `SELECT p.*, o.name as organization_name 
           FROM projects p 
           LEFT JOIN organizations o ON p.organization_id = o.id 
           WHERE p.id = $1`,
          [id]
        );
        const project = result.rows[0];

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        res.status(200).json(project);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch project' });
      }
      break;

    case 'PATCH':
      try {
        const { action, archivedBy } = req.body;
        
        if (action === 'archive') {
          // Archive the project
          await query(
            `UPDATE projects 
             SET archived_at = CURRENT_TIMESTAMP, 
                 archived_by = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [id, archivedBy || null]
          );
          
          // Log the activity
          await query(
            `INSERT INTO project_activity (id, project_id, action_type, action_details, performed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [uuidv4(), id, 'archived', 'Project archived', archivedBy || null]
          );
          
          res.status(200).json({ success: true, message: 'Project archived successfully' });
        } else if (action === 'restore') {
          // Restore the project
          await query(
            `UPDATE projects 
             SET archived_at = NULL, 
                 archived_by = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [id]
          );
          
          // Log the activity
          await query(
            `INSERT INTO project_activity (id, project_id, action_type, action_details, performed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [uuidv4(), id, 'restored', 'Project restored', archivedBy || null]
          );
          
          res.status(200).json({ success: true, message: 'Project restored successfully' });
        } else {
          res.status(400).json({ error: 'Invalid action. Use "archive" or "restore"' });
        }
      } catch (error) {
        console.error('Failed to update project:', error);
        res.status(500).json({ error: 'Failed to update project' });
      }
      break;

    case 'DELETE':
      try {
        // Check if project exists
        const checkResult = await query(
          'SELECT id FROM projects WHERE id = $1',
          [id]
        );
        
        if (checkResult.rows.length === 0) {
          return res.status(404).json({ error: 'Project not found' });
        }
        
        // Soft delete by setting archived_at
        await query(
          `UPDATE projects 
           SET archived_at = CURRENT_TIMESTAMP,
               archived_by = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id, req.body.deletedBy || null]
        );
        
        // Log the activity
        await query(
          `INSERT INTO project_activity (id, project_id, action_type, action_details, performed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), id, 'deleted', 'Project deleted', req.body.deletedBy || null]
        );
        
        res.status(200).json({ success: true, message: 'Project deleted successfully' });
      } catch (error) {
        console.error('Failed to delete project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}