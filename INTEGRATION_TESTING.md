# 🔌 Frontend-Backend Integration Testing Guide

## 📋 Current Status

### Frontend ✅
- **Location**: `/Users/abdulqadeer/Desktop/oil-erp-frontend`
- **Status**: Fully implemented
- **Mode**: MOCK (localStorage)
- **Service**: `customerService.ts` with dual-mode support

### Backend ❓
- **Location**: `/Users/abdulqadeer/Desktop/oil-erp-backend`
- **Expected**: Python FastAPI
- **Status**: Needs verification

---

## 🎯 Integration Testing Steps

### STEP 1: Verify Backend Exists and Runs

#### 1.1 Check Backend Structure
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
ls -la
```

**Expected to see:**
- `app/` directory
- `main.py` file
- `requirements.txt` or `pyproject.toml`
- Database files or config

#### 1.2 Check if Backend is Running
```bash
# Check if port 8000 is in use
lsof -i :8000

# Or try to connect
curl http://localhost:8000
```

**If not running, start it:**
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend

# Option 1: If using uvicorn directly
uvicorn app.main:app --reload --port 8000

# Option 2: If using Python module
python -m uvicorn app.main:app --reload --port 8000

# Option 3: If there's a run script
python run.py
# or
./run.sh
```

---

### STEP 2: Test Backend API Endpoints

#### 2.1 Test Health/Root Endpoint
```bash
curl http://localhost:8000/
# or
curl http://localhost:8000/api/
```

**Expected**: JSON response or API documentation

#### 2.2 Test Customer Endpoints

**A. Get All Customers**
```bash
curl http://localhost:8000/api/customers
```

**Expected Response:**
```json
[
  {
    "id": "uuid-here",
    "name": "Customer Name",
    "email": "email@example.com",
    "phone": "+1234567890",
    "balance": -5000,
    "credit_limit": 50000,
    ...
  }
]
```

**B. Create Customer**
```bash
curl -X POST http://localhost:8000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "email": "test@example.com",
    "phone": "+1234567890",
    "address": "123 Test St",
    "category": "Retail",
    "credit_limit": 10000,
    "opening_balance": -1000
  }'
```

**Expected**: 201 Created with customer object

**C. Get Single Customer**
```bash
# Replace {id} with actual customer ID from previous response
curl http://localhost:8000/api/customers/{id}
```

**D. Update Customer**
```bash
curl -X PUT http://localhost:8000/api/customers/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Customer Name",
    "phone": "+9876543210"
  }'
```

**E. Get Customer Ledger**
```bash
curl http://localhost:8000/api/customers/{id}/ledger
```

**F. Get Customer Payments**
```bash
curl http://localhost:8000/api/customers/{id}/payments
```

**G. Create Payment**
```bash
curl -X POST http://localhost:8000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "{id}",
    "amount": 500,
    "payment_date": "2026-01-01",
    "payment_method": "Cash",
    "reference": "TEST-001"
  }'
```

**H. Get Overdue Customers**
```bash
curl http://localhost:8000/api/customers/overdue
```

**I. Get Customer Stats**
```bash
curl http://localhost:8000/api/customers/stats
```

**J. Search Customers**
```bash
curl "http://localhost:8000/api/customers/search?q=test"
```

---

### STEP 3: Connect Frontend to Backend

#### 3.1 Switch Frontend to Backend Mode

**Edit**: `/Users/abdulqadeer/Desktop/oil-erp-frontend/src/services/customerService.ts`

**Line 7 - Change:**
```typescript
const USE_MOCK = true;  // ❌ Currently using mock
```

**To:**
```typescript
const USE_MOCK = false; // ✅ Use real backend
```

**Save the file.**

#### 3.2 Restart Frontend Dev Server
```bash
# Stop current server (Ctrl+C in terminal)
# Then restart:
cd /Users/abdulqadeer/Desktop/oil-erp-frontend
npm run dev
```

---

### STEP 4: Integration Testing

#### 4.1 Open Browser DevTools
1. Open: http://localhost:5175/ (or whatever port Vite shows)
2. Press **F12** (DevTools)
3. Go to **Network** tab
4. Go to **Console** tab

