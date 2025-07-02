import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { openDb } from '@/lib/db';
import { scrapeWebPage } from '@/lib/web-scraper';

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

    const db = await openDb();
    await db.run(
      `INSERT INTO web_sources (id, project_id, url, title, content, scraped_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sourceId,
        projectId,
        scrapedContent.url,
        scrapedContent.title,
        scrapedContent.content,
        scrapedContent.scrapedAt.toISOString()
      ]
    );

    res.status(200).json({
      id: sourceId,
      ...scrapedContent
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to scrape web page' });
  }
}