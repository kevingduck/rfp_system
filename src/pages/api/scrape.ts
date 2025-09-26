import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/pg-db';
import { PerplexityService } from '@/lib/perplexity-service';
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
    console.log(`[Scrape] Starting intelligent extraction for ${url}`);

    // Get project context for better extraction
    const projectResult = await query(
      'SELECT name, description, project_type FROM projects WHERE id = $1',
      [projectId]
    );
    const project = projectResult.rows[0];
    const projectContext = `${project?.project_type || 'RFP'} for ${project?.name || 'project'}. ${project?.description || ''}`;

    // Use Perplexity service for intelligent extraction
    const perplexity = new PerplexityService();
    const extractedInfo = await perplexity.extractWebsiteInformation(url, projectContext);

    console.log(`[Scrape] Extracted ${extractedInfo.relevantSections.length} relevant sections from ${extractedInfo.siteName}`);

    // Format the extracted content for storage
    const formattedContent = perplexity.formatForDisplay(extractedInfo);

    // Store structured data in metadata field
    const metadata = {
      siteType: extractedInfo.siteType,
      keyInformation: extractedInfo.keyInformation,
      extractedData: extractedInfo.extractedData,
      sources: extractedInfo.sources,
      extractedAt: extractedInfo.extractedAt,
      relevantSections: extractedInfo.relevantSections
    };

    const sourceId = uuidv4();

    // Insert into database with structured metadata
    await query(
      `INSERT INTO web_sources (id, project_id, url, title, content, metadata, scraped_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sourceId,
        projectId,
        url,
        extractedInfo.siteName,
        formattedContent,
        JSON.stringify(metadata),
        new Date().toISOString()
      ]
    );

    // Generate AI summary of the extracted content
    let summary = null;
    try {
      const summarizer = new DocumentSummarizer();
      summary = await summarizer.summarizeDocument(
        formattedContent,
        extractedInfo.siteName,
        project?.project_type as 'RFI' | 'RFP' | 'FORM_470'
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
    }

    res.status(200).json({
      id: sourceId,
      url,
      title: extractedInfo.siteName,
      content: formattedContent,
      metadata,
      summary,
      scrapedAt: new Date()
    });
  } catch (error) {
    console.error('Extraction error:', error);

    // Fallback to basic storage if extraction fails
    try {
      const sourceId = uuidv4();
      const fallbackTitle = new URL(url).hostname;

      await query(
        `INSERT INTO web_sources (id, project_id, url, title, content, scraped_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sourceId,
          projectId,
          url,
          fallbackTitle,
          `Unable to extract content from ${url}. Please verify the URL and try again.`,
          new Date().toISOString()
        ]
      );

      res.status(200).json({
        id: sourceId,
        url,
        title: fallbackTitle,
        content: 'Extraction failed - basic information saved',
        error: 'Failed to extract detailed information',
        scrapedAt: new Date()
      });
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to process web source' });
    }
  }
}