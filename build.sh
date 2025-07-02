#!/bin/bash
# Render build script

echo "Starting Render build process..."

# Create necessary directories
mkdir -p uploads
mkdir -p exports
mkdir -p data

# Set up database if it doesn't exist
if [ ! -f "rfp_database.db" ]; then
    echo "Initializing database..."
    
    # Run all migration scripts
    node fix-all-tables.js
    node create-knowledge-table.js
    node create-drafts-table.js
    node add-summary-cache.js
    
    echo "Database initialized successfully"
else
    echo "Database already exists"
fi

# Build the Next.js application
echo "Building Next.js application..."
npm run build

echo "Build complete!"