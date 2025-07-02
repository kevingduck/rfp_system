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
          
          try {
            const content = JSON.parse(doc.content);
            // Extract key information from content
            extractedInfo = {
              scope: content.scope,
              requirements: content.requirements,
              timeline: content.timeline,
              budget: content.budget,
              deliverables: content.deliverables,
              text: content.text
            };
          } catch (e) {
            console.error('Failed to parse document content:', e);
          }
          
          try {
            metadata = JSON.parse(doc.metadata);
          } catch (e) {
            console.error('Failed to parse document metadata:', e);
          }

          return {
            id: doc.id,
            filename: doc.filename,
            file_type: doc.file_type || doc.mimetype,
            extractedInfo,
            metadata,
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