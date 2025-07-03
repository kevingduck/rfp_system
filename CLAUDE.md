# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development
- `npm run dev` - Start the development server on http://localhost:3000
- `npm run build` - Initialize PostgreSQL database and build for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint for code quality checks

### Environment Setup
Create a `.env.local` file with:
```
DATABASE_URL=postgresql://[connection-string]
ANTHROPIC_API_KEY=your_anthropic_api_key
GROQ_API_KEY=your_groq_api_key
```

## High-Level Architecture

### Tech Stack
- **Frontend**: Next.js 14 with React 18 and TypeScript
- **Database**: PostgreSQL (hosted on Neon, recently migrated from SQLite)
- **Styling**: Tailwind CSS with shadcn/ui components
- **AI Services**: Anthropic Claude for document generation, Groq as alternative
- **Document Processing**: pdf-parse, mammoth (Word), xlsx (Excel), docx (generation)

### Project Structure
The system supports two main workflows:
1. **RFI (Request for Information)**: Market research and vendor discovery
2. **RFP (Request for Proposal)**: Detailed proposal requests from qualified vendors

Key directories:
- `/src/components/` - React components including RFPWizard, ChatAssistant, DraftPreview
- `/src/lib/` - Core business logic for AI, document parsing, database, and generation
- `/src/pages/api/` - API endpoints for all backend operations
- `/uploads/` - Local file storage for uploaded documents

### Database Schema
PostgreSQL tables include:
- `organizations` - Company management
- `projects` - RFI/RFP projects with type discrimination
- `documents` - Uploaded files with parsed content and AI summaries
- `web_sources` - Scraped web content with summaries
- `rfi_questions` - Questions for RFI projects
- `company_knowledge` - Reusable knowledge base documents
- `drafts` - Generated document drafts

### Key APIs and Integration Points

#### Document Processing Flow
1. Upload endpoint: `/api/projects/[projectId]/documents`
2. Parser: `/src/lib/document-parser.ts` handles PDF, Word, Excel, text
3. Summarizer: `/src/lib/document-summarizer.ts` uses AI for content analysis
4. Storage: Files saved to `/uploads/`, metadata in PostgreSQL

#### Generation Pipeline
- RFI: `/src/lib/rfi-generator.ts` creates structured questionnaires
- RFP: `/src/lib/rfp-generator.ts` generates comprehensive proposals
- Both use AI services via `/src/lib/ai-service.ts`
- Exports to Word format using docx library

#### Web Scraping
- Endpoint: `/api/projects/[projectId]/web-sources`
- Scraper: `/src/lib/web-scraper.ts` using Cheerio
- Respects robots.txt, extracts and summarizes content

### Deployment Notes
- Platform: Render (web service)
- Build command runs `init-pg-db.js` first to ensure schema exists
- Production requires SSL for PostgreSQL connection
- No authentication system currently implemented

### Development Tips
- The system uses AI heavily - monitor API usage and costs
- Document summaries are cached in the database to reduce API calls
- Excel parsing extracts all sheets and attempts to identify pricing/timeline data
- The RFP Wizard (`/src/components/RFPWizard.tsx`) provides step-by-step guidance
- Chat Assistant uses conversation history for context-aware help