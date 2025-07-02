import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/pg-db';
import { AIService } from '@/lib/ai-service';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { chatContext } = req.body || {};

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  // Set up SSE headers for real-time progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  
  // Validate environment variables
  if (!process.env.ANTHROPIC_API_KEY || !process.env.GROQ_API_KEY) {
    res.write(`data: ${JSON.stringify({ error: 'API configuration error: Missing required API keys' })}\n\n`);
    res.end();
    return;
  }
  
  // Send initial connection message
  res.write(':ok\n\n');

  const sendProgress = (message: string, progress?: number) => {
    const data = { message, progress };
    console.log('[Generate Draft] Sending progress:', data);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Force flush the response
    if ((res as any).flush) (res as any).flush();
  };

  try {
    sendProgress('Collecting resources...', 10);
    
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    const project = projectResult.rows[0];

    if (!project) {
      res.write(`data: ${JSON.stringify({ error: 'Project not found' })}\n\n`);
      res.end();
      return;
    }

    sendProgress('Collecting documents and sources...', 20);

    const [documentsResult, webSourcesResult, organizationResult, companyInfoResult] = await Promise.all([
      query('SELECT *, summary_cache, summary_generated_at FROM documents WHERE project_id = $1', [id]),
      query('SELECT *, summary_cache, summary_generated_at FROM web_sources WHERE project_id = $1', [id]),
      query('SELECT * FROM organizations WHERE id = $1', [project.organization_id]),
      query('SELECT * FROM company_info LIMIT 1')
    ]);
    const documents = documentsResult.rows;
    const webSources = webSourcesResult.rows;
    const organization = organizationResult.rows[0];
    const companyInfo = companyInfoResult.rows[0];

    sendProgress('Analyzing knowledge base...', 30);

    // Fetch knowledge base with cached summaries
    const knowledgeFilesResult = await query('SELECT *, summary_cache, summary_generated_at FROM company_knowledge');
    const knowledgeFiles = knowledgeFilesResult.rows;
    console.log(`[Generate Draft] Found ${knowledgeFiles.length} knowledge base files`);
    
    const knowledgeBase: any = {};
    for (const file of knowledgeFiles) {
      if (!knowledgeBase[file.category]) {
        knowledgeBase[file.category] = [];
      }
      knowledgeBase[file.category].push({
        filename: file.original_filename,
        content: file.content || '',
        metadata: {
          summary_cache: file.summary_cache,
          summary_generated_at: file.summary_generated_at
        }
      });
    }
    
    // Log knowledge base categories
    const kbSummary = Object.entries(knowledgeBase)
      .map(([cat, files]: [string, any]) => `${cat}: ${files.length} files`)
      .join(', ');
    console.log(`[Generate Draft] Knowledge base loaded: ${kbSummary || 'Empty'}`);
    sendProgress(`Knowledge base loaded: ${kbSummary || 'No files yet'}`, 35);

    sendProgress(`Analyzing ${documents.length} documents and ${webSources.length} web sources...`, 40);

    const aiService = new AIService();
    
    // Generate content based on project type
    let content;
    if (project.project_type === 'RFI') {
      const rfiQuestionsResult = await query(
        'SELECT * FROM rfi_questions WHERE project_id = $1 ORDER BY category, order_index',
        [id]
      );
      const rfiQuestions = rfiQuestionsResult.rows;

      sendProgress('Summarizing documents...', 50);
      
      // Create a progress callback that sends SSE updates
      const progressCallback = (message: string, progress: number) => {
        sendProgress(message, progress);
      };

      content = await aiService.generateRFIContent({
        projectType: 'RFI',
        projectName: project.name,
        organizationName: organization?.name || 'Your Organization',
        documents: documents.map(doc => ({
          filename: doc.filename,
          content: doc.content,
          metadata: {
            ...doc.metadata,
            summary_cache: doc.summary_cache,
            summary_generated_at: doc.summary_generated_at
          }
        })),
        webSources: webSources.map(source => ({
          url: source.url,
          title: source.title,
          content: source.content,
          metadata: {
            summary_cache: source.summary_cache,
            summary_generated_at: source.summary_generated_at
          }
        })),
        companyInfo,
        rfiQuestions,
        chatContext,
        knowledgeBase
      }, progressCallback);
    } else {
      sendProgress('Summarizing documents...', 50);
      
      // Create a progress callback that sends SSE updates
      const progressCallback = (message: string, progress: number) => {
        sendProgress(message, progress);
      };

      content = await aiService.generateRFPContent({
        projectType: 'RFP',
        projectName: project.name,
        organizationName: organization?.name || 'Your Organization',
        documents: documents.map(doc => ({
          filename: doc.filename,
          content: doc.content,
          metadata: {
            ...doc.metadata,
            summary_cache: doc.summary_cache,
            summary_generated_at: doc.summary_generated_at
          }
        })),
        webSources: webSources.map(source => ({
          url: source.url,
          title: source.title,
          content: source.content,
          metadata: {
            summary_cache: source.summary_cache,
            summary_generated_at: source.summary_generated_at
          }
        })),
        companyInfo,
        chatContext,
        knowledgeBase
      }, progressCallback);
    }

    sendProgress('Formatting document...', 90);

    // Prepare draft data with metadata
    const draftData = {
      projectId: id,
      projectName: project.name,
      projectType: project.project_type,
      organizationName: organization?.name || 'Unknown',
      generatedAt: new Date().toISOString(),
      sections: content,
      metadata: {
        documentsUsed: documents.map(d => ({ id: d.id, filename: d.filename })),
        webSourcesUsed: webSources.map(w => ({ id: w.id, url: w.url, title: w.title })),
        knowledgeBaseUsed: Object.keys(knowledgeBase).map(cat => ({
          category: cat,
          count: knowledgeBase[cat].length
        })),
        chatContext: chatContext || null
      }
    };

    // Save draft to database
    // First check if a draft exists for this project
    const existingDraftResult = await query(
      'SELECT id FROM drafts WHERE project_id = $1',
      [id]
    );
    const existingDraft = existingDraftResult.rows[0];
    
    if (existingDraft) {
      // Update existing draft
      await query(
        `UPDATE drafts 
         SET content = $1, metadata = $2, updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $3`,
        [JSON.stringify(draftData.sections), JSON.stringify(draftData.metadata), id]
      );
    } else {
      // Create new draft
      const draftId = uuidv4();
      await query(
        `INSERT INTO drafts (id, project_id, content, metadata)
         VALUES ($1, $2, $3, $4)`,
        [draftId, id, JSON.stringify(draftData.sections), JSON.stringify(draftData.metadata)]
      );
    }

    sendProgress('Draft generated successfully!', 100);

    // Send the final draft data
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      draft: draftData 
    })}\n\n`);
    
    res.end();

  } catch (error) {
    console.error('Draft generation error:', error);
    res.write(`data: ${JSON.stringify({ 
      error: 'Failed to generate draft',
      details: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
    res.end();
  }
}