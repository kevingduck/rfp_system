import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  if (req.method === 'DELETE') {
    try {
      // Get file info first
      const result = await query(
        'SELECT filename FROM company_knowledge WHERE id = $1',
        [id]
      );
      const file = result.rows[0];

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Delete from database
      await query('DELETE FROM company_knowledge WHERE id = $1', [id]);

      // Delete physical file
      try {
        const filepath = path.join(process.cwd(), 'uploads', 'knowledge', file.filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (fsError) {
        console.error('Error deleting physical file:', fsError);
        // Continue anyway - database record is more important
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting knowledge file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}