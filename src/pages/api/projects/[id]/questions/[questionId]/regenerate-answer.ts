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

  const { id, questionId } = req.query;
  const { documentIds, includeCompanyKnowledge = true } = req.body;

  if (!id || !questionId || typeof id !== 'string' || typeof questionId !== 'string') {
    return res.status(400).json({ error: 'Invalid project or question ID' });
  }

  try {
    // Get the question
    const questionResult = await query(
      'SELECT * FROM rfi_questions WHERE id = $1 AND project_id = $2',
      [questionId, id]
    );
    const question = questionResult.rows[0];
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Get specified documents or all documents if none specified
    let fullDocuments = [];
    if (documentIds && documentIds.length > 0) {
      const documentsResult = await query(
        'SELECT * FROM documents WHERE id = ANY($1) AND project_id = $2',
        [documentIds, id]
      );
      fullDocuments = documentsResult.rows;
    } else {
      // Get all project documents
      const documentsResult = await query(
        'SELECT * FROM documents WHERE project_id = $1',
        [id]
      );
      fullDocuments = documentsResult.rows;
    }
    
    // Get company knowledge if requested
    let companyKnowledge = [];
    if (includeCompanyKnowledge) {
      const knowledgeResult = await query(
        'SELECT * FROM company_knowledge ORDER BY uploaded_at DESC',
        []
      );
      companyKnowledge = knowledgeResult.rows;
    }
    
    // Get company information
    const companyInfoResult = await query(
      'SELECT * FROM company_info ORDER BY updated_at DESC LIMIT 1',
      []
    );
    const companyInfo = companyInfoResult.rows[0];
    
    // Combine all documents
    const allDocuments = [
      // Add company info as a special document if it exists
      ...(companyInfo ? [{
        filename: 'Company Information',
        content: JSON.stringify({
          name: companyInfo.company_name,
          description: companyInfo.description,
          services: companyInfo.services,
          capabilities: companyInfo.capabilities,
          differentiators: companyInfo.differentiators,
          experience: companyInfo.experience,
          certifications: companyInfo.certifications,
          team_size: companyInfo.team_size,
          website: companyInfo.website,
          email: companyInfo.email,
          phone: companyInfo.phone,
          address: companyInfo.address
        }, null, 2),
        metadata: { type: 'company_info' }
      }] : []),
      ...fullDocuments.map(doc => {
        let docContent = '';
        if (doc.summary_cache) {
          try {
            const summary = JSON.parse(doc.summary_cache);
            docContent = `Summary: ${summary.fullSummary}\n\nKey Points:\n${summary.keyPoints?.join('\n- ') || 'N/A'}`;
            if (summary.extractedData) {
              docContent += '\n\nExtracted Information:\n' + Object.entries(summary.extractedData)
                .filter(([_, value]) => value)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
            }
          } catch (e) {
            const parsedContent = doc.content ? JSON.parse(doc.content) : {};
            docContent = parsedContent.text || doc.content || '';
          }
        } else {
          try {
            const parsedContent = doc.content ? JSON.parse(doc.content) : {};
            docContent = parsedContent.text || doc.content || '';
          } catch (e) {
            docContent = doc.content || '';
          }
        }
        
        return {
          filename: doc.filename,
          content: docContent,
          metadata: doc.metadata
        };
      }),
      ...companyKnowledge.map(kb => {
        let kbContent = '';
        if (kb.summary_cache) {
          try {
            const summary = JSON.parse(kb.summary_cache);
            kbContent = `Summary: ${summary.fullSummary}\n\nKey Points:\n${summary.keyPoints?.join('\n- ') || 'N/A'}`;
          } catch (e) {
            kbContent = kb.content || '';
          }
        } else {
          kbContent = kb.content || '';
        }
        
        return {
          filename: `${kb.filename} (Company Knowledge: ${kb.category})`,
          content: kbContent,
          metadata: kb.metadata
        };
      })
    ];
    
    console.log(`[Regenerate Answer] Using ${allDocuments.length} documents for question: "${question.question_text}"`);
    
    // Use AI to generate answer
    const aiService = new AIService();
    const filledAnswers = await aiService.generateAnswersFromDocuments({
      questions: [{
        id: question.id,
        text: question.question_text
      }],
      documents: allDocuments
    });
    
    if (filledAnswers.length > 0) {
      const newAnswer = filledAnswers[0].answer;
      
      // Update the question with the new answer
      await query(
        'UPDATE rfi_questions SET answer = $1 WHERE id = $2',
        [newAnswer, questionId]
      );
      
      res.status(200).json({
        success: true,
        answer: newAnswer,
        documentsUsed: fullDocuments.length,
        knowledgeDocsUsed: companyKnowledge.length
      });
    } else {
      res.status(500).json({ error: 'Failed to generate answer' });
    }
  } catch (error) {
    console.error('Failed to regenerate answer:', error);
    res.status(500).json({ 
      error: 'Failed to regenerate answer',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}