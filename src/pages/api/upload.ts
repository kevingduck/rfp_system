import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { query } from '@/lib/pg-db';
import { parseDocument, extractKeyInformation } from '@/lib/document-parser';

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