#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   STARTING PYTHON BACKEND - OIL ERP                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Navigate to backend directory
cd /Users/abdulqadeer/Desktop/oil-erp-backend

echo "📂 Backend directory: $(pwd)"
echo ""

# Check if virtual environment exists
if [ -d ".venv" ]; then
    echo "🐍 Activating virtual environment (.venv)..."
    source .venv/bin/activate
    echo "✓ Virtual environment activated"
elif [ -d "venv" ]; then
    echo "🐍 Activating virtual environment (venv)..."
    source venv/bin/activate
    echo "✓ Virtual environment activated"
else
    echo "⚠️  No virtual environment found"
    echo "   Using system Python..."
fi

echo ""

# Check if uvicorn is installed
if ! command -v uvicorn &> /dev/null; then
    echo "❌ uvicorn not found!"
    echo ""
    echo "Installing dependencies..."
    pip install -r requirements.txt
    echo ""
fi

echo "🚀 Starting FastAPI backend server..."
echo "   URL: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "   Press Ctrl+C to stop"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# Start the server
uvicorn app.main:app --reload --port 8000
