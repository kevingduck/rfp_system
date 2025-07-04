import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import { DocumentSummarizer } from '@/lib/document-summarizer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id: projectId, sourceId } = req.query;
  const { force = false } = req.body || {};

  if (!projectId || !sourceId || typeof projectId !== 'string' || typeof sourceId !== 'string') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    // Get the web source
    const result = await query(
      'SELECT * FROM web_sources WHERE id = $1 AND project_id = $2',
      [sourceId, projectId]
    );
    const source = result.rows[0];

    if (!source) {
      return res.status(404).json({ error: 'Web source not found' });
    }

    // Check if we already have a cached summary (unless force regeneration is requested)
    if (source.summary_cache && !force) {
      try {
        const cachedSummary = typeof source.summary_cache === 'string' 
          ? JSON.parse(source.summary_cache) 
          : source.summary_cache;
        
        // Only return cached summary if it's valid
        if (cachedSummary && cachedSummary.fullSummary) {
          return res.status(200).json({ summary: cachedSummary });
        }
      } catch (e) {
        console.error('Invalid cached summary, regenerating:', e);
      }
    }

    if (!source.content) {
      return res.status(400).json({ error: 'Web source has no content to summarize' });
    }

    // Get project type
    const projectResult = await query(
      'SELECT project_type FROM projects WHERE id = $1',
      [projectId]
    );
    const projectType = projectResult.rows[0]?.project_type || 'RFP';

    // Generate new summary
    const summarizer = new DocumentSummarizer();
    const summary = await summarizer.summarizeDocument(
      source.content,
      source.title || source.url,
      projectType
    );

    // Cache the summary
    await query(
      `UPDATE web_sources 
       SET summary_cache = $1, summary_generated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(summary), sourceId]
    );

    res.status(200).json({ summary });
  } catch (error) {
    console.error('Failed to generate summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}