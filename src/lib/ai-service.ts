import Anthropic from '@anthropic-ai/sdk';
import { query } from './pg-db';
import { DocumentSummarizer, DocumentSummary } from './document-summarizer';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface DocumentContext {
  projectType: 'RFI' | 'RFP';
  projectName: string;
  organizationName: string;
  documents: Array<{
    filename: string;
    content: any;
    metadata: any;
  }>;
  webSources: Array<{
    url: string;
    title: string;
    content: string;
    metadata?: {
      summary_cache?: string;
    };
  }>;
  companyInfo?: any;
  rfiQuestions?: Array<{
    question_text: string;
    category?: string;
    required: boolean;
  }>;
  chatContext?: {
    responses: Array<{
      question: string;
      answer: string;
      category: string;
    }>;
  };
  knowledgeBase?: {
    won_proposals?: Array<{ filename: string; content: string; metadata?: { summary_cache?: string; }; }>;
    sow?: Array<{ filename: string; content: string; metadata?: { summary_cache?: string; }; }>;
    k12_erate?: Array<{ filename: string; content: string; metadata?: { summary_cache?: string; }; }>;
    engineering?: Array<{ filename: string; content: string; metadata?: { summary_cache?: string; }; }>;
    project_plans?: Array<{ filename: string; content: string; metadata?: { summary_cache?: string; }; }>;
    legal?: Array<{ filename: string; content: string; metadata?: { summary_cache?: string; }; }>;
  };
  targetLength?: number;
}

export class AIService {
  private summarizer: DocumentSummarizer;
  
  constructor() {
    this.summarizer = new DocumentSummarizer();
  }
  
  private async cacheSummary(type: 'document' | 'web_source' | 'knowledge', identifier: string, summary: DocumentSummary): Promise<void> {
    try {
      const summaryJson = JSON.stringify(summary);
      const now = new Date().toISOString();
      
      if (type === 'document') {
        await query(
          'UPDATE documents SET summary_cache = $1, summary_generated_at = $2 WHERE filename = $3',
          [summaryJson, now, identifier]
        );
      } else if (type === 'web_source') {
        await query(
          'UPDATE web_sources SET summary_cache = $1, summary_generated_at = $2 WHERE url = $3',
          [summaryJson, now, identifier]
        );
      } else if (type === 'knowledge') {
        await query(
          'UPDATE company_knowledge SET summary_cache = $1, summary_generated_at = $2 WHERE original_filename = $3',
          [summaryJson, now, identifier]
        );
      }
      
      console.log(`[AIService] Cached summary for ${type}: ${identifier}`);
    } catch (error) {
      console.error(`[AIService] Failed to cache summary for ${identifier}:`, error);
    }
  }
  
  async generateRFIContent(context: DocumentContext, onProgress?: (message: string, progress: number) => void): Promise<Record<string, string>> {
    console.log(`[AIService] Starting RFI generation for ${context.projectName}`);
    console.log(`[AIService] Processing ${context.documents.length} documents and ${context.webSources.length} web sources`);
    
    if (onProgress) onProgress('Building AI prompt...', 65);
    
    const prompt = await this.buildRFIPrompt(context, onProgress);
    console.log(`[AIService] Prompt built, length: ${prompt.length} chars`);
    
    if (onProgress) onProgress('Sending to AI for generation...', 75);
    
    try {
      console.log(`[AIService] Sending to Claude Opus 3 for content generation...`);
      const startTime = Date.now();
      
      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        temperature: 0.1, // Near-deterministic for factual accuracy
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const duration = Date.now() - startTime;
      console.log(`[AIService] Claude Opus 3 responded in ${duration}ms`);
      
      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log(`[AIService] Raw AI response preview: ${content.substring(0, 200)}...`);
      
      // Check if the AI returned redacted content
      if (content.includes('[Content Redacted]') || content.includes('Content Redacted')) {
        console.error('[AIService] AI returned redacted content! This may be due to safety filters.');
        console.log('[AIService] Full response:', content);
      }
      
      const sections = this.parseAIResponse(content);
      console.log(`[AIService] Generated ${Object.keys(sections).length} sections`);
      
      // Build valid sources list for validation
      const validSources: string[] = [];
      context.documents.forEach(doc => validSources.push(doc.filename));
      context.webSources.forEach(source => validSources.push(`${source.title} (${source.url})`));
      if (context.knowledgeBase) {
        Object.entries(context.knowledgeBase).forEach(([category, files]) => {
          if (Array.isArray(files)) {
            files.forEach((file: any) => {
              validSources.push(`${file.filename} (Knowledge Base: ${category})`);
            });
          }
        });
      }
      if (context.companyInfo) {
        validSources.push('Company Settings');
      }
      
      // Validate citations in each section
      for (const [sectionName, sectionContent] of Object.entries(sections)) {
        sections[sectionName] = this.validateAndCleanCitations(sectionContent, validSources);
      }
      
      // Check if all sections are redacted
      const allRedacted = Object.values(sections).every(content => 
        content.includes('[Content Redacted]') || content.trim() === ''
      );
      
      if (allRedacted) {
        console.error('[AIService] All sections were redacted! Generating fallback content.');
        // Generate basic fallback content
        return this.generateFallbackContent(context, 'RFI');
      }
      
      return sections;
    } catch (error) {
      console.error('[AIService] AI generation error:', error);
      throw new Error('Failed to generate RFI content');
    }
  }

