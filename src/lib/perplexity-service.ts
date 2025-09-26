import Anthropic from '@anthropic-ai/sdk';

// Perplexity API configuration
const PERPLEXITY_API_URL = 'https://api.perplexity.ai';
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// We'll use Anthropic for analysis since we already have it
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface PerplexitySearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  publishedDate?: string;
  lastUpdated?: string;
}

export interface ExtractedWebInfo {
  siteName: string;
  siteType: 'business' | 'government' | 'educational' | 'news' | 'other';
  summary: string;
  keyInformation: Record<string, any>;
  relevantSections: Array<{
    title: string;
    content: string;
    relevance: string;
  }>;
  extractedData: {
    companyInfo?: {
      name?: string;
      description?: string;
      services?: string[];
      products?: string[];
      locations?: string[];
      contact?: {
        email?: string;
        phone?: string;
        address?: string;
      };
      certifications?: string[];
      experience?: string;
      clients?: string[];
    };
    technicalSpecs?: {
      capabilities?: string[];
      technologies?: string[];
      integrations?: string[];
    };
    pricing?: {
      models?: string[];
      tiers?: string[];
      estimates?: string[];
    };
  };
  sources: string[];
  extractedAt: string;
}

export class PerplexityService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || PERPLEXITY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[PerplexityService] No API key provided, will use fallback web fetch');
    }
  }

  /**
   * Perform intelligent extraction from a website URL
   */
  async extractWebsiteInformation(url: string, projectContext?: string): Promise<ExtractedWebInfo> {
    console.log(`[PerplexityService] Starting intelligent extraction for ${url}`);

    try {
      // Phase 1: Identify what type of website this is
      const siteType = await this.identifySiteType(url);
      console.log(`[PerplexityService] Identified site type: ${siteType.siteType}`);

      // Phase 2: Perform targeted extraction based on site type
      const extractedInfo = await this.performTargetedExtraction(url, siteType, projectContext);

      return extractedInfo;
    } catch (error) {
      console.error(`[PerplexityService] Error extracting from ${url}:`, error);
      // Fallback to basic extraction
      return this.fallbackExtraction(url);
    }
  }

  /**
   * Phase 1: Identify the type of website
   */
  private async identifySiteType(url: string): Promise<{ siteType: ExtractedWebInfo['siteType']; siteName: string; summary: string }> {
    // Use Perplexity to get basic info about the site
    const searchQuery = `What type of website is ${url}? Is it a business, government site, educational institution, or news site? What is the organization's name and primary purpose?`;

    try {
      const searchResults = await this.perplexitySearch(searchQuery, [url]);

      // Analyze the results to determine site type
      const analysisPrompt = `Based on this information about ${url}, classify the website:

${JSON.stringify(searchResults, null, 2)}

Respond with a JSON object:
{
  "siteType": "business" | "government" | "educational" | "news" | "other",
  "siteName": "organization or website name",
  "summary": "brief 1-2 sentence description of what this organization does"
}`;

      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{ role: 'user', content: analysisPrompt }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text);
          return parsed;
        } catch (e) {
          // Fallback parsing
          return {
            siteType: 'other',
            siteName: new URL(url).hostname,
            summary: 'Website information'
          };
        }
      }
    } catch (error) {
      console.error('[PerplexityService] Error identifying site type:', error);
      return {
        siteType: 'other',
        siteName: new URL(url).hostname,
        summary: 'Website information'
      };
    }

    return {
      siteType: 'other',
      siteName: new URL(url).hostname,
      summary: 'Unable to determine website type'
    };
  }

  /**
   * Phase 2: Perform targeted extraction based on site type
   */
  private async performTargetedExtraction(
    url: string,
    siteInfo: { siteType: ExtractedWebInfo['siteType']; siteName: string; summary: string },
    projectContext?: string
  ): Promise<ExtractedWebInfo> {
    console.log(`[PerplexityService] Performing targeted extraction for ${siteInfo.siteType} site`);

    // Build targeted queries based on site type
    const queries = this.buildTargetedQueries(url, siteInfo.siteType, projectContext);

    // Execute searches
    const searchPromises = queries.map(query => this.perplexitySearch(query, [url]));
    const searchResults = await Promise.all(searchPromises);

    // Combine and analyze results
    const combinedResults = searchResults.flat();

    // Use AI to structure the extracted information
    const structuredInfo = await this.structureExtractedInfo(url, siteInfo, combinedResults, projectContext);

    return structuredInfo;
  }

  /**
   * Build targeted search queries based on site type
   */
  private buildTargetedQueries(url: string, siteType: ExtractedWebInfo['siteType'], projectContext?: string): string[] {
    const domain = new URL(url).hostname;
    const baseQueries: string[] = [];

    // Common queries for all types
    baseQueries.push(
      `site:${domain} company overview about us mission`,
      `site:${domain} contact information email phone address`
    );

    // Type-specific queries
    switch (siteType) {
      case 'business':
        baseQueries.push(
          `site:${domain} products services offerings solutions`,
          `site:${domain} certifications compliance accreditations awards`,
          `site:${domain} clients customers case studies testimonials`,
          `site:${domain} experience expertise team leadership`,
          `site:${domain} pricing plans cost rates`,
          `site:${domain} technology stack capabilities infrastructure`,
          `site:${domain} support SLA guarantees uptime`
        );
        break;

      case 'government':
        baseQueries.push(
          `site:${domain} services programs initiatives`,
          `site:${domain} requirements regulations compliance`,
          `site:${domain} procurement bidding RFP contracts`,
          `site:${domain} budget funding allocations`,
          `site:${domain} departments divisions offices`
        );
        break;

      case 'educational':
        baseQueries.push(
          `site:${domain} programs academics curriculum`,
          `site:${domain} enrollment students faculty staff`,
          `site:${domain} technology infrastructure IT services`,
          `site:${domain} partnerships collaborations`,
          `site:${domain} achievements rankings accreditation`
        );
        break;

      default:
        baseQueries.push(
          `site:${domain} main content key information`,
          `site:${domain} latest updates news announcements`
        );
    }

    // Add project-specific queries if context provided
    if (projectContext) {
      baseQueries.push(
        `site:${domain} ${projectContext}`,
        `site:${domain} E-rate telecommunications education technology`
      );
    }

    return baseQueries;
  }

  /**
   * Execute Perplexity search
   */
  private async perplexitySearch(query: string, domains?: string[]): Promise<any[]> {
    if (!this.apiKey) {
      console.log('[PerplexityService] No API key, using mock data');
      return this.getMockSearchResults(query);
    }

    try {
      const requestBody = {
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts specific information from websites.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        search_domain_filter: domains,
        search_recency_filter: 'year',
        max_tokens: 2000
      };

      const response = await fetch(`${PERPLEXITY_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract citations and content
      const results = [];
      if (data.citations) {
        data.citations.forEach((citation: any, index: number) => {
          results.push({
            title: citation.title || `Result ${index + 1}`,
            url: citation.url,
            snippet: citation.snippet || '',
            content: data.choices?.[0]?.message?.content || ''
          });
        });
      }

      return results;
    } catch (error) {
      console.error('[PerplexityService] Search error:', error);
      return this.getMockSearchResults(query);
    }
  }

  /**
   * Structure the extracted information using AI
   */
  private async structureExtractedInfo(
    url: string,
    siteInfo: { siteType: ExtractedWebInfo['siteType']; siteName: string; summary: string },
    searchResults: any[],
    projectContext?: string
  ): Promise<ExtractedWebInfo> {
    const prompt = `Analyze and structure this information extracted from ${url}:

Site Type: ${siteInfo.siteType}
Site Name: ${siteInfo.siteName}
Summary: ${siteInfo.summary}

${projectContext ? `Project Context: ${projectContext}` : ''}

Search Results:
${JSON.stringify(searchResults.slice(0, 10), null, 2)}

Please structure this into a comprehensive summary with:
1. Key company/organization information
2. Relevant products/services for an RFP response
3. Technical capabilities if applicable
4. Contact information
5. Any certifications or qualifications
6. Relevant experience or case studies

Focus on information that would be useful for evaluating this organization as a potential vendor or understanding their requirements as a client.

Respond with structured JSON matching the ExtractedWebInfo format.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Parse and return structured info
        try {
          const structured = JSON.parse(content.text);
          return {
            ...siteInfo,
            keyInformation: structured.keyInformation || {},
            relevantSections: structured.relevantSections || [],
            extractedData: structured.extractedData || {},
            sources: searchResults.map(r => r.url).filter(Boolean),
            extractedAt: new Date().toISOString()
          };
        } catch (e) {
          // Fallback to basic structure
          return this.createBasicStructure(url, siteInfo, searchResults);
        }
      }
    } catch (error) {
      console.error('[PerplexityService] Error structuring info:', error);
      return this.createBasicStructure(url, siteInfo, searchResults);
    }

    return this.createBasicStructure(url, siteInfo, searchResults);
  }

  /**
   * Create basic structure from search results
   */
  private createBasicStructure(
    url: string,
    siteInfo: { siteType: ExtractedWebInfo['siteType']; siteName: string; summary: string },
    searchResults: any[]
  ): ExtractedWebInfo {
    const relevantSections = searchResults.map(result => ({
      title: result.title || 'Information',
      content: result.snippet || result.content || '',
      relevance: 'Extracted from website'
    })).filter(section => section.content);

    return {
      ...siteInfo,
      keyInformation: {
        url,
        extractedResults: searchResults.length,
        timestamp: new Date().toISOString()
      },
      relevantSections,
      extractedData: {},
      sources: searchResults.map(r => r.url).filter(Boolean),
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Fallback extraction when Perplexity is unavailable
   */
  private async fallbackExtraction(url: string): Promise<ExtractedWebInfo> {
    return {
      siteName: new URL(url).hostname,
      siteType: 'other',
      summary: `Information extracted from ${url}`,
      keyInformation: {
        url,
        method: 'fallback',
        timestamp: new Date().toISOString()
      },
      relevantSections: [],
      extractedData: {},
      sources: [url],
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Get mock search results for testing
   */
  private getMockSearchResults(query: string): any[] {
    return [
      {
        title: 'Company Overview',
        url: 'https://example.com/about',
        snippet: 'Mock search result for testing. This would contain actual extracted content from the website.',
        content: 'Full content would appear here with detailed information about the company, its services, and capabilities.'
      }
    ];
  }

  /**
   * Format extracted info for display
   */
  formatForDisplay(info: ExtractedWebInfo): string {
    let formatted = `# ${info.siteName}\n\n`;
    formatted += `**Type:** ${info.siteType}\n`;
    formatted += `**Summary:** ${info.summary}\n\n`;

    if (info.extractedData.companyInfo) {
      formatted += `## Company Information\n`;
      const company = info.extractedData.companyInfo;
      if (company.name) formatted += `**Name:** ${company.name}\n`;
      if (company.description) formatted += `**Description:** ${company.description}\n`;
      if (company.services?.length) formatted += `**Services:** ${company.services.join(', ')}\n`;
      if (company.certifications?.length) formatted += `**Certifications:** ${company.certifications.join(', ')}\n`;
      if (company.contact?.email) formatted += `**Email:** ${company.contact.email}\n`;
      if (company.contact?.phone) formatted += `**Phone:** ${company.contact.phone}\n`;
      formatted += '\n';
    }

    if (info.relevantSections.length > 0) {
      formatted += `## Relevant Information\n\n`;
      info.relevantSections.forEach(section => {
        formatted += `### ${section.title}\n`;
        formatted += `${section.content}\n`;
        formatted += `*Relevance: ${section.relevance}*\n\n`;
      });
    }

    formatted += `\n---\n*Extracted: ${new Date(info.extractedAt).toLocaleString()}*\n`;
    formatted += `*Sources: ${info.sources.length} pages analyzed*`;

    return formatted;
  }
}

export default PerplexityService;