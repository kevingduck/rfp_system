#!/bin/bash
set -e

echo "Starting build process..."

# Create necessary directories
echo "Creating directories..."
mkdir -p uploads
mkdir -p uploads/knowledge
mkdir -p exports
mkdir -p data/templates

# Run database migrations
echo "Running database migrations..."
node create-knowledge-table.js
node create-drafts-table.js
node add-summary-cache.js
node fix-all-tables.js
node fix-company-info-table.js

# Install dependencies
echo "Installing dependencies..."
npm ci --production=false

# Build Next.js app
echo "Building Next.js app..."
npm run build

echo "Build complete!"