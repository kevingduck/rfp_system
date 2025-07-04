import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id: projectId, sourceId } = req.query;

  if (!projectId || !sourceId || typeof projectId !== 'string' || typeof sourceId !== 'string') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    // Clear the summary cache
    await query(
      `UPDATE web_sources 
       SET summary_cache = NULL, summary_generated_at = NULL
       WHERE id = $1 AND project_id = $2`,
      [sourceId, projectId]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to delete summary:', error);
    res.status(500).json({ 
      error: 'Failed to delete summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}