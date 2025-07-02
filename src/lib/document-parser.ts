import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

export interface ParsedDocument {
  text: string;
  metadata: {
    fileName: string;
    fileType: string;
    pageCount?: number;
    sheetCount?: number;
    extractedDate: Date;
  };
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const fileName = path.basename(filePath);
  const fileExt = path.extname(filePath).toLowerCase();
  
  let text = '';
  let metadata: ParsedDocument['metadata'] = {
    fileName,
    fileType: fileExt,
    extractedDate: new Date()
  };

  try {
    switch (fileExt) {
      case '.pdf':
        const pdfBuffer = await fs.readFile(filePath);
        const pdfData = await pdf(pdfBuffer);
        text = pdfData.text;
        metadata.pageCount = pdfData.numpages;
        break;
        
      case '.docx':
      case '.doc':
        const docBuffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer: docBuffer });
        text = result.value;
        break;
        
      case '.txt':
        text = await fs.readFile(filePath, 'utf-8');
        break;
        
      case '.xls':
      case '.xlsx':
      case '.xlsm':
        const xlsBuffer = await fs.readFile(filePath);
        const workbook = XLSX.read(xlsBuffer, { type: 'buffer' });
        
        // Store sheet count in metadata
        metadata.sheetCount = workbook.SheetNames.length;
        
        // Extract text from all sheets
        const textParts: string[] = [];
        
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          
          // Add sheet name as header
          textParts.push(`\n=== Sheet: ${sheetName} ===\n`);
          
          // Get range of sheet
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          
          // Convert to array of arrays for better handling
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            raw: false,
            blankrows: false
          }) as any[][];
          
          if (jsonData.length > 0) {
            // Format as a table
            textParts.push('\nTable Format:');
            
            // Find maximum column widths for alignment
            const colWidths: number[] = [];
            jsonData.forEach(row => {
              row.forEach((cell, colIndex) => {
                const cellStr = String(cell || '');
                colWidths[colIndex] = Math.max(colWidths[colIndex] || 0, cellStr.length);
              });
            });
            
            // Format each row
            jsonData.forEach((row, rowIndex) => {
              const formattedCells = row.map((cell, colIndex) => {
                const cellStr = String(cell || '');
                return cellStr.padEnd(colWidths[colIndex] || 0);
              });
              textParts.push(formattedCells.join(' | '));
              
              // Add separator after header row
              if (rowIndex === 0 && jsonData.length > 1) {
                const separator = colWidths.map(width => '-'.repeat(width)).join('-+-');
                textParts.push(separator);
              }
            });
          }
          
          // Also add CSV for alternative parsing
          const csv = XLSX.utils.sheet_to_csv(worksheet, { 
            blankrows: false,
            rawNumbers: false 
          });
          if (csv.trim()) {
            textParts.push('\nCSV Format:');
            textParts.push(csv);
          }
        }
        
        text = textParts.join('\n');
        break;
        
      default:
        throw new Error(`Unsupported file type: ${fileExt}`);
    }
    
    return { text, metadata };
  } catch (error) {
    throw new Error(`Failed to parse document: ${error}`);
  }
}

export function extractKeyInformation(text: string) {
  const sections: Record<string, string> = {};
  
  // Check if this is spreadsheet data
  const isSpreadsheet = text.includes('=== Sheet:');
  
  if (isSpreadsheet) {
    // Extract information from spreadsheet format
    const lines = text.split('\n');
    let currentSection = '';
    let sectionContent: string[] = [];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Check for section headers in spreadsheet
      if (lowerLine.includes('requirement') || lowerLine.includes('spec')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join('\n').trim();
        }
        currentSection = 'requirements';
        sectionContent = [];
      } else if (lowerLine.includes('budget') || lowerLine.includes('cost') || lowerLine.includes('price')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join('\n').trim();
        }
        currentSection = 'budget';
        sectionContent = [];
      } else if (lowerLine.includes('timeline') || lowerLine.includes('schedule') || lowerLine.includes('date')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join('\n').trim();
        }
        currentSection = 'timeline';
        sectionContent = [];
      } else if (lowerLine.includes('deliverable') || lowerLine.includes('output')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join('\n').trim();
        }
        currentSection = 'deliverables';
        sectionContent = [];
      } else if (currentSection && line.trim()) {
        sectionContent.push(line);
      }
    }
    
    // Save last section
    if (currentSection && sectionContent.length > 0) {
      sections[currentSection] = sectionContent.join('\n').trim();
    }
    
    // Extract any pricing information from cells
    const priceMatches = text.match(/\$[\d,]+\.?\d*/g);
    if (priceMatches && !sections.budget) {
      sections.budget = 'Pricing found: ' + priceMatches.join(', ');
    }
  } else {
    // Original pattern matching for text documents
    const sectionPatterns = [
      { name: 'scope', pattern: /(?:scope of work|project scope|scope)[\s:]*([^]*?)(?=\n(?:deliverables|requirements|timeline|budget)|$)/i },
      { name: 'requirements', pattern: /(?:requirements|technical requirements|functional requirements)[\s:]*([^]*?)(?=\n(?:deliverables|scope|timeline|budget)|$)/i },
      { name: 'timeline', pattern: /(?:timeline|schedule|project duration|deadlines?)[\s:]*([^]*?)(?=\n(?:deliverables|requirements|scope|budget)|$)/i },
      { name: 'budget', pattern: /(?:budget|pricing|cost|financial)[\s:]*([^]*?)(?=\n(?:deliverables|requirements|scope|timeline)|$)/i },
      { name: 'deliverables', pattern: /(?:deliverables|outputs|expected results)[\s:]*([^]*?)(?=\n(?:requirements|scope|timeline|budget)|$)/i }
    ];
    
    for (const { name, pattern } of sectionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        sections[name] = match[1].trim();
      }
    }
  }
  
  return sections;
}