#!/bin/bash
# Azure App Service Startup Script

echo "🚀 Starting FitFusion API on Azure..."

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "📦 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements-production.txt

echo "✅ Starting Gunicorn..."
gunicorn -c gunicorn.conf.py app:app
