import { NextApiRequest, NextApiResponse } from 'next';
import { openDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const db = await openDb();

  if (req.method === 'DELETE') {
    try {
      // Get file info first
      const file = await db.get(
        'SELECT filename FROM company_knowledge WHERE id = ?',
        [id]
      );

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Delete from database
      await db.run('DELETE FROM company_knowledge WHERE id = ?', [id]);

      // Delete physical file
      const filepath = path.join(process.cwd(), 'uploads', 'knowledge', file.filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
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