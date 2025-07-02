import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { openDb } from '@/lib/db';
import { parseDocument } from '@/lib/document-parser';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = await openDb();
  const form = formidable({ 
    uploadDir: path.join(process.cwd(), 'uploads'),
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024, // 50MB
  });

  try {
    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const category = Array.isArray(fields.category) ? fields.category[0] : fields.category;

    if (!file || !category) {
      return res.status(400).json({ error: 'File and category are required' });
    }

    // Validate category
    const validCategories = ['won_proposals', 'sow', 'k12_erate', 'engineering', 'project_plans', 'legal', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'knowledge');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(file.originalFilename || '');
    const filename = `${category}_${uuidv4()}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // Move file to final location
    fs.renameSync(file.filepath, filepath);

    // Parse document content
    let content = '';
    let metadata = {};
    
    try {
      const parsed = await parseDocument(filepath, file.mimetype || '');
      content = parsed.content;
      metadata = parsed.metadata || {};
    } catch (parseError) {
      console.error('Error parsing document:', parseError);
      // Continue without content - file is still saved
    }

    // Save to database
    const result = await db.run(`
      INSERT INTO company_knowledge (category, filename, original_filename, content, metadata, file_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      category,
      filename,
      file.originalFilename || 'unknown',
      content,
      JSON.stringify(metadata),
      file.mimetype || 'application/octet-stream'
    ]);

    res.status(200).json({ 
      success: true, 
      id: result.lastID,
      filename: filename,
      original_filename: file.originalFilename
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
}