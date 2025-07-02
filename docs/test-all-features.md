# RFP System Feature Test Checklist

## System Configuration

### 1. **AI Model Updates** ✅
- Document Summarization: Now uses **Claude 3.5 Sonnet** (latest)
- RFI/RFP Generation: Now uses **Claude 3 Opus** (most capable)
- Smart Questions: Now uses **Claude 3.5 Sonnet** (latest)

### 2. **TypeScript Fixes** ✅
- Fixed missing `file_type` property in Document interface
- All components properly typed
- No TypeScript errors in the codebase

## Feature Testing Guide

### Test 1: Company Profile Setup
1. Navigate to home page
2. Click "Company Settings" button
3. Fill out all fields:
   - Company name
   - Description
   - Services (list your VoIP services)
   - Technical capabilities
   - Differentiators
   - Certifications
   - Contact info
4. Click "Save Company Info"
5. **Expected**: Success message, data persists on refresh

### Test 2: Create New Project
1. Click "New Project" on home page
2. Select project type (RFI or RFP)
3. Enter project name
4. Enter organization name (optional)
5. Click "Create Project"
6. **Expected**: Redirected to project page with welcome card

### Test 3: Wizard Flow (Recommended Path)
1. On new project, see welcome card
2. Click "Start Wizard"
3. **Step 1 - Upload**:
   - Upload PDF/Word/Excel documents
   - Add web source URL (optional)
   - **Expected**: Files show with green checkmarks
4. **Step 2 - Context Questions**:
   - Answer 4 targeted questions
   - Use quick replies or type custom answers
   - Click "Why am I asking?" to see explanations
   - **Expected**: Progress shows "Question X of 4"
5. **Step 3 - Review**:
   - Review all inputs
   - **Expected**: See document count and all answers
6. **Step 4 - Generate**:
   - Click "Generate RFI/RFP"
   - **Expected**: Progress messages appear, document downloads

### Test 4: Quick Generate (Traditional)
1. Exit wizard or choose "Quick Generate" from welcome
2. Upload documents using traditional interface
3. Add web sources
4. Click "Quick Generate"
5. **Expected**: Document generates without questions

### Test 5: Progress Visibility
During generation, verify you see:
- Visual progress component with status messages
- Real-time updates: "Analyzing...", "Summarizing...", "Generating..."
- Console logs (F12) showing:
  - Document summarization progress
  - AI model calls (Sonnet for summaries, Opus for generation)
  - Processing times

### Test 6: Document Summarization
1. Upload a large document (> 2KB)
2. Check console logs during generation
3. **Expected**: 
   - See "[DocumentSummarizer] Processing..." logs
   - Large docs get summarized before AI processing
   - Key info extracted (scope, requirements, timeline, budget)

### Test 7: RFI vs RFP Context
1. **For RFI**: Verify generated doc is FROM your company seeking vendor info
2. **For RFP**: Verify generated doc is your RESPONSE to a buyer's RFP

### Test 8: Chat Context Integration
1. Use wizard and provide specific answers
2. Generate document
3. **Expected**: Your answers are reflected in the output
   - Win themes mentioned in executive summary
   - Timeline concerns addressed
   - Budget considerations included

## Console Log Examples

You should see logs like:
```
[DocumentSummarizer] Processing document.pdf (15000 chars)
[DocumentSummarizer] document.pdf requires single-chunk summarization
[DocumentSummarizer] Sending to Claude Sonnet 3.5 for summarization...
[DocumentSummarizer] Claude Sonnet 3.5 responded in 1523ms
[AIService] Starting RFP generation for Project Name
[AIService] Processing 3 documents and 2 web sources
[AIService] Prompt built, length: 8500 chars
[AIService] Sending to Claude Opus 3 for content generation...
[AIService] Claude Opus 3 responded in 4821ms
[AIService] Generated 12 sections
```

## Common Issues to Check

1. **API Key**: Ensure ANTHROPIC_API_KEY is set in .env.local
2. **Database**: Run migration for company_info table if needed
3. **File Uploads**: Check uploads directory exists and is writable
4. **Model Availability**: Opus might have rate limits, fallback to Sonnet if needed

## Performance Notes

- Opus is slower but produces highest quality output
- Sonnet 3.5 is fast and excellent for summarization
- Expect 5-15 seconds for full generation depending on document size

The system is now using the best available AI models for each task!