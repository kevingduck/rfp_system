import Anthropic from '@anthropic-ai/sdk';
import { query } from './pg-db';
import { DocumentSummarizer, DocumentSummary } from './document-summarizer';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Model Selection Strategy:
// - Claude 3.5 Sonnet: Used for RFI/RFP generation (8192 token output limit)
//   - Generates ~15 pages of content per call
//   - For longer documents, consider chunking strategy
// - Claude 3.5 Sonnet: Also used for question extraction and answer generation
// Note: 128K output feature requires beta headers and may not be available in all SDK versions

interface DocumentContext {
  projectType: 'RFI' | 'RFP' | 'FORM_470';
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

  async extractDocumentRequirements(documentContent: string, documentType: string = 'document'): Promise<any> {
    console.log(`[AIService] Extracting requirements from ${documentType}`);

    const prompt = `Analyze this ${documentType} and extract ALL requirements, requests, and evaluation criteria.
    DO NOT assume any particular structure - adapt to whatever is in the document.

    Extract and organize the following (if present):
    1. Services/Products Requested - List EXACTLY what they're asking for
    2. Technical Requirements - Specific technical specifications mentioned
    3. Quantities - Number of units, locations, users, etc.
    4. Timeline/Deadlines - All dates mentioned
    5. Evaluation Criteria - How they will score/evaluate responses
    6. Budget/Pricing Expectations - Any budget mentions or pricing structures requested
    7. Compliance Requirements - Certifications, standards, regulations mentioned
    8. Special Conditions - Any unique requirements or preferences
    9. Contact Information - Who to contact and how
    10. Submission Instructions - How to respond

    IMPORTANT:
    - Extract ACTUAL requirements from the document, not generic categories
    - If they ask for "1000 Mbps fiber to 5 schools", extract exactly that
    - Include section/page references when possible
    - Don't make up information that's not in the document

    Document Content:
    ${documentContent.substring(0, 100000)}

    Return as structured JSON with the actual requirements found, not placeholder text.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      // Try to parse as JSON, otherwise return structured text
      try {
        return JSON.parse(content.text);
      } catch {
        // If not valid JSON, structure it
        return {
          rawExtraction: content.text,
          requirements: this.parseRequirementsText(content.text)
        };
      }
    } catch (error) {
      console.error('[AIService] Error extracting requirements:', error);
      throw error;
    }
  }

  private parseRequirementsText(text: string): any {
    // Basic parser for non-JSON responses
    const sections = text.split(/\n\n/);
    const requirements: any = {};

    sections.forEach(section => {
      const lines = section.split('\n');
      if (lines[0] && lines[0].includes(':')) {
        const [key, ...valueParts] = lines[0].split(':');
        requirements[key.trim()] = valueParts.join(':').trim();
      }
    });

    return requirements;
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
  
  async generateForm470Response(context: any, onProgress?: (message: string, progress: number) => void): Promise<Record<string, string>> {
    console.log(`[AIService] Starting Form 470 response generation for ${context.projectName}`);

    if (onProgress) onProgress('Building comprehensive Form 470 response...', 20);

    // Build valid sources list for citations
    const validSources: string[] = [];

    if (context.documents?.length > 0) {
      context.documents.forEach(doc => validSources.push(doc.filename));
    }
    if (context.webSources?.length > 0) {
      context.webSources.forEach(source => validSources.push(`${source.title} (${source.url})`));
    }
    if (context.knowledgeBase) {
      Object.entries(context.knowledgeBase).forEach(([category, files]) => {
        if (Array.isArray(files)) {
          files.forEach((file: any) => validSources.push(`${file.filename} (Knowledge Base: ${category})`));
        }
      });
    }
    if (context.companyInfo) {
      validSources.push('Company Settings');
    }

    // Prepare document summaries for context
    let documentContext = '';
    if (context.documents?.length > 0) {
      documentContext = '\n\nUPLOADED DOCUMENTS:\n';
      for (const doc of context.documents) {
        documentContext += `\nDocument: ${doc.filename}\n`;
        if (doc.content) {
          const contentPreview = typeof doc.content === 'string' ?
            doc.content.substring(0, 5000) : JSON.stringify(doc.content).substring(0, 5000);
          documentContext += `Content: ${contentPreview}\n`;
        }
      }
    }

    // Build the comprehensive prompt
    const prompt = `You are creating a professional Form 470 response document for ${context.companyInfo?.company_name || 'our company'}.

CONTEXT:
- Form 470 Number: ${context.form470Details?.applicationNumber || 'Pending'}
- Entity: ${context.form470Details?.entityName || context.organizationName}
- Funding Year: ${context.form470Details?.fundingYear || '2025'}
- Discount: ${context.form470Details?.discountPercentage || 80}%
- Service Category: ${context.form470Details?.serviceCategory || 'Category 1'}
- Services Requested: ${context.form470Details?.servicesRequested?.join(', ') || 'Internet/WAN'}
- Locations: ${context.form470Details?.locations || 'Multiple'}
- Students: ${context.form470Details?.students || 'Not specified'}

COMPANY INFORMATION:
${context.companyInfo ? `
- Company: ${context.companyInfo.company_name}
- SPIN: ${context.companyInfo.spin_number || 'Pending'}
- Tax ID: ${context.companyInfo.tax_id || 'Available upon request'}
- FCC Reg: ${context.companyInfo.fcc_registration || 'Pending'}
- Primary Contact: ${context.companyInfo.contact_name} (${context.companyInfo.contact_email}, ${context.companyInfo.contact_phone})
- Team Size: ${context.companyInfo.team_size || '50+'}
- Years in Business: ${context.companyInfo.years_in_business || '10+'}
- E-Rate Experience: ${context.companyInfo.erate_experience || 'Extensive'}
- E-Rate Funding Secured: ${context.companyInfo.erate_funding_secured || '$50M+'}
- Districts Served: ${context.companyInfo.districts_served || '100+'}
` : 'Company information not provided'}

KEY PERSONNEL (if available):
${context.companyInfo?.key_personnel ? context.companyInfo.key_personnel : 'To be provided'}

EXTRACTED REQUIREMENTS:
${context.extractedRequirements ? JSON.stringify(context.extractedRequirements, null, 2) : 'No specific requirements extracted'}

${documentContext}

INSTRUCTIONS FOR PROFESSIONAL FORM 470 RESPONSE:

Generate EXTREMELY DETAILED, PROFESSIONAL content for each section. This should read like a real, winning Form 470 response from an experienced E-rate vendor.

SECTION REQUIREMENTS:

1. EXECUTIVE_SUMMARY (3-4 paragraphs):
   - Open with excitement about the opportunity
   - Summarize your understanding of their needs
   - Highlight 3-4 key differentiators
   - Close with commitment to their success
   - Include [Source: citations] from documents

2. UNDERSTANDING_REQUIREMENTS (4-5 paragraphs):
   - Quote specific requirements from their Form 470
   - Show deep understanding of their environment
   - Identify challenges they may face
   - Explain how you'll address each challenge
   - Reference similar successful implementations

3. TECHNICAL_SOLUTION (6-8 paragraphs):
   - Detailed technical architecture
   - Specific equipment models and specifications
   - Bandwidth calculations and growth projections
   - Redundancy and failover mechanisms
   - Network security measures
   - Quality of Service (QoS) configuration
   - Monitoring and management tools
   - Include specific product names and model numbers

4. COMPANY_BACKGROUND (3-4 paragraphs):
   - Company history and mission
   - E-rate specific experience and success metrics
   - Certifications and partnerships
   - Local presence and support capabilities
   - Use actual data from company settings

5. KEY_PERSONNEL (4-5 team members):
   For each person, include:
   - Full name and title
   - Years of experience
   - Specific E-rate expertise
   - Role in this project
   - Contact information

   Example format:
   ### John Smith - Senior E-Rate Consultant
   With over 15 years of experience in E-rate program management, John has successfully guided over 200 school districts through the E-rate process, securing over $75 million in funding. John holds certifications in Cisco CCNP, USAC E-rate Compliance, and Project Management Professional (PMP). As your dedicated E-rate consultant, John will ensure all aspects of your project maintain full compliance while maximizing your funding opportunities.
   **Email:** john.smith@company.com | **Direct:** (555) 123-4567

6. IMPLEMENTATION_TIMELINE (Detailed milestone table):
   - Week 1-2: Contract execution and USAC filing
   - Week 3-4: Site surveys and technical design finalization
   - Week 5-6: Equipment ordering and staging
   - Week 7-8: Installation Phase 1 (Main sites)
   - Week 9-10: Installation Phase 2 (Remote sites)
   - Week 11-12: Testing and optimization
   - Week 13-14: Training and documentation
   - Week 15-16: Go-live and support transition

7. PRICING_PROPOSAL (Detailed breakdown):
   - Line-item pricing for each service
   - Pre-discount amounts
   - E-rate discount calculations
   - Post-discount amounts (what district pays)
   - Payment terms aligned with E-rate
   - Optional services clearly marked

   Format as:
   ### Category 1 - Internet Access
   **1Gbps Dedicated Internet Access - Main Campus**
   - Monthly Recurring: $3,500
   - E-rate Discount (${context.form470Details?.discountPercentage || 80}%): -$2,800
   - **Your Monthly Cost: $700**

8. PAST_PERFORMANCE (3-4 detailed case studies):
   For each case study:
   - Client name and size
   - Challenge they faced
   - Solution implemented
   - Measurable results
   - Client testimonial quote

9. REFERENCES (3 references):
   For each reference:
   - Organization name
   - Contact person and title
   - Phone and email
   - Project description
   - Funding amount secured

10. CERTIFICATIONS_COMPLIANCE (2-3 paragraphs):
    - E-rate compliance certifications
    - CIPA compliance capabilities
    - Industry certifications (list specific ones)
    - Security and data protection standards

CITATION REQUIREMENTS:
- Add [Source: filename] citations throughout
- Valid sources you can cite: ${validSources.join(', ')}
- ONLY cite sources that exist in the list above
- When citing uploaded Form 470: [Source: ${context.documents?.[0]?.filename || 'Form470.pdf'}]
- When citing company info: [Source: Company Settings]

WRITING STYLE:
- Professional but approachable
- Specific and detailed (avoid generalities)
- Use industry terminology correctly
- Include specific model numbers, speeds, quantities
- Show expertise through technical details
- Make it 3-4x more detailed than a typical response

TARGET: Generate 15-20 pages worth of professional content that would win this bid.

Format each section as:
SECTION_NAME: [detailed content with citations]`;

    if (onProgress) onProgress('Generating comprehensive Form 470 response...', 60);

    // Call AI with the enhanced prompt
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    if (onProgress) onProgress('Processing response sections...', 80);

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    // Parse the response into sections
    const sections = this.parseAIResponse(content.text);

    // Debug logging
    console.log(`[AIService] Parsed ${Object.keys(sections).length} sections from AI response`);
    console.log(`[AIService] Section names:`, Object.keys(sections));

    // Log first 100 chars of each section for debugging
    Object.entries(sections).forEach(([name, content]) => {
      console.log(`[AIService] Section "${name}" preview: ${(content as string).substring(0, 100)}...`);
    });

    if (onProgress) onProgress('Form 470 response complete', 100);

    return sections;
  }

  async generateRFIContent(context: DocumentContext, onProgress?: (message: string, progress: number) => void): Promise<Record<string, string>> {
    console.log(`[AIService] Starting RFI generation for ${context.projectName}`);
    console.log(`[AIService] Processing ${context.documents.length} documents and ${context.webSources.length} web sources`);
    console.log(`[AIService] Target length: ${context.targetLength} pages`);

    if (onProgress) onProgress('Extracting RFI requirements...', 20);

    // First, extract the actual requirements from the RFI if documents exist
    let extractedRequirements = {};
    if (context.documents && context.documents.length > 0) {
      const mainDoc = context.documents[0];
      let documentContent = '';

      // Parse the document content
      if (typeof mainDoc.content === 'string') {
        try {
          const parsed = JSON.parse(mainDoc.content);
          documentContent = parsed.text || JSON.stringify(parsed);
        } catch {
          documentContent = mainDoc.content;
        }
      } else {
        documentContent = JSON.stringify(mainDoc.content);
      }

      // Extract requirements
      extractedRequirements = await this.extractDocumentRequirements(documentContent, 'RFI');
      console.log(`[AIService] Extracted requirements from RFI`);
    }

    if (onProgress) onProgress('Building AI prompt...', 65);

    // For documents over 15 pages, we'll need to use chunking
    const needsChunking = (context.targetLength || 15) > 15;
    if (needsChunking) {
      console.log(`[AIService] Document requires chunking strategy for ${context.targetLength} pages`);
      return this.generateRFIContentChunked({ ...context, extractedRequirements }, onProgress);
    }

    const prompt = await this.buildRFIPrompt({ ...context, extractedRequirements }, onProgress);
    console.log(`[AIService] Prompt built, length: ${prompt.length} chars`);
    
    if (onProgress) onProgress('Sending to AI for generation...', 75);
    
    try {
      console.log(`[AIService] Sending to Claude 3.5 Sonnet for content generation...`);
      console.log(`[AIService] Using standard generation (8192 token limit)`);
      const startTime = Date.now();
      
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192, // Current max for Claude 3.5 Sonnet
        temperature: 0.1, // Near-deterministic for factual accuracy
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const duration = Date.now() - startTime;
      console.log(`[AIService] Claude 3.5 Sonnet responded in ${duration}ms`);
      
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
    console.log(`[AIService] Starting RFP response generation for ${context.projectName}`);

    if (onProgress) onProgress('Extracting RFP requirements...', 20);

    // First, extract the actual requirements from the RFP
    let extractedRequirements = {};
    if (context.documents && context.documents.length > 0) {
      const mainDoc = context.documents[0];
      let documentContent = '';

      // Parse the document content
      if (typeof mainDoc.content === 'string') {
        try {
          const parsed = JSON.parse(mainDoc.content);
          documentContent = parsed.text || JSON.stringify(parsed);
        } catch {
          documentContent = mainDoc.content;
        }
      } else {
        documentContent = JSON.stringify(mainDoc.content);
      }

      // Extract requirements
      extractedRequirements = await this.extractDocumentRequirements(documentContent, 'RFP');
      console.log(`[AIService] Extracted requirements from RFP`);
    }

    if (onProgress) onProgress('Analyzing RFP requirements...', 40);

    // Then generate targeted response using the original method with extracted requirements
    const enhancedContext = {
      ...context,
      extractedRequirements
    };

    return this.generateRFPContentWithRequirements(enhancedContext, onProgress);
  }

  private async generateRFPContentWithRequirements(context: DocumentContext & { extractedRequirements?: any }, onProgress?: (message: string, progress: number) => void): Promise<Record<string, string>> {
    console.log(`[AIService] Starting RFP generation for ${context.projectName}`);
    console.log(`[AIService] Processing ${context.documents.length} documents and ${context.webSources.length} web sources`);
    console.log(`[AIService] Target length: ${context.targetLength} pages`);
    
    if (onProgress) onProgress('Building AI prompt...', 65);
    
    // For documents over 15 pages, we'll need to use chunking
    const needsChunking = (context.targetLength || 15) > 15;
    if (needsChunking) {
      console.log(`[AIService] Document requires chunking strategy for ${context.targetLength} pages`);
      return this.generateRFPContentChunked(context, onProgress);
    }
    
    const prompt = await this.buildRFPPrompt(context, onProgress);
    console.log(`[AIService] Prompt built, length: ${prompt.length} chars`);
    
    if (onProgress) onProgress('Sending to AI for generation...', 75);
    
    try {
      console.log(`[AIService] Sending to Claude 3.5 Sonnet for content generation...`);
      console.log(`[AIService] Using standard generation (8192 token limit)`);
      const startTime = Date.now();
      
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192, // Current max for Claude 3.5 Sonnet
        temperature: 0.1, // Near-deterministic for factual accuracy
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const duration = Date.now() - startTime;
      console.log(`[AIService] Claude 3.5 Sonnet responded in ${duration}ms`);
      
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

  private async buildRFIPrompt(context: DocumentContext & { extractedRequirements?: any }, onProgress?: (message: string, progress: number) => void): Promise<string> {
    let prompt = '';

    // Add extracted requirements first if available
    if (context.extractedRequirements) {
      prompt += `IMPORTANT: The following requirements were extracted from the RFI document. You MUST address each of these specifically in your response:

=== EXTRACTED RFI REQUIREMENTS ===
`;

      // Add overview
      if (context.extractedRequirements.overview) {
        prompt += `\nPROJECT OVERVIEW:\n${context.extractedRequirements.overview}\n`;
      }

      // Add specific requirements or questions
      if (context.extractedRequirements.requirements) {
        prompt += `\nINFORMATION REQUESTED:\n`;
        for (const req of context.extractedRequirements.requirements) {
          prompt += `- ${req.category}: ${req.description}\n`;
          if (req.specifications?.length > 0) {
            for (const spec of req.specifications) {
              prompt += `  • ${spec}\n`;
            }
          }
        }
      }

      // Add specific questions if they exist
      if (context.rfiQuestions && context.rfiQuestions.length > 0) {
        prompt += `\nSPECIFIC QUESTIONS TO ANSWER:\n`;
        for (const q of context.rfiQuestions) {
          prompt += `Q: ${q.question_text}\n`;
          if (q.answer) {
            prompt += `Suggested Answer: ${q.answer}\n`;
          }
        }
      }

      // Add evaluation criteria
      if (context.extractedRequirements.evaluationCriteria) {
        prompt += `\nEVALUATION CRITERIA:\n`;
        for (const criteria of context.extractedRequirements.evaluationCriteria) {
          prompt += `- ${criteria.name}${criteria.weight ? ` (${criteria.weight})` : ''}: ${criteria.description}\n`;
        }
      }

      // Add timeline
      if (context.extractedRequirements.timeline) {
        prompt += `\nTIMELINE:\n`;
        for (const [key, value] of Object.entries(context.extractedRequirements.timeline)) {
          if (value) prompt += `- ${key}: ${value}\n`;
        }
      }

      prompt += `\n=== END OF EXTRACTED REQUIREMENTS ===\n\n`;
      prompt += `CRITICAL: Your response MUST specifically address each of the requirements and questions listed above.\n\n`;
    }

    prompt += `You are helping create a comprehensive response to an RFI from ${context.organizationName} regarding ${context.projectName}.

Based on the following context and the extracted requirements above, generate professional, detailed content that directly addresses their needs:

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

Please help generate comprehensive DRAFT content for an RFI response. 

CRITICAL: Generate DETAILED, SUBSTANTIVE content for each section. Each section should be multiple paragraphs with specific examples, details, and relevant information from the provided documents.

Format your response as:
SECTION_NAME: [detailed multi-paragraph content with citations]

Generate these sections:

1. INTRODUCTION: Professional introduction (2-3 paragraphs)

2. ORGANIZATION_BACKGROUND: Detailed company background using ONLY the provided facts (3-4 paragraphs)

3. PROJECT_SCOPE: Comprehensive understanding of requirements (3-4 paragraphs)

4. INFORMATION_REQUESTED: Detailed responses to all aspects mentioned in the RFI (this should be your LONGEST section - 5-8 paragraphs covering capabilities, experience, technical specs, approach)

5. VENDOR_QUALIFICATIONS: Thorough coverage of qualifications and experience (3-4 paragraphs)

6. SUBMISSION_REQUIREMENTS: Complete compliance confirmation (2-3 paragraphs)

7. EVALUATION_CRITERIA: Detailed response to each evaluation criterion (3-4 paragraphs)

8. NEXT_STEPS: Clear next steps and readiness statement (2-3 paragraphs)

IMPORTANT: Generate comprehensive content within the 8192 token limit. Focus on quality and detail.

TARGET LENGTH: Approximately ${context.targetLength || 15} pages of professional content.

CRITICAL REQUIREMENTS:
1. Generate DETAILED, SUBSTANTIVE content for each section
2. Each section should be 2-4 well-developed paragraphs
3. Include specific examples and data from provided documents
4. Add proper citations throughout using [Source: filename]
5. Focus on the most important sections:
   - Introduction: Concise but compelling (1-2 paragraphs)
   - Organization Background: Key strengths and experience (2-3 paragraphs)
   - Project Scope: Clear understanding of requirements (2-3 paragraphs)
   - Information Requested: Most detailed section (4-6 paragraphs with specific capabilities)
   - Vendor Qualifications: Strong evidence of capability (2-3 paragraphs)
   - Other sections: Professional but concise (1-2 paragraphs each)

Note: Due to token limits, content will be comprehensive but focused. For longer documents, additional generation may be needed.

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

  private async buildRFPPrompt(context: DocumentContext & { extractedRequirements?: any }, onProgress?: (message: string, progress: number) => void): Promise<string> {
    let prompt = '';

    // Add extracted requirements first if available
    if (context.extractedRequirements) {
      prompt += `IMPORTANT: The following requirements were extracted from the RFP document. You MUST address each of these specifically in your response:

=== EXTRACTED RFP REQUIREMENTS ===
`;

      // Add overview
      if (context.extractedRequirements.overview) {
        prompt += `\nPROJECT OVERVIEW:\n${context.extractedRequirements.overview}\n`;
      }

      // Add specific requirements
      if (context.extractedRequirements.requirements) {
        prompt += `\nSPECIFIC REQUIREMENTS:\n`;
        for (const req of context.extractedRequirements.requirements) {
          prompt += `- ${req.category}: ${req.description}\n`;
          if (req.specifications?.length > 0) {
            for (const spec of req.specifications) {
              prompt += `  • ${spec}\n`;
            }
          }
        }
      }

      // Add evaluation criteria
      if (context.extractedRequirements.evaluationCriteria) {
        prompt += `\nEVALUATION CRITERIA:\n`;
        for (const criteria of context.extractedRequirements.evaluationCriteria) {
          prompt += `- ${criteria.name}${criteria.weight ? ` (${criteria.weight})` : ''}: ${criteria.description}\n`;
        }
      }

      // Add timeline
      if (context.extractedRequirements.timeline) {
        prompt += `\nTIMELINE:\n`;
        for (const [key, value] of Object.entries(context.extractedRequirements.timeline)) {
          if (value) prompt += `- ${key}: ${value}\n`;
        }
      }

      // Add submission requirements
      if (context.extractedRequirements.submissionRequirements) {
        prompt += `\nSUBMISSION REQUIREMENTS:\n`;
        for (const [key, value] of Object.entries(context.extractedRequirements.submissionRequirements)) {
          if (value) prompt += `- ${key}: ${value}\n`;
        }
      }

      prompt += `\n=== END OF EXTRACTED REQUIREMENTS ===\n\n`;
      prompt += `CRITICAL: Your response MUST specifically address each of the requirements listed above. Quote the requirement first, then provide your response.\n\n`;
    }

    prompt += `You are helping create a comprehensive response to an RFP from ${context.organizationName} regarding ${context.projectName}.

Based on the following context and the extracted requirements above, generate professional, detailed content that directly addresses their needs:

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

Please help generate comprehensive DRAFT content for an RFP response.

CRITICAL: Generate DETAILED, SUBSTANTIVE content for each section. Each section should be multiple paragraphs with specific examples, details, and relevant information from the provided documents.

Format your response as:
SECTION_NAME: [detailed multi-paragraph content with citations]

Generate these sections:

1. EXECUTIVE_SUMMARY: Compelling summary demonstrating understanding (3-4 paragraphs)

2. COMPANY_OVERVIEW: Detailed company overview using ONLY provided facts (3-4 paragraphs)

3. PROJECT_BACKGROUND: Comprehensive understanding of project and challenges (3-4 paragraphs)

4. SCOPE_OF_WORK: Detailed approach to requirements (4-5 paragraphs)

5. TECHNICAL_REQUIREMENTS: Thorough technical solution details (4-5 paragraphs)

6. FUNCTIONAL_REQUIREMENTS: Complete functional coverage (4-5 paragraphs)

7. IMPLEMENTATION_APPROACH: Detailed methodology and phases (3-4 paragraphs)

8. TIMELINE_AND_MILESTONES: Comprehensive timeline (2-3 paragraphs)

9. PRICING_STRUCTURE: Detailed pricing approach (2-3 paragraphs)

10. EVALUATION_CRITERIA: Response to each criterion (3-4 paragraphs)

11. SUBMISSION_INSTRUCTIONS: Compliance confirmation (1-2 paragraphs)

12. TERMS_AND_CONDITIONS: Terms acknowledgment (1-2 paragraphs)

IMPORTANT: Generate comprehensive content within the 8192 token limit. Focus on quality and detail.

TARGET LENGTH: Approximately ${context.targetLength || 15} pages of professional content.

CRITICAL REQUIREMENTS:
1. Generate DETAILED, SUBSTANTIVE content for each section
2. Each section should be 2-3 well-developed paragraphs (more for technical sections)
3. Include specific examples and data from provided documents
4. Add proper citations throughout using [Source: filename]
5. Prioritize key sections:
   - Executive Summary: Compelling overview (2 paragraphs)
   - Company Overview: Key strengths (2 paragraphs)
   - Technical/Functional Requirements: Most detailed (3-4 paragraphs each)
   - Implementation Approach: Clear methodology (2-3 paragraphs)
   - Other sections: Professional but focused (1-2 paragraphs each)

Note: Due to token limits, content will be comprehensive but focused. For longer documents, additional generation may be needed.

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

  private async generateRFIContentChunked(context: DocumentContext & { extractedRequirements?: any }, onProgress?: (message: string, progress: number) => void): Promise<Record<string, string>> {
    console.log(`[AIService] Using chunked generation for ${context.targetLength} page document`);
    
    const sections: Record<string, string> = {};
    
    // Generate in chunks
    // Chunk 1: Introduction, Organization Background, Project Scope
    if (onProgress) onProgress('Generating introduction sections...', 70);
    const chunk1Sections = await this.generateRFIChunk(context, ['INTRODUCTION', 'ORGANIZATION_BACKGROUND', 'PROJECT_SCOPE'], onProgress);
    Object.assign(sections, chunk1Sections);
    
    // Chunk 2: Information Requested (largest section)
    if (onProgress) onProgress('Generating main content...', 80);
    const chunk2Sections = await this.generateRFIChunk(context, ['INFORMATION_REQUESTED'], onProgress);
    Object.assign(sections, chunk2Sections);
    
    // Chunk 3: Remaining sections
    if (onProgress) onProgress('Generating final sections...', 90);
    const chunk3Sections = await this.generateRFIChunk(context, ['VENDOR_QUALIFICATIONS', 'SUBMISSION_REQUIREMENTS', 'EVALUATION_CRITERIA', 'NEXT_STEPS'], onProgress);
    Object.assign(sections, chunk3Sections);
    
    return sections;
  }

  private async generateRFIChunk(context: DocumentContext & { extractedRequirements?: any }, sectionNames: string[], onProgress?: (message: string, progress: number) => void): Promise<Record<string, string>> {
    const prompt = await this.buildRFIChunkPrompt(context, sectionNames);
    
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseAIResponse(content);
    } catch (error) {
      console.error('[AIService] Chunk generation error:', error);
      throw new Error(`Failed to generate RFI chunk for sections: ${sectionNames.join(', ')}`);
    }
  }

  private async buildRFIChunkPrompt(context: DocumentContext & { extractedRequirements?: any }, sectionNames: string[]): Promise<string> {
    // Build a focused prompt for specific sections
    let prompt = '';

    // Add extracted requirements if available and relevant
    if (context.extractedRequirements && sectionNames.some(s => s === 'INFORMATION_REQUESTED' || s === 'PROJECT_SCOPE')) {
      prompt += `IMPORTANT: Address these extracted requirements in your response:

=== EXTRACTED REQUIREMENTS ===
`;
      if (context.extractedRequirements.overview) {
        prompt += `\nOVERVIEW:\n${context.extractedRequirements.overview}\n`;
      }
      if (context.extractedRequirements.requirements) {
        prompt += `\nREQUIREMENTS:\n`;
        for (const req of context.extractedRequirements.requirements) {
          prompt += `- ${req.category}: ${req.description}\n`;
        }
      }
      prompt += `=== END REQUIREMENTS ===\n\n`;
    }

    prompt += `You are helping create specific sections of a Request for Information (RFI) response to ${context.organizationName} regarding ${context.projectName}.

Generate ONLY these sections with detailed, comprehensive content:
${sectionNames.join(', ')}

Context:
`;

    // Add minimal context (company info and key documents)
    if (context.companyInfo) {
      prompt += `\nCOMPANY INFO:
Company: ${context.companyInfo.company_name}
Description: ${context.companyInfo.description || 'Not specified'}
Experience: ${context.companyInfo.experience || 'Not specified'}
Services: ${context.companyInfo.services || 'Not specified'}
`;
    }

    // Add section-specific instructions
    const sectionInstructions: Record<string, string> = {
      INTRODUCTION: 'Write a professional introduction acknowledging their RFI and expressing interest (2-3 paragraphs)',
      ORGANIZATION_BACKGROUND: 'Provide detailed company background using ONLY provided facts (3-4 paragraphs)',
      PROJECT_SCOPE: 'Demonstrate comprehensive understanding of requirements (3-4 paragraphs)',
      INFORMATION_REQUESTED: 'Provide EXTENSIVE responses covering all capabilities, experience, technical specs (6-8 paragraphs)',
      VENDOR_QUALIFICATIONS: 'Detail qualifications, certifications, and track record (3-4 paragraphs)',
      SUBMISSION_REQUIREMENTS: 'Confirm compliance with requirements (2 paragraphs)',
      EVALUATION_CRITERIA: 'Address each evaluation criterion (3-4 paragraphs)',
      NEXT_STEPS: 'Express readiness and next steps (2 paragraphs)'
    };

    prompt += '\n\nGenerate these sections with the following requirements:\n';
    sectionNames.forEach(section => {
      prompt += `\n${section}: ${sectionInstructions[section] || 'Generate comprehensive content'}`;
    });

    prompt += '\n\nFormat: SECTION_NAME: [detailed content with citations]';
    prompt += '\n\nIMPORTANT: Generate substantial, detailed content for each section. Include citations [Source: filename] where relevant.';

    return prompt;
  }

  private async generateRFPContentChunked(context: DocumentContext & { extractedRequirements?: any }, onProgress?: (message: string, progress: number) => void): Promise<Record<string, string>> {
    console.log(`[AIService] Using chunked generation for ${context.targetLength} page RFP document`);
    
    const sections: Record<string, string> = {};
    
    // Generate in chunks for RFP (12 sections total)
    // Chunk 1: Executive Summary, Company Overview, Project Background
    if (onProgress) onProgress('Generating overview sections...', 70);
    const chunk1Sections = await this.generateRFPChunk(context, ['EXECUTIVE_SUMMARY', 'COMPANY_OVERVIEW', 'PROJECT_BACKGROUND'], onProgress);
    Object.assign(sections, chunk1Sections);
    
    // Chunk 2: Technical and Functional Requirements (largest sections)
    if (onProgress) onProgress('Generating requirements sections...', 80);
    const chunk2Sections = await this.generateRFPChunk(context, ['SCOPE_OF_WORK', 'TECHNICAL_REQUIREMENTS', 'FUNCTIONAL_REQUIREMENTS'], onProgress);
    Object.assign(sections, chunk2Sections);
    
    // Chunk 3: Implementation and remaining sections
    if (onProgress) onProgress('Generating implementation and final sections...', 90);
    const chunk3Sections = await this.generateRFPChunk(context, ['IMPLEMENTATION_APPROACH', 'TIMELINE_AND_MILESTONES', 'PRICING_STRUCTURE', 'EVALUATION_CRITERIA', 'SUBMISSION_INSTRUCTIONS', 'TERMS_AND_CONDITIONS'], onProgress);
    Object.assign(sections, chunk3Sections);
    
    return sections;
  }

  private async generateRFPChunk(context: DocumentContext & { extractedRequirements?: any }, sectionNames: string[], onProgress?: (message: string, progress: number) => void): Promise<Record<string, string>> {
    const prompt = await this.buildRFPChunkPrompt(context, sectionNames);
    
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseAIResponse(content);
    } catch (error) {
      console.error('[AIService] RFP chunk generation error:', error);
      throw new Error(`Failed to generate RFP chunk for sections: ${sectionNames.join(', ')}`);
    }
  }

  private async buildRFPChunkPrompt(context: DocumentContext & { extractedRequirements?: any }, sectionNames: string[]): Promise<string> {
    // Build a focused prompt for specific RFP sections
    let prompt = '';

    // Add extracted requirements if available and relevant for technical/functional sections
    const technicalSections = ['TECHNICAL_REQUIREMENTS', 'FUNCTIONAL_REQUIREMENTS', 'SCOPE_OF_WORK', 'IMPLEMENTATION_APPROACH'];
    if (context.extractedRequirements && sectionNames.some(s => technicalSections.includes(s))) {
      prompt += `IMPORTANT: Address these extracted RFP requirements in your response:

=== EXTRACTED REQUIREMENTS ===
`;
      if (context.extractedRequirements.overview) {
        prompt += `\nOVERVIEW:\n${context.extractedRequirements.overview}\n`;
      }
      if (context.extractedRequirements.requirements) {
        prompt += `\nREQUIREMENTS:\n`;
        for (const req of context.extractedRequirements.requirements) {
          prompt += `- ${req.category}: ${req.description}\n`;
          if (req.specifications?.length > 0) {
            for (const spec of req.specifications) {
              prompt += `  • ${spec}\n`;
            }
          }
        }
      }
      prompt += `=== END REQUIREMENTS ===\n\n`;
    }

    prompt += `You are helping create specific sections of a Request for Proposal (RFP) response for ${context.organizationName} regarding ${context.projectName}.

Generate ONLY these sections with detailed, comprehensive content:
${sectionNames.join(', ')}

Context:
`;

    // Add company info
    if (context.companyInfo) {
      prompt += `\nCOMPANY INFO:
Company: ${context.companyInfo.company_name}
Description: ${context.companyInfo.description || 'Not specified'}
Services: ${context.companyInfo.services || 'Not specified'}
Capabilities: ${context.companyInfo.capabilities || 'Not specified'}
Differentiators: ${context.companyInfo.differentiators || 'Not specified'}
`;
    }

    // Add section-specific instructions
    const sectionInstructions: Record<string, string> = {
      EXECUTIVE_SUMMARY: 'Write compelling executive summary demonstrating understanding (2-3 paragraphs)',
      COMPANY_OVERVIEW: 'Detailed company overview using ONLY provided facts (3 paragraphs)',
      PROJECT_BACKGROUND: 'Demonstrate understanding of project and challenges (3 paragraphs)',
      SCOPE_OF_WORK: 'Detail approach to meeting requirements (4 paragraphs)',
      TECHNICAL_REQUIREMENTS: 'Explain how solution meets technical requirements (4-5 paragraphs)',
      FUNCTIONAL_REQUIREMENTS: 'Detail functional requirements coverage (4-5 paragraphs)',
      IMPLEMENTATION_APPROACH: 'Present methodology and phases (3 paragraphs)',
      TIMELINE_AND_MILESTONES: 'Provide timeline with milestones (2-3 paragraphs)',
      PRICING_STRUCTURE: 'Present pricing approach (2 paragraphs)',
      EVALUATION_CRITERIA: 'Address evaluation criteria (3 paragraphs)',
      SUBMISSION_INSTRUCTIONS: 'Confirm compliance (1-2 paragraphs)',
      TERMS_AND_CONDITIONS: 'Acknowledge terms (1-2 paragraphs)'
    };

    prompt += '\n\nGenerate these sections with the following requirements:\n';
    sectionNames.forEach(section => {
      prompt += `\n${section}: ${sectionInstructions[section] || 'Generate comprehensive content'}`;
    });

    prompt += '\n\nFormat: SECTION_NAME: [detailed content with citations]';
    prompt += '\n\nIMPORTANT: Generate substantial, detailed content for each section. Include citations [Source: filename] where relevant.';

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
        max_tokens: 8000,
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
      // Build document context - using summaries where available
      // Prioritize documents: Company Info first, then RFI/RFP, then others
      const sortedDocs = params.documents.sort((a, b) => {
        if (a.metadata?.type === 'company_info') return -1;
        if (b.metadata?.type === 'company_info') return 1;
        if (a.filename.toLowerCase().includes('rfi') || a.filename.toLowerCase().includes('rfp')) return -1;
        if (b.filename.toLowerCase().includes('rfi') || b.filename.toLowerCase().includes('rfp')) return 1;
        return 0;
      });
      
      const documentContext = sortedDocs.map(doc => {
        let content = doc.content;
        
        // Parse content if it's JSON (shouldn't happen with summaries, but just in case)
        if (typeof content === 'string' && content.startsWith('{') && !content.includes('Summary:')) {
          try {
            const parsed = JSON.parse(content);
            content = parsed.text || JSON.stringify(parsed, null, 2);
          } catch (e) {
            // Use as-is if not valid JSON
          }
        }
        
        return `=== ${doc.filename} ===\n${content}\n`;
      }).join('\n\n');
      
      console.log(`[AIService] Document context built: ${sortedDocs.length} docs using summaries where available`);
      
      // Build questions list
      const questionsList = params.questions.map((q, idx) => 
        `${idx + 1}. ${q.text} (ID: ${q.id})`
      ).join('\n');
      
      const prompt = `You are analyzing company documents to answer RFI questions as a vendor responding to a client's request. 
The documents include AI-generated summaries and key extracted information from larger documents.

IMPORTANT: 
- The "Company Information" document contains critical details about our company that should be used prominently
- Reference specific company capabilities, certifications, and differentiators when relevant
- Use concrete examples from past projects when available
- Documents may be provided as summaries with key points and extracted data
- Focus on the most relevant information from each document
- If documents don't contain relevant information for a question, clearly state what information is missing

SUPPORTING DOCUMENTS (includes summaries where applicable):
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
        max_tokens: 8000,
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

  async processChatMessage(params: {
    message: string;
    context: any;
  }): Promise<{
    message: string;
    action?: {
      type: string;
      data: any;
    };
    suggestions?: string[];
  }> {
    const { message, context } = params;

    // Build a comprehensive prompt for the AI
    const prompt = `You are an AI assistant helping with ${context.projectType} document preparation.

Current Project Context:
- Project: ${context.projectName} (${context.projectType})
- Documents uploaded: ${context.documentCount}
- Draft status: ${context.hasDraft ? 'Generated' : 'Not generated'}
${context.hasDraft ? `- Draft sections: ${context.draftSections.join(', ')}` : ''}
- Questions: ${context.questionCount} total, ${context.answeredQuestions} answered
- Company: ${context.companyInfo?.company_name || 'Not configured'}

User Message: "${message}"

Analyze the user's intent and provide a helpful response. If they want to edit the draft, provide specific changes.

IMPORTANT INSTRUCTIONS:
1. If the user wants to edit/modify/update the draft, you MUST:
   - Set action.type to "update_draft"
   - Provide the complete updated sections in action.data.sections
   - Include ALL sections, even unchanged ones
   - Preserve the exact section names (keys) from the current draft

2. If the user asks about the project, provide helpful information without an action.

3. If the user wants to generate something new, suggest the appropriate action.

Current draft content for reference:
${context.currentDraftContent ? JSON.stringify(context.currentDraftContent, null, 2) : 'No draft yet'}

Response format:
{
  "message": "Your helpful response to the user",
  "action": {
    "type": "update_draft" | "generate_draft" | "extract_questions" | null,
    "data": {
      "sections": { ... } // For update_draft, include ALL sections
    }
  },
  "suggestions": ["Optional suggestion 1", "Optional suggestion 2"]
}

Respond with valid JSON only.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';

      // Parse the JSON response
      try {
        const parsed = JSON.parse(content);
        return {
          message: parsed.message || 'I can help with that.',
          action: parsed.action,
          suggestions: parsed.suggestions
        };
      } catch (parseError) {
        // If JSON parsing fails, try to extract a message
        console.error('Failed to parse AI response as JSON:', parseError);
        return {
          message: content || 'I understand. Let me help you with that.',
          action: undefined,
          suggestions: []
        };
      }
    } catch (error) {
      console.error('Chat AI error:', error);
      return {
        message: 'I apologize, but I encountered an error processing your request. Please try again.',
        action: undefined,
        suggestions: ['Try rephrasing your request', 'Check the help menu for available commands']
      };
    }
  }
}