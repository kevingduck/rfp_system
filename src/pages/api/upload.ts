import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { query } from '@/lib/pg-db';
import { parseDocument, extractKeyInformation } from '@/lib/document-parser';
import { DocumentSummarizer } from '@/lib/document-summarizer';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uploadDir = path.join(process.cwd(), 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    filter: function ({ mimetype }) {
      // Accept various document types including Excel
      const valid = mimetype && (
        mimetype.includes('pdf') ||
        mimetype.includes('msword') ||
        mimetype.includes('wordprocessingml') ||
        mimetype.includes('text') ||
        mimetype.includes('spreadsheet') ||
        mimetype.includes('excel') ||
        mimetype.includes('sheet')
      );
      return !!valid;
    }
  });

  try {
    const [fields, files] = await form.parse(req);
    const projectId = fields.projectId?.[0];
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!uploadedFile || !projectId) {
      return res.status(400).json({ error: 'Missing file or project ID' });
    }

    const documentId = uuidv4();
    const parsedDoc = await parseDocument(uploadedFile.filepath);
    const keyInfo = extractKeyInformation(parsedDoc.text);

    await query(
      `INSERT INTO documents (id, project_id, filename, file_type, filepath, file_path, mimetype, size, content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        documentId,
        projectId,
        uploadedFile.originalFilename,
        parsedDoc.metadata.fileType,
        uploadedFile.filepath,
        uploadedFile.filepath, // duplicate for compatibility
        uploadedFile.mimetype,
        uploadedFile.size,
        JSON.stringify({ text: parsedDoc.text, ...keyInfo }),
        JSON.stringify(parsedDoc.metadata)
      ]
    );

    // Get project type for summary generation
    const projectResult = await query(
      'SELECT project_type FROM projects WHERE id = $1',
      [projectId]
    );
    const projectType = projectResult.rows[0]?.project_type || 'RFP';

    // Generate summary automatically after upload
    try {
      const summarizer = new DocumentSummarizer();
      const summary = await summarizer.summarizeDocument(
        parsedDoc.text,
        uploadedFile.originalFilename || 'document',
        projectType as 'RFI' | 'RFP'
      );

      // Save the summary to the database
      await query(
        `UPDATE documents 
         SET summary_cache = $1, summary_generated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(summary), documentId]
      );

      console.log(`[Upload] Generated and cached summary for document ${documentId}`);
    } catch (error) {
      console.error('[Upload] Failed to generate summary:', error);
      // Don't fail the upload if summary generation fails
    }

    res.status(200).json({
      id: documentId,
      filename: uploadedFile.originalFilename,
      extractedInfo: keyInfo,
      metadata: parsedDoc.metadata
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process upload' });
  }
}