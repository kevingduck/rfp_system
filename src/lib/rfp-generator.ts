import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType } from 'docx';
import { openDb } from './db';
import { AIService } from './ai-service';

export interface RFPSection {
  title: string;
  content: string;
  subsections?: RFPSection[];
}

export interface RFPData {
  projectName: string;
  organizationName: string;
  submissionDate: string;
  contactInfo: {
    name: string;
    email: string;
    phone: string;
  };
  sections: RFPSection[];
}

export class RFPGenerator {
  private projectId: string;
  private aiService: AIService;
  
  constructor(projectId: string) {
    this.projectId = projectId;
    this.aiService = new AIService();
  }
  
  async generateRFP(chatContext?: any): Promise<Buffer> {
    console.log(`[RFPGenerator] Starting RFP generation for project ${this.projectId}`);
    if (chatContext) {
      console.log(`[RFPGenerator] Using chat context with ${chatContext.responses?.length || 0} responses`);
    }
    
    const data = await this.collectRFPData(chatContext);
    console.log(`[RFPGenerator] Data collected, creating document...`);
    
    const doc = this.createDocument(data);
    console.log(`[RFPGenerator] Document created, converting to buffer...`);
    
    const buffer = await Packer.toBuffer(doc);
    console.log(`[RFPGenerator] RFP generation complete`);
    
    return buffer;
  }
  
  private async collectRFPData(chatContext?: any): Promise<RFPData> {
    const db = await openDb();
    
    const project = await db.get(
      `SELECT p.*, o.name as organization_name FROM projects p 
       LEFT JOIN organizations o ON p.organization_id = o.id 
       WHERE p.id = ? AND p.project_type = "RFP"`,
      this.projectId
    );
    
    if (!project) {
      throw new Error('RFP project not found');
    }
    
    const sections = await db.all(
      'SELECT * FROM project_sections WHERE project_id = ? ORDER BY order_index',
      this.projectId
    );
    
    const companyInfo = await db.get('SELECT * FROM company_info LIMIT 1');
    
    const documents = await db.all(
      'SELECT * FROM documents WHERE project_id = ?',
      this.projectId
    );
    
    const webSources = await db.all(
      'SELECT * FROM web_sources WHERE project_id = ?',
      this.projectId
    );
    
    return {
      projectName: project.name,
      organizationName: project.organization_name || 'Your Organization',
      submissionDate: new Date().toLocaleDateString(),
      contactInfo: {
        name: companyInfo?.company_name || 'Your Company',
        email: companyInfo?.email || 'contact@company.com',
        phone: companyInfo?.phone || '555-0123'
      },
      sections: await this.buildSections(sections, documents, webSources, chatContext)
    };
  }
  
  private async buildSections(sections: any[], documents: any[], webSources: any[], chatContext?: any): Promise<RFPSection[]> {
    console.log(`[RFPGenerator] Building sections with AI - ${documents.length} documents, ${webSources.length} web sources`);
    
    const db = await openDb();
    const project = await db.get(
      `SELECT p.*, o.name as organization_name FROM projects p 
       LEFT JOIN organizations o ON p.organization_id = o.id 
       WHERE p.id = ?`,
      this.projectId
    );
    const companyInfo = await db.get('SELECT * FROM company_info LIMIT 1');
    
    // Use AI to generate comprehensive content
    const aiContent = await this.aiService.generateRFPContent({
      projectType: 'RFP',
      projectName: project.name,
      organizationName: project.organization_name || 'Your Organization',
      documents: documents.map(doc => ({
        filename: doc.filename,
        content: doc.content,
        metadata: doc.metadata
      })),
      webSources: webSources.map(source => ({
        url: source.url,
        title: source.title,
        content: source.content
      })),
      companyInfo,
      chatContext
    });

    // Build comprehensive sections from AI-generated content
    const standardSections: RFPSection[] = [
      {
        title: 'Executive Summary',
        content: aiContent.executive_summary || await this.generateExecutiveSummary(documents, webSources)
      },
      {
        title: 'Company Overview',
        content: aiContent.company_overview || await this.generateCompanyOverview()
      },
      {
        title: 'Project Background',
        content: aiContent.project_background || 'This project aims to modernize our telecommunications infrastructure.'
      },
      {
        title: 'Scope of Work',
        content: aiContent.scope_of_work || 'The scope includes design, implementation, and support of a comprehensive VoIP solution.'
      },
      {
        title: 'Technical Requirements',
        content: aiContent.technical_requirements || await this.generateTechnicalApproach(documents, webSources)
      },
      {
        title: 'Functional Requirements',
        content: aiContent.functional_requirements || 'The solution must meet all functional requirements outlined in the attached documents.'
      },
      {
        title: 'Implementation Approach',
        content: aiContent.implementation_approach || 'We expect a phased implementation approach with minimal disruption to operations.'
      },
      {
        title: 'Timeline and Milestones',
        content: aiContent.timeline_and_milestones || await this.generateTimeline(documents, webSources)
      },
      {
        title: 'Pricing Structure',
        content: aiContent.pricing_structure || await this.generatePricing(documents, webSources)
      },
      {
        title: 'Evaluation Criteria',
        content: aiContent.evaluation_criteria || this.generateEvaluationCriteria()
      },
      {
        title: 'Submission Instructions',
        content: aiContent.submission_instructions || this.generateSubmissionInstructions()
      },
      {
        title: 'Terms and Conditions',
        content: aiContent.terms_and_conditions || this.generateTermsAndConditions()
      }
    ];
    
    // Add any custom sections from the database
    for (const section of sections) {
      standardSections.push({
        title: section.section_name,
        content: section.content || ''
      });
    }
    
    return standardSections;
  }
  
