import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!
});

export interface DocumentSummary {
  originalLength: number;
  summaryLength: number;
  keyPoints: string[];
  extractedData: {
    scope?: string;
    requirements?: string;
    timeline?: string;
    budget?: string;
    deliverables?: string;
    technicalSpecs?: string;
    evaluationCriteria?: string;
  };
  fullSummary: string;
}

export class DocumentSummarizer {
  private readonly MAX_CHUNK_SIZE = 15000; // Characters per chunk for summarization
  private readonly MAX_SUMMARY_SIZE = 2000; // Max characters per document summary
  
  async summarizeDocument(content: string, filename: string, projectType: 'RFI' | 'RFP'): Promise<DocumentSummary> {
    const originalLength = content.length;
    console.log(`[DocumentSummarizer] Processing ${filename} (${originalLength} chars)`);
    
    // If content is already small enough, just extract key information
    if (originalLength <= this.MAX_SUMMARY_SIZE) {
      console.log(`[DocumentSummarizer] ${filename} is small enough, skipping summarization`);
      return {
        originalLength,
        summaryLength: originalLength,
        keyPoints: this.extractKeyPoints(content),
        extractedData: this.quickExtractData(content),
        fullSummary: content
      };
    }
    
    // For large documents, use AI to summarize
    if (originalLength <= this.MAX_CHUNK_SIZE) {
      // Single chunk summarization
      console.log(`[DocumentSummarizer] ${filename} requires single-chunk summarization`);
      return await this.summarizeSingleChunk(content, filename, projectType);
    } else {
      // Multi-chunk summarization
      console.log(`[DocumentSummarizer] ${filename} requires multi-chunk summarization (${Math.ceil(originalLength / this.MAX_CHUNK_SIZE)} chunks)`);
      return await this.summarizeMultipleChunks(content, filename, projectType);
    }
  }
  
