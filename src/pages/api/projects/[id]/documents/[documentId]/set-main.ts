import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, documentId } = req.query;

  if (!id || !documentId || typeof id !== 'string' || typeof documentId !== 'string') {
    return res.status(400).json({ error: 'Invalid project or document ID' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if document exists for this project
    const documentResult = await query(
      'SELECT * FROM documents WHERE id = $1 AND project_id = $2',
      [documentId, id]
    );
    
    if (documentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Set this document as main (the trigger will handle unsetting others)
    await query(
      'UPDATE documents SET is_main_document = TRUE WHERE id = $1',
      [documentId]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to set main document:', error);
    res.status(500).json({ error: 'Failed to set main document' });
  }
}