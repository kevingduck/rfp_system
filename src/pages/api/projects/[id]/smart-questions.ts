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
    
    // Get uploaded documents - find the main RFI/RFP document
    const documentsResult = await query(
      'SELECT * FROM documents WHERE project_id = $1 ORDER BY uploaded_at ASC',
      [id]
    );
    const documents = documentsResult.rows;
    
    if (documents.length === 0) {
      return res.status(400).json({ error: 'No documents uploaded. Please upload the RFI/RFP document first.' });
    }
    
    // Find the main RFI/RFP document (first uploaded or contains RFI/RFP in filename)
    let mainDocument = documents.find(doc => 
      doc.filename?.toLowerCase().includes('rfi') || 
      doc.filename?.toLowerCase().includes('rfp')
    ) || documents[0]; // Default to first document if no RFI/RFP in filename
    
    console.log(`[Smart Questions] Processing main document: ${mainDocument.filename}`);
    
    // Get company knowledge for answer generation
    const knowledgeResult = await query(
      'SELECT * FROM company_knowledge ORDER BY uploaded_at DESC',
      []
    );
    const companyKnowledge = knowledgeResult.rows;

    // Generate smart questions with answers using AI - only from main document
    const aiService = new AIService();
    const smartQuestions = await aiService.extractQuestionsWithAnswers({
      projectName: project.name,
      documents: [mainDocument], // Only process the main RFI/RFP document
      companyKnowledge,
      industry: 'VoIP/Telecommunications'
    });
    
    // Add questions to database
    for (const question of smartQuestions) {
      const questionId = require('uuid').v4();
      await query(
        `INSERT INTO rfi_questions (id, project_id, question_text, question_type, required, order_index, category, answer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          questionId,
          id,
          question.question,
          'text',
          question.priority >= 4 ? 1 : 0,
          smartQuestions.indexOf(question),
          question.category,
          question.answer || null
        ]
      );
    }
    
    res.status(200).json({
      success: true,
      questionsAdded: smartQuestions.length,
      questions: smartQuestions,
      sourceDocument: mainDocument.filename,
      message: `Extracted ${smartQuestions.length} questions from ${mainDocument.filename} and generated answers based on your company knowledge.`
    });
  } catch (error) {
    console.error('Smart questions generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to generate smart questions',
      details: errorMessage,
      hint: 'Make sure you have uploaded an RFI/RFP document and have company knowledge configured.'
    });
  }
}