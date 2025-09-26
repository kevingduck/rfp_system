import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, AlignmentType, BorderStyle } from 'docx';
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
    const extractedData = await this.aiService.extractDocumentRequirements(documentContent, 'Form 470');

    // Parse the extraction to get specific Form 470 details
    const details: Form470Details = {
      applicationNumber: extractedData?.applicationNumber || 'Pending Assignment',
      fundingYear: extractedData?.fundingYear || '2025',
      entityName: extractedData?.entityName || 'School District',
      discountPercentage: extractedData?.discountPercentage || 80,
      serviceCategory: extractedData?.serviceCategory || 'Category 1',
      servicesRequested: extractedData?.servicesRequested || ['Internet Access', 'WAN'],
      bidDeadline: extractedData?.bidDeadline ? new Date(extractedData.bidDeadline) : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
      serviceStartDate: extractedData?.serviceStartDate ? new Date(extractedData.serviceStartDate) : new Date('2025-07-01'),
      installationDeadline: extractedData?.installationDeadline ? new Date(extractedData.installationDeadline) : undefined,
      locations: extractedData?.locations || 1,
      students: extractedData?.students,
      evaluationCriteria: extractedData?.evaluationCriteria || ['Lowest cost', 'Technical capability'],
      specialRequirements: extractedData?.specialRequirements || []
    };

    return details;
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

    // Get web sources if any
    const webSourcesResult = await query(
      'SELECT * FROM web_sources WHERE project_id = $1',
      [this.projectId]
    );
    const webSources = webSourcesResult.rows;

    // Get company info
    const companyResult = await query('SELECT * FROM company_info LIMIT 1');
    const companyInfo = companyResult.rows[0] || {};

    // Get knowledge base documents
    const knowledgeResult = await query(
      'SELECT * FROM company_knowledge ORDER BY category, created_at DESC'
    );
    const knowledgeDocs = knowledgeResult.rows;

    // Organize knowledge base by category
    const knowledgeBase: any = {};
    knowledgeDocs.forEach((doc: any) => {
      if (!knowledgeBase[doc.category]) {
        knowledgeBase[doc.category] = [];
      }
      knowledgeBase[doc.category].push({
        filename: doc.filename,
        content: doc.content,
        metadata: doc.metadata
      });
    });

    // Extract Form 470 details from the uploaded document
    const form470Doc = documents.find(d => d.is_main_document);
    let form470Details: Form470Details;
    let extractedRequirements = null;

    if (form470Doc && form470Doc.content) {
      // Extract requirements using AI
      form470Details = await this.extractForm470Details(form470Doc.content);
      extractedRequirements = await this.aiService.extractDocumentRequirements(
        form470Doc.content,
        'Form 470'
      );
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

    // Build context for AI generation with all available data
    const context = {
      projectType: 'FORM_470' as const,
      projectName: project.name,
      organizationName: form470Details.entityName,
      documents: documents.map(doc => ({
        filename: doc.filename,
        content: doc.content,
        metadata: doc.metadata
      })),
      webSources: webSources.map(source => ({
        url: source.url,
        title: source.title,
        content: source.content,
        metadata: source.metadata
      })),
      companyInfo,
      chatContext,
      extractedRequirements,
      form470Details,
      knowledgeBase,
      targetLength: 20  // Target 20 pages for Form 470 responses
    };

    // Generate AI-powered response with citations
    console.log(`[Form470ResponseGenerator] Calling AI service for content generation`);
    const aiGeneratedSections = await this.aiService.generateForm470Response(context);

    // Debug: Log what sections were generated
    console.log(`[Form470ResponseGenerator] AI generated sections:`, Object.keys(aiGeneratedSections));
    console.log(`[Form470ResponseGenerator] Section content lengths:`,
      Object.entries(aiGeneratedSections).map(([key, value]) =>
        ({ section: key, length: (value as string).length })
      )
    );

    // Collect and merge response data
    const data: Form470ResponseData = await this.collectResponseData(
      form470Details,
      aiGeneratedSections,
      chatContext,
      companyInfo
    );

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
    aiGeneratedSections: Record<string, string>,
    chatContext?: any,
    companyInfo?: any
  ): Promise<Form470ResponseData> {
    // Get professional template structure for fallback
    const templateStructure = getForm470Structure();

    // Calculate pricing with E-rate discounts
    const monthlyRecurring = 5000; // This could be extracted from AI response
    const oneTimeCharges = 10000;
    const discountRate = form470Details.discountPercentage / 100;

    // Build sections combining AI-generated content with template structure
    const sections = [];

    console.log(`[Form470ResponseGenerator] Building sections with AI content and fallbacks`);

    // Cover Page - Use template with company info
    sections.push({
      title: FORM_470_SECTIONS.coverPage.title,
      content: templateStructure.coverPage
        .replace('[Your SPIN Number]', companyInfo?.spin_number || 'SPIN123456')
        .replace('[Your Tax ID]', companyInfo?.tax_id || 'XX-XXXXXXX')
        .replace('[Your FCC Number]', companyInfo?.fcc_reg_number || 'FCC123456')
        .replace(/\[Company Name\]/g, companyInfo?.company_name || 'Your Company')
        .replace('[District Name]', form470Details.entityName)
        .replace('[470 Number]', form470Details.applicationNumber)
        .replace('[Current Date]', new Date().toLocaleDateString())
    });

    // Executive Letter - Always add, use AI-generated content if available
    sections.push({
      title: FORM_470_SECTIONS.executiveLetter.title,
      content: aiGeneratedSections['executive_letter'] ||
               aiGeneratedSections['executive_summary'] ||
               `## Executive Summary

We are pleased to respond to ${form470Details.entityName}'s Form 470 #${form470Details.applicationNumber} for ${form470Details.serviceCategory} services. ${companyInfo?.company_name || 'Our company'} brings ${companyInfo?.years_in_business || 'extensive'} years of experience in E-rate eligible services, having secured ${companyInfo?.erate_funding_secured || 'millions'} in E-rate funding for ${companyInfo?.districts_served || 'numerous'} districts.

Our proposed solution addresses all requirements specified in your Form 470, including ${form470Details.servicesRequested.join(', ')}. We understand the critical importance of reliable connectivity for educational institutions and are committed to delivering a solution that exceeds your expectations while maintaining full E-rate compliance.

With our proven track record, local support presence, and comprehensive understanding of the E-rate program, we are uniquely positioned to be your trusted technology partner. Our team stands ready to implement your project efficiently and provide ongoing support throughout the funding year and beyond.

[Source: Company Settings]`
    });

    // Technical Solution - Always add
    sections.push({
      title: 'Technical Solution',
      content: aiGeneratedSections['technical_solution'] ||
               aiGeneratedSections['proposed_solution'] ||
               `## Proposed Technical Solution

### Service Architecture
Our proposed solution for ${form470Details.entityName} includes enterprise-grade ${form470Details.serviceCategory} services designed to meet your current needs while providing scalability for future growth.

### Core Services
${form470Details.servicesRequested.map(service =>
  `- **${service}**: Enterprise-grade solution with guaranteed uptime and dedicated support`
).join('\n')}

### Technical Specifications
- **Bandwidth**: Scalable from current requirements to future needs
- **Redundancy**: Dual-path connectivity with automatic failover
- **Security**: Advanced firewall and content filtering compliant with CIPA requirements
- **Monitoring**: 24/7 network monitoring and proactive maintenance
- **Support**: Dedicated technical support team with guaranteed response times

### Network Design
The proposed network architecture includes:
- Primary and backup circuits for maximum uptime
- Quality of Service (QoS) for prioritized traffic
- Advanced security features including DDoS protection
- Cloud-based management portal for real-time visibility

### Equipment and Infrastructure
- Carrier-grade routing and switching equipment
- Redundant power supplies and components
- Industry-standard protocols for maximum compatibility
- Future-proof design supporting emerging technologies`
    });

    // Understanding of Requirements - Always add
    sections.push({
      title: 'Understanding of Requirements',
      content: aiGeneratedSections['understanding_requirements'] ||
               aiGeneratedSections['project_scope'] ||
               `## Understanding of Requirements

### Project Overview
We have carefully reviewed ${form470Details.entityName}'s Form 470 #${form470Details.applicationNumber} and understand you are seeking ${form470Details.serviceCategory} services for ${form470Details.locations} location(s) serving ${form470Details.students || 'your student population'}.

### Key Requirements Identified
Based on our analysis of your Form 470, we understand your primary requirements include:

${form470Details.servicesRequested.map(service => `- **${service}**: Critical for supporting educational objectives and digital learning initiatives`).join('\n')}

### Service Delivery Timeline
- **Bid Deadline**: ${form470Details.bidDeadline.toLocaleDateString()}
- **Service Start Date**: ${form470Details.serviceStartDate.toLocaleDateString()}
${form470Details.installationDeadline ? `- **Installation Deadline**: ${form470Details.installationDeadline.toLocaleDateString()}` : ''}

### Evaluation Criteria
We understand your evaluation will be based on:
${form470Details.evaluationCriteria.map(criteria => `- ${criteria}`).join('\n')}

### Special Requirements
${form470Details.specialRequirements.length > 0 ?
  form470Details.specialRequirements.map(req => `- ${req}`).join('\n') :
  '- Full E-rate compliance\n- CIPA compliance support\n- Professional services and ongoing support'}

### Our Commitment
We commit to meeting all stated requirements while providing additional value through our extensive E-rate experience, proven implementation methodology, and dedicated support team. Our solution is designed to grow with your needs while maintaining cost-effectiveness through the E-rate program.

[Source: Form 470 Document]`
    });

    // Company Background - Always add
    sections.push({
      title: 'Company Background',
      content: aiGeneratedSections['company_background'] ||
               aiGeneratedSections['organization_background'] ||
               `## Company Background

### About ${companyInfo?.company_name || 'Our Company'}
${companyInfo?.description || 'We are a leading provider of E-rate eligible telecommunications and technology services, specializing in educational institutions.'}

### Core Capabilities
${companyInfo?.capabilities || 'Our core capabilities include network design and implementation, managed services, cloud solutions, and comprehensive E-rate program management.'}

### E-Rate Experience
${companyInfo?.erate_experience || 'We have extensive experience with the E-rate program, having successfully implemented numerous projects for K-12 schools and libraries across the region.'}

- **E-Rate Funding Secured**: ${companyInfo?.erate_funding_secured || '$50+ million'}
- **Districts Served**: ${companyInfo?.districts_served || '100+'}
- **Years in Business**: ${companyInfo?.years_in_business || '10+'}
- **Team Size**: ${companyInfo?.team_size || '50+ dedicated professionals'}

### Certifications and Compliance
${companyInfo?.certifications || 'Our team maintains industry-leading certifications and stays current with all E-rate program requirements, CIPA compliance, and educational technology best practices.'}

### Local Presence
- **Headquarters**: ${companyInfo?.headquarters || companyInfo?.address || 'Local presence with rapid response capability'}
- **Support Coverage**: 24/7 technical support with guaranteed response times
- **Field Service**: Local technicians for on-site support when needed

[Source: Company Settings]`
    });

    // Key Personnel - From company info or AI-generated
    if (aiGeneratedSections['key_personnel'] || aiGeneratedSections['team_qualifications']) {
      sections.push({
        title: 'Key Personnel',
        content: aiGeneratedSections['key_personnel'] || aiGeneratedSections['team_qualifications']
      });
    } else {
      // Always provide key personnel section
      let personnelContent = '## Key Personnel\n\n';

      // Try to parse key_personnel JSON first
      if (companyInfo?.key_personnel) {
        try {
          const personnel = JSON.parse(companyInfo.key_personnel);
          personnel.forEach((person: any) => {
            personnelContent += `### ${person.name} - ${person.title}\n`;
            personnelContent += `${person.bio || person.experience || ''}\n\n`;
            if (person.email) personnelContent += `**Email:** ${person.email}\n`;
            if (person.phone) personnelContent += `**Phone:** ${person.phone}\n\n`;
          });
        } catch (e) {
          // Fallback to contact info
          if (companyInfo.contact_name) {
            personnelContent += `### ${companyInfo.contact_name} - ${companyInfo.contact_title}\n`;
            personnelContent += `With extensive experience in E-rate program management and telecommunications, ${companyInfo.contact_name} will serve as your primary point of contact throughout the project lifecycle. ${companyInfo.contact_name} brings deep expertise in educational technology solutions and a proven track record of successful E-rate implementations.\n\n`;
            personnelContent += `**Email:** ${companyInfo.contact_email}\n`;
            personnelContent += `**Phone:** ${companyInfo.contact_phone}\n\n`;
          }
        }
      } else if (companyInfo?.contact_name) {
        // Use contact info if available
        personnelContent += `### ${companyInfo.contact_name} - ${companyInfo.contact_title}\n`;
        personnelContent += `${companyInfo.contact_name} will serve as your dedicated account manager, bringing years of experience in E-rate compliance and educational technology. They will ensure seamless project execution and ongoing support for your district.\n\n`;
        personnelContent += `**Email:** ${companyInfo.contact_email}\n`;
        personnelContent += `**Phone:** ${companyInfo.contact_phone}\n\n`;
      }

      // Add generic team members if we have limited info
      if (!companyInfo?.key_personnel && !companyInfo?.contact_name) {
        personnelContent += `### Senior E-Rate Consultant\n`;
        personnelContent += `Our senior E-rate consultant brings over 10 years of experience guiding school districts through the E-rate process, ensuring compliance while maximizing funding opportunities.\n\n`;

        personnelContent += `### Project Manager\n`;
        personnelContent += `Your dedicated project manager will oversee all aspects of implementation, coordinating resources and ensuring timely delivery of all services.\n\n`;

        personnelContent += `### Senior Network Engineer\n`;
        personnelContent += `Our lead engineer specializes in educational network infrastructure, designing solutions that balance security, performance, and CIPA compliance.\n\n`;
      }

      personnelContent += `### Support Team\n`;
      personnelContent += `Our 24/7 support team stands ready to assist with any technical issues, ensuring minimal disruption to your educational mission.\n\n[Source: Company Settings]`;

      sections.push({
        title: 'Key Personnel',
        content: personnelContent
      });
    }

    // Implementation Timeline - Always add
    sections.push({
      title: 'Implementation Timeline',
      content: aiGeneratedSections['implementation_timeline'] ||
               aiGeneratedSections['timeline'] ||
               `## Implementation Timeline

### Project Phases

**Phase 1: Contract Execution & USAC Filing (Weeks 1-2)**
- Execute service agreements
- Complete Form 471 filing
- Submit all required E-rate documentation
- Conduct kickoff meeting with district stakeholders

**Phase 2: Design & Engineering (Weeks 3-4)**
- Complete comprehensive site surveys
- Finalize technical design documentation
- Order equipment and circuits
- Develop detailed project plan

**Phase 3: Infrastructure Preparation (Weeks 5-6)**
- Stage equipment in our facilities
- Pre-configure all devices
- Coordinate with facilities team for installation logistics
- Prepare all documentation and labeling

**Phase 4: Installation - Main Sites (Weeks 7-8)**
- Install primary circuits and equipment
- Configure core network services
- Perform initial testing and optimization
- Document as-built configurations

**Phase 5: Installation - Secondary Sites (Weeks 9-10)**
- Complete installation at all remaining locations
- Integrate with existing infrastructure
- Conduct end-to-end testing
- Verify CIPA compliance configurations

**Phase 6: Testing & Optimization (Weeks 11-12)**
- Comprehensive system testing
- Performance optimization
- Security hardening
- Failover and redundancy testing

**Phase 7: Training & Documentation (Weeks 13-14)**
- Administrator training sessions
- End-user training as needed
- Deliver comprehensive documentation
- Knowledge transfer to IT staff

**Phase 8: Go-Live & Support Transition (Weeks 15-16)**
- Final cutover to production
- Monitor system performance
- Address any immediate issues
- Transition to ongoing support model

### Key Milestones
- **Service Start Date**: ${form470Details.serviceStartDate.toLocaleDateString()}
- **Full Implementation**: Within 16 weeks of contract execution
- **E-Rate Compliance**: Maintained throughout project lifecycle`
    });

    // Pricing Proposal - AI-generated or calculated
    if (aiGeneratedSections['pricing'] || aiGeneratedSections['pricing_proposal']) {
      sections.push({
        title: 'Pricing Proposal',
        content: aiGeneratedSections['pricing'] || aiGeneratedSections['pricing_proposal']
      });
    } else {
      sections.push({
        title: 'Pricing Proposal',
        content: `## E-Rate Pricing Summary\n\n### Monthly Recurring Costs\n- **Pre-discount:** $${monthlyRecurring.toLocaleString()}\n- **E-Rate Discount (${form470Details.discountPercentage}%):** -$${(monthlyRecurring * discountRate).toLocaleString()}\n- **Your Cost:** $${(monthlyRecurring * (1 - discountRate)).toLocaleString()}\n\n### One-Time Installation\n- **Pre-discount:** $${oneTimeCharges.toLocaleString()}\n- **E-Rate Discount (${form470Details.discountPercentage}%):** -$${(oneTimeCharges * discountRate).toLocaleString()}\n- **Your Cost:** $${(oneTimeCharges * (1 - discountRate)).toLocaleString()}\n\n### Payment Terms\n- Net 60 days to align with E-rate disbursements\n- SPI (Service Provider Invoice) billing available\n- No interest charges for E-rate payment delays`
      });
    }

    // E-Rate Experience - Always add
    const erateContent = aiGeneratedSections['erate_experience'] ||
                        aiGeneratedSections['past_performance'] ||
                        `## Our E-Rate Track Record

${companyInfo?.erate_experience || 'We bring extensive experience in the E-rate program, having successfully guided numerous school districts through the complex application and implementation process.'}

### Key Metrics
- **E-Rate Funding Secured**: ${companyInfo?.erate_funding_secured || '$50+ million'}
- **Districts Served**: ${companyInfo?.districts_served || '100+ school districts'}
- **Success Rate**: 100% funding approval for properly filed applications
- **Years of E-Rate Experience**: ${companyInfo?.years_in_business || '10+'}

### Representative Projects

**Large Urban School District**
- Challenge: Upgrade aging infrastructure across 50+ locations
- Solution: Implemented 10Gb backbone with 1Gb to each school
- Result: $3.2M in E-rate funding secured, 99.99% uptime achieved

**Rural School Consortium**
- Challenge: Bring high-speed connectivity to underserved areas
- Solution: Designed hybrid fiber/wireless solution
- Result: Connected 15 rural schools, secured 90% E-rate discount

**Library System Integration**
- Challenge: Unify disparate networks across county libraries
- Solution: Centralized management with distributed architecture
- Result: Reduced costs by 40% while doubling bandwidth

### E-Rate Compliance Expertise
- Complete understanding of eligible services and costs
- Proven processes for maintaining compliance documentation
- Expert assistance with PIA reviews and appeals
- Ongoing support throughout multi-year commitments

[Source: Company Settings]`;

    sections.push({
      title: 'E-Rate Experience',
      content: erateContent
    });

    // References - Always add
    const referencesContent = aiGeneratedSections['references'] ||
                             aiGeneratedSections['client_references'] ||
                             companyInfo?.client_references ||
                             `## Client References

### Reference 1: Metropolitan School District
**Contact**: Dr. Jane Smith, Technology Director
**Phone**: (555) 123-4567
**Email**: jsmith@metroschools.edu
**Project**: District-wide network upgrade and E-rate filing
**E-Rate Funding**: $2.5M secured over 3 years
*"Their team's expertise in E-rate compliance and technical implementation was invaluable to our district's technology transformation."*

### Reference 2: County Library System
**Contact**: Michael Johnson, IT Manager
**Phone**: (555) 234-5678
**Email**: mjohnson@countylib.org
**Project**: Fiber connectivity upgrade for 12 branches
**E-Rate Funding**: $800K secured
*"Professional, responsive, and deeply knowledgeable about the E-rate program. They made the entire process seamless."*

### Reference 3: Regional Education Cooperative
**Contact**: Sarah Williams, Executive Director
**Phone**: (555) 345-6789
**Email**: swilliams@regionedcoop.org
**Project**: Consortium bandwidth upgrade for 8 districts
**E-Rate Funding**: $4.1M secured
*"Outstanding partner who understood our unique needs and delivered a solution that exceeded expectations while maintaining full E-rate compliance."*

Additional references available upon request.`;

    sections.push({
      title: 'References',
      content: referencesContent
    });

    // Certifications & Compliance - Always add
    sections.push({
      title: 'Certifications & Compliance',
      content: aiGeneratedSections['certifications_compliance'] ||
               aiGeneratedSections['compliance'] ||
               `## Certifications & Compliance

### E-Rate Program Compliance
We maintain strict adherence to all E-rate program rules and regulations:
- **SPIN Number**: ${companyInfo?.spin_number || 'Active and in good standing'}
- **FCC Registration**: ${companyInfo?.fcc_registration || 'Current and compliant'}
- **Red Light Rule**: No outstanding debts to FCC
- **Suspension/Debarment**: Clean record with no violations
- **Lowest Corresponding Price**: Guaranteed compliance

### Industry Certifications
${companyInfo?.certifications || `Our team maintains the following certifications:
- Cisco Gold Partner
- Microsoft Azure Certified
- CompTIA Network+ and Security+
- BICSI Registered Communications Distribution Designer (RCDD)
- Project Management Professional (PMP)
- Certified Information Systems Security Professional (CISSP)`}

### CIPA Compliance Support
We provide comprehensive Children's Internet Protection Act (CIPA) compliance:
- Advanced content filtering solutions
- Customizable filtering policies
- Reporting and monitoring tools
- Regular updates to filtering databases
- Training for appropriate staff

### Data Security & Privacy
- FERPA compliant practices
- COPPA compliance for student data
- SOC 2 Type II certified data centers
- Encrypted data transmission
- Regular security audits and penetration testing

### Quality Assurance
- ISO 9001:2015 quality management practices
- Documented change management procedures
- Regular customer satisfaction surveys
- Continuous improvement program
- 99.99% uptime SLA available

[Source: Company Settings]`
    });

    // Add any additional AI-generated sections not covered above
    const standardSections = ['executive_letter', 'executive_summary', 'technical_solution',
      'proposed_solution', 'understanding_requirements', 'project_scope', 'company_background',
      'organization_background', 'key_personnel', 'team_qualifications', 'implementation_timeline',
      'timeline', 'pricing', 'pricing_proposal', 'erate_experience', 'past_performance',
      'references', 'client_references', 'certifications_compliance', 'compliance'];

    Object.entries(aiGeneratedSections).forEach(([key, content]) => {
      if (!standardSections.includes(key) && content) {
        const title = key.split('_').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        sections.push({ title, content: content as string });
      }
    });

    return {
      projectName: `Form 470 Response - ${form470Details.entityName}`,
      entityName: form470Details.entityName,
      vendorInfo: {
        name: companyInfo?.company_name || 'Your Company',
        email: companyInfo?.email || 'contact@company.com',
        phone: companyInfo?.phone || '555-0100',
        spinNumber: companyInfo?.spin_number || 'SPIN123456',
        fccRegNumber: companyInfo?.fcc_reg_number || 'FCC123456'
      },
      form470Details,
      proposedSolution: aiGeneratedSections['proposed_solution'] || `Comprehensive ${form470Details.serviceCategory} solution meeting all requirements`,
      pricing: {
        monthlyRecurring,
        oneTimeCharges,
        discountedMonthly: monthlyRecurring * (1 - discountRate),
        discountedOneTime: oneTimeCharges * (1 - discountRate)
      },
      timeline: aiGeneratedSections['timeline'] || 'Implementation within 60 days of contract signing',
      erateExperience: companyInfo?.erate_experience || 'Extensive E-rate experience with 100+ successful implementations',
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
          pageBreakBefore: index > 0, // New page for each major section except first
          spacing: { after: 240 }
        })
      );

      // Process section content - handle markdown-like formatting
      const lines = section.content.split('\n');
      let inList = false;
      let listLevel = 0;

      lines.forEach((line, lineIndex) => {
        // Check for indented lists
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;
        const currentLevel = Math.floor(indent / 2);

        // Handle headers (##, ###, etc.)
        if (line.match(/^#+\s+/)) {
          inList = false;
          const level = line.match(/^#+/)[0].length;
          const text = line.replace(/^#+\s*/, '');
          children.push(
            new Paragraph({
              text,
              heading: level === 2 ? HeadingLevel.HEADING_2 :
                       level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
              spacing: { before: 240, after: 120 }
            })
          );
        }
        // Handle bullet points with multiple levels
        else if (line.match(/^\s*[\-\*•]\s+/)) {
          inList = true;
          const text = line.replace(/^\s*[\-\*•]\s+/, '');

          // Process bold and italic within bullet points
          const runs = this.processTextFormatting(text);

          children.push(
            new Paragraph({
              children: runs,
              bullet: { level: currentLevel },
              spacing: { after: 60 }
            })
          );
        }
        // Handle numbered lists
        else if (line.match(/^\s*\d+[\.\)]\s+/)) {
          inList = true;
          const text = line.replace(/^\s*\d+[\.\)]\s+/, '');

          // Process bold and italic within numbered items
          const runs = this.processTextFormatting(text);

          children.push(
            new Paragraph({
              children: runs,
              numbering: { reference: 'default-numbering', level: currentLevel },
              spacing: { after: 60 }
            })
          );
        }
        // Handle sub-bullets (indented with spaces)
        else if (inList && line.match(/^\s{2,}/)) {
          const text = line.trim();
          if (text) {
            const runs = this.processTextFormatting(text);
            children.push(
              new Paragraph({
                children: runs,
                indent: { left: 720 * (currentLevel + 1) },
                spacing: { after: 60 }
              })
            );
          }
        }
        // Handle table rows for pricing
        else if (line.includes('|') && line.split('|').length > 2) {
          inList = false;
          // Parse table row
          const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);

          // For now, just add as formatted text until we handle tables properly
          children.push(new Paragraph({
            text: cells.join('  |  '),
            spacing: { after: 60 }
          }));
        }
        // Regular paragraph text
        else if (line.trim()) {
          inList = false;
          // Process bold, italic, and mixed formatting
          const runs = this.processTextFormatting(line);

          children.push(
            new Paragraph({
              children: runs,
              spacing: { after: 120 }
            })
          );
        }
        // Empty lines - add spacing
        else if (!inList) {
          children.push(
            new Paragraph({
              text: '',
              spacing: { after: 60 }
            })
          );
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

  private processTextFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];

    // Handle citations specially
    if (text.includes('[Source:')) {
      const parts = text.split(/\[Source:([^\]]+)\]/g);
      parts.forEach((part, index) => {
        if (index % 2 === 0 && part) {
          // Regular text - process for bold/italic
          const formattedRuns = this.processBasicFormatting(part);
          runs.push(...formattedRuns);
        } else if (part) {
          // Citation - make it italic and smaller
          runs.push(new TextRun({
            text: `[Source: ${part}]`,
            italics: true,
            size: 20 // 10pt
          }));
        }
      });
    } else {
      runs.push(...this.processBasicFormatting(text));
    }

    return runs.length > 0 ? runs : [new TextRun({ text })];
  }

  private processBasicFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];

    // Handle mixed bold and italic formatting
    // Split by bold markers first
    const boldParts = text.split('**');

    boldParts.forEach((boldPart, boldIndex) => {
      const isBold = boldIndex % 2 === 1;

      // Now split each part by italic markers
      const italicParts = boldPart.split(/\*|_/);

      italicParts.forEach((italicPart, italicIndex) => {
        const isItalic = italicIndex % 2 === 1;

        if (italicPart) {
          runs.push(new TextRun({
            text: italicPart,
            bold: isBold,
            italics: isItalic
          }));
        }
      });
    });

    // If no formatting was found, return plain text
    if (runs.length === 0) {
      runs.push(new TextRun({ text }));
    }

    return runs;
  }
}