#!/bin/bash
# Render start script

echo "Starting RFP System..."

# Ensure directories exist
mkdir -p uploads
mkdir -p exports
mkdir -p data

# Start the Next.js application
npm start