import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType } from 'docx';
import { query } from './pg-db';
import { AIService } from './ai-service';
import { getForm470Structure, FORM_470_SECTIONS } from './form470-template';

export interface Form470Details {
  applicationNumber: string;
  fundingYear: string;
  entityName: string;
  discountPercentage: number;
  serviceCategory: 'Category 1' | 'Category 2' | 'Both';
  servicesRequested: string[];
  bidDeadline: Date;
  serviceStartDate: Date;
  installationDeadline?: Date;
  locations: number;
  students?: number;
  evaluationCriteria: string[];
  specialRequirements: string[];
}

export interface Form470ResponseData {
  projectName: string;
  entityName: string;
  vendorInfo: {
    name: string;
    email: string;
    phone: string;
    spinNumber?: string;
    fccRegNumber?: string;
  };
  form470Details: Form470Details;
  proposedSolution: string;
  pricing: {
    monthlyRecurring: number;
    oneTimeCharges: number;
    discountedMonthly: number;
    discountedOneTime: number;
  };
  timeline: string;
  erateExperience: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
}

export class Form470ResponseGenerator {
  private projectId: string;
  private aiService: AIService;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.aiService = new AIService();
  }

  async extractForm470Details(documentContent: string): Promise<Form470Details> {
    console.log(`[Form470ResponseGenerator] Extracting details from Form 470`);

    // Use AI to extract structured information from the Form 470
    const extractionPrompt = `
    You are analyzing a Form 470 document from the E-rate program. Extract the following information:

    1. Application/Form Number
    2. Funding Year
    3. Entity Name (school/library name)
    4. Discount Percentage
    5. Service Categories (Category 1 for Internet/WAN, Category 2 for Internal Connections, or Both)
    6. Specific Services Requested (list all)
    7. Bid Deadline Date
    8. Service Start Date
    9. Installation Deadline (if applicable)
    10. Number of Locations/Sites
    11. Number of Students (if mentioned)
    12. Evaluation Criteria (price, technical capability, etc.)
    13. Any special requirements or conditions

    Format as JSON with clear field names. If a field is not found, use null.

    Document content:
    ${documentContent.substring(0, 50000)} // Limit to prevent token overflow
    `;

    // This would call the AI service to extract - placeholder for now
    // const extraction = await this.aiService.extractStructuredData(extractionPrompt);

    // For now, return mock data - will be replaced with actual AI extraction
    return {
      applicationNumber: 'Extracted from document',
      fundingYear: '2025',
      entityName: 'Extracted School District',
      discountPercentage: 80,
      serviceCategory: 'Category 1',
      servicesRequested: ['Internet Access', 'WAN', 'Managed Services'],
      bidDeadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28 days from now
      serviceStartDate: new Date('2025-07-01'),
      locations: 5,
      students: 2500,
      evaluationCriteria: ['Lowest cost', 'Technical capability', 'E-rate experience'],
      specialRequirements: ['24/7 support', 'Guaranteed uptime 99.9%']
    };
  }

  async generateResponseStrategy(form470Details: Form470Details): Promise<string> {
    console.log(`[Form470ResponseGenerator] Generating response strategy`);

    const strategyPrompt = `
    Based on this Form 470 opportunity, provide a winning bid strategy:

    Entity: ${form470Details.entityName}
    Discount: ${form470Details.discountPercentage}%
    Services Needed: ${form470Details.servicesRequested.join(', ')}
    Evaluation Criteria: ${form470Details.evaluationCriteria.join(', ')}
    Bid Deadline: ${form470Details.bidDeadline}

    Provide strategic recommendations for:
    1. Competitive positioning
    2. Pricing strategy considering their ${form470Details.discountPercentage}% E-rate discount
    3. Key differentiators to emphasize
    4. Compliance requirements to address
    5. Suggested response structure

    Focus on how to WIN this E-rate bid.
    `;

    // Placeholder - will be replaced with actual AI call
    return `Strategic recommendations for winning this Form 470 bid...`;
  }

  async generateForm470Response(chatContext?: any): Promise<{ buffer: Buffer; sections: Record<string, string> }> {
    console.log(`[Form470ResponseGenerator] Starting Form 470 response generation for project ${this.projectId}`);

    // Fetch project and document data
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [this.projectId]
    );
    const project = projectResult.rows[0];

    const documentsResult = await query(
      'SELECT * FROM documents WHERE project_id = $1',
      [this.projectId]
    );
    const documents = documentsResult.rows;

    // Extract Form 470 details from the uploaded document
    const form470Doc = documents.find(d => d.is_main_document);
    let form470Details: Form470Details;

    if (form470Doc && form470Doc.content) {
      form470Details = await this.extractForm470Details(form470Doc.content);
    } else {
      // Default details if no document uploaded yet
      form470Details = {
        applicationNumber: 'TBD',
        fundingYear: '2025',
        entityName: project.name,
        discountPercentage: 80,
        serviceCategory: 'Category 1',
        servicesRequested: ['Internet Access'],
        bidDeadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        serviceStartDate: new Date('2025-07-01'),
        locations: 1,
        evaluationCriteria: ['Lowest cost'],
        specialRequirements: []
      };
    }

    // Generate response strategy
    const strategy = await this.generateResponseStrategy(form470Details);

    // Collect response data
    const data: Form470ResponseData = await this.collectResponseData(form470Details, strategy, chatContext);

    // Create the document
    const doc = this.createResponseDocument(data);

    // Convert to buffer
    const buffer = await Packer.toBuffer(doc);
    console.log(`[Form470ResponseGenerator] Response generation complete`);

    // Convert sections array to object for storage
    const sectionsObject: Record<string, string> = {};
    data.sections.forEach((section, index) => {
      const key = section.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      sectionsObject[key] = section.content;
    });

    return { buffer, sections: sectionsObject };
  }

  private async collectResponseData(
    form470Details: Form470Details,
    strategy: string,
    chatContext?: any
  ): Promise<Form470ResponseData> {
    // Get company info
    const companyResult = await query('SELECT * FROM company_info LIMIT 1');
    const companyInfo = companyResult.rows[0] || {};

    // Get professional template structure
    const templateStructure = getForm470Structure();

    // Calculate pricing with E-rate discounts
    const monthlyRecurring = 5000; // Example - would be calculated based on requirements
    const oneTimeCharges = 10000;
    const discountRate = form470Details.discountPercentage / 100;

    // Build sections using professional template
    const sections = [];

    // Cover Page
    sections.push({
      title: FORM_470_SECTIONS.coverPage.title,
      content: templateStructure.coverPage
        .replace('[Your SPIN Number]', companyInfo.spin_number || 'SPIN123456')
        .replace('[Your Tax ID]', companyInfo.tax_id || 'XX-XXXXXXX')
        .replace('[Your FCC Number]', companyInfo.fcc_reg_number || 'FCC123456')
        .replace(/\[Company Name\]/g, companyInfo.company_name || 'Your Company')
        .replace('[District Name]', form470Details.entityName)
        .replace('[470 Number]', form470Details.applicationNumber)
        .replace('[Current Date]', new Date().toLocaleDateString())
    });

    // Executive Letter
    sections.push({
      title: FORM_470_SECTIONS.executiveLetter.title,
      content: templateStructure.executiveLetter
        .replace(/\[Company Name\]/g, companyInfo.company_name || 'Your Company')
        .replace(/\[District Name\]/g, form470Details.entityName)
        .replace('[470 Number]', form470Details.applicationNumber)
        .replace('[Category 1/2]', form470Details.serviceCategory)
    });

    // Data Sheets
    sections.push({
      title: FORM_470_SECTIONS.dataSheets.title,
      content: templateStructure.dataSheets
    });

    // Background Information
    sections.push({
      title: FORM_470_SECTIONS.backgroundInformation.title,
      content: templateStructure.backgroundInformation
        .replace(/\[Company Name\]/g, companyInfo.company_name || 'Your Company')
    });

    // Key Personnel & References
    sections.push({
      title: FORM_470_SECTIONS.keyPersonnel.title,
      content: templateStructure.keyPersonnel
    });

    // Scope of Services
    sections.push({
      title: FORM_470_SECTIONS.scopeOfServices.title,
      content: templateStructure.scopeOfServices
    });

    // Pricing
    sections.push({
      title: 'Pricing Proposal',
      content: `## E-Rate Pricing Summary

### Monthly Recurring Costs
- **Pre-discount:** $${monthlyRecurring.toLocaleString()}
- **E-Rate Discount (${form470Details.discountPercentage}%):** -$${(monthlyRecurring * discountRate).toLocaleString()}
- **Your Cost:** $${(monthlyRecurring * (1 - discountRate)).toLocaleString()}

### One-Time Installation
- **Pre-discount:** $${oneTimeCharges.toLocaleString()}
- **E-Rate Discount (${form470Details.discountPercentage}%):** -$${(oneTimeCharges * discountRate).toLocaleString()}
- **Your Cost:** $${(oneTimeCharges * (1 - discountRate)).toLocaleString()}

### Payment Terms
- Net 60 days to align with E-Rate disbursements
- SPI (Service Provider Invoice) billing available
- No interest charges for E-Rate payment delays`
    });

    return {
      projectName: `Form 470 Response - ${form470Details.entityName}`,
      entityName: form470Details.entityName,
      vendorInfo: {
        name: companyInfo.company_name || 'Your Company',
        email: companyInfo.email || 'contact@company.com',
        phone: companyInfo.phone || '555-0100',
        spinNumber: companyInfo.spin_number || 'SPIN123456',
        fccRegNumber: companyInfo.fcc_reg_number || 'FCC123456'
      },
      form470Details,
      proposedSolution: `Comprehensive ${form470Details.serviceCategory} solution meeting all requirements`,
      pricing: {
        monthlyRecurring,
        oneTimeCharges,
        discountedMonthly: monthlyRecurring * (1 - discountRate),
        discountedOneTime: oneTimeCharges * (1 - discountRate)
      },
      timeline: 'Implementation within 60 days of contract signing',
      erateExperience: companyInfo.erate_experience || 'Extensive E-rate experience with 100+ successful implementations',
      sections
    };
  }

  private createResponseDocument(data: Form470ResponseData): Document {
    const doc = new Document({
      sections: [{
        properties: {},
        children: this.buildDocumentChildren(data)
      }]
    });

    return doc;
  }

  private buildDocumentChildren(data: Form470ResponseData): any[] {
    const children = [];

    // Process each section from the template
    data.sections.forEach((section, index) => {
      // Add section title
      children.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: index > 0 // New page for each major section except first
        })
      );

      // Process section content - handle markdown-like formatting
      const lines = section.content.split('\n');
      lines.forEach(line => {
        // Handle headers (##, ###, etc.)
        if (line.startsWith('##')) {
          const level = line.match(/^#+/)[0].length;
          const text = line.replace(/^#+\s*/, '');
          children.push(
            new Paragraph({
              text,
              heading: level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
            })
          );
        }
        // Handle bullet points
        else if (line.match(/^[\-\*•]\s+/)) {
          const text = line.replace(/^[\-\*•]\s+/, '');
          children.push(
            new Paragraph({
              text,
              bullet: { level: 0 }
            })
          );
        }
        // Handle numbered lists
        else if (line.match(/^\d+\.\s+/)) {
          const text = line.replace(/^\d+\.\s+/, '');
          children.push(
            new Paragraph({
              text,
              numbering: { reference: 'default-numbering', level: 0 }
            })
          );
        }
        // Handle table-like content (for pricing)
        else if (line.includes('|') && line.split('|').length > 2) {
          // This would need more complex table handling - skip for now
          children.push(new Paragraph({ text: line.replace(/\|/g, ' ') }));
        }
        // Handle bold text
        else if (line.includes('**')) {
          const parts = line.split('**');
          const runs = [];
          parts.forEach((part, i) => {
            if (i % 2 === 1) {
              runs.push(new TextRun({ text: part, bold: true }));
            } else if (part) {
              runs.push(new TextRun({ text: part }));
            }
          });
          if (runs.length > 0) {
            children.push(new Paragraph({ children: runs }));
          }
        }
        // Regular text
        else if (line.trim()) {
          children.push(new Paragraph({ text: line }));
        }
        // Empty lines
        else {
          children.push(new Paragraph({ text: '' }));
        }
      });
    });

    // Add compliance footer
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        text: 'E-rate Compliance Certification',
        heading: HeadingLevel.HEADING_2,
        pageBreakBefore: true
      }),
      new Paragraph({
        text: 'We certify that all proposed services are E-rate eligible and comply with all applicable FCC rules and USAC requirements.'
      })
    );

    return children;
  }
}