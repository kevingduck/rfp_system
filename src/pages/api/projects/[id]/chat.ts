import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import { AIService } from '@/lib/ai-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { message, context } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get project details
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    const project = projectResult.rows[0];

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get current draft if exists
    let currentDraft = null;
    const draftResult = await query(
      'SELECT * FROM drafts WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    if (draftResult.rows.length > 0) {
      currentDraft = {
        content: JSON.parse(draftResult.rows[0].content),
        metadata: JSON.parse(draftResult.rows[0].metadata || '{}')
      };
    }

    // Get documents and questions for context
    const documentsResult = await query(
      'SELECT * FROM documents WHERE project_id = $1',
      [id]
    );
    const documents = documentsResult.rows;

    const questionsResult = await query(
      'SELECT * FROM rfi_questions WHERE project_id = $1',
      [id]
    );
    const questions = questionsResult.rows;

    // Get company info
    const companyInfoResult = await query(
      'SELECT * FROM company_info LIMIT 1',
      []
    );
    const companyInfo = companyInfoResult.rows[0];

    // Initialize AI service
    const aiService = new AIService();

    // Process the chat message
    const response = await aiService.processChatMessage({
      message,
      context: {
        projectType: project.project_type,
        projectName: project.name,
        hasDocuments: documents.length > 0,
        documentCount: documents.length,
        hasDraft: currentDraft !== null,
        draftSections: currentDraft ? Object.keys(currentDraft.content) : [],
        currentDraftContent: currentDraft?.content,
        questionCount: questions.length,
        answeredQuestions: questions.filter(q => q.answer).length,
        companyInfo,
        ...context // Include any additional context from frontend
      }
    });

    // Handle different action types
    if (response.action) {
      switch (response.action.type) {
        case 'update_draft':
          if (currentDraft && response.action.data.sections) {
            // Update the draft in the database
            const updatedSections = response.action.data.sections;

            // Get the draft ID
            const draftId = draftResult.rows[0].id;
            const currentVersion = draftResult.rows[0].current_version || 1;
            const newVersion = currentVersion + 1;

            // Create a new revision
            await query(
              `INSERT INTO draft_revisions (id, draft_id, project_id, version_number, content, metadata, created_by)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
              [
                draftId,
                id,
                newVersion,
                JSON.stringify(updatedSections),
                JSON.stringify({
                  ...currentDraft.metadata,
                  editedViaChat: true,
                  editMessage: message
                }),
                null
              ]
            );

            // Update the main draft
            await query(
              `UPDATE drafts
               SET content = $1, current_version = $2, updated_at = CURRENT_TIMESTAMP
               WHERE id = $3`,
              [JSON.stringify(updatedSections), newVersion, draftId]
            );

            response.action.data.version = newVersion;
          }
          break;

        case 'generate_draft':
          // Trigger draft generation
          response.action.data.triggerGeneration = true;
          break;

        case 'extract_questions':
          // Trigger question extraction
          response.action.data.triggerExtraction = true;
          break;
      }
    }

    res.status(200).json({
      success: true,
      response: response.message,
      action: response.action,
      suggestions: response.suggestions
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}