# Document Summarization Caching Implementation

## Overview
Implemented caching for document summaries to avoid re-summarizing documents every time a draft is generated. This significantly reduces API calls to Claude and improves generation speed.

## Changes Made

### 1. Database Schema Updates
Created migration script `add-summary-cache.js` that adds:
- `summary_cache` (TEXT) - Stores JSON summary data
- `summary_generated_at` (DATETIME) - Tracks when summary was generated

Added to tables:
- `documents`
- `web_sources`
- `company_knowledge`

### 2. AI Service Updates (`/src/lib/ai-service.ts`)

#### Added `cacheSummary` Method
```typescript
private async cacheSummary(type: 'document' | 'web_source' | 'knowledge', identifier: string, summary: DocumentSummary)
```
- Saves summaries to database based on type
- Uses filename for documents, URL for web sources, original_filename for knowledge base

#### Updated Prompt Building
Both `buildRFIPrompt` and `buildRFPPrompt` now:
1. Check for cached summary in metadata
2. If found, use cached version (logs "Using cached summary")
3. If not found, generate new summary and cache it
4. Works for documents, web sources, and knowledge base files

### 3. API Updates (`/src/pages/api/projects/[id]/generate-draft.ts`)
- Modified queries to include `summary_cache` and `summary_generated_at` columns
- Pass metadata with cached summaries to AI service
- Supports all three types: documents, web sources, knowledge base

### 4. Rate Limit Handling (`/src/lib/document-summarizer.ts`)
Added retry logic with exponential backoff:
- Maximum 3 retries
- Waits for time specified in `retry-after` header
- Applies to single chunk, multi-chunk, and final consolidation summarization
- Prevents 429 rate limit errors from failing the entire process

## Benefits

1. **Performance**: 
   - First generation: Normal speed (generates summaries)
   - Subsequent generations: Much faster (uses cached summaries)
   - Significant reduction in API calls

2. **Cost Savings**:
   - Fewer API calls to Claude
   - Lower token usage
   - Reduced rate limit issues

3. **Reliability**:
   - Rate limit handling prevents failures
   - Cached summaries persist between sessions
   - Summaries remain consistent across regenerations

## Usage

### Running the Migration
```bash
cd rfp_system
node add-summary-cache.js
```

### How It Works
1. First time a document is summarized:
   - Console: `[AIService] Generating new summary for filename.pdf`
   - Summary is cached to database

2. Subsequent uses:
   - Console: `[AIService] Using cached summary for filename.pdf`
   - No API call needed

### Clearing Cache
To force regeneration of summaries:
```sql
UPDATE documents SET summary_cache = NULL, summary_generated_at = NULL;
UPDATE web_sources SET summary_cache = NULL, summary_generated_at = NULL;
UPDATE company_knowledge SET summary_cache = NULL, summary_generated_at = NULL;
```

## Testing
1. Generate a draft and note the time taken
2. Generate the same draft again - should be significantly faster
3. Check console logs for "Using cached summary" messages
4. Verify summaries are consistent between generations