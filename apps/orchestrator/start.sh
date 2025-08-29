#!/bin/bash

# Startup script for the Insurance Orchestrator

echo "🚀 Starting Insurance Orchestrator..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if requirements are installed
if [ ! -f "requirements.txt" ]; then
    echo "❌ requirements.txt not found. Please run: pip install -r requirements.txt"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from example..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "📝 Please edit .env file with your configuration before starting."
        echo "   Required: OPENAI_API_KEY, NEST_API_URL"
        exit 1
    else
        echo "❌ env.example not found. Please create .env file manually."
        exit 1
    fi
fi

# Load environment variables
export $(cat .env | xargs)

# Check required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY not set in .env file"
    exit 1
fi

if [ -z "$NEST_API_URL" ]; then
    echo "❌ NEST_API_URL not set in .env file"
    exit 1
fi

echo "✅ Environment variables loaded"
echo "🔑 OpenAI API Key: ${OPENAI_API_KEY:0:10}..."
echo "🌐 API URL: $NEST_API_URL"
echo "🐍 Python: $(python3 --version)"
echo ""

# Install requirements if needed
echo "📦 Installing/updating Python dependencies..."
pip install -r requirements.txt

# Start the orchestrator
echo "🚀 Starting orchestrator on port ${PORT:-8001}..."
python3 main.py