  async generateRFPContent(context: DocumentContext, onProgress?: (message: string, progress: number) => void): Promise<Record<string, string>> {
    console.log(`[AIService] Starting RFP generation for ${context.projectName}`);
    console.log(`[AIService] Processing ${context.documents.length} documents and ${context.webSources.length} web sources`);
    
    if (onProgress) onProgress('Building AI prompt...', 65);
    
    const prompt = await this.buildRFPPrompt(context, onProgress);
    console.log(`[AIService] Prompt built, length: ${prompt.length} chars`);
    
    if (onProgress) onProgress('Sending to AI for generation...', 75);
    
    try {
      console.log(`[AIService] Sending to Claude Opus 3 for content generation...`);
      const startTime = Date.now();
      
      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        temperature: 0.1, // Near-deterministic for factual accuracy
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const duration = Date.now() - startTime;
      console.log(`[AIService] Claude Opus 3 responded in ${duration}ms`);
      
      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log(`[AIService] Raw AI response preview: ${content.substring(0, 200)}...`);
      
      // Check if the AI returned redacted content
      if (content.includes('[Content Redacted]') || content.includes('Content Redacted')) {
        console.error('[AIService] AI returned redacted content! This may be due to safety filters.');
        console.log('[AIService] Full response:', content);
      }
      
      const sections = this.parseAIResponse(content);
      console.log(`[AIService] Generated ${Object.keys(sections).length} sections`);
      
      // Build valid sources list for validation
      const validSources: string[] = [];
      context.documents.forEach(doc => validSources.push(doc.filename));
      context.webSources.forEach(source => validSources.push(`${source.title} (${source.url})`));
      if (context.knowledgeBase) {
        Object.entries(context.knowledgeBase).forEach(([category, files]) => {
          if (Array.isArray(files)) {
            files.forEach((file: any) => {
              validSources.push(`${file.filename} (Knowledge Base: ${category})`);
            });
          }
        });
      }
      if (context.companyInfo) {
        validSources.push('Company Settings');
      }
      
      // Validate citations in each section
      for (const [sectionName, sectionContent] of Object.entries(sections)) {
        sections[sectionName] = this.validateAndCleanCitations(sectionContent, validSources);
      }
      
      // Check if all sections are redacted
      const allRedacted = Object.values(sections).every(content => 
        content.includes('[Content Redacted]') || content.trim() === ''
      );
      
      if (allRedacted) {
        console.error('[AIService] All sections were redacted! Generating fallback content.');
        // Generate basic fallback content
        return this.generateFallbackContent(context, 'RFP');
      }
      
      return sections;
    } catch (error) {
      console.error('[AIService] AI generation error:', error);
      throw new Error('Failed to generate RFP content');
    }
  }

  private async buildRFIPrompt(context: DocumentContext, onProgress?: (message: string, progress: number) => void): Promise<string> {
    let prompt = `You are helping create a comprehensive Request for Information (RFI) document for ${context.organizationName} regarding ${context.projectName}.

Based on the following context, generate professional, detailed content for each section of the RFI:

`;

    // Summarize documents if they exist
    if (context.documents.length > 0) {
      prompt += 'DOCUMENT SUMMARIES:\n';
      
      for (const doc of context.documents) {
        // Check if we have a cached summary
        if (doc.metadata?.summary_cache) {
          console.log(`[AIService] Using cached summary for ${doc.filename}`);
          const cachedSummary = JSON.parse(doc.metadata.summary_cache);
          prompt += `\nDocument: ${doc.filename}\n`;
          prompt += `Summary: ${cachedSummary.fullSummary}\n`;
          if (cachedSummary.keyPoints?.length > 0) {
            prompt += `Key Points: ${cachedSummary.keyPoints.join('; ')}\n`;
          }
        } else {
          // Generate and cache the summary
          console.log(`[AIService] Generating new summary for ${doc.filename}`);
          const summary = await this.summarizer.summarizeDocument(
            typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content),
            doc.filename,
            'RFI'
          );
          
          // Cache the summary
          await this.cacheSummary('document', doc.filename, summary);
          
          prompt += `\nDocument: ${doc.filename}\n`;
          prompt += `Summary: ${summary.fullSummary}\n`;
          if (summary.keyPoints.length > 0) {
            prompt += `Key Points: ${summary.keyPoints.join('; ')}\n`;
          }
        }
      }
    }

    // Add web sources
    if (context.webSources.length > 0) {
      prompt += '\nWEB SOURCES:\n';
      
      for (const source of context.webSources) {
        // Check if content needs summarization
        if (source.content.length > 2000) {
          // Check for cached summary in metadata
          if (source.metadata?.summary_cache) {
            console.log(`[AIService] Using cached summary for web source: ${source.url}`);
            const cachedSummary = JSON.parse(source.metadata.summary_cache);
            prompt += `\nSource: ${source.title} (${source.url})\n`;
            prompt += `Summary: ${cachedSummary.fullSummary}\n`;
            if (cachedSummary.keyPoints?.length > 0) {
              prompt += `Key Points: ${cachedSummary.keyPoints.join(', ')}\n`;
            }
          } else {
            // Generate and cache the summary
            console.log(`[AIService] Generating new summary for web source: ${source.url}`);
            const summary = await this.summarizer.summarizeDocument(source.content, source.title, 'RFI');
            
            // Cache the summary
            await this.cacheSummary('web_source', source.url, summary);
            
            prompt += `\nSource: ${source.title} (${source.url})\n`;
            prompt += `Summary: ${summary.fullSummary}\n`;
            if (summary.keyPoints.length > 0) {
              prompt += `Key Points: ${summary.keyPoints.join(', ')}\n`;
            }
          }
        } else {
          prompt += `\nSource: ${source.title} (${source.url})\n`;
          prompt += `Content: ${source.content}\n`;
        }
      }
    }

    // Add company info for RFI context
    if (context.companyInfo) {
      prompt += `\nOUR COMPANY INFO:\n`;
      prompt += `Company: ${context.companyInfo.company_name}\n`;
      
      if (context.companyInfo.description) {
        prompt += `About Us: ${context.companyInfo.description}\n`;
      }
      
      if (context.companyInfo.services) {
        prompt += `\nServices We Provide:\n${context.companyInfo.services}\n`;
      }
      
      if (context.companyInfo.capabilities) {
        prompt += `\nOur Technical Capabilities:\n${context.companyInfo.capabilities}\n`;
      }
    }

