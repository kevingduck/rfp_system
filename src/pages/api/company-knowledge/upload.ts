import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/pg-db';
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
    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
    } catch (dirError) {
      console.error('Error creating uploads directory:', dirError);
      return res.status(500).json({ error: 'Failed to create uploads directory' });
    }

    // Generate unique filename
    const ext = path.extname(file.originalFilename || '');
    const filename = `${category}_${uuidv4()}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // Move file to final location
    try {
      fs.renameSync(file.filepath, filepath);
    } catch (moveError) {
      console.error('Error moving file:', moveError);
      return res.status(500).json({ error: 'Failed to save uploaded file' });
    }

    // Parse document content
    let content = '';
    let metadata = {};
    
    try {
      const parsed = await parseDocument(filepath);
      content = parsed.text;
      metadata = parsed.metadata || {};
    } catch (parseError) {
      console.error('Error parsing document:', parseError);
      // Continue without content - file is still saved
    }

    // Save to database
    const id = uuidv4();
    const result = await query(`
      INSERT INTO company_knowledge (id, category, filename, original_filename, content, metadata, file_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      id,
      category,
      filename,
      file.originalFilename || 'unknown',
      content,
      JSON.stringify(metadata),
      file.mimetype || 'application/octet-stream'
    ]);

    res.status(200).json({ 
      success: true, 
      id: id,
      filename: filename,
      original_filename: file.originalFilename
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
}