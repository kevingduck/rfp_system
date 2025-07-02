import type { NextApiRequest, NextApiResponse } from 'next';
import { openDb } from '@/lib/db';
import { AIService } from '@/lib/ai-service';

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
    const db = await openDb();
    
    sendProgress('Collecting resources...', 10);
    
    const project = await db.get(
      'SELECT * FROM projects WHERE id = ?',
      id
    );

    if (!project) {
      res.write(`data: ${JSON.stringify({ error: 'Project not found' })}\n\n`);
      res.end();
      return;
    }

    sendProgress('Collecting documents and sources...', 20);

    const [documents, webSources, organization, companyInfo] = await Promise.all([
      db.all('SELECT *, summary_cache, summary_generated_at FROM documents WHERE project_id = ?', id),
      db.all('SELECT *, summary_cache, summary_generated_at FROM web_sources WHERE project_id = ?', id),
      db.get('SELECT * FROM organizations WHERE id = ?', project.organization_id),
      db.get('SELECT * FROM company_info LIMIT 1')
    ]);

    sendProgress('Analyzing knowledge base...', 30);

    // Fetch knowledge base with cached summaries
    const knowledgeFiles = await db.all('SELECT *, summary_cache, summary_generated_at FROM company_knowledge');
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
      const rfiQuestions = await db.all(
        'SELECT * FROM rfi_questions WHERE project_id = ? ORDER BY category, order_index',
        id
      );

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
    await db.run(
      `INSERT OR REPLACE INTO drafts (project_id, content, metadata, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [id, JSON.stringify(draftData.sections), JSON.stringify(draftData.metadata)]
    );

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