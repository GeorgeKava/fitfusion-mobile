#!/bin/bash
# Deployment Script for Production
# Usage: bash deploy.sh

set -e  # Exit on error

echo "🚀 FitFusion API Deployment Script"
echo "=================================="

# Check if running in the correct directory
if [ ! -f "app.py" ]; then
    echo "❌ Error: app.py not found. Please run this script from the backend directory."
    exit 1
fi

# Step 1: Environment Check
echo ""
echo "📋 Step 1: Checking environment variables..."
if [ -z "$FLASK_DEBUG" ] || [ "$FLASK_DEBUG" != "false" ]; then
    echo "⚠️  Warning: FLASK_DEBUG should be set to 'false' for production"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

if [ -z "$JWT_SECRET_KEY" ]; then
    echo "❌ Error: JWT_SECRET_KEY environment variable is not set"
    echo "Generate a new key with: python3 -c 'import secrets; print(secrets.token_urlsafe(32))'"
    exit 1
fi

echo "✅ Environment variables configured"

# Step 2: Install Dependencies
echo ""
echo "📦 Step 2: Installing production dependencies..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements-production.txt
echo "✅ Dependencies installed"

# Step 3: Database Check
echo ""
echo "🗄️  Step 3: Checking database..."
if [ ! -d "chroma_db" ]; then
    echo "⚠️  Warning: chroma_db directory not found. Will be created on first run."
else
    echo "✅ Database directory exists"
fi

# Step 4: Security Checklist
echo ""
echo "🔒 Step 4: Security checklist..."
SECURITY_ISSUES=0

# Check JWT Secret
if grep -q "JWT_SECRET_KEY=\"your-secret-key-here\"" .env 2>/dev/null; then
    echo "❌ Default JWT_SECRET_KEY detected in .env"
    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi

# Check CORS
if grep -q "CORS_ALLOWED_ORIGINS=\"\*\"" .env 2>/dev/null; then
    echo "❌ CORS allows all origins (*)"
    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi

# Check Flask Debug
if grep -q "FLASK_DEBUG=\"true\"" .env 2>/dev/null; then
    echo "⚠️  FLASK_DEBUG=true in .env (should be false for production)"
    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi

if [ $SECURITY_ISSUES -eq 0 ]; then
    echo "✅ No security issues found"
else
    echo "⚠️  Found $SECURITY_ISSUES security issue(s). Please review before deploying."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 5: Test Configuration
echo ""
echo "🧪 Step 5: Testing configuration..."
python3 -c "
import sys
sys.path.insert(0, '.')
try:
    from app import app
    print('✅ Flask app loads successfully')
except Exception as e:
    print(f'❌ Error loading Flask app: {e}')
    sys.exit(1)
"

# Step 6: Start Gunicorn
echo ""
echo "🚀 Step 6: Starting Gunicorn server..."
echo "=================================="
echo ""

# Export environment variables if .env exists
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start Gunicorn with configuration
gunicorn -c gunicorn.conf.py app:app

# This line only executes if Gunicorn exits
echo ""
echo "👋 Gunicorn server stopped"