  private async summarizeSingleChunk(content: string, filename: string, projectType: 'RFI' | 'RFP'): Promise<DocumentSummary> {
    const prompt = `You are analyzing a document "${filename}" for a ${projectType} project. 
    
Please provide:
1. A concise summary (max 500 words) capturing the most important information
2. Extract specific data for these categories if present:
   - Scope of work
   - Requirements (technical and functional)
   - Timeline/Schedule
   - Budget/Pricing information
   - Deliverables
   - Technical specifications
   - Evaluation criteria

Format your response as:
SUMMARY: [concise summary]
SCOPE: [scope information or "Not specified"]
REQUIREMENTS: [requirements or "Not specified"]
TIMELINE: [timeline info or "Not specified"]
BUDGET: [budget info or "Not specified"]
DELIVERABLES: [deliverables or "Not specified"]
TECHNICAL_SPECS: [technical details or "Not specified"]
EVALUATION: [evaluation criteria or "Not specified"]
KEY_POINTS:
- [key point 1]
- [key point 2]
- [key point 3]
(continue as needed)

Document content:
${content}`;

    try {
      console.log(`[DocumentSummarizer] Sending to Groq for fast summarization...`);
      const startTime = Date.now();
      
      let response;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          response = await groq.chat.completions.create({
            model: 'llama-3.1-70b-versatile',
            max_tokens: 2000,
            temperature: 0.3,
            messages: [{
              role: 'user',
              content: prompt
            }]
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          if (error.status === 429 && retries < maxRetries - 1) {
            retries++;
            const retryAfter = 5; // Groq typically has shorter retry windows
            console.log(`[DocumentSummarizer] Rate limited, waiting ${retryAfter}s before retry ${retries}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          } else {
            throw error;
          }
        }
      }
      
      if (!response) {
        throw new Error('Failed to get response after retries');
      }
      
      const duration = Date.now() - startTime;
      console.log(`[DocumentSummarizer] Groq responded in ${duration}ms`);
      
      const result = response.choices[0]?.message?.content || '';
      const summary = this.parseSummaryResponse(result, content.length);
      console.log(`[DocumentSummarizer] Summary extracted - ${summary.summaryLength} chars, ${summary.keyPoints.length} key points`);
      
      return summary;
    } catch (error) {
      console.error('[DocumentSummarizer] Summarization error:', error);
      console.log('[DocumentSummarizer] Falling back to basic extraction');
      // Fallback to basic extraction
      return {
        originalLength: content.length,
        summaryLength: Math.min(content.length, this.MAX_SUMMARY_SIZE),
        keyPoints: this.extractKeyPoints(content),
        extractedData: this.quickExtractData(content),
        fullSummary: content.substring(0, this.MAX_SUMMARY_SIZE) + '...'
      };
    }
  }
  
  private async summarizeMultipleChunks(content: string, filename: string, projectType: 'RFI' | 'RFP'): Promise<DocumentSummary> {
    // Split content into manageable chunks
    const chunks = this.splitIntoChunks(content, this.MAX_CHUNK_SIZE);
    const chunkSummaries: string[] = [];
    
    // Summarize each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkPrompt = `Summarize this part (${i + 1} of ${chunks.length}) of document "${filename}" for a ${projectType} project.
Focus on extracting key information about scope, requirements, timeline, budget, and deliverables.

Content:
${chunks[i]}

Provide a concise summary (max 300 words):`;

      try {
        let response;
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
          try {
            response = await groq.chat.completions.create({
              model: 'llama-3.1-70b-versatile',
              max_tokens: 500,
              temperature: 0.3,
              messages: [{
                role: 'user',
                content: chunkPrompt
              }]
            });
            break; // Success, exit retry loop
          } catch (error: any) {
            if (error.status === 429 && retries < maxRetries - 1) {
              retries++;
              const retryAfter = 5; // Groq typically has shorter retry windows
              console.log(`[DocumentSummarizer] Rate limited on chunk ${i + 1}, waiting ${retryAfter}s before retry ${retries}/${maxRetries}`);
              await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            } else {
              throw error;
            }
          }
        }
        
        if (response) {
          const summary = response.choices[0]?.message?.content || '';
          chunkSummaries.push(summary);
        } else {
          throw new Error('Failed to get response after retries');
        }
      } catch (error) {
        console.error(`Error summarizing chunk ${i + 1}:`, error);
        chunkSummaries.push(chunks[i].substring(0, 300) + '...');
      }
    }
    
    // Combine chunk summaries into final summary
    const combinedSummary = chunkSummaries.join('\n\n');
    
    // Do a final summarization of the combined summaries
    const finalPrompt = `You've received summaries of different parts of a document "${filename}" for a ${projectType} project.
Please consolidate these into a final summary with extracted data.

Format your response as:
SUMMARY: [consolidated summary]
SCOPE: [scope information or "Not specified"]
REQUIREMENTS: [requirements or "Not specified"]
TIMELINE: [timeline info or "Not specified"]
BUDGET: [budget info or "Not specified"]
DELIVERABLES: [deliverables or "Not specified"]
TECHNICAL_SPECS: [technical details or "Not specified"]
EVALUATION: [evaluation criteria or "Not specified"]
KEY_POINTS:
- [key point 1]
- [key point 2]
(continue as needed)

Chunk summaries:
${combinedSummary}`;

    try {
      let response;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          response = await groq.chat.completions.create({
            model: 'llama-3.1-70b-versatile',
            max_tokens: 2000,
            temperature: 0.3,
            messages: [{
              role: 'user',
              content: finalPrompt
            }]
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          if (error.status === 429 && retries < maxRetries - 1) {
            retries++;
            const retryAfter = 5; // Groq typically has shorter retry windows
            console.log(`[DocumentSummarizer] Rate limited on final summary, waiting ${retryAfter}s before retry ${retries}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          } else {
            throw error;
          }
        }
      }
      
      if (!response) {
        throw new Error('Failed to get response after retries');
      }
      
      const result = response.choices[0]?.message?.content || '';
      return this.parseSummaryResponse(result, content.length);
    } catch (error) {
      console.error('Final summarization error:', error);
      return {
        originalLength: content.length,
        summaryLength: combinedSummary.length,
        keyPoints: this.extractKeyPoints(combinedSummary),
        extractedData: this.quickExtractData(combinedSummary),
        fullSummary: combinedSummary
      };
    }
  }
  
  private splitIntoChunks(content: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          // Single line is too long, split it
          chunks.push(line.substring(0, chunkSize));
          currentChunk = line.substring(chunkSize);
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  private parseSummaryResponse(response: string, originalLength: number): DocumentSummary {
    const lines = response.split('\n');
    const extractedData: any = {};
    let summary = '';
    const keyPoints: string[] = [];
    let inKeyPoints = false;
    
    for (const line of lines) {
      if (line.startsWith('SUMMARY:')) {
        summary = line.substring(8).trim();
      } else if (line.startsWith('SCOPE:')) {
        extractedData.scope = line.substring(6).trim();
      } else if (line.startsWith('REQUIREMENTS:')) {
        extractedData.requirements = line.substring(13).trim();
      } else if (line.startsWith('TIMELINE:')) {
        extractedData.timeline = line.substring(9).trim();
      } else if (line.startsWith('BUDGET:')) {
        extractedData.budget = line.substring(7).trim();
      } else if (line.startsWith('DELIVERABLES:')) {
        extractedData.deliverables = line.substring(13).trim();
      } else if (line.startsWith('TECHNICAL_SPECS:')) {
        extractedData.technicalSpecs = line.substring(16).trim();
      } else if (line.startsWith('EVALUATION:')) {
        extractedData.evaluationCriteria = line.substring(11).trim();
      } else if (line.startsWith('KEY_POINTS:')) {
        inKeyPoints = true;
      } else if (inKeyPoints && line.trim().startsWith('-')) {
        keyPoints.push(line.trim().substring(1).trim());
      }
    }
    
    // Clean up extracted data
    Object.keys(extractedData).forEach(key => {
      if (extractedData[key] === 'Not specified' || !extractedData[key]) {
        delete extractedData[key];
      }
    });
    
    return {
      originalLength,
      summaryLength: summary.length,
      keyPoints,
      extractedData,
      fullSummary: summary || response.substring(0, this.MAX_SUMMARY_SIZE)
    };
  }
  
  private extractKeyPoints(content: string): string[] {
    const keyPoints: string[] = [];
    const lines = content.split('\n');
    
    // Look for bullet points or numbered lists
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-•*]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        keyPoints.push(trimmed.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, ''));
      }
    }
    
    return keyPoints.slice(0, 10); // Limit to 10 key points
  }
  
  private quickExtractData(content: string): any {
    const data: any = {};
    
    // Simple pattern matching for common sections
    const patterns = [
      { key: 'scope', pattern: /(?:scope of work|project scope|scope)[\s:]*([^]*?)(?=\n(?:deliverables|requirements|timeline|budget)|$)/i },
      { key: 'requirements', pattern: /(?:requirements|technical requirements|functional requirements)[\s:]*([^]*?)(?=\n(?:deliverables|scope|timeline|budget)|$)/i },
      { key: 'timeline', pattern: /(?:timeline|schedule|project duration|deadlines?)[\s:]*([^]*?)(?=\n(?:deliverables|requirements|scope|budget)|$)/i },
      { key: 'budget', pattern: /(?:budget|pricing|cost|financial)[\s:]*([^]*?)(?=\n(?:deliverables|requirements|scope|timeline)|$)/i },
      { key: 'deliverables', pattern: /(?:deliverables|outputs|expected results)[\s:]*([^]*?)(?=\n(?:requirements|scope|timeline|budget)|$)/i }
    ];
    
    for (const { key, pattern } of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        data[key] = match[1].trim().substring(0, 500); // Limit each section
      }
    }
    
    return data;
  }
  
  async summarizeMultipleDocuments(documents: any[], projectType: 'RFI' | 'RFP'): Promise<string> {
    const summaries: string[] = [];
    console.log(`[DocumentSummarizer] Processing ${documents.length} documents for ${projectType}`);
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`[DocumentSummarizer] Processing document ${i + 1}/${documents.length}: ${doc.filename}`);
      
      let content = '';
      try {
        const parsedContent = JSON.parse(doc.content);
        content = parsedContent.text || JSON.stringify(parsedContent);
      } catch {
        content = doc.content;
      }
      
      const summary = await this.summarizeDocument(content, doc.filename, projectType);
      
      summaries.push(`
=== Document: ${doc.filename} ===
Summary: ${summary.fullSummary}
${summary.extractedData.scope ? `Scope: ${summary.extractedData.scope}` : ''}
${summary.extractedData.requirements ? `Requirements: ${summary.extractedData.requirements}` : ''}
${summary.extractedData.timeline ? `Timeline: ${summary.extractedData.timeline}` : ''}
${summary.extractedData.budget ? `Budget: ${summary.extractedData.budget}` : ''}
${summary.extractedData.deliverables ? `Deliverables: ${summary.extractedData.deliverables}` : ''}
${summary.keyPoints.length > 0 ? `Key Points:\n${summary.keyPoints.map(p => `- ${p}`).join('\n')}` : ''}
`);
    }
    
    console.log(`[DocumentSummarizer] All documents processed`);
    return summaries.join('\n\n');
  }
}