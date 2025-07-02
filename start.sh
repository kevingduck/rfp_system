#!/bin/bash
set -e

echo "Starting RFP System..."

# Ensure directories exist
mkdir -p uploads
mkdir -p uploads/knowledge
mkdir -p exports

# Start Next.js in production mode
exec npm start