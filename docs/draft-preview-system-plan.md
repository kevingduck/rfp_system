# Draft Preview System Implementation Plan

## Overview
Transform the RFP/RFI generation process into a two-phase system:
1. **Draft Phase**: Preview with citations, edit in browser
2. **Final Phase**: Clean export without citations

## Key Features to Implement

### 1. Real-time Progress Updates
- Use Server-Sent Events (SSE) or polling
- Show actual progress in UI, not just console
- Update status for each step

### 2. Draft Preview with Citations
- Generate content with inline citations [Source: document.pdf, page 3]
- Display in browser with rich text editor
- Highlight citations in different color
- Click citations to see source context

### 3. Temperature Setting
- Set LLM temperature to 0.1 for consistency
- Prevent creative hallucinations
- Ensure factual accuracy

### 4. In-Browser Editing
- Rich text editor (Quill or TipTap)
- Track changes
- Save drafts to database
- Collaborative review features

### 5. Citation Management
- Format: [Source: filename, page/section]
- Clickable to show source excerpt
- Toggle citations on/off
- Export with or without citations

### 6. Two-Stage Export
- Draft: With citations for internal review
- Final: Clean version for client

## Implementation Steps

### Step 1: Update AI Service
```typescript
// Add temperature setting
const response = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  temperature: 0.1, // Near-deterministic
  max_tokens: 4000,
  messages: [...]
});

// Add citation tracking
prompt += `
IMPORTANT: When using information from sources, include inline citations in this format:
[Source: filename, section/page]

Example: "The company requires 99.9% uptime [Source: RFP-Requirements.pdf, Section 3.2]"
`;
```

### Step 2: Create Draft Preview API
```typescript
// /api/projects/[id]/generate-draft.ts
// Returns JSON with sections and citations
// Not a direct download
```

### Step 3: Build Preview Component
```typescript
// /components/DraftPreview.tsx
// Rich text editor with citation highlighting
// Save draft functionality
// Export options
```

### Step 4: Progress Updates
```typescript
// Use Server-Sent Events
// /api/projects/[id]/generate-stream.ts
// Send progress updates in real-time
```

### Step 5: Citation Viewer
```typescript
// /components/CitationViewer.tsx
// Show source context on hover/click
// Link to original document
```

## Benefits
- **Transparency**: See exactly where content comes from
- **Accuracy**: Temperature 0.1 prevents hallucinations
- **Collaboration**: Review and edit before sending
- **Flexibility**: Export with or without citations
- **Trust**: Build confidence in AI-generated content

## Chat Interface Location
The chat interface exists in the Wizard:
1. Create project
2. Click "Start Wizard" 
3. Upload docs (Step 1)
4. Click "Next" → Chat interface (Step 2)
5. Answer 4 contextual questions
6. Review (Step 3)
7. Generate (Step 4)

The wizard provides the interactive chat experience for gathering context!