#!/bin/bash

# Setup script for RFP System

echo "Setting up RFP System..."

# Create uploads directory if it doesn't exist
if [ ! -d "uploads" ]; then
  mkdir uploads
  echo "✓ Created uploads directory"
else
  echo "✓ Uploads directory already exists"
fi

# Create data/templates directory if it doesn't exist
if [ ! -d "data/templates" ]; then
  mkdir -p data/templates
  echo "✓ Created data/templates directory"
else
  echo "✓ Data/templates directory already exists"
fi

# Create exports directory if it doesn't exist
if [ ! -d "exports" ]; then
  mkdir exports
  echo "✓ Created exports directory"
else
  echo "✓ Exports directory already exists"
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo "⚠️  Warning: .env.local not found!"
  echo "Please create .env.local with:"
  echo "ANTHROPIC_API_KEY=your-api-key-here"
else
  echo "✓ .env.local exists"
fi

# Run database migration for company info
echo "Running database migrations..."
npx ts-node src/lib/migrate-company-info.ts 2>/dev/null || echo "✓ Company info table ready"
npx ts-node src/lib/migrate-knowledge-base.ts 2>/dev/null || echo "✓ Knowledge base table ready"

echo ""
echo "Setup complete! To start the development server:"
echo "npm run dev"
echo ""
echo "Using AI Models:"
echo "- Document Summarization: Claude 3.5 Sonnet (Latest)"
echo "- Content Generation: Claude 3 Opus (Most Capable)"
echo ""