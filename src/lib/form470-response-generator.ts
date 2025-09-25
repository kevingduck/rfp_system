import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType } from 'docx';
import { query } from './pg-db';
import { AIService } from './ai-service';

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

  async generateForm470Response(chatContext?: any): Promise<Buffer> {
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

    return buffer;
  }

  private async collectResponseData(
    form470Details: Form470Details,
    strategy: string,
    chatContext?: any
  ): Promise<Form470ResponseData> {
    // Get company info
    const companyResult = await query('SELECT * FROM company_info LIMIT 1');
    const companyInfo = companyResult.rows[0] || {};

    // Calculate pricing with E-rate discounts
    const monthlyRecurring = 5000; // Example - would be calculated based on requirements
    const oneTimeCharges = 10000;
    const discountRate = form470Details.discountPercentage / 100;

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
      sections: [
        {
          title: 'Executive Summary',
          content: `Response to Form 470 #${form470Details.applicationNumber} for ${form470Details.entityName}`
        },
        {
          title: 'E-rate Compliance',
          content: 'All proposed services are fully E-rate eligible under Category 1 guidelines.'
        },
        {
          title: 'Proposed Solution',
          content: strategy
        },
        {
          title: 'Pricing',
          content: `Taking into account your ${form470Details.discountPercentage}% E-rate discount...`
        }
      ]
    };
  }

  private createResponseDocument(data: Form470ResponseData): Document {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Header
          new Paragraph({
            text: 'Form 470 Response',
            heading: HeadingLevel.HEADING_1,
            alignment: 'center'
          }),
          new Paragraph({
            text: data.entityName,
            heading: HeadingLevel.HEADING_2,
            alignment: 'center'
          }),
          new Paragraph({
            text: `Application #${data.form470Details.applicationNumber}`,
            alignment: 'center'
          }),
          new Paragraph({ text: '' }),

          // Vendor Information
          new Paragraph({
            text: 'Vendor Information',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            text: `Company: ${data.vendorInfo.name}`
          }),
          new Paragraph({
            text: `Contact: ${data.vendorInfo.email} | ${data.vendorInfo.phone}`
          }),
          new Paragraph({
            text: `SPIN: ${data.vendorInfo.spinNumber || 'Pending'}`
          }),
          new Paragraph({
            text: `FCC Registration: ${data.vendorInfo.fccRegNumber || 'Pending'}`
          }),
          new Paragraph({ text: '' }),

          // Service Category Response
          new Paragraph({
            text: 'Services Proposed',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            text: `Service Category: ${data.form470Details.serviceCategory}`
          }),
          new Paragraph({
            text: `Services: ${data.form470Details.servicesRequested.join(', ')}`
          }),
          new Paragraph({ text: '' }),

          // Pricing with E-rate Discounts
          new Paragraph({
            text: 'E-rate Pricing Summary',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            text: `Your E-rate Discount: ${data.form470Details.discountPercentage}%`
          }),
          new Paragraph({
            text: `Monthly Recurring: $${data.pricing.monthlyRecurring.toLocaleString()}`
          }),
          new Paragraph({
            text: `Your Cost After E-rate Discount: $${data.pricing.discountedMonthly.toLocaleString()}/month`,
            bold: true
          }),
          new Paragraph({ text: '' }),

          // E-rate Experience
          new Paragraph({
            text: 'E-rate Program Experience',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            text: data.erateExperience
          }),
          new Paragraph({ text: '' }),

          // Additional sections
          ...data.sections.flatMap(section => [
            new Paragraph({
              text: section.title,
              heading: HeadingLevel.HEADING_2
            }),
            new Paragraph({
              text: section.content
            }),
            new Paragraph({ text: '' })
          ]),

          // Compliance Statement
          new Paragraph({
            text: 'E-rate Compliance Certification',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            text: 'We certify that all proposed services are E-rate eligible and comply with all applicable FCC rules and USAC requirements.'
          })
        ]
      }]
    });

    return doc;
  }
}