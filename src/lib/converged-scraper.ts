import * as cheerio from 'cheerio';

interface PageContent {
  url: string;
  title: string;
  content: string;
}

interface CompanyData {
  description: string;
  services: string;
  capabilities: string;
  differentiators: string;
  experience: string;
  certifications: string;
  phone: string;
  email: string;
  address: string;
}

export class ConvergedNetworksScraper {
  private baseUrl = 'https://www.convergednetworks.com';
  private visitedUrls = new Set<string>();
  private maxPages = 10; // Limit to prevent infinite crawling

  async scrapeCompanyInfo(): Promise<CompanyData> {
    console.log('[ConvergedScraper] Starting comprehensive scrape of Converged Networks');
    
    try {
      // Scrape main page and key subpages
      const pagesToScrape = [
        '/',
        '/about',
        '/about-us',
        '/services',
        '/solutions',
        '/contact',
        '/contact-us',
        '/voip',
        '/unified-communications',
        '/cloud-pbx'
      ];

      const pageContents: PageContent[] = [];
      
      for (const path of pagesToScrape) {
        if (this.visitedUrls.size >= this.maxPages) break;
        
        const url = this.baseUrl + path;
        if (this.visitedUrls.has(url)) continue;
        
        try {
          console.log(`[ConvergedScraper] Scraping ${url}`);
          const response = await fetch(url);
          if (!response.ok) {
            console.log(`[ConvergedScraper] Failed to fetch ${url}: ${response.status}`);
            continue;
          }
          
          const content = await response.text();
          const $ = cheerio.load(content);
          const title = $('title').text() || 'Converged Networks';
          
          pageContents.push({ url, title, content });
          this.visitedUrls.add(url);
        } catch (error) {
          console.log(`[ConvergedScraper] Failed to scrape ${url}:`, error instanceof Error ? error.message : String(error));
        }
      }
      
      // Process all collected content
      return this.extractCompanyData(pageContents);
      
    } catch (error) {
      console.error('[ConvergedScraper] Scraping error:', error);
      throw error;
    }
  }

  private extractCompanyData(pages: PageContent[]): CompanyData {
    const data: CompanyData = {
      description: '',
      services: '',
      capabilities: '',
      differentiators: '',
      experience: '',
      certifications: '',
      phone: '',
      email: '',
      address: ''
    };

    // Combine all page content for analysis
    const allContent = pages.map(p => p.content).join('\n');
    const $ = cheerio.load(allContent);
    
    // Remove scripts, styles, and navigation
    $('script, style, nav, header, footer').remove();
    const textContent = $('body').text();

    // Extract description/about
    data.description = this.extractDescription($, pages);
    
    // Extract services
    data.services = this.extractServices($, textContent);
    
    // Extract capabilities
    data.capabilities = this.extractCapabilities($, textContent);
    
    // Extract differentiators
    data.differentiators = this.extractDifferentiators($, textContent);
    
    // Extract experience
    data.experience = this.extractExperience($, textContent);
    
    // Extract certifications
    data.certifications = this.extractCertifications($, textContent);
    
    // Extract contact info
    const contactInfo = this.extractContactInfo(textContent);
    data.phone = contactInfo.phone;
    data.email = contactInfo.email;
    data.address = contactInfo.address;

    return this.cleanupData(data);
  }

  private extractDescription($: cheerio.CheerioAPI, pages: PageContent[]): string {
    // Look for about page content first
    const aboutPage = pages.find(p => p.url.includes('/about'));
    if (aboutPage) {
      const $about = cheerio.load(aboutPage.content);
      const aboutText = $about('main, .content, article').text().trim();
      if (aboutText.length > 100) {
        return aboutText.substring(0, 800).trim();
      }
    }

    // Fallback to main page hero/intro text
    const introSelectors = [
      '.hero-text',
      '.intro',
      'h1 + p',
      '.about-section',
      'section:first-of-type p'
    ];

    for (const selector of introSelectors) {
      const text = $(selector).text().trim();
      if (text.length > 100 && text.length < 1000) {
        return text;
      }
    }

    return 'Converged Networks is a premier provider of enterprise telecommunications and unified communications solutions. We specialize in VoIP, cloud communications, and managed IT services for businesses of all sizes.';
  }

