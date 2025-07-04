import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  switch (req.method) {
    case 'GET':
      try {
        const result = await query(
          'SELECT * FROM documents WHERE project_id = $1 ORDER BY uploaded_at DESC',
          [id]
        );
        const documents = result.rows;

        // Parse the content and metadata for each document
        const documentsWithParsedData = documents.map(doc => {
          let extractedInfo = {};
          let metadata = {};
          let parsedContent = null;
          
          try {
            // Try to parse content as JSON first
            parsedContent = JSON.parse(doc.content);
            // Extract key information from content
            extractedInfo = {
              scope: parsedContent.scope,
              requirements: parsedContent.requirements,
              timeline: parsedContent.timeline,
              budget: parsedContent.budget,
              deliverables: parsedContent.deliverables,
              text: parsedContent.text
            };
          } catch (e) {
            // If JSON parse fails, content is plain text
            extractedInfo = {
              text: doc.content
            };
          }
          
          try {
            if (doc.metadata) {
              metadata = JSON.parse(doc.metadata);
            }
          } catch (e) {
            console.error('Failed to parse document metadata:', e);
          }

          return {
            id: doc.id,
            filename: doc.filename,
            file_type: doc.file_type || doc.mimetype,
            content: doc.content, // Include raw content
            extractedInfo,
            metadata,
            summary_cache: doc.summary_cache, // Include cached summary
            summary_generated_at: doc.summary_generated_at,
            created_at: doc.uploaded_at || doc.created_at
          };
        });

        res.status(200).json(documentsWithParsedData);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
      }
      break;

    default:
      res.status(405).json({ error: 'Method not allowed' });
  }
}