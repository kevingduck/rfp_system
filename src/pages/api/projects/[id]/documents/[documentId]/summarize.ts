import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import { DocumentSummarizer } from '@/lib/document-summarizer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id: projectId, documentId } = req.query;

  if (!projectId || !documentId || typeof projectId !== 'string' || typeof documentId !== 'string') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    // Get the document
    const result = await query(
      'SELECT * FROM documents WHERE id = $1 AND project_id = $2',
      [documentId, projectId]
    );
    const document = result.rows[0];

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if we already have a cached summary
    if (document.summary_cache) {
      return res.status(200).json({ 
        summary: typeof document.summary_cache === 'string' 
          ? JSON.parse(document.summary_cache) 
          : document.summary_cache 
      });
    }

    // Generate new summary
    const summarizer = new DocumentSummarizer();
    const summary = await summarizer.summarizeDocument(
      document.filename,
      document.content,
      document.metadata
    );

    // Cache the summary
    await query(
      `UPDATE documents 
       SET summary_cache = $1, summary_generated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(summary), documentId]
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