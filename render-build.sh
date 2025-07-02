#!/bin/bash
# Combined build script for Render

echo "=== Starting Render Build ==="

# Create necessary directories
echo "Creating directories..."
mkdir -p uploads exports data

# Initialize database if needed
if [ ! -f "rfp_database.db" ]; then
    echo "Setting up database..."
    node fix-all-tables.js || echo "fix-all-tables.js completed"
    node create-knowledge-table.js || echo "create-knowledge-table.js completed"
    node create-drafts-table.js || echo "create-drafts-table.js completed"
    node add-summary-cache.js || echo "add-summary-cache.js completed"
    echo "Database setup complete"
fi

# Build Next.js
echo "Building Next.js application..."
npx next build

echo "=== Build Complete ==="