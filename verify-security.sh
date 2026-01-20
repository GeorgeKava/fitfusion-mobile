#!/bin/bash

echo "🔒 FitFusion Security Verification Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ISSUES=0

# Check 1: .env file should NOT be committed
echo "1️⃣  Checking .env file status..."
if [ -f "backend/.env" ]; then
    echo -e "${YELLOW}   ⚠️  backend/.env exists (this is OK if not tracked by git)${NC}"
    if git ls-files --error-unmatch backend/.env 2>/dev/null; then
        echo -e "${RED}   ❌ CRITICAL: backend/.env is tracked by git!${NC}"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "${GREEN}   ✅ backend/.env is NOT tracked by git${NC}"
    fi
else
    echo -e "${GREEN}   ✅ No .env file found${NC}"
fi
echo ""

# Check 2: .env.example should exist
echo "2️⃣  Checking .env.example..."
if [ -f "backend/.env.example" ]; then
    echo -e "${GREEN}   ✅ backend/.env.example exists${NC}"
else
    echo -e "${YELLOW}   ⚠️  backend/.env.example not found${NC}"
fi
echo ""

# Check 3: .gitignore should contain .env
echo "3️⃣  Checking .gitignore for .env patterns..."
if grep -q "\.env" .gitignore; then
    echo -e "${GREEN}   ✅ .gitignore contains .env patterns${NC}"
else
    echo -e "${RED}   ❌ .gitignore missing .env patterns!${NC}"
    ISSUES=$((ISSUES + 1))
fi
echo ""

# Check 4: Search for potential API keys in tracked files
echo "4️⃣  Scanning for potential API keys in code..."
POTENTIAL_KEYS=$(git grep -i "api[_-]key\|secret\|password" -- '*.py' '*.js' '*.jsx' '*.ts' '*.tsx' 2>/dev/null | grep -v "\.env" | grep -v "example" | grep -v "your-" | grep -v "placeholder" | grep -v "FIXME" | grep -v "TODO" || true)

if [ -z "$POTENTIAL_KEYS" ]; then
    echo -e "${GREEN}   ✅ No hardcoded API keys found${NC}"
else
    echo -e "${YELLOW}   ⚠️  Potential API key references found (review these):${NC}"
    echo "$POTENTIAL_KEYS" | head -5
    echo ""
fi
echo ""

# Check 5: Verify common sensitive directories are ignored
echo "5️⃣  Checking sensitive directories..."
SENSITIVE_DIRS=("node_modules" "__pycache__" "build" ".venv" "venv")
for dir in "${SENSITIVE_DIRS[@]}"; do
    if grep -q "$dir" .gitignore; then
        echo -e "${GREEN}   ✅ $dir is in .gitignore${NC}"
    else
        echo -e "${YELLOW}   ⚠️  $dir not explicitly in .gitignore${NC}"
    fi
done
echo ""

# Check 6: Look for actual API key patterns
echo "6️⃣  Checking for actual Azure API key patterns..."
KEY_PATTERN=$(git grep -E "[A-Za-z0-9]{32,}" -- '*.py' '*.js' '*.jsx' 2>/dev/null | grep -v "node_modules" | grep -v "\.env" | grep -v "build" | grep -v "example" | head -3 || true)
if [ -z "$KEY_PATTERN" ]; then
    echo -e "${GREEN}   ✅ No suspicious long strings found in code${NC}"
else
    echo -e "${YELLOW}   ⚠️  Found long strings (may be keys - review):${NC}"
    echo "$KEY_PATTERN"
fi
echo ""

# Summary
echo "=========================================="
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    echo -e "${GREEN}Your repository appears safe to push to GitHub.${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "   1. git init"
    echo "   2. git add ."
    echo "   3. git commit -m 'Initial commit: FitFusion Mobile'"
    echo "   4. git remote add origin https://github.com/YOUR_USERNAME/fitfusion-mobile.git"
    echo "   5. git push -u origin main"
else
    echo -e "${RED}❌ Found $ISSUES critical issue(s)!${NC}"
    echo -e "${RED}DO NOT push to GitHub until these are resolved.${NC}"
    exit 1
fi
