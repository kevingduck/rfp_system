import type { NextApiRequest, NextApiResponse } from 'next';
import { Form470ResponseGenerator } from '@/lib/form470-response-generator';
import { AIService } from '@/lib/ai-service';
import { query } from '@/lib/pg-db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  try {
    console.log(`[API] Starting Form 470 response generation for project ${id}`);

    // Get project details
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    if (project.project_type !== 'FORM_470') {
      return res.status(400).json({ error: 'Project is not a Form 470' });
    }

    // Initialize the generator
    const generator = new Form470ResponseGenerator(id);

    // Get chat context from request
    const chatContext = req.body.chatContext || null;

    // Generate the Form 470 response
    const docBuffer = await generator.generateForm470Response(chatContext);

    // Save the generated document
    const exportsDir = path.join(process.cwd(), 'exports');
    await fs.mkdir(exportsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Form470_Response_${project.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.docx`;
    const filepath = path.join(exportsDir, filename);

    await fs.writeFile(filepath, docBuffer);

    // Save draft to database
    const draftId = uuidv4();
    await query(
      `INSERT INTO drafts (id, project_id, content, format, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        draftId,
        id,
        'Form 470 Response Generated',
        'docx',
        JSON.stringify({
          filename,
          filepath,
          generatedAt: new Date().toISOString(),
          projectType: 'FORM_470',
          chatContext: chatContext
        })
      ]
    );

    console.log(`[API] Form 470 response generated successfully: ${filename}`);

    res.status(200).json({
      success: true,
      filename,
      downloadUrl: `/api/projects/${id}/export-draft?filename=${encodeURIComponent(filename)}`,
      draftId
    });

  } catch (error) {
    console.error('[API] Error generating Form 470 response:', error);
    res.status(500).json({
      error: 'Failed to generate Form 470 response',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}