    // Add knowledge base content
    if (context.knowledgeBase) {
      console.log('[AIService] Adding knowledge base content to prompt...');
      prompt += `\nCOMPANY KNOWLEDGE BASE:\n`;
      
      if (context.knowledgeBase.won_proposals && context.knowledgeBase.won_proposals.length > 0) {
        console.log(`[AIService] Including ${context.knowledgeBase.won_proposals.length} winning proposals`);
        prompt += `\nWINNING PROPOSAL EXAMPLES:\n`;
        const proposals = context.knowledgeBase.won_proposals.slice(0, 3); // Use top 3 most relevant
        for (const proposal of proposals) {
          if (proposal.content && proposal.content.trim()) {
            // Check for cached summary
            if (proposal.metadata?.summary_cache) {
              console.log(`[AIService] Using cached summary for knowledge base: ${proposal.filename}`);
              const cachedSummary = JSON.parse(proposal.metadata.summary_cache);
              prompt += `\nFile: ${proposal.filename} (Knowledge Base: won_proposals)\n`;
              prompt += `Content Summary: ${cachedSummary.fullSummary}\n`;
              if (cachedSummary.keyPoints?.length > 0) {
                prompt += `Key Points: ${cachedSummary.keyPoints.join('; ')}\n`;
              }
            } else {
              console.log(`[AIService] Generating new summary for knowledge base: ${proposal.filename}`);
              const summary = await this.summarizer.summarizeDocument(proposal.content, proposal.filename, 'RFI');
              
              // Cache the summary
              await this.cacheSummary('knowledge', proposal.filename, summary);
              
              prompt += `\nFile: ${proposal.filename} (Knowledge Base: won_proposals)\n`;
              prompt += `Content Summary: ${summary.fullSummary}\n`;
              if (summary.keyPoints.length > 0) {
                prompt += `Key Points: ${summary.keyPoints.join('; ')}\n`;
              }
            }
          }
        }
      }

      if (context.knowledgeBase.sow && context.knowledgeBase.sow.length > 0) {
        console.log(`[AIService] Including ${context.knowledgeBase.sow.length} SOW documents`);
        prompt += `\nSTANDARD SCOPES OF WORK:\n`;
        for (const sow of context.knowledgeBase.sow.slice(0, 2)) {
          if (sow.content && sow.content.trim()) {
            const summary = await this.summarizer.summarizeDocument(sow.content, sow.filename, 'RFI');
            prompt += `\nFile: ${sow.filename} (Knowledge Base: sow)\n`;
            prompt += `Content: ${summary.fullSummary}\n`;
          }
        }
      }

      if (context.knowledgeBase.k12_erate && context.knowledgeBase.k12_erate.length > 0) {
        console.log(`[AIService] Including K-12/E-Rate expertise`);
        prompt += `\nK-12/E-RATE EXPERTISE:\n`;
        for (const doc of context.knowledgeBase.k12_erate.slice(0, 2)) {
          if (doc.content && doc.content.trim()) {
            prompt += `\nFile: ${doc.filename} (Knowledge Base: k12_erate)\n`;
            const summary = await this.summarizer.summarizeDocument(doc.content, doc.filename, 'RFI');
            prompt += `Content: ${summary.fullSummary}\n`;
          }
        }
      }

      if (context.knowledgeBase.engineering && context.knowledgeBase.engineering.length > 0) {
        console.log(`[AIService] Including ${context.knowledgeBase.engineering.length} engineering documents`);
        prompt += `\nTECHNICAL EXPERTISE:\n`;
        for (const doc of context.knowledgeBase.engineering.slice(0, 3)) {
          if (doc.content && doc.content.trim()) {
            prompt += `\nFile: ${doc.filename} (Knowledge Base: engineering)\n`;
            if (doc.content.length > 5000) {
              const summary = await this.summarizer.summarizeDocument(doc.content, doc.filename, 'RFI');
              prompt += `Content: ${summary.fullSummary}\n`;
            } else {
              prompt += `Content: ${doc.content}\n`;
            }
          }
        }
      }

      if (context.knowledgeBase.project_plans && context.knowledgeBase.project_plans.length > 0) {
        console.log(`[AIService] Including ${context.knowledgeBase.project_plans.length} project plans`);
        prompt += `\nPROJECT PLANNING:\n`;
        for (const doc of context.knowledgeBase.project_plans.slice(0, 2)) {
          if (doc.content && doc.content.trim()) {
            prompt += `\nFile: ${doc.filename} (Knowledge Base: project_plans)\n`;
            const summary = await this.summarizer.summarizeDocument(doc.content, doc.filename, 'RFI');
            prompt += `Content: ${summary.fullSummary}\n`;
          }
        }
      }

      if (context.knowledgeBase.legal && context.knowledgeBase.legal.length > 0) {
        console.log(`[AIService] Including ${context.knowledgeBase.legal.length} legal documents`);
        prompt += `\nLEGAL/CONTRACT TERMS:\n`;
        for (const doc of context.knowledgeBase.legal.slice(0, 1)) {
          if (doc.content && doc.content.trim()) {
            prompt += `\nFile: ${doc.filename} (Knowledge Base: legal)\n`;
            const summary = await this.summarizer.summarizeDocument(doc.content, doc.filename, 'RFI');
            prompt += `Key Terms: ${summary.fullSummary}\n`;
          }
        }
      }
    }

    // Add chat context if available
    if (context.chatContext && context.chatContext.responses.length > 0) {
      prompt += `\nUSER RESPONSES FROM WIZARD INTERVIEW:\n`;
      context.chatContext.responses.forEach(response => {
        prompt += `\nQ: ${response.question}\n`;
        prompt += `A: ${response.answer}\n`;
      });
      prompt += `\nIMPORTANT: Use these responses to make the RFI more targeted and specific to their needs.\n`;
    }

