import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Unset all main documents for this project
    await query(
      'UPDATE documents SET is_main_document = FALSE WHERE project_id = $1',
      [id]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to unset main document:', error);
    res.status(500).json({ error: 'Failed to unset main document' });
  }
}