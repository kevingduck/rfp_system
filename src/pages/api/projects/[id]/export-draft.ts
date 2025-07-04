import type { NextApiRequest, NextApiResponse } from 'next';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';
import { query } from '@/lib/pg-db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { includeCitations } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    // Get the existing draft
    const draftResult = await query(
      'SELECT * FROM drafts WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    const draft = draftResult.rows[0];

    if (!draft) {
      return res.status(404).json({ error: 'No draft found' });
    }

    // Get project info
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    const project = projectResult.rows[0];

    // Parse the draft sections
    const sections = JSON.parse(draft.content);
    
    // Define proper section order and titles for better formatting
    const sectionOrder = project.project_type === 'RFI' ? [
      { key: 'executive_summary', title: 'Executive Summary' },
      { key: 'company_overview', title: 'Company Overview' },
      { key: 'understanding_requirements', title: 'Understanding of Requirements' },
      { key: 'proposed_solution', title: 'Proposed Solution' },
      { key: 'technical_approach', title: 'Technical Approach' },
      { key: 'implementation_timeline', title: 'Implementation Timeline' },
      { key: 'pricing_structure', title: 'Pricing Structure' },
      { key: 'team_qualifications', title: 'Team Qualifications' },
      { key: 'past_performance', title: 'Past Performance' },
      { key: 'certifications_compliance', title: 'Certifications & Compliance' },
      { key: 'references', title: 'References' },
      { key: 'conclusion', title: 'Conclusion' }
    ] : [
      { key: 'executive_summary', title: 'Executive Summary' },
      { key: 'company_overview', title: 'Company Overview' },
      { key: 'project_background', title: 'Project Background' },
      { key: 'scope_of_work', title: 'Scope of Work' },
      { key: 'technical_requirements', title: 'Technical Requirements' },
      { key: 'functional_requirements', title: 'Functional Requirements' },
      { key: 'implementation_approach', title: 'Implementation Approach' },
      { key: 'timeline_and_milestones', title: 'Timeline and Milestones' },
      { key: 'pricing_structure', title: 'Pricing Structure' },
      { key: 'evaluation_criteria', title: 'Evaluation Criteria' },
      { key: 'submission_instructions', title: 'Submission Instructions' },
      { key: 'terms_and_conditions', title: 'Terms and Conditions' }
    ];
    
    // Create Word document
    const children: any[] = [];

    // Title page
    children.push(
      new Paragraph({
        text: project.name,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({
        text: `${project.project_type} Response`,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: project.organization_name || '',
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({
        text: new Date().toLocaleDateString(),
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new PageBreak()
    );

    // Add sections in proper order
    sectionOrder.forEach(({ key, title }) => {
      const content = sections[key];
      if (!content) return; // Skip if section doesn't exist
      
      children.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );

      // Parse the content properly
      const contentText = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      
      // Split by newlines and process each line
      const lines = contentText.split('\n');
      let inList = false;
      
      lines.forEach((line: string, index: number) => {
        const trimmedLine = line.trim();
        
        if (!trimmedLine && !inList) {
          // Empty line - add spacing
          if (index > 0 && lines[index - 1].trim()) {
            children.push(
              new Paragraph({
                text: '',
                spacing: { after: 100 }
              })
            );
          }
        } else if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.match(/^\d+\./)) {
          // List item
          inList = true;
          const listText = trimmedLine.replace(/^[•\-\d+\.]\s*/, '');
          children.push(
            new Paragraph({
              text: listText,
              bullet: { level: 0 },
              spacing: { after: 100 }
            })
          );
        } else if (trimmedLine.startsWith('#')) {
          // Subheading
          inList = false;
          const headingText = trimmedLine.replace(/^#+\s*/, '');
          children.push(
            new Paragraph({
              text: headingText,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            })
          );
        } else if (trimmedLine) {
          // Regular paragraph
          inList = false;
          children.push(
            new Paragraph({
              text: trimmedLine,
              spacing: { after: 200 }
            })
          );
        }
      });

      // Add space before next section
      children.push(new PageBreak());
    });
    
    // Add any additional sections not in the standard order
    Object.entries(sections).forEach(([key, content]: [string, any]) => {
      if (!sectionOrder.find(s => s.key === key)) {
        const title = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l: string) => l.toUpperCase());
        
        children.push(
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          })
        );
        
        const contentText = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        children.push(
          new Paragraph({
            text: contentText,
            spacing: { after: 200 }
          })
        );
        
        children.push(new PageBreak());
      }
    });

    // Add citations if requested
    if (includeCitations) {
      children.push(
        new PageBreak(),
        new Paragraph({
          text: 'Document Sources & References',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
          text: 'This document was generated based on the following sources:',
          spacing: { after: 200 }
        })
      );

      // Get documents used
      const docsResult = await query(
        'SELECT filename, file_type FROM documents WHERE project_id = $1',
        [id]
      );
      
      docsResult.rows.forEach((doc: any) => {
        children.push(
          new Paragraph({
            text: `• ${doc.filename} (${doc.file_type || 'Document'})`,
            bullet: { level: 0 },
            spacing: { after: 100 }
          })
        );
      });
    }

    // Create the document
    const doc = new Document({
      sections: [{
        properties: {},
        children
      }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Send the file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${project.project_type}_${id}${includeCitations ? '_draft' : '_final'}.docx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export draft' });
  }
}