#### 4.2 Test Customer List
1. Click "Customers" in sidebar
2. **Check Network Tab:**
   - Should see: `GET http://localhost:8000/api/customers`
   - Status: 200 OK
   - Response: JSON array of customers

3. **Check Console:**
   - No errors
   - No CORS errors
   - No "Failed to fetch" errors

#### 4.3 Test Customer Creation
1. Click "Add New Customer"
2. Fill form with test data
3. Click "Save Customer"

**Check Network Tab:**
- Should see: `POST http://localhost:8000/api/customers`
- Status: 201 Created
- Response: New customer object

**Check Result:**
- Redirects to customer list
- New customer appears in list

#### 4.4 Test Customer Update
1. Click on a customer
2. Click "Edit Customer"
3. Change some fields
4. Click "Save"

**Check Network Tab:**
- Should see: `PUT http://localhost:8000/api/customers/{id}`
- Status: 200 OK

#### 4.5 Test Payment
1. On customer overview page
2. Click "Receive Payment"
3. Enter amount and details
4. Submit

**Check Network Tab:**
- Should see: `POST http://localhost:8000/api/payments`
- Status: 201 Created
- Balance updates on page

#### 4.6 Test Ledger
1. Click "Ledger" tab
2. **Check Network Tab:**
   - `GET http://localhost:8000/api/customers/{id}/ledger`
   - Status: 200 OK
   - Response: Array of ledger entries

---

### STEP 5: Verify Data Persistence

#### 5.1 Close Browser Completely
- Close all browser windows
- Wait 10 seconds

#### 5.2 Reopen Browser
1. Navigate to: http://localhost:5175/
2. Go to Customers
3. **Verify:**
   - Test customer still exists
   - Data is NOT from localStorage
   - Data comes from database

#### 5.3 Check Database
```bash
# If using SQLite
cd /Users/abdulqadeer/Desktop/oil-erp-backend
sqlite3 database.db
.tables
SELECT * FROM customers;
.exit

# If using PostgreSQL
psql -U your_user -d your_database
\dt
SELECT * FROM customers;
\q
```

---

## 🐛 Common Issues & Solutions

### Issue 1: CORS Error
**Error**: "Access to fetch at 'http://localhost:8000' from origin 'http://localhost:5175' has been blocked by CORS policy"

**Solution**: Add CORS middleware to backend

**Backend (FastAPI) - `main.py`:**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### Issue 2: Connection Refused
**Error**: "Failed to fetch" or "ERR_CONNECTION_REFUSED"

**Cause**: Backend not running

**Solution**:
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
uvicorn app.main:app --reload --port 8000
```

---

### Issue 3: 404 Not Found
**Error**: 404 on API endpoints

**Cause**: Endpoint path mismatch

**Check**:
- Frontend expects: `/api/customers`
- Backend provides: `/customers` or `/api/v1/customers`

**Solution**: Update either frontend or backend to match

---

### Issue 4: Data Type Mismatch
**Error**: TypeScript errors or validation errors

**Cause**: Backend response doesn't match frontend interface

**Solution**: Ensure backend returns data matching `Customer` interface:
```typescript
interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    balance?: number;
    credit_limit?: number;
    category?: string;
    // ... etc
}
```

---

## ✅ Integration Checklist

### Backend Setup
- [ ] Backend code exists
- [ ] Dependencies installed
- [ ] Database configured
- [ ] Backend running on port 8000
- [ ] API endpoints accessible
- [ ] CORS configured

### API Endpoints Working
- [ ] GET /api/customers
- [ ] POST /api/customers
- [ ] GET /api/customers/:id
- [ ] PUT /api/customers/:id
- [ ] DELETE /api/customers/:id
- [ ] GET /api/customers/:id/ledger
- [ ] POST /api/customers/:id/ledger
- [ ] GET /api/customers/:id/payments
- [ ] POST /api/payments
- [ ] GET /api/customers/overdue
- [ ] GET /api/customers/stats
- [ ] GET /api/customers/search

### Frontend Integration
- [ ] USE_MOCK = false
- [ ] Frontend dev server running
- [ ] No CORS errors
- [ ] Network requests successful
- [ ] Data displays correctly
- [ ] CRUD operations work
- [ ] Data persists after refresh

### Data Flow
- [ ] Create customer → saves to database
- [ ] Update customer → updates in database
- [ ] Delete customer → removes from database
- [ ] Payments → update customer balance
- [ ] Ledger → shows all transactions
- [ ] Stats → calculate from real data

---

## 🧪 Quick Integration Test Script

Save this as `test-integration.sh`:

```bash
#!/bin/bash

