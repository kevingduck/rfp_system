import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/pg-db';
import { scrapeWebPage } from '@/lib/web-scraper';
import { DocumentSummarizer } from '@/lib/document-summarizer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, projectId } = req.body;

  if (!url || !projectId) {
    return res.status(400).json({ error: 'Missing URL or project ID' });
  }

  try {
    const scrapedContent = await scrapeWebPage(url);
    const sourceId = uuidv4();

    await query(
      `INSERT INTO web_sources (id, project_id, url, title, content, scraped_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sourceId,
        projectId,
        scrapedContent.url,
        scrapedContent.title,
        scrapedContent.content,
        scrapedContent.scrapedAt.toISOString()
      ]
    );

    // Get project type for summary generation
    const projectResult = await query(
      'SELECT project_type FROM projects WHERE id = $1',
      [projectId]
    );
    const projectType = projectResult.rows[0]?.project_type || 'RFP';

    // Generate summary automatically after scraping
    let summary = null;
    try {
      const summarizer = new DocumentSummarizer();
      summary = await summarizer.summarizeDocument(
        scrapedContent.content,
        scrapedContent.title || scrapedContent.url,
        projectType as 'RFI' | 'RFP'
      );

      // Save the summary to the database
      await query(
        `UPDATE web_sources 
         SET summary_cache = $1, summary_generated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(summary), sourceId]
      );

      console.log(`[Scrape] Generated and cached summary for web source ${sourceId}`);
    } catch (error) {
      console.error('[Scrape] Failed to generate summary:', error);
      // Don't fail the scraping if summary generation fails
    }

    res.status(200).json({
      id: sourceId,
      ...scrapedContent,
      summary
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to scrape web page' });
  }
}