import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import { AIService } from '@/lib/ai-service';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { questions, documentIds, includeCompanyKnowledge } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Invalid questions data' });
  }

  try {
    console.log(`[Fill Answers] Processing ${questions.length} questions with ${documentIds.length} documents`);
    
    // Get full document content for the supporting documents
    const documentsResult = await query(
      'SELECT * FROM documents WHERE id = ANY($1)',
      [documentIds]
    );
    const fullDocuments = documentsResult.rows;
    
    // Get company knowledge if requested
    let companyKnowledge = [];
    if (includeCompanyKnowledge) {
      const knowledgeResult = await query(
        'SELECT * FROM company_knowledge ORDER BY uploaded_at DESC',
        []
      );
      companyKnowledge = knowledgeResult.rows;
      console.log(`[Fill Answers] Including ${companyKnowledge.length} company knowledge documents`);
    }
    
    // Get company information
    const companyInfoResult = await query(
      'SELECT * FROM company_info ORDER BY updated_at DESC LIMIT 1',
      []
    );
    const companyInfo = companyInfoResult.rows[0];
    
    // Combine all documents including company info
    const allDocuments = [
      // Add company info as a special document if it exists
      ...(companyInfo ? [{
        filename: 'Company Information',
        content: JSON.stringify({
          name: companyInfo.name,
          description: companyInfo.description,
          services: companyInfo.services,
          address: companyInfo.address,
          website: companyInfo.website,
          contacts: companyInfo.contacts,
          certifications: companyInfo.certifications,
          differentiators: companyInfo.differentiators,
          past_projects: companyInfo.past_projects
        }, null, 2),
        metadata: { type: 'company_info' }
      }] : []),
      ...fullDocuments.map(doc => ({
        filename: doc.filename,
        content: doc.extracted_text || doc.content || '',
        metadata: doc.metadata
      })),
      ...companyKnowledge.map(kb => ({
        filename: `${kb.filename} (Company Knowledge: ${kb.category})`,
        content: kb.content || '',
        metadata: kb.metadata
      }))
    ];
    
    // Use AI to analyze documents and generate answers
    const aiService = new AIService();
    const filledAnswers = await aiService.generateAnswersFromDocuments({
      questions: questions.map((q: any) => ({
        id: q.id,
        text: q.text
      })),
      documents: allDocuments
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