  private async generateExecutiveSummary(documents: any[], webSources: any[]): Promise<string> {
    let summary = 'We are pleased to submit this proposal in response to your Request for Proposal. ';
    
    if (documents.length > 0) {
      const relevantContent = documents
        .map(doc => JSON.parse(doc.content || '{}'))
        .filter(content => content.scope || content.requirements)
        .map(content => content.scope || content.requirements)
        .join(' ');
        
      if (relevantContent) {
        summary += `Based on your requirements, we understand that ${relevantContent.substring(0, 200)}... `;
      }
    }
    
    summary += 'Our solution leverages industry-leading VoIP technology to deliver reliable, scalable, and cost-effective communication services.';
    
    return summary;
  }
  
  private async generateCompanyOverview(): Promise<string> {
    const db = await openDb();
    const companyInfo = await db.get('SELECT * FROM company_info LIMIT 1');
    
    if (companyInfo) {
      return `${companyInfo.company_name} ${companyInfo.description || 'is a leading provider of VoIP solutions.'}
      
Capabilities: ${companyInfo.capabilities || 'Full-service VoIP implementation and support'}
Certifications: ${companyInfo.certifications || 'Industry standard certifications'}`;
    }
    
    return 'We are a leading provider of VoIP and telecommunications solutions with extensive experience in delivering enterprise-grade communication systems.';
  }
  
  private async generateTechnicalApproach(documents: any[], webSources: any[]): Promise<string> {
    return `Our technical approach includes:
    
1. Comprehensive needs assessment and network analysis
2. Custom VoIP solution design tailored to your requirements
3. Professional installation and configuration
4. Thorough testing and quality assurance
5. Training and documentation
6. Ongoing support and maintenance`;
  }
  
  private async generateTimeline(documents: any[], webSources: any[]): Promise<string> {
    return `Project Timeline:
    
Phase 1: Discovery and Assessment (2 weeks)
Phase 2: Solution Design (1 week)
Phase 3: Implementation (4-6 weeks)
Phase 4: Testing and Training (1 week)
Phase 5: Go-Live and Support (Ongoing)`;
  }
  
  private async generatePricing(documents: any[], webSources: any[]): Promise<string> {
    return `Pricing will be provided based on:
    
- Number of users/extensions
- Feature requirements
- Hardware needs
- Support level
- Contract terms

A detailed pricing breakdown will be provided upon further discussion of specific requirements.`;
  }
  
  private generateEvaluationCriteria(): string {
    return `Proposals will be evaluated based on the following weighted criteria:

1. Technical Solution Fit (30%)
   - Meets all technical requirements
   - Scalability and flexibility
   - Integration capabilities

2. Vendor Experience and Qualifications (25%)
   - Relevant experience
   - Technical certifications
   - Reference quality

3. Implementation Approach (20%)
   - Methodology and timeline
   - Risk mitigation
   - Transition planning

4. Cost and Value (15%)
   - Total cost of ownership
   - Price competitiveness
   - Value for investment

5. Support and Maintenance (10%)
   - SLA commitments
   - Support coverage
   - Ongoing partnership approach`;
  }
  
  private generateSubmissionInstructions(): string {
    return `Please submit your proposal according to these instructions:

1. Proposal Format:
   - Executive Summary (2-3 pages)
   - Technical Solution (10-15 pages)
   - Implementation Plan (5-7 pages)
   - Pricing Proposal (separate sealed envelope)
   - References and Case Studies
   - Required Forms and Certifications

2. Submission Requirements:
   - One (1) original and five (5) copies
   - One (1) electronic copy on USB drive
   - All materials in sealed envelope marked "RFP Response"

3. Submission Deadline:
   - Date: [30 days from issue date]
   - Time: 4:00 PM Local Time
   - Late submissions will not be accepted

4. Delivery Address:
   [Organization Address]
   Attention: Procurement Department`;
  }
  
  private generateTermsAndConditions(): string {
    return `The following terms and conditions apply to this RFP:

1. This RFP does not commit the organization to award a contract
2. The organization reserves the right to reject any or all proposals
3. Vendors are responsible for all costs associated with proposal preparation
4. All proposals become property of the organization
5. Proprietary information must be clearly marked
6. The organization may request clarifications or additional information
7. Contract negotiations will be conducted with selected vendor(s)
8. Standard terms and conditions will apply to any resulting contract`;
  }
  
  private createDocument(data: RFPData): Document {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: `Response to RFP: ${data.projectName}`,
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 }
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: `Submitted to: ${data.organizationName}`,
                bold: true
              })
            ],
            spacing: { after: 200 }
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: `Date: ${data.submissionDate}`,
                italics: true
              })
            ],
            spacing: { after: 400 }
          }),
          
          ...this.createSections(data.sections)
        ]
      }]
    });
    
    return doc;
  }
  
  private createSections(sections: RFPSection[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    
    for (const section of sections) {
      paragraphs.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );
      
      const contentParagraphs = section.content.split('\n').filter(line => line.trim());
      for (const para of contentParagraphs) {
        paragraphs.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 200 }
          })
        );
      }
      
      if (section.subsections) {
        for (const subsection of section.subsections) {
          paragraphs.push(
            new Paragraph({
              text: subsection.title,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            })
          );
          
          const subContentParagraphs = subsection.content.split('\n').filter(line => line.trim());
          for (const para of subContentParagraphs) {
            paragraphs.push(
              new Paragraph({
                text: para.trim(),
                spacing: { after: 100 }
              })
            );
          }
        }
      }
    }
    
    return paragraphs;
  }
}