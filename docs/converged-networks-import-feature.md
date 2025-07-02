# Converged Networks Import Feature

## What's Been Added

### 1. Import Button in Settings
- Added "Import from Converged Networks" button in the Company Settings page
- Located next to the Company Name field
- One-click import specifically for Converged Networks

### 2. Smart Web Scraping
The import feature intelligently extracts:
- **Company Description**: About us content
- **Services**: VoIP, Unified Communications, SIP Trunking, etc.
- **Capabilities**: Technical expertise and offerings  
- **Differentiators**: What sets Converged Networks apart
- **Experience**: Company history and years in business
- **Certifications**: Partnerships and certifications
- **Contact Info**: Phone, email, and address

### 3. How It Works
1. Click "Import from Converged Networks" button
2. System scrapes www.convergednetworks.com
3. Intelligently extracts relevant information
4. Auto-fills all company fields
5. You can review and edit before saving

### 4. Fallback Defaults
If certain information can't be extracted, the system provides sensible defaults:
- Professional company description
- Common VoIP/telecom services
- Standard capabilities
- Key differentiators

## Benefits
- **Time-Saving**: No manual data entry
- **Consistency**: Always uses latest website info
- **Accuracy**: Pulls directly from your website
- **Convenience**: One-click setup

## Usage Instructions
1. Go to Settings (click "Company Settings" on home page)
2. Click "Import from Converged Networks" button
3. Wait for import to complete (shows progress)
4. Review imported information
5. Make any necessary edits
6. Click "Save Company Info"

## Technical Implementation
- Custom API endpoint: `/api/company-import`
- Uses Puppeteer for dynamic content
- Falls back to basic fetch if needed
- Cheerio for HTML parsing
- Smart content extraction with multiple selectors
- Specific to Converged Networks website structure

The system now knows you ARE Converged Networks and will use this information when generating RFI/RFP responses!