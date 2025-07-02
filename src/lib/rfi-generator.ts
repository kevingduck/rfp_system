import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, AlignmentType } from 'docx';
import { openDb } from './db';
import { AIService } from './ai-service';

export interface RFISection {
  title: string;
  content: string;
  questions?: RFIQuestion[];
}

export interface RFIQuestion {
  id: string;
  question: string;
  category?: string;
  required: boolean;
}

export interface RFIData {
  projectName: string;
  organizationName: string;
  issueDate: string;
  dueDate: string;
  contactInfo: {
    name: string;
    email: string;
    phone: string;
  };
  sections: RFISection[];
}

export class RFIGenerator {
  private projectId: string;
  private aiService: AIService;
  
  constructor(projectId: string) {
    this.projectId = projectId;
    this.aiService = new AIService();
  }
  
  async generateRFI(chatContext?: any): Promise<Buffer> {
    console.log(`[RFIGenerator] Starting RFI generation for project ${this.projectId}`);
    if (chatContext) {
      console.log(`[RFIGenerator] Using chat context with ${chatContext.responses?.length || 0} responses`);
    }
    
    const data = await this.collectRFIData(chatContext);
    console.log(`[RFIGenerator] Data collected, creating document...`);
    
    const doc = this.createDocument(data);
    console.log(`[RFIGenerator] Document created, converting to buffer...`);
    
    const buffer = await Packer.toBuffer(doc);
    console.log(`[RFIGenerator] RFI generation complete`);
    
    return buffer;
  }
  
  private async collectRFIData(chatContext?: any): Promise<RFIData> {
    const db = await openDb();
    
    const project = await db.get(
      'SELECT * FROM projects WHERE id = ? AND project_type = "RFI"',
      this.projectId
    );
    
    if (!project) {
      throw new Error('RFI project not found');
    }
    
    const organization = await db.get(
      'SELECT * FROM organizations WHERE id = ?',
      project.organization_id
    );
    
    const questions = await db.all(
      'SELECT * FROM rfi_questions WHERE project_id = ? ORDER BY category, order_index',
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
    
    // Fetch knowledge base files
    const knowledgeFiles = await db.all('SELECT * FROM company_knowledge');
    
    // Organize knowledge base by category
    const knowledgeBase: any = {};
    for (const file of knowledgeFiles) {
      if (!knowledgeBase[file.category]) {
        knowledgeBase[file.category] = [];
      }
      knowledgeBase[file.category].push({
        filename: file.original_filename,
        content: file.content || ''
      });
    }
    
    // Calculate due date (2 weeks from now by default)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    
    return {
      projectName: project.name,
      organizationName: organization?.name || 'Your Organization',
      issueDate: new Date().toLocaleDateString(),
      dueDate: dueDate.toLocaleDateString(),
      contactInfo: {
        name: companyInfo?.company_name || 'Your Company',
        email: companyInfo?.email || 'contact@company.com',
        phone: companyInfo?.phone || '555-0123'
      },
      sections: await this.buildSections(questions, project, organization, documents, webSources, companyInfo, knowledgeBase, chatContext)
    };
  }
  
  private async buildSections(
    questions: any[], 
    project: any,
    organization: any,
    documents: any[],
    webSources: any[],
    companyInfo: any,
    knowledgeBase: any,
    chatContext?: any
  ): Promise<RFISection[]> {
    console.log(`[RFIGenerator] Building sections with AI - ${documents.length} documents, ${webSources.length} web sources`);
    
    // Use AI to generate comprehensive content
    const aiContent = await this.aiService.generateRFIContent({
      projectType: 'RFI',
      projectName: project.name,
      organizationName: organization?.name || 'Your Organization',
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
      rfiQuestions: questions,
      chatContext,
      knowledgeBase
    });

    // Build sections from AI-generated content
    const sections: RFISection[] = [
      {
        title: 'Introduction',
        content: aiContent.introduction || await this.generateIntroduction()
      },
      {
        title: 'Company Overview',
        content: aiContent.organization_background || `Thank you for the opportunity to respond to your RFI. We are pleased to provide information about our comprehensive telecommunications and VoIP solutions.`
      },
      {
        title: 'Project Scope',
        content: aiContent.project_scope || await this.generatePurpose()
      },
      {
        title: 'Information Requested',
        content: aiContent.information_requested || 'Please provide detailed responses to the following questions:',
        questions: this.organizeQuestions(questions)
      },
      {
        title: 'Vendor Qualifications',
        content: aiContent.vendor_qualifications || this.generateVendorQualifications()
      },
      {
        title: 'Submission Requirements',
        content: aiContent.submission_requirements || this.generateSubmissionGuidelines()
      },
      {
        title: 'Evaluation Criteria',
        content: aiContent.evaluation_criteria || this.generateEvaluationProcess()
      },
      {
        title: 'Next Steps',
        content: aiContent.next_steps || 'We look forward to discussing your requirements in greater detail and demonstrating how our solutions can meet your needs. We are prepared to provide additional information, arrange product demonstrations, or participate in your formal RFP process.'
      }
    ];
    
    return sections;
  }
  
  private organizeQuestions(questions: any[]): RFIQuestion[] {
    return questions.map(q => ({
      id: q.id,
      question: q.question_text,
      category: q.category,
      required: q.required === 1
    }));
  }
  
  private async generateIntroduction(): Promise<string> {
    const db = await openDb();
    const companyInfo = await db.get('SELECT * FROM company_info LIMIT 1');
    
    return `${companyInfo?.company_name || 'We'} appreciate the opportunity to respond to your Request for Information (RFI) regarding telecommunications and VoIP solutions. We are excited to share how our proven solutions and expertise can address your organization's communication needs.

This response provides comprehensive information about our capabilities, experience, and the value we can bring to your organization.`;
  }
  
  private async generatePurpose(): Promise<string> {
    return `Based on your RFI requirements, we understand you are seeking:

1. A comprehensive VoIP and telecommunications solution provider
2. Proven experience with similar organizations
3. Scalable solutions that grow with your needs
4. Seamless integration with existing systems
5. Reliable, high-quality communications
6. Modern collaboration capabilities

Our response demonstrates how we excel in each of these areas:
- Proven track record with organizations of your size and complexity
- Scalable architecture designed for growth
- Extensive integration capabilities with major business platforms
- Industry-leading uptime and call quality metrics
- Full suite of unified communications features
- 24/7 support and comprehensive maintenance programs`;
  }
  
  private generateSubmissionGuidelines(): string {
    return `Please adhere to the following guidelines when preparing your response:

1. Response Format:
   - Submit responses in PDF or Microsoft Word format
   - Use clear section headings corresponding to each question
   - Include page numbers and your company name in the header/footer
   - Limit response to 50 pages maximum (excluding appendices)

2. Required Information:
   - Complete company profile and contact information
   - Responses to all required questions
   - Relevant case studies or references
   - Any supplementary materials in clearly labeled appendices

3. Submission Instructions:
   - Email responses to the contact listed below
   - Include "RFI Response - [Your Company Name]" in the subject line
   - Confirm receipt of submission within 24 hours

4. Questions and Clarifications:
   - Submit all questions in writing via email
   - Questions must be received at least 5 business days before the due date
   - Responses to questions will be shared with all known interested vendors`;
  }
  
  private generateVendorQualifications(): string {
    return `We are seeking vendors with the following qualifications:

1. Proven experience in VoIP and telecommunications solutions
2. Established track record with similar-sized implementations
3. Technical certifications and partnerships with major VoIP platforms
4. 24/7 support capabilities
5. Financial stability and longevity in the market
6. Strong references from comparable organizations
7. Compliance with industry standards and regulations`;
  }

  private generateEvaluationProcess(): string {
    return `Responses to this RFI will be evaluated based on the following criteria:

1. Completeness and clarity of responses
2. Demonstrated understanding of our requirements
3. Relevant experience and qualifications
4. Solution capabilities and features
5. Innovation and value-added services
6. Financial stability and company viability

Please note:
- This RFI is not a commitment to purchase
- We reserve the right to use information provided to develop future procurement documents
- Vendors may be invited to participate in demonstrations or provide additional information
- Participation in this RFI does not guarantee invitation to any subsequent RFP process
- All costs associated with responding to this RFI are the responsibility of the vendor`;
  }
  
  private createDocument(data: RFIData): Document {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: `Request for Information (RFI)`,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          }),
          
