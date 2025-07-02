import type { NextApiRequest, NextApiResponse } from 'next';
import { openDb } from '@/lib/db';
import fs from 'fs/promises';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, documentId } = req.query;

  if (!id || !documentId || typeof id !== 'string' || typeof documentId !== 'string') {
    return res.status(400).json({ error: 'Invalid project or document ID' });
  }

  const db = await openDb();

  switch (req.method) {
    case 'DELETE':
      try {
        // Get the document to find the file path
        const document = await db.get(
          'SELECT * FROM documents WHERE id = ? AND project_id = ?',
          [documentId, id]
        );

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // Delete from database
        await db.run(
          'DELETE FROM documents WHERE id = ? AND project_id = ?',
          [documentId, id]
        );

        // Try to delete the file from disk
        try {
          await fs.unlink(document.filepath || document.file_path);
        } catch (error) {
          // File might not exist, that's okay
          console.error('Failed to delete file from disk:', error);
        }

        res.status(200).json({ success: true });
      } catch (error) {
        console.error('Failed to delete document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}