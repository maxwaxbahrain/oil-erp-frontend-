#!/bin/bash

# Customer Module Integration Status Check
# Run this to verify frontend-backend integration

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   CUSTOMER MODULE INTEGRATION STATUS CHECK                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

# Test 1: Check if backend directory exists
echo -e "${BLUE}[1/8]${NC} Checking backend directory..."
if [ -d "/Users/abdulqadeer/Desktop/oil-erp-backend" ]; then
    echo -e "${GREEN}✓${NC} Backend directory exists"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Backend directory NOT found"
    echo "  Expected: /Users/abdulqadeer/Desktop/oil-erp-backend"
    ((FAIL++))
fi
echo ""

# Test 2: Check if backend is running
echo -e "${BLUE}[2/8]${NC} Checking if backend is running..."
if curl -s --max-time 2 http://localhost:8000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend is running on port 8000"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Backend is NOT running"
    echo "  Start with: cd /Users/abdulqadeer/Desktop/oil-erp-backend && uvicorn app.main:app --reload"
    ((FAIL++))
fi
echo ""

# Test 3: Check if frontend is running
echo -e "${BLUE}[3/8]${NC} Checking if frontend is running..."
FRONTEND_RUNNING=false
for PORT in 5173 5174 5175; do
    if curl -s --max-time 2 http://localhost:$PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend is running on port $PORT"
        FRONTEND_PORT=$PORT
        FRONTEND_RUNNING=true
        ((PASS++))
        break
    fi
done

if [ "$FRONTEND_RUNNING" = false ]; then
    echo -e "${RED}✗${NC} Frontend is NOT running"
    echo "  Start with: cd /Users/abdulqadeer/Desktop/oil-erp-frontend && npm run dev"
    ((FAIL++))
fi
echo ""

# Test 4: Check frontend mode (mock vs backend)
echo -e "${BLUE}[4/8]${NC} Checking frontend mode..."
if grep -q "const USE_MOCK = true" /Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts; then
    echo -e "${YELLOW}⚠${NC}  Frontend is in MOCK mode (using localStorage)"
    echo "  To use backend: Change 'USE_MOCK = true' to 'USE_MOCK = false'"
    echo "  File: src/services/customerService.ts (line 7)"
elif grep -q "const USE_MOCK = false" /Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts; then
    echo -e "${GREEN}✓${NC} Frontend is in BACKEND mode"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Cannot determine frontend mode"
    ((FAIL++))
fi
echo ""

# Test 5: Test backend API (if running)
if curl -s --max-time 2 http://localhost:8000 > /dev/null 2>&1; then
    echo -e "${BLUE}[5/8]${NC} Testing backend API endpoints..."
    
    # Test GET /api/customers
    RESPONSE=$(curl -s -w "%{http_code}" --max-time 2 http://localhost:8000/api/customers 2>/dev/null)
    HTTP_CODE="${RESPONSE: -3}"
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓${NC} GET /api/customers - OK"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} GET /api/customers - Failed (HTTP $HTTP_CODE)"
        ((FAIL++))
    fi
else
    echo -e "${BLUE}[5/8]${NC} Skipping API tests (backend not running)"
    echo ""
fi
echo ""

# Test 6: Check for CORS configuration
echo -e "${BLUE}[6/8]${NC} Checking CORS configuration..."
if [ -f "/Users/abdulqadeer/Desktop/oil-erp-backend/app/main.py" ]; then
    if grep -q "CORSMiddleware" /Users/abdulqadeer/Desktop/oil-erp-backend/app/main.py; then
        echo -e "${GREEN}✓${NC} CORS middleware found in backend"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠${NC}  CORS middleware not found"
        echo "  Add CORS middleware to prevent browser errors"
        ((FAIL++))
    fi
else
    echo -e "${YELLOW}⚠${NC}  Cannot access backend main.py"
fi
echo ""

# Test 7: Check database
echo -e "${BLUE}[7/8]${NC} Checking database..."
if [ -f "/Users/abdulqadeer/Desktop/oil-erp-backend/database.db" ]; then
    echo -e "${GREEN}✓${NC} SQLite database found"
    DB_SIZE=$(du -h /Users/abdulqadeer/Desktop/oil-erp-backend/database.db | cut -f1)
    echo "  Size: $DB_SIZE"
    ((PASS++))
elif [ -f "/Users/abdulqadeer/Desktop/oil-erp-backend/oil_erp.db" ]; then
    echo -e "${GREEN}✓${NC} SQLite database found (oil_erp.db)"
    DB_SIZE=$(du -h /Users/abdulqadeer/Desktop/oil-erp-backend/oil_erp.db | cut -f1)
    echo "  Size: $DB_SIZE"
    ((PASS++))
else
    echo -e "${YELLOW}⚠${NC}  Database file not found (may be using PostgreSQL)"
fi
echo ""

# Test 8: Check if customerService exists
echo -e "${BLUE}[8/8]${NC} Checking customer service..."
if [ -f "/Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts" ]; then
    echo -e "${GREEN}✓${NC} customerService.ts exists"
    LINES=$(wc -l < /Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts)
    echo "  Lines of code: $LINES"
    ((PASS++))
else
    echo -e "${RED}✗${NC} customerService.ts NOT found"
    ((FAIL++))
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════"
echo "                      SUMMARY                                "
echo "════════════════════════════════════════════════════════════"
echo -e "Tests Passed: ${GREEN}$PASS${NC}"
echo -e "Tests Failed: ${RED}$FAIL${NC}"
echo ""

# Recommendations
if [ $FAIL -gt 0 ]; then
    echo "⚠️  RECOMMENDATIONS:"
    echo ""
    
    if ! curl -s --max-time 2 http://localhost:8000 > /dev/null 2>&1; then
        echo "1. Start Backend:"
        echo "   cd /Users/abdulqadeer/Desktop/oil-erp-backend"
        echo "   uvicorn app.main:app --reload --port 8000"
        echo ""
    fi
    
    if [ "$FRONTEND_RUNNING" = false ]; then
        echo "2. Start Frontend:"
        echo "   cd /Users/abdulqadeer/Desktop/oil-erp-frontend"
        echo "   npm run dev"
        echo ""
    fi
    
    if grep -q "const USE_MOCK = true" /Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts; then
        echo "3. Switch to Backend Mode:"
        echo "   Edit: src/services/customerService.ts"
        echo "   Change: USE_MOCK = true → USE_MOCK = false"
        echo ""
    fi
    
    echo "4. Read Integration Guide:"
    echo "   cat INTEGRATION_TESTING.md"
    echo ""
else
    echo "🎉 ALL CHECKS PASSED!"
    echo ""
    echo "Next Steps:"
    echo "1. Open browser: http://localhost:$FRONTEND_PORT"
    echo "2. Open DevTools (F12)"
    echo "3. Navigate to Customers"
    echo "4. Test CRUD operations"
    echo "5. Check Network tab for API calls"
    echo ""
fi

echo "════════════════════════════════════════════════════════════"
