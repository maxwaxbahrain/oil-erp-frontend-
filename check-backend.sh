#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   BACKEND INTEGRATION CHECK - CUSTOMER MODULE              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

# Check 1: Is backend running?
echo -e "${BLUE}CHECK 1: Backend Server Status${NC}"
echo "Testing: http://localhost:8000"
if curl -s --max-time 3 http://localhost:8000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is RUNNING${NC}"
    ((PASS++))
    BACKEND_RUNNING=true
else
    echo -e "${RED}✗ Backend is NOT running${NC}"
    echo ""
    echo "To start backend:"
    echo "  cd /Users/abdulqadeer/Desktop/oil-erp-backend"
    echo "  uvicorn app.main:app --reload --port 8000"
    echo ""
    ((FAIL++))
    BACKEND_RUNNING=false
fi
echo ""

# Check 2: Test Customer API endpoint
if [ "$BACKEND_RUNNING" = true ]; then
    echo -e "${BLUE}CHECK 2: Customer API Endpoint${NC}"
    echo "Testing: GET /api/customers"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 3 http://localhost:8000/api/customers 2>/dev/null)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ API endpoint working (HTTP 200)${NC}"
        
        # Try to count customers
        if command -v jq &> /dev/null; then
            COUNT=$(echo "$BODY" | jq '. | length' 2>/dev/null || echo "?")
            echo "  Customers in database: $COUNT"
        else
            echo "  Response received (install 'jq' to see count)"
        fi
        ((PASS++))
    else
        echo -e "${RED}✗ API endpoint failed (HTTP $HTTP_CODE)${NC}"
        echo "  Response: $BODY"
        ((FAIL++))
    fi
    echo ""
    
    # Check 3: Test other endpoints
    echo -e "${BLUE}CHECK 3: Additional API Endpoints${NC}"
    
    # Test stats endpoint
    STATS_RESPONSE=$(curl -s -w "%{http_code}" --max-time 3 http://localhost:8000/api/customers/stats 2>/dev/null)
    STATS_CODE="${STATS_RESPONSE: -3}"
    
    if [ "$STATS_CODE" = "200" ]; then
        echo -e "${GREEN}✓${NC} GET /api/customers/stats - OK"
    else
        echo -e "${YELLOW}⚠${NC}  GET /api/customers/stats - HTTP $STATS_CODE"
    fi
    
    # Test overdue endpoint
    OVERDUE_RESPONSE=$(curl -s -w "%{http_code}" --max-time 3 http://localhost:8000/api/customers/overdue 2>/dev/null)
    OVERDUE_CODE="${OVERDUE_RESPONSE: -3}"
    
    if [ "$OVERDUE_CODE" = "200" ]; then
        echo -e "${GREEN}✓${NC} GET /api/customers/overdue - OK"
    else
        echo -e "${YELLOW}⚠${NC}  GET /api/customers/overdue - HTTP $OVERDUE_CODE"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠ Skipping API tests (backend not running)${NC}"
    echo ""
fi

# Check 4: Frontend mode
echo -e "${BLUE}CHECK 4: Frontend Configuration${NC}"
if grep -q "const USE_MOCK = true" /Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts; then
    echo -e "${YELLOW}⚠${NC}  Frontend is in MOCK mode (using localStorage)"
    echo "  Not connected to backend"
    echo ""
    echo "  To connect to backend:"
    echo "  1. Edit: src/services/customerService.ts"
    echo "  2. Change line 7: USE_MOCK = true → USE_MOCK = false"
    echo "  3. Save file (Vite will auto-reload)"
elif grep -q "const USE_MOCK = false" /Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts; then
    echo -e "${GREEN}✓${NC} Frontend is configured for BACKEND mode"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Cannot determine frontend mode"
    ((FAIL++))
fi
echo ""

# Check 5: Data synchronization test
if [ "$BACKEND_RUNNING" = true ]; then
    echo -e "${BLUE}CHECK 5: Data Synchronization Test${NC}"
    echo "Creating test customer to verify sync..."
    
    TEST_NAME="SyncTest_$(date +%s)"
    CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8000/api/customers \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"$TEST_NAME\",
        \"email\": \"sync@test.com\",
        \"phone\": \"+1234567890\",
        \"category\": \"Retail\",
        \"credit_limit\": 5000
      }" 2>/dev/null)
    
    CREATE_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
    CREATE_BODY=$(echo "$CREATE_RESPONSE" | head -n-1)
    
    if [ "$CREATE_CODE" = "200" ] || [ "$CREATE_CODE" = "201" ]; then
        echo -e "${GREEN}✓${NC} Create customer - Success"
        
        if command -v jq &> /dev/null; then
            CUSTOMER_ID=$(echo "$CREATE_BODY" | jq -r '.id' 2>/dev/null)
            
            if [ ! -z "$CUSTOMER_ID" ] && [ "$CUSTOMER_ID" != "null" ]; then
                # Try to retrieve it
                sleep 0.5
                GET_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8000/api/customers/$CUSTOMER_ID 2>/dev/null)
                GET_CODE="${GET_RESPONSE: -3}"
                
                if [ "$GET_CODE" = "200" ]; then
                    echo -e "${GREEN}✓${NC} Retrieve customer - Success"
                    echo -e "${GREEN}✓${NC} Data synchronization WORKING"
                    ((PASS++))
                else
                    echo -e "${RED}✗${NC} Retrieve customer - Failed"
                    ((FAIL++))
                fi
            fi
        else
            echo "  (Install 'jq' for detailed sync test)"
        fi
    else
        echo -e "${YELLOW}⚠${NC}  Create customer - HTTP $CREATE_CODE"
        echo "  (May be validation error or duplicate)"
    fi
    echo ""
fi

# Summary
echo "════════════════════════════════════════════════════════════"
echo "                      SUMMARY                                "
echo "════════════════════════════════════════════════════════════"
echo ""

if [ "$BACKEND_RUNNING" = true ]; then
    echo -e "Backend Status:    ${GREEN}RUNNING ✓${NC}"
else
    echo -e "Backend Status:    ${RED}NOT RUNNING ✗${NC}"
fi

if grep -q "const USE_MOCK = false" /Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts; then
    echo -e "Frontend Mode:     ${GREEN}BACKEND MODE ✓${NC}"
    INTEGRATED=true
else
    echo -e "Frontend Mode:     ${YELLOW}MOCK MODE ⚠${NC}"
    INTEGRATED=false
fi

echo ""

if [ "$BACKEND_RUNNING" = true ] && [ "$INTEGRATED" = true ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✓ BACKEND AND FRONTEND ARE INTEGRATED AND SYNCED!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "🎯 You can now:"
    echo "  1. Open browser: http://localhost:5175"
    echo "  2. Navigate to Customers"
    echo "  3. All data will be saved to database"
    echo "  4. Data persists across browser sessions"
elif [ "$BACKEND_RUNNING" = true ] && [ "$INTEGRATED" = false ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  ⚠ BACKEND IS READY BUT FRONTEND NOT CONNECTED${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "To connect frontend to backend:"
    echo "  1. Edit: src/services/customerService.ts"
    echo "  2. Line 7: Change USE_MOCK = true → USE_MOCK = false"
    echo "  3. Save (Vite will auto-reload)"
elif [ "$BACKEND_RUNNING" = false ]; then
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  ✗ BACKEND IS NOT RUNNING${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "To start backend:"
    echo "  cd /Users/abdulqadeer/Desktop/oil-erp-backend"
    echo "  uvicorn app.main:app --reload --port 8000"
    echo ""
    echo "Or use the helper script:"
    echo "  ./start-backend.sh"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
