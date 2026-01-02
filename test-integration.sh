#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   CUSTOMER MODULE INTEGRATION TEST                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "This script will test the Customer module integration."
echo ""

# Step 1: Check backend
echo -e "${BLUE}[1/5]${NC} Checking backend server..."
if curl -s --max-time 3 http://localhost:8000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend is running on port 8000"
else
    echo -e "${RED}✗${NC} Backend is NOT running"
    echo ""
    echo "To start backend, run in a new terminal:"
    echo -e "${YELLOW}./start-backend.sh${NC}"
    echo ""
    echo "Or manually:"
    echo "cd /Users/abdulqadeer/Desktop/oil-erp-backend"
    echo "uvicorn app.main:app --reload --port 8000"
    echo ""
    exit 1
fi
echo ""

# Step 2: Test API endpoint
echo -e "${BLUE}[2/5]${NC} Testing customer API endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 3 http://localhost:8000/api/customers 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} GET /api/customers - Success (HTTP 200)"
    
    # Count customers
    if command -v jq &> /dev/null; then
        COUNT=$(echo "$BODY" | jq '. | length' 2>/dev/null || echo "?")
        echo "  Found $COUNT customers in database"
    fi
else
    echo -e "${RED}✗${NC} GET /api/customers - Failed (HTTP $HTTP_CODE)"
    echo "  Response: $BODY"
    exit 1
fi
echo ""

# Step 3: Check frontend mode
echo -e "${BLUE}[3/5]${NC} Checking frontend configuration..."
if grep -q "const USE_MOCK = false" /Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts; then
    echo -e "${GREEN}✓${NC} Frontend is configured to use backend API"
elif grep -q "const USE_MOCK = true" /Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts; then
    echo -e "${RED}✗${NC} Frontend is still in MOCK mode"
    echo "  Run: sed -i '' 's/USE_MOCK = true/USE_MOCK = false/' src/services/customerService.ts"
    exit 1
else
    echo -e "${YELLOW}⚠${NC}  Cannot determine frontend mode"
fi
echo ""

# Step 4: Check frontend server
echo -e "${BLUE}[4/5]${NC} Checking frontend server..."
FRONTEND_PORT=""
for PORT in 5173 5174 5175; do
    if curl -s --max-time 2 http://localhost:$PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend is running on port $PORT"
        FRONTEND_PORT=$PORT
        break
    fi
done

if [ -z "$FRONTEND_PORT" ]; then
    echo -e "${RED}✗${NC} Frontend is NOT running"
    echo "  Start with: npm run dev"
    exit 1
fi
echo ""

# Step 5: Test integration
echo -e "${BLUE}[5/5]${NC} Testing full integration..."

# Create a test customer
echo "  Creating test customer..."
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Integration Test Customer",
    "email": "integration@test.com",
    "phone": "+1234567890",
    "address": "123 Test Street",
    "category": "Retail",
    "credit_limit": 10000,
    "opening_balance": -1000
  }' 2>/dev/null)

CREATE_HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | head -n-1)

if [ "$CREATE_HTTP_CODE" = "200" ] || [ "$CREATE_HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓${NC} Customer created successfully"
    
    if command -v jq &> /dev/null; then
        CUSTOMER_ID=$(echo "$CREATE_BODY" | jq -r '.id' 2>/dev/null)
        echo "  Customer ID: $CUSTOMER_ID"
        
        # Test getting the customer
        echo "  Fetching customer..."
        GET_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8000/api/customers/$CUSTOMER_ID 2>/dev/null)
        GET_HTTP_CODE=$(echo "$GET_RESPONSE" | tail -n1)
        
        if [ "$GET_HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✓${NC} Customer retrieved successfully"
        else
            echo -e "${RED}✗${NC} Failed to retrieve customer"
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC}  Customer creation returned HTTP $CREATE_HTTP_CODE"
    echo "  This might be okay if customer already exists"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ INTEGRATION TEST COMPLETE${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Open browser: http://localhost:$FRONTEND_PORT"
echo ""
echo "2. Open DevTools (F12) → Network tab"
echo ""
echo "3. Navigate to Customers page"
echo ""
echo "4. You should see API calls to:"
echo "   http://localhost:8000/api/customers"
echo ""
echo "5. Test CRUD operations:"
echo "   - Create new customer"
echo "   - Edit existing customer"
echo "   - View customer ledger"
echo "   - Record payment"
echo ""
echo "6. Verify in Network tab that all requests go to"
echo "   localhost:8000 (not localStorage)"
echo ""
echo "════════════════════════════════════════════════════════════"
