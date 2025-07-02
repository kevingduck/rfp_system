import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import { AIService } from '@/lib/ai-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    // Get project info
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    const project = projectResult.rows[0];
    
    if (!project || project.project_type !== 'RFI') {
      return res.status(400).json({ error: 'Invalid RFI project' });
    }
    
    // Get uploaded documents
    const documentsResult = await query(
      'SELECT * FROM documents WHERE project_id = $1',
      [id]
    );
    const documents = documentsResult.rows;
    
    // Generate smart questions using AI
    const aiService = new AIService();
    const smartQuestions = await aiService.generateSmartQuestions({
      projectName: project.name,
      documents,
      industry: 'VoIP/Telecommunications'
    });
    
    // Add questions to database
    for (const question of smartQuestions) {
      const questionId = require('uuid').v4();
      await query(
        `INSERT INTO rfi_questions (id, project_id, question_text, question_type, required, order_index, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          questionId,
          id,
          question.question,
          'text',
          question.priority >= 4 ? 1 : 0,
          smartQuestions.indexOf(question),
          question.category
        ]
      );
    }
    
    res.status(200).json({
      success: true,
      questionsAdded: smartQuestions.length,
      questions: smartQuestions
    });
  } catch (error) {
    console.error('Smart questions generation error:', error);
    res.status(500).json({ error: 'Failed to generate smart questions' });
  }
}