    // Add custom questions if any
    if (context.rfiQuestions && context.rfiQuestions.length > 0) {
      prompt += '\nCUSTOM QUESTIONS TO INCLUDE:\n';
      const categorizedQuestions = context.rfiQuestions.reduce((acc, q) => {
        const category = q.category || 'General';
        if (!acc[category]) acc[category] = [];
        acc[category].push(q.question_text);
        return acc;
      }, {} as Record<string, string[]>);
      
      Object.entries(categorizedQuestions).forEach(([category, questions]) => {
        prompt += `\n${category}:\n`;
        questions.forEach(q => prompt += `- ${q}\n`);
      });
    }

    // Build list of valid sources for citation
    const validSources: string[] = [];
    
    // Add uploaded documents
    if (context.documents.length > 0) {
      context.documents.forEach(doc => {
        validSources.push(doc.filename);
      });
    }
    
    // Add web sources
    if (context.webSources.length > 0) {
      context.webSources.forEach(source => {
        validSources.push(`${source.title} (${source.url})`);
      });
    }
    
    // Add knowledge base files
    if (context.knowledgeBase) {
      Object.entries(context.knowledgeBase).forEach(([category, files]) => {
        if (Array.isArray(files)) {
          files.forEach((file: any) => {
            validSources.push(`${file.filename} (Knowledge Base: ${category})`);
          });
        }
      });
    }
    
    // Add company info as a source
    if (context.companyInfo) {
      validSources.push('Company Settings');
    }

    prompt += `
You are an AI assistant helping to draft content for a business response document. This is for internal use to help structure ideas and content.

CONTEXT: The company "${context.companyInfo?.company_name || 'our company'}" is preparing draft content for responding to an RFI from ${context.organizationName}.

COMPANY INFORMATION TO USE:
${context.companyInfo ? `
- Company Name: ${context.companyInfo.company_name}
- Team Size: ${context.companyInfo.team_size || 'Not specified'}
- Years of Experience: ${context.companyInfo.experience || 'Not specified'}
- Description: ${context.companyInfo.description || 'Not specified'}
` : 'No company information provided'}

Please help generate DRAFT content for the following sections that could be used in preparing a response:

1. INTRODUCTION: Write a professional introduction acknowledging their RFI and expressing our interest in providing information about our solutions.

2. ORGANIZATION_BACKGROUND: Provide background about ${context.companyInfo?.company_name || 'our company'}, highlighting our expertise, market position, and why we're well-suited to address their needs. USE ONLY THE COMPANY FACTS PROVIDED ABOVE.

3. PROJECT_SCOPE: Demonstrate our understanding of their requirements and how our capabilities align with what they're seeking to accomplish.

4. INFORMATION_REQUESTED: Provide comprehensive responses to the information they've requested, including our capabilities, experience, technical specifications, and approach.

5. VENDOR_QUALIFICATIONS: Detail our qualifications, certifications, experience, and track record that make us a strong potential partner.

6. SUBMISSION_REQUIREMENTS: Confirm our compliance with their submission requirements and provide all requested documentation and information.

7. EVALUATION_CRITERIA: Address how we meet or exceed their evaluation criteria, highlighting our strengths in each area.

8. NEXT_STEPS: Express our readiness to move forward, provide additional information, participate in demos, or advance to the RFP stage.

Format your response as:
SECTION_NAME: [content]
SECTION_NAME: [content]
etc.

TARGET LENGTH: The final document should be approximately ${context.targetLength || 15} pages long. Adjust the detail level of each section accordingly:
- For shorter documents (5-10 pages): Be concise but comprehensive, focus on key points
- For medium documents (10-20 pages): Include more detail, examples, and explanations
- For longer documents (20-50 pages): Be thorough, include extensive detail, case studies, and comprehensive coverage

Make the content specific to VoIP/telecommunications based on the context provided. Be professional, comprehensive, and position us as the ideal vendor for their needs.

CITATION REQUIREMENT: 
1. ONLY cite sources that actually exist in the provided documents
2. Valid sources you can cite from:
${validSources.map(source => `   - ${source}`).join('\n')}

3. Format citations as: [Source: exact filename from above list]
4. DO NOT make up or invent source names
5. DO NOT cite documents that are not in the list above
6. If you cannot find a source for a claim, either don't make the claim or state it without a citation
7. When citing Company Settings, use [Source: Company Settings]

ANTI-HALLUCINATION RULES:
- DO NOT invent team sizes, years of experience, or other metrics not explicitly provided
- DO NOT create fictional case studies or client names
- DO NOT reference documents that don't exist in the valid sources list
- DO NOT make up statistics or numbers not found in the provided content
- If specific information is not available, use general statements instead of making up specifics`;

