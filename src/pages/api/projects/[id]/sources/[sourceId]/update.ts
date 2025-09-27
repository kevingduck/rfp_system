import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, sourceId } = req.query;

  if (!id || typeof id !== 'string' || !sourceId || typeof sourceId !== 'string') {
    return res.status(400).json({ error: 'Invalid project or source ID' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content, metadata, title } = req.body;

    // Update the web source
    await query(
      `UPDATE web_sources
       SET content = $1,
           metadata = $2,
           title = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND project_id = $5`,
      [
        content || '',
        JSON.stringify(metadata || {}),
        title || 'Web Source',
        sourceId,
        id
      ]
    );

    // Clear the summary cache since content changed
    await query(
      `UPDATE web_sources
       SET summary_cache = NULL,
           summary_generated_at = NULL
       WHERE id = $1`,
      [sourceId]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to update web source:', error);
    res.status(500).json({ error: 'Failed to update web source' });
  }
}