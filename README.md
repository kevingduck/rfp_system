# Universal RFI/RFP Generation System

A comprehensive web-based system for managing the complete procurement lifecycle from RFI (Request for Information) to RFP (Request for Proposal) with document ingestion, web scraping, and AI-powered content generation.

## Features

### RFI (Request for Information) Support
- **Custom Question Builder**: Create and organize questions for vendor assessment
- **Question Templates**: Pre-built templates for common industries (VoIP, IT services, etc.)
- **Vendor Response Management**: Track and evaluate vendor responses
- **RFI Document Generation**: Professional RFI documents with customizable sections

### RFP (Request for Proposal) Support  
- **Document Upload**: Support for PDF, Word (.doc, .docx), Excel (.xls, .xlsx, .xlsm), and text files
- **Web Scraping**: Extract content from relevant web pages
- **AI-Powered Analysis**: Automatically extract key information (scope, requirements, timeline, budget)
- **Smart RFP Generation**: Generate professional RFP documents based on uploaded content
- **Spreadsheet Analysis**: Extract pricing, timelines, and requirements from Excel spreadsheets

### General Features
- **Project Management**: Organize multiple RFI/RFP projects
- **RFI to RFP Workflow**: Convert successful RFI vendors into RFP participants
- **Export Options**: Download completed documents as Word files
- **Vendor Database**: Store and manage vendor information

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the project directory:
```bash
cd rfp_system
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Understanding the RFI → RFP Process

1. **Start with RFI**: Gather market information and identify qualified vendors
2. **Evaluate Responses**: Review vendor capabilities and solutions
3. **Create RFP**: Request detailed proposals from qualified vendors
4. **Select Vendor**: Choose the best solution based on proposals

### Creating a New Project

1. Click "New Project" on the home page
2. Select project type:
   - **RFI**: For initial market research and vendor discovery
   - **RFP**: For detailed proposal requests
3. Enter a project name
4. Optionally add the organization name
5. Click "Create Project"

### Working with RFI Projects

#### Managing Questions
1. Click "Manage Questions" on the RFI project page
2. Add custom questions or use a template
3. Organize questions by category
4. Mark questions as required or optional

#### Generating RFI Document
1. Upload reference documents and web sources
2. Click "Generate RFI"
3. The system creates a professional RFI document with:
   - Introduction and purpose
   - Submission guidelines
   - Your custom questions
   - Evaluation criteria

### Working with RFP Projects

#### Adding Content
- **Upload Documents**: Select PDF, Word, Excel, or text files containing requirements
- **Add Web Sources**: Paste URLs to scrape and analyze content
- **Excel Support**: Upload pricing sheets, requirement matrices, and timeline spreadsheets

#### Generating RFP Document
1. After uploading documents and/or web sources
2. Click "Generate RFP"
3. The system creates a professional RFP document with:
   - Executive summary
   - Company overview
   - Technical approach
   - Timeline and pricing sections

### Customization

The system includes:
- Configurable company information
- Template sections that can be customized
- Support for multiple organizations and RFP types

## Technical Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite
- **Document Processing**: pdf-parse, mammoth
- **Web Scraping**: Puppeteer, Cheerio
- **Document Generation**: docx

## Project Structure

```
rfp_system/
├── src/
│   ├── components/     # UI components
│   ├── pages/         # Next.js pages and API routes
│   ├── lib/           # Core utilities and services
│   └── styles/        # Global styles
├── uploads/           # Uploaded documents
├── exports/           # Generated RFPs
└── data/             # Database and templates
```

## Security Notes

- Uploaded files are stored locally
- Web scraping respects robots.txt
- All data is stored in a local SQLite database