echo "=== Customer Module Integration Test ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Backend Health
echo "Test 1: Backend Health Check"
if curl -s http://localhost:8000 > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is NOT running${NC}"
    echo "Start backend: cd /Users/abdulqadeer/Desktop/oil-erp-backend && uvicorn app.main:app --reload"
    exit 1
fi

# Test 2: Get Customers
echo ""
echo "Test 2: Get Customers"
RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8000/api/customers)
HTTP_CODE="${RESPONSE: -3}"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ GET /api/customers works${NC}"
else
    echo -e "${RED}✗ GET /api/customers failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 3: Create Customer
echo ""
echo "Test 3: Create Customer"
CREATE_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:8000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Integration Test Customer","email":"test@integration.com","phone":"+1234567890"}')
HTTP_CODE="${CREATE_RESPONSE: -3}"
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ POST /api/customers works${NC}"
    CUSTOMER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id' 2>/dev/null)
    echo "  Created customer ID: $CUSTOMER_ID"
else
    echo -e "${RED}✗ POST /api/customers failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 4: Get Single Customer
if [ ! -z "$CUSTOMER_ID" ]; then
    echo ""
    echo "Test 4: Get Single Customer"
    RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8000/api/customers/$CUSTOMER_ID)
    HTTP_CODE="${RESPONSE: -3}"
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ GET /api/customers/:id works${NC}"
    else
        echo -e "${RED}✗ GET /api/customers/:id failed (HTTP $HTTP_CODE)${NC}"
    fi
fi

# Test 5: Frontend Connection
echo ""
echo "Test 5: Frontend Server"
if curl -s http://localhost:5175 > /dev/null; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend is NOT running${NC}"
    echo "Start frontend: cd /Users/abdulqadeer/Desktop/oil-erp-frontend && npm run dev"
fi

echo ""
echo "=== Integration Test Complete ==="
echo ""
echo "Next Steps:"
echo "1. Open http://localhost:5175 in browser"
echo "2. Open DevTools (F12)"
echo "3. Navigate to Customers"
echo "4. Check Network tab for API calls"
echo "5. Test CRUD operations"
```

**Run it:**
```bash
chmod +x test-integration.sh
./test-integration.sh
```

---

## 📊 Integration Status Report Template

```
=== FRONTEND-BACKEND INTEGRATION STATUS ===
Date: [DATE]
Tester: [NAME]

BACKEND STATUS:
[ ] Backend running on port 8000
[ ] Database connected
[ ] CORS configured
[ ] All endpoints responding

FRONTEND STATUS:
[ ] USE_MOCK = false
[ ] Frontend running
[ ] No console errors
[ ] Network requests working

API ENDPOINTS:
[ ] GET /api/customers
[ ] POST /api/customers
[ ] GET /api/customers/:id
[ ] PUT /api/customers/:id
[ ] DELETE /api/customers/:id
[ ] GET /api/customers/:id/ledger
[ ] POST /api/payments
[ ] GET /api/customers/overdue
[ ] GET /api/customers/stats

INTEGRATION TESTS:
[ ] Create customer → saves to DB
[ ] View customer → loads from DB
[ ] Update customer → updates in DB
[ ] Delete customer → removes from DB
[ ] Record payment → updates balance
[ ] View ledger → shows transactions
[ ] Data persists after refresh

ISSUES FOUND:
[List any issues]

OVERALL STATUS: [ ] PASS  [ ] FAIL
NOTES:
```

---

## 🎯 Summary

**To fully test integration:**

1. ✅ **Start Backend**: `uvicorn app.main:app --reload --port 8000`
2. ✅ **Test API**: Use curl commands above
3. ✅ **Switch Frontend**: Set `USE_MOCK = false`
4. ✅ **Start Frontend**: `npm run dev`
5. ✅ **Test in Browser**: Complete all CRUD operations
6. ✅ **Verify Persistence**: Close/reopen browser, data should persist

**Your integration is complete when all checklist items pass! 🚀**