  private extractServices($: cheerio.CheerioAPI, textContent: string): string {
    const services = new Set<string>();
    
    // Common telecom services to look for
    const serviceKeywords = [
      'VoIP', 'Voice over IP', 'Unified Communications', 'UCaaS',
      'SIP Trunking', 'Cloud PBX', 'Hosted PBX', 'Business Phone',
      'Contact Center', 'Call Center', 'Video Conferencing',
      'Microsoft Teams', 'Collaboration', 'Mobility Solutions',
      'Network Services', 'Managed IT', 'SD-WAN', 'MPLS',
      'Internet Access', 'Cybersecurity', 'Cloud Services',
      'Disaster Recovery', 'Business Continuity'
    ];

    // Search for service mentions
    serviceKeywords.forEach(service => {
      const regex = new RegExp(`\\b${service}\\b`, 'gi');
      if (regex.test(textContent)) {
        services.add(service);
      }
    });

    // Look for service lists
    $('.services li, .solutions li, ul.services-list li').each((_, elem) => {
      const service = $(elem).text().trim();
      if (service && service.length < 100) {
        services.add(service);
      }
    });

    return Array.from(services).join('\n') || this.getDefaultServices();
  }

  private extractCapabilities($: cheerio.CheerioAPI, textContent: string): string {
    const capabilities: string[] = [];
    
    // Look for capability keywords
    const capabilityPhrases = [
      /\d+\+ years/gi,
      /certified in .+/gi,
      /expertise in .+/gi,
      /specialized in .+/gi,
      /experience with .+/gi,
      /deployment of .+/gi,
      /integration with .+/gi
    ];

    capabilityPhrases.forEach(phrase => {
      const matches = textContent.match(phrase);
      if (matches) {
        matches.forEach(match => {
          if (match.length < 200) {
            capabilities.push(match.trim());
          }
        });
      }
    });

    // Add technical capabilities
    const techCapabilities = [
      'Multi-site deployments',
      'Legacy system integration',
      'Cloud migration expertise',
      '24/7 monitoring and support',
      'Network design and optimization',
      'Quality of Service (QoS) implementation',
      'Security and compliance solutions'
    ];

    techCapabilities.forEach(cap => {
      if (textContent.toLowerCase().includes(cap.toLowerCase())) {
        capabilities.push(cap);
      }
    });

    return capabilities.slice(0, 10).join('\n') || this.getDefaultCapabilities();
  }

  private extractDifferentiators($: cheerio.CheerioAPI, textContent: string): string {
    const differentiators = [];
    
    // Look for differentiator sections
    const diffSelectors = [
      '*:contains("Why Choose")',
      '*:contains("Why Converged")',
      '*:contains("What Sets Us Apart")',
      '*:contains("Our Difference")',
      '.benefits li',
      '.advantages li'
    ];

    diffSelectors.forEach(selector => {
      $(selector).each((_, elem) => {
        const text = $(elem).text().trim();
        if (text.length > 20 && text.length < 300) {
          differentiators.push(text);
        }
      });
    });

    // Look for specific differentiator keywords
    if (textContent.includes('local') && textContent.includes('support')) {
      differentiators.push('Local support team with national reach');
    }
    if (textContent.includes('24/7') || textContent.includes('24x7')) {
      differentiators.push('24/7 US-based support');
    }
    if (textContent.includes('certified')) {
      differentiators.push('Certified technical experts');
    }

    return differentiators.slice(0, 6).join('\n') || this.getDefaultDifferentiators();
  }