    return prompt;
  }

  private async buildRFPPrompt(context: DocumentContext, onProgress?: (message: string, progress: number) => void): Promise<string> {
    let prompt = `You are helping create a comprehensive Request for Proposal (RFP) document for ${context.organizationName} regarding ${context.projectName}.

Based on the following context, generate professional, detailed content for each section of the RFP:

`;

    // Summarize documents if they exist
    if (context.documents.length > 0) {
      prompt += 'DOCUMENT SUMMARIES:\n';
      
      for (const doc of context.documents) {
        // Check if we have a cached summary
        if (doc.metadata?.summary_cache) {
          console.log(`[AIService] Using cached summary for ${doc.filename}`);
          const cachedSummary = JSON.parse(doc.metadata.summary_cache);
          prompt += `\nDocument: ${doc.filename}\n`;
          prompt += `Summary: ${cachedSummary.fullSummary}\n`;
          if (cachedSummary.keyPoints?.length > 0) {
            prompt += `Key Points: ${cachedSummary.keyPoints.join('; ')}\n`;
          }
        } else {
          // Generate and cache the summary
          console.log(`[AIService] Generating new summary for ${doc.filename}`);
          const summary = await this.summarizer.summarizeDocument(
            typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content),
            doc.filename,
            'RFP'
          );
          
          // Cache the summary
          await this.cacheSummary('document', doc.filename, summary);
          
          prompt += `\nDocument: ${doc.filename}\n`;
          prompt += `Summary: ${summary.fullSummary}\n`;
          if (summary.keyPoints.length > 0) {
            prompt += `Key Points: ${summary.keyPoints.join('; ')}\n`;
          }
        }
      }
    }

    // Add web sources
    if (context.webSources.length > 0) {
      prompt += '\nWEB SOURCES:\n';
      
      for (const source of context.webSources) {
        // Check if content needs summarization
        if (source.content.length > 2000) {
          // Check for cached summary in metadata
          if (source.metadata?.summary_cache) {
            console.log(`[AIService] Using cached summary for web source: ${source.url}`);
            const cachedSummary = JSON.parse(source.metadata.summary_cache);
            prompt += `\nSource: ${source.title} (${source.url})\n`;
            prompt += `Summary: ${cachedSummary.fullSummary}\n`;
            if (cachedSummary.keyPoints?.length > 0) {
              prompt += `Key Points: ${cachedSummary.keyPoints.join(', ')}\n`;
            }
          } else {
            // Generate and cache the summary
            console.log(`[AIService] Generating new summary for web source: ${source.url}`);
            const summary = await this.summarizer.summarizeDocument(source.content, source.title, 'RFP');
            
            // Cache the summary
            await this.cacheSummary('web_source', source.url, summary);
            
            prompt += `\nSource: ${source.title} (${source.url})\n`;
            prompt += `Summary: ${summary.fullSummary}\n`;
            if (summary.keyPoints.length > 0) {
              prompt += `Key Points: ${summary.keyPoints.join(', ')}\n`;
            }
          }
        } else {
          prompt += `\nSource: ${source.title} (${source.url})\n`;
          prompt += `Content: ${source.content}\n`;
        }
      }
    }

    // Add company info
    if (context.companyInfo) {
      prompt += `\nOUR COMPANY INFO:\n`;
      prompt += `Company: ${context.companyInfo.company_name}\n`;
      
      if (context.companyInfo.description) {
        prompt += `Description: ${context.companyInfo.description}\n`;
      }
      
      if (context.companyInfo.services) {
        prompt += `\nServices Offered:\n${context.companyInfo.services}\n`;
      }
      
      if (context.companyInfo.capabilities) {
        prompt += `\nTechnical Capabilities:\n${context.companyInfo.capabilities}\n`;
      }
      
      if (context.companyInfo.differentiators) {
        prompt += `\nKey Differentiators:\n${context.companyInfo.differentiators}\n`;
      }
      
      if (context.companyInfo.experience) {
        prompt += `Experience: ${context.companyInfo.experience}\n`;
      }
      
      if (context.companyInfo.certifications) {
        prompt += `\nCertifications & Partnerships:\n${context.companyInfo.certifications}\n`;
      }
      
      if (context.companyInfo.team_size) {
        prompt += `Team Size: ${context.companyInfo.team_size}\n`;
      }
    }

    // Add chat context for RFP
    if (context.chatContext && context.chatContext.responses.length > 0) {
      prompt += `\nSTRATEGIC INSIGHTS FROM WIZARD INTERVIEW:\n`;
      context.chatContext.responses.forEach(response => {
        prompt += `\nQ: ${response.question}\n`;
        prompt += `A: ${response.answer}\n`;
      });
      prompt += `\nIMPORTANT: Use these strategic insights to strengthen our proposal and address their needs effectively.\n`;
    }

    // Build list of valid sources for citation
    const validSources: string[] = [];
    
    // Add uploaded documents
    if (context.documents.length > 0) {
      context.documents.forEach(doc => {
        validSources.push(doc.filename);
      });
    }
    
    // Add web sources
    if (context.webSources.length > 0) {
      context.webSources.forEach(source => {
        validSources.push(`${source.title} (${source.url})`);
      });
    }
    
    // Add knowledge base files
    if (context.knowledgeBase) {
      Object.entries(context.knowledgeBase).forEach(([category, files]) => {
        if (Array.isArray(files)) {
          files.forEach((file: any) => {
            validSources.push(`${file.filename} (Knowledge Base: ${category})`);
          });
        }
      });
    }
    
    // Add company info as a source
    if (context.companyInfo) {
      validSources.push('Company Settings');
    }

    prompt += `
You are an AI assistant helping to draft content for a business proposal document. This is for internal use to help structure ideas and content.

CONTEXT: The company "${context.companyInfo?.company_name || 'our company'}" is preparing draft content for responding to an RFP from ${context.organizationName}.

COMPANY INFORMATION TO USE:
${context.companyInfo ? `
- Company Name: ${context.companyInfo.company_name}
- Team Size: ${context.companyInfo.team_size || 'Not specified'}
- Years of Experience: ${context.companyInfo.experience || 'Not specified'}
- Description: ${context.companyInfo.description || 'Not specified'}
- Services: ${context.companyInfo.services || 'Not specified'}
- Capabilities: ${context.companyInfo.capabilities || 'Not specified'}
- Differentiators: ${context.companyInfo.differentiators || 'Not specified'}
- Certifications: ${context.companyInfo.certifications || 'Not specified'}
` : 'No company information provided'}

Please help generate DRAFT content for the following sections that could be used in preparing a proposal:

1. EXECUTIVE_SUMMARY: Write a compelling executive summary that demonstrates our understanding of their needs and how our solution addresses them.

2. COMPANY_OVERVIEW: Provide a detailed overview of ${context.companyInfo?.company_name || 'our company'}, highlighting our experience, capabilities, and why we're the best choice for this project. USE ONLY THE COMPANY FACTS PROVIDED ABOVE.

3. PROJECT_BACKGROUND: Demonstrate our understanding of their project, challenges, and objectives based on the RFP documents.

4. SCOPE_OF_WORK: Detail our proposed approach to meeting all requirements and specifications outlined in their RFP.

5. TECHNICAL_REQUIREMENTS: Explain how our solution meets or exceeds each technical requirement they've specified.

6. FUNCTIONAL_REQUIREMENTS: Detail how our solution addresses each functional requirement and feature they need.

7. IMPLEMENTATION_APPROACH: Present our proven implementation methodology, project phases, and approach to minimize disruption.

8. TIMELINE_AND_MILESTONES: Provide our proposed timeline with key milestones and deliverables.

9. PRICING_STRUCTURE: Present our competitive pricing proposal with clear cost breakdowns as requested in their RFP.

10. EVALUATION_CRITERIA: Address each of their evaluation criteria and explain why we excel in each area.

11. SUBMISSION_INSTRUCTIONS: Confirm our compliance with their submission requirements.

12. TERMS_AND_CONDITIONS: Acknowledge and address their terms while proposing any necessary modifications.

Format your response as:
SECTION_NAME: [content]
SECTION_NAME: [content]
etc.

TARGET LENGTH: The final document should be approximately ${context.targetLength || 15} pages long. Adjust the detail level of each section accordingly:
- For shorter documents (5-10 pages): Be concise but comprehensive, focus on key points
- For medium documents (10-20 pages): Include more detail, examples, and explanations
- For longer documents (20-50 pages): Be thorough, include extensive detail, case studies, and comprehensive coverage

Make the content specific, detailed, and professional. Use the uploaded document context to make it as relevant and accurate as possible.

CITATION REQUIREMENT: 
1. ONLY cite sources that actually exist in the provided documents
2. Valid sources you can cite from:
${validSources.map(source => `   - ${source}`).join('\n')}

3. Format citations as: [Source: exact filename from above list]
4. DO NOT make up or invent source names
5. DO NOT cite documents that are not in the list above
6. If you cannot find a source for a claim, either don't make the claim or state it without a citation
7. When citing Company Settings, use [Source: Company Settings]

ANTI-HALLUCINATION RULES:
- DO NOT invent team sizes, years of experience, or other metrics not explicitly provided
- DO NOT create fictional case studies or client names
- DO NOT reference documents that don't exist in the valid sources list
- DO NOT make up statistics or numbers not found in the provided content
- If specific information is not available, use general statements instead of making up specifics`;

    return prompt;
  }

  private parseAIResponse(response: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = response.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const sectionMatch = line.match(/^([A-Z_]+):\s*(.*)$/);
      if (sectionMatch) {
        // Save previous section
        if (currentSection) {
          sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
        }
        // Start new section
        currentSection = sectionMatch[1];
        currentContent = [sectionMatch[2]];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
    }

    return sections;
  }

  private generateFallbackContent(context: DocumentContext, type: 'RFI' | 'RFP'): Record<string, string> {
    console.log(`[AIService] Generating fallback content for ${type}`);
    
    const companyName = context.companyInfo?.company_name || 'Our Company';
    const orgName = context.organizationName || 'Your Organization';
    
    if (type === 'RFI') {
      return {
        introduction: `Thank you for the opportunity to provide information about ${companyName}'s solutions and capabilities. We are pleased to respond to your Request for Information.`,
        organization_background: `${companyName} is a technology solutions provider with expertise in telecommunications and VoIP services. ${context.companyInfo?.description || ''}`,
        project_scope: `Based on your requirements, we understand you are seeking information about VoIP and telecommunications solutions. Our team has extensive experience delivering similar projects.`,
        information_requested: `We have compiled comprehensive information about our solutions, capabilities, and experience as requested in your RFI. Our team is ready to provide additional details as needed.`,
        vendor_qualifications: `${companyName} brings ${context.companyInfo?.experience || 'extensive'} experience to this project. Our team of ${context.companyInfo?.team_size || 'qualified professionals'} has successfully delivered numerous similar implementations.`,
        submission_requirements: `We confirm our compliance with all submission requirements outlined in your RFI. All requested information has been provided in this response.`,
        evaluation_criteria: `We believe ${companyName} meets or exceeds all evaluation criteria outlined in your RFI. We look forward to demonstrating our capabilities further.`,
        next_steps: `We are prepared to provide additional information, schedule demonstrations, or participate in the next phase of your evaluation process.`
      };
    } else {
      return {
        executive_summary: `${companyName} is pleased to submit this proposal in response to ${orgName}'s RFP. We offer a comprehensive solution that addresses all requirements.`,
        company_overview: `${companyName} is a leading provider of ${context.companyInfo?.services || 'technology solutions'}. ${context.companyInfo?.description || ''}`,
        project_background: `We understand the importance of this project and have carefully analyzed all requirements outlined in your RFP.`,
        scope_of_work: `Our proposed solution encompasses all requested services and deliverables, with a proven implementation methodology.`,
        technical_requirements: `Our solution meets all technical specifications outlined in your RFP, utilizing industry-standard technologies and best practices.`,
        functional_requirements: `We have addressed each functional requirement with specific features and capabilities designed to meet your needs.`,
        implementation_approach: `Our implementation methodology includes detailed planning, phased deployment, and comprehensive testing to ensure success.`,
        timeline_and_milestones: `We propose a realistic timeline with clear milestones and deliverables aligned with your requirements.`,
        pricing_structure: `Our competitive pricing provides excellent value while meeting all budget requirements outlined in your RFP.`,
        evaluation_criteria: `${companyName} excels in all evaluation areas including experience, technical capability, and proven track record.`,
        submission_instructions: `This proposal complies with all submission requirements and includes all requested documentation.`,
        terms_and_conditions: `We acknowledge your terms and conditions and look forward to finalizing mutually agreeable contract terms.`
      };
    }
  }

  private validateAndCleanCitations(content: string, validSources: string[]): string {
    // Find all citations in the format [Source: ...]
    const citationRegex = /\[Source:\s*([^\]]+)\]/g;
    let cleanedContent = content;
    const invalidCitations: string[] = [];
    
    // Check each citation
    const matches = content.matchAll(citationRegex);
    for (const match of matches) {
      const citedSource = match[1].trim();
      
      // Check if this is a valid source
      const isValid = validSources.some(validSource => {
        // Exact match
        if (validSource === citedSource) return true;
        
        // Check if it's a partial match (e.g., "filename.pdf" matches "filename.pdf (Knowledge Base: category)")
        if (citedSource.includes('Knowledge Base:') && validSource.includes('Knowledge Base:')) {
          const citedFile = citedSource.split('(')[0].trim();
          const validFile = validSource.split('(')[0].trim();
          return citedFile === validFile;
        }
        
        // Check if cited source is just the filename part of a valid source
        const validFilename = validSource.split('(')[0].trim();
        return citedSource === validFilename;
      });
      
      if (!isValid) {
        invalidCitations.push(match[0]);
        console.warn(`[AIService] Invalid citation detected and removed: ${match[0]}`);
      }
    }
    
    // Remove invalid citations
    for (const invalidCitation of invalidCitations) {
      cleanedContent = cleanedContent.replace(invalidCitation, '');
    }
    
    // Clean up any double spaces left after removing citations
    cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();
    
    if (invalidCitations.length > 0) {
      console.log(`[AIService] Removed ${invalidCitations.length} invalid citations`);
    }
    
    return cleanedContent;
  }

  async extractQuestionsWithAnswers(context: { 
    projectName: string; 
    documents: any[]; 
    companyKnowledge: any[];
    industry?: string;
  }): Promise<Array<{ question: string; category: string; priority: number; answer?: string }>> {
    let prompt = `You are helping a vendor respond to an RFI/RFP. Extract all questions from the uploaded RFI/RFP document and generate appropriate answers based on the company knowledge provided.

Project: ${context.projectName}
Industry: ${context.industry || 'General'}

`;

    // Add the RFI/RFP document content
    if (context.documents.length > 0) {
      prompt += 'RFI/RFP DOCUMENT CONTENT:\n';
      for (const doc of context.documents) {
        let content = '';
        try {
          if (typeof doc.content === 'string') {
            try {
              const parsedContent = JSON.parse(doc.content);
              content = parsedContent.text || JSON.stringify(parsedContent);
            } catch {
              content = doc.content;
            }
          } else {
            content = JSON.stringify(doc.content);
          }
        } catch (e) {
          console.error('Error parsing document content:', e);
          content = 'Unable to parse document content';
        }
        
        // Limit content length to avoid token limits
        if (content.length > 50000) {
          content = content.substring(0, 50000) + '... [truncated]';
        }
        
        prompt += `\nDocument: ${doc.filename}\n${content}\n`;
      }
    }

    // Add company knowledge
    if (context.companyKnowledge.length > 0) {
      prompt += '\n\nCOMPANY KNOWLEDGE BASE:\n';
      for (const knowledge of context.companyKnowledge) {
        prompt += `\n${knowledge.title}:\n${knowledge.content}\n`;
      }
    }

    prompt += `
INSTRUCTIONS:
1. Extract ALL questions from the RFI/RFP document
2. For each question, generate a comprehensive answer based on the company knowledge
3. If company knowledge doesn't contain specific information, indicate what needs to be provided
4. Categorize questions appropriately
5. Mark questions as high priority (5) if they're about core capabilities, pricing, or compliance

Format each item as:
CATEGORY: [category name]
QUESTION: [exact question from the RFI/RFP]
ANSWER: [generated answer based on company knowledge]
PRIORITY: [1-5, where 5 is highest]

Extract and answer ALL questions found in the document.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseQuestionsWithAnswers(content);
    } catch (error) {
      console.error('AI question extraction error:', error);
      return [];
    }
  }

  private parseQuestionsWithAnswers(response: string): Array<{ question: string; category: string; priority: number; answer?: string }> {
    const questions: Array<{ question: string; category: string; priority: number; answer?: string }> = [];
    const lines = response.split('\n');
    
    let currentCategory = '';
    let currentQuestion = '';
    let currentAnswer = '';
    let currentPriority = 3;

    for (const line of lines) {
      if (line.startsWith('CATEGORY:')) {
        // Save previous question if exists
        if (currentQuestion) {
          questions.push({
            question: currentQuestion,
            category: currentCategory,
            priority: currentPriority,
            answer: currentAnswer || undefined
          });
        }
        currentCategory = line.replace('CATEGORY:', '').trim();
        currentQuestion = '';
        currentAnswer = '';
        currentPriority = 3;
      } else if (line.startsWith('QUESTION:')) {
        currentQuestion = line.replace('QUESTION:', '').trim();
      } else if (line.startsWith('ANSWER:')) {
        currentAnswer = line.replace('ANSWER:', '').trim();
      } else if (line.startsWith('PRIORITY:')) {
        currentPriority = parseInt(line.replace('PRIORITY:', '').trim()) || 3;
      }
    }
    
    // Don't forget the last question
    if (currentQuestion) {
      questions.push({
        question: currentQuestion,
        category: currentCategory,
        priority: currentPriority,
        answer: currentAnswer || undefined
      });
    }

    return questions;
  }

  async generateSmartQuestions(context: { 
    projectName: string; 
    documents: any[]; 
    industry?: string;
  }): Promise<Array<{ question: string; category: string; priority: number }>> {
    let prompt = `Generate smart, relevant questions for an RFI about ${context.projectName}.

`;

    // Summarize documents if they're large
    if (context.documents.length > 0) {
      const summaries: string[] = [];
      for (const doc of context.documents) {
        let content = '';
        try {
          const parsedContent = JSON.parse(doc.content);
          content = parsedContent.text || JSON.stringify(parsedContent);
        } catch {
          content = doc.content;
        }
        
        if (content.length > 1000) {
          const summary = await this.summarizer.summarizeDocument(content, doc.filename, 'RFI');
          summaries.push(`Document: ${doc.filename}\nSummary: ${summary.fullSummary}`);
        } else {
          summaries.push(`Document: ${doc.filename}\nContent: ${content}`);
        }
      }
      prompt += 'Context from uploaded documents:\n' + summaries.join('\n\n');
    }

    prompt += `
Generate 15-20 intelligent questions that will help evaluate vendors for this project. Categories should include:
- Company Background & Experience
- Technical Capabilities
- Implementation Approach
- Support & Maintenance
- Pricing & Commercial Terms
- Security & Compliance
- References & Case Studies

Format each question as:
CATEGORY: [category name]
QUESTION: [question text]
PRIORITY: [1-5, where 5 is highest]

Make questions specific to the context and avoid generic questions.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.5,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseQuestions(content);
    } catch (error) {
      console.error('AI question generation error:', error);
      return [];
    }
  }

  private parseQuestions(response: string): Array<{ question: string; category: string; priority: number }> {
    const questions: Array<{ question: string; category: string; priority: number }> = [];
    const lines = response.split('\n');
    
    let currentCategory = '';
    let currentQuestion = '';
    let currentPriority = 3;

    for (const line of lines) {
      if (line.startsWith('CATEGORY:')) {
        currentCategory = line.replace('CATEGORY:', '').trim();
      } else if (line.startsWith('QUESTION:')) {
        currentQuestion = line.replace('QUESTION:', '').trim();
      } else if (line.startsWith('PRIORITY:')) {
        currentPriority = parseInt(line.replace('PRIORITY:', '').trim()) || 3;
        
        // We have all parts, add the question
        if (currentCategory && currentQuestion) {
          questions.push({
            category: currentCategory,
            question: currentQuestion,
            priority: currentPriority
          });
        }
        
        // Reset for next question
        currentCategory = '';
        currentQuestion = '';
        currentPriority = 3;
      }
    }

    return questions;
  }

  async generateAnswersFromDocuments(params: {
    questions: Array<{ id: string; text: string }>;
    documents: Array<{ filename: string; content: string; metadata?: any }>;
  }): Promise<Array<{ questionId: string; answer: string }>> {
    console.log(`[AIService] Generating answers for ${params.questions.length} questions from ${params.documents.length} documents`);
    
    try {
      // Build document context with size optimization
      const MAX_CONTENT_PER_DOC = 8000; // Reduced to prevent token limits
      const MAX_TOTAL_CONTEXT = 30000; // Overall limit
      
      let totalLength = 0;
      const documentContextParts: string[] = [];
      
      // Prioritize documents: Company Info first, then RFI/RFP, then others
      const sortedDocs = params.documents.sort((a, b) => {
        if (a.metadata?.type === 'company_info') return -1;
        if (b.metadata?.type === 'company_info') return 1;
        if (a.filename.toLowerCase().includes('rfi') || a.filename.toLowerCase().includes('rfp')) return -1;
        if (b.filename.toLowerCase().includes('rfi') || b.filename.toLowerCase().includes('rfp')) return 1;
        return 0;
      });
      
      for (const doc of sortedDocs) {
        let content = doc.content;
        
        // Parse content if it's JSON
        if (typeof content === 'string' && content.startsWith('{')) {
          try {
            const parsed = JSON.parse(content);
            content = parsed.text || JSON.stringify(parsed, null, 2);
          } catch (e) {
            // Use as-is if not valid JSON
          }
        }
        
        // Skip if we've already hit total limit
        if (totalLength >= MAX_TOTAL_CONTEXT) {
          console.log(`[AIService] Skipping ${doc.filename} - total context limit reached`);
          continue;
        }
        
        // Limit individual document content
        let truncated = false;
        if (content.length > MAX_CONTENT_PER_DOC) {
          content = content.substring(0, MAX_CONTENT_PER_DOC);
          truncated = true;
        }
        
        // Check if adding this would exceed total limit
        if (totalLength + content.length > MAX_TOTAL_CONTEXT) {
          content = content.substring(0, MAX_TOTAL_CONTEXT - totalLength);
          truncated = true;
        }
        
        const docContext = `=== ${doc.filename} ===\n${content}${truncated ? '\n... [truncated for length]' : ''}\n`;
        documentContextParts.push(docContext);
        totalLength += docContext.length;
      }
      
      const documentContext = documentContextParts.join('\n\n');
      console.log(`[AIService] Document context built: ${documentContextParts.length} docs, ${totalLength} chars total`);
      
      // Build questions list
      const questionsList = params.questions.map((q, idx) => 
        `${idx + 1}. ${q.text} (ID: ${q.id})`
      ).join('\n');
      
      const prompt = `You are analyzing company documents to answer RFI questions as a vendor responding to a client's request. 
Based on the following documents, provide comprehensive, accurate answers to each question.

IMPORTANT: 
- The "Company Information" document contains critical details about our company that should be used prominently
- Reference specific company capabilities, certifications, and differentiators when relevant
- Use concrete examples from past projects when available
- If documents don't contain relevant information for a question, clearly state what information is missing

SUPPORTING DOCUMENTS:
${documentContext}

QUESTIONS TO ANSWER:
${questionsList}

For each question, provide an answer in the following format:
QUESTION_ID: [the ID from above]
ANSWER: [your detailed answer based on the documents, emphasizing company strengths and capabilities]
---

Be specific, professional, and reference information from the documents where relevant. Prioritize company information and capabilities in your responses.`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseAnswers(content);
    } catch (error) {
      console.error('AI answer generation error:', error);
      return [];
    }
  }

  private parseAnswers(response: string): Array<{ questionId: string; answer: string }> {
    const answers: Array<{ questionId: string; answer: string }> = [];
    const sections = response.split('---');
    
    for (const section of sections) {
      const lines = section.trim().split('\n');
      let questionId = '';
      let answer = '';
      
      for (const line of lines) {
        if (line.startsWith('QUESTION_ID:')) {
          questionId = line.replace('QUESTION_ID:', '').trim();
        } else if (line.startsWith('ANSWER:')) {
          answer = line.replace('ANSWER:', '').trim();
          // Get the rest of the answer if it spans multiple lines
          const answerStartIndex = lines.indexOf(line);
          if (answerStartIndex < lines.length - 1) {
            answer = lines.slice(answerStartIndex)
              .join('\n')
              .replace('ANSWER:', '')
              .trim();
          }
        }
      }
      
      if (questionId && answer) {
        answers.push({ questionId, answer });
      }
    }
    
    return answers;
  }
}