import Anthropic from '@anthropic-ai/sdk';
import { openDb } from './db';
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
    won_proposals?: Array<{ filename: string; content: string; }>;
    sow?: Array<{ filename: string; content: string; }>;
    k12_erate?: Array<{ filename: string; content: string; }>;
    engineering?: Array<{ filename: string; content: string; }>;
    project_plans?: Array<{ filename: string; content: string; }>;
    legal?: Array<{ filename: string; content: string; }>;
  };
}

export class AIService {
  private summarizer: DocumentSummarizer;
  
  constructor() {
    this.summarizer = new DocumentSummarizer();
  }
  
  private async cacheSummary(type: 'document' | 'web_source' | 'knowledge', identifier: string, summary: DocumentSummary): Promise<void> {
    try {
      const db = await openDb();
      const summaryJson = JSON.stringify(summary);
      const now = new Date().toISOString();
      
      if (type === 'document') {
        await db.run(
          'UPDATE documents SET summary_cache = ?, summary_generated_at = ? WHERE filename = ?',
          summaryJson, now, identifier
        );
      } else if (type === 'web_source') {
        await db.run(
          'UPDATE web_sources SET summary_cache = ?, summary_generated_at = ? WHERE url = ?',
          summaryJson, now, identifier
        );
      } else if (type === 'knowledge') {
        await db.run(
          'UPDATE company_knowledge SET summary_cache = ?, summary_generated_at = ? WHERE original_filename = ?',
          summaryJson, now, identifier
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
IMPORTANT: We are ${context.companyInfo?.company_name || 'the vendor'} RESPONDING TO an RFI from ${context.organizationName}.
We are NOT the buyer issuing the RFI - we are the seller/vendor preparing our response to their request for information.

CRITICAL COMPANY FACTS (USE THESE EXACTLY - DO NOT MAKE UP DIFFERENT NUMBERS):
${context.companyInfo ? `
- Company Name: ${context.companyInfo.company_name}
- Team Size: ${context.companyInfo.team_size || 'Not specified'}
- Years of Experience: ${context.companyInfo.experience || 'Not specified'}
- Description: ${context.companyInfo.description || 'Not specified'}
` : 'No company information provided'}

Generate comprehensive content for the following RFI RESPONSE sections:

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
IMPORTANT: We are ${context.companyInfo?.company_name || 'the vendor'} RESPONDING TO an RFP from ${context.organizationName}.
We are NOT the buyer issuing the RFP - we are the seller/vendor creating a proposal in response to their RFP.

CRITICAL COMPANY FACTS (USE THESE EXACTLY - DO NOT MAKE UP DIFFERENT NUMBERS):
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

Generate comprehensive content for the following RFP RESPONSE sections:

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
}