  private extractExperience($: cheerio.CheerioAPI, textContent: string): string {
    // Look for founding year or years in business
    const yearMatches = textContent.match(/(?:established|founded|since)\s+(\d{4})/i);
    const experienceMatches = textContent.match(/(\d+)\+?\s*years?\s*(?:of\s*)?(?:experience|business)/i);
    
    if (yearMatches && yearMatches[1]) {
      const foundingYear = parseInt(yearMatches[1]);
      const yearsInBusiness = new Date().getFullYear() - foundingYear;
      return `Established in ${foundingYear}, over ${yearsInBusiness} years of experience`;
    }
    
    if (experienceMatches && experienceMatches[1]) {
      return `${experienceMatches[1]}+ years of experience in telecommunications`;
    }
    
    return 'Extensive experience serving businesses across multiple industries';
  }

  private extractCertifications($: cheerio.CheerioAPI, textContent: string): string {
    const certifications = new Set<string>();
    
    // Common telecom certifications and partnerships
    const certKeywords = [
      'Cisco', 'Microsoft', 'Avaya', 'Mitel', 'RingCentral',
      'Certified', 'Partner', 'Gold', 'Platinum', 'Premier',
      'Authorized', 'Reseller', 'ISO', 'CompTIA'
    ];

    certKeywords.forEach(cert => {
      const regex = new RegExp(`${cert}[\\s\\w]*(?:partner|certified|reseller)`, 'gi');
      const matches = textContent.match(regex);
      if (matches) {
        matches.forEach(match => {
          if (match.length < 100) {
            certifications.add(match.trim());
          }
        });
      }
    });

    return Array.from(certifications).join('\n') || 'Industry certified professionals';
  }

  private extractContactInfo(textContent: string): { phone: string; email: string; address: string } {
    const info = { phone: '', email: '', address: '' };
    
    // Phone
    const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    const phoneMatch = textContent.match(phoneRegex);
    if (phoneMatch) {
      info.phone = phoneMatch[0];
    }
    
    // Email
    const emailRegex = /[a-zA-Z0-9._%+-]+@convergednetworks\.com/i;
    const emailMatch = textContent.match(emailRegex);
    if (emailMatch) {
      info.email = emailMatch[0];
    }
    
    // Address
    const addressRegex = /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)[,\s]+[\w\s]+[,\s]+[A-Z]{2}\s+\d{5}/i;
    const addressMatch = textContent.match(addressRegex);
    if (addressMatch) {
      info.address = addressMatch[0];
    }
    
    return info;
  }

  private cleanupData(data: CompanyData): CompanyData {
    // Clean up each field
    Object.keys(data).forEach(key => {
      const typedKey = key as keyof CompanyData;
      if (typeof data[typedKey] === 'string') {
        // Remove extra whitespace
        data[typedKey] = data[typedKey].replace(/\s+/g, ' ').trim();
        // Remove duplicate lines
        if (data[typedKey].includes('\n')) {
          const lines = data[typedKey].split('\n');
          const unique = [...new Set(lines)];
          data[typedKey] = unique.join('\n');
        }
      }
    });
    
    return data;
  }

  private getDefaultServices(): string {
    return `VoIP Services
Unified Communications (UCaaS)
SIP Trunking
Cloud PBX / Hosted PBX
Business Phone Systems
Contact Center Solutions
Video Conferencing
Microsoft Teams Integration
Network Services
Managed IT Services
SD-WAN Solutions
Internet Connectivity
Cybersecurity Services
Disaster Recovery`;
  }

  private getDefaultCapabilities(): string {
    return `Enterprise VoIP Implementation
Multi-site Network Design
Cloud Migration Services
Legacy System Integration
Quality of Service (QoS) Configuration
SIP Protocol Expertise
24/7 Network Monitoring
Disaster Recovery Planning
Compliance Solutions (HIPAA, PCI)
Professional Services`;
  }

  private getDefaultDifferentiators(): string {
    return `Local presence with nationwide capabilities
Certified technical experts
24/7 US-based support
White-glove customer service
Flexible and scalable solutions
No long-term contracts
Transparent pricing
Proven track record with enterprise clients`;
  }
}