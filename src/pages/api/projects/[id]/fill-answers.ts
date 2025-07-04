import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import { AIService } from '@/lib/ai-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { questions, documents } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Invalid questions data' });
  }

  try {
    console.log(`[Fill Answers] Processing ${questions.length} questions with ${documents.length} supporting documents`);
    
    // Get full document content for the supporting documents
    const docIds = documents.map((d: any) => d.id);
    const documentsResult = await query(
      'SELECT * FROM documents WHERE id = ANY($1)',
      [docIds]
    );
    const fullDocuments = documentsResult.rows;
    
    // Use AI to analyze documents and generate answers
    const aiService = new AIService();
    const filledAnswers = await aiService.generateAnswersFromDocuments({
      questions: questions.map((q: any) => ({
        id: q.id,
        text: q.text
      })),
      documents: fullDocuments.map(doc => ({
        filename: doc.filename,
        content: doc.extracted_text || doc.content || '',
        metadata: doc.metadata
      }))
    });
    
    // Update each question with its generated answer
    for (const answer of filledAnswers) {
      await query(
        'UPDATE rfi_questions SET answer = $1 WHERE id = $2',
        [answer.answer, answer.questionId]
      );
    }
    
    res.status(200).json({
      success: true,
      answersUpdated: filledAnswers.length
    });
  } catch (error) {
    console.error('Failed to fill answers:', error);
    res.status(500).json({ 
      error: 'Failed to auto-fill answers',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}