          new Paragraph({
            text: data.projectName,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          
          this.createInfoTable(data),
          
          ...this.createSections(data.sections)
        ]
      }]
    });
    
    return doc;
  }
  
  private createInfoTable(data: RFIData): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'Issuing Organization:', bold: true })],
              width: { size: 30, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph(data.organizationName)],
              width: { size: 70, type: WidthType.PERCENTAGE }
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'Issue Date:', bold: true })]
            }),
            new TableCell({
              children: [new Paragraph(data.issueDate)]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'Response Due Date:', bold: true })]
            }),
            new TableCell({
              children: [new Paragraph(data.dueDate)]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'Contact:', bold: true })]
            }),
            new TableCell({
              children: [
                new Paragraph(data.contactInfo.name),
                new Paragraph(data.contactInfo.email),
                new Paragraph(data.contactInfo.phone)
              ]
            })
          ]
        })
      ]
    });
  }
  
  private createSections(sections: RFISection[]): Paragraph[] {
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
      
      if (section.questions) {
        let currentCategory = '';
        let questionNumber = 1;
        
        for (const question of section.questions) {
          if (question.category && question.category !== currentCategory) {
            currentCategory = question.category;
            paragraphs.push(
              new Paragraph({
                text: currentCategory,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 200 }
              })
            );
          }
          
          paragraphs.push(
            new Paragraph({
              text: `${questionNumber}. ${question.question}${question.required ? ' *' : ''}`,
              spacing: { before: 100, after: 100 },
              indent: { left: 360 }
            })
          );
          
          questionNumber++;
        }
        
        paragraphs.push(
          new Paragraph({
            text: '* Required question',
            italics: true,
            spacing: { before: 200 }
          })
        );
      }
    }
    
    return paragraphs;
  }
}