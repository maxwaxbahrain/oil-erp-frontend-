# 🧪 Customer Module Integration Testing Guide

## 📋 Your Current Setup

**Frontend:**
- Framework: React 19.2.0 + Vite 7.2.4
- Language: TypeScript 5.9.3
- Routing: React Router DOM 7.10.1
- UI: TailwindCSS 4.1.18
- Dev Server: http://localhost:5173 (default Vite port)

**Backend:**
- API Base URL: http://localhost:8000/api
- Current Mode: **MOCK MODE** (USE_MOCK = true)
- Storage: localStorage (for mock data)

**Database:**
- Mock: Browser localStorage
- Real: (To be configured when connecting to backend)

---

## 🎯 Testing Strategy

We'll test in **TWO PHASES**:
1. **Phase 1**: Mock Mode Testing (Current - No backend needed)
2. **Phase 2**: Backend Integration Testing (After connecting real API)

---

## 📝 PHASE 1: MOCK MODE TESTING CHECKLIST

### ✅ Pre-Testing Setup

**Step 1: Start the Development Server**
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-frontend
npm run dev
```

**Expected Output:**
```
VITE v7.2.4  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**Step 2: Open Browser DevTools**
- Open Chrome/Firefox
- Navigate to: http://localhost:5173
- Press F12 to open DevTools
- Go to **Console** tab (check for errors)
- Go to **Network** tab (monitor API calls)
- Go to **Application** > **Local Storage** (view mock data)

**Step 3: Clear Previous Data (Fresh Start)**
```javascript
// Run in Browser Console:
localStorage.clear();
location.reload();
```

---

## 🧪 TEST SUITE 1: CUSTOMER LIST & VIEWING

### Test 1.1: View Customer List
**Navigation:** Click "Customers" in sidebar

**What to Check:**
- ✅ Loading spinner appears briefly
- ✅ 3 sample customers load:
  - Al-Khaleej Trading Co. (Dubai)
  - Pakistan Motors Ltd. (Karachi)
  - Gulf Petroleum Services (Riyadh)
- ✅ Each customer shows:
  - Name and ID
  - Classification (Wholesale/Retail)
  - Location
  - Balance (negative numbers in red)
- ✅ "Add New Customer" button visible
- ✅ Search box present

**Console Check:**
```
[MOCK API] GET /customers
```

**Network Tab:**
- No actual network requests (mock mode)

**LocalStorage Check:**
```javascript
// Run in Console:
JSON.parse(localStorage.getItem('customers'))
// Should show 3 customers
```

**Screenshot Location:** Take screenshot for documentation

---

### Test 1.2: Search Customers
**Action:** Type "Dubai" in search box

**What to Check:**
- ✅ List filters instantly (no page reload)
- ✅ Only "Al-Khaleej Trading Co." shows
- ✅ Clear search → all customers return

**Test Multiple Searches:**
- Search by name: "Pakistan"
- Search by phone: "+971"
- Search by location: "Karachi"

---

### Test 1.3: View Customer Details
**Action:** Click on any customer row

**What to Check:**
- ✅ Navigates to customer overview page
- ✅ URL changes to `/customers/{id}`
- ✅ Customer name displays in header
- ✅ 6 stat cards show:
  - Outstanding Balance
  - Total Sales
  - Credit Limit
  - Overdue Amount
  - Last Payment
  - Last Invoice
- ✅ 4 tabs visible: Overview, Ledger, Sales, Payments
- ✅ Action buttons present:
  - New Invoice
  - Receive Payment
  - New Sales Order
  - Edit Customer

**Console Check:**
```
[MOCK API] GET /customers
```

---

## 🧪 TEST SUITE 2: CREATE CUSTOMER (CRUD - CREATE)

### Test 2.1: Open Create Form
**Action:** Click "Add New Customer" button

**What to Check:**
- ✅ Navigates to `/customers/new`
- ✅ Form displays with all fields:
  - Customer Name (required - red asterisk)
  - Email
  - Phone
  - Address
  - Category dropdown (Retail, Wholesale, Partner, Other)
  - Credit Limit
  - Opening Balance
  - Notes
- ✅ "Save Customer" and "Cancel" buttons visible

---

### Test 2.2: Form Validation
**Action:** Click "Save Customer" without filling name

**What to Check:**
- ✅ Error message: "Customer Name is required"
- ✅ Form doesn't submit
- ✅ No console errors

---

### Test 2.3: Create New Customer
**Action:** Fill form with test data:

```
Customer Name: Test Trading LLC
Email: test@trading.com
Phone: +971-50-1234567
Address: Business Bay, Dubai
Category: Wholesale
Credit Limit: 75000
Opening Balance: -5000
Notes: Test customer for integration testing
```

**Click "Save Customer"**

**What to Check:**
- ✅ "Saving..." button text appears
- ✅ Button disabled during save
- ✅ Success (redirects to customer list)
- ✅ New customer appears at top of list
- ✅ Balance shows -5000 (in red)

**Console Check:**
```
[MOCK API] POST /customers
✅ Customer saved to localStorage: {id: "...", name: "Test Trading LLC", ...}
```

**LocalStorage Verification:**
```javascript
// Run in Console:
const customers = JSON.parse(localStorage.getItem('customers'));
console.log(customers.length); // Should be 4 now
console.log(customers[0].name); // Should be "Test Trading LLC"

// Check ledger entry for opening balance
const ledger = JSON.parse(localStorage.getItem('customer_ledger'));
console.log(ledger); // Should have 1 entry for opening balance
```

**Expected Ledger Entry:**
```javascript
{
  id: "...",
  customer_id: "...",
  type: "opening_balance",
  amount: -5000,
  balance: -5000,
  description: "Opening Balance",
  reference: "OPENING"
}
```

---

## 🧪 TEST SUITE 3: UPDATE CUSTOMER (CRUD - UPDATE)

### Test 3.1: Navigate to Edit
**Action:** 
1. Click on "Test Trading LLC" customer
2. Click "Edit Customer" button

**What to Check:**
- ✅ Navigates to `/customers/edit/{id}`
- ✅ Form pre-filled with customer data
- ✅ All fields editable

---

### Test 3.2: Update Customer Information
**Action:** Change the following:
```
Phone: +971-50-9999999
Credit Limit: 100000
Notes: Updated credit limit - approved by manager
```

**Click "Save Customer"**

**What to Check:**
- ✅ "Saving..." appears
- ✅ Redirects back to customer list
- ✅ Changes reflected in list
- ✅ Click customer again → verify changes saved

**Console Check:**
```
[MOCK API] PUT /customers/{id}
```

**LocalStorage Verification:**
```javascript
const customers = JSON.parse(localStorage.getItem('customers'));
const testCustomer = customers.find(c => c.name === 'Test Trading LLC');
console.log(testCustomer.phone); // Should be +971-50-9999999
console.log(testCustomer.credit_limit); // Should be 100000
```

---

## 🧪 TEST SUITE 4: CUSTOMER LEDGER

### Test 4.1: View Ledger
**Action:**
1. Click on "Test Trading LLC"
2. Click "Ledger" tab

**What to Check:**
- ✅ Ledger table displays
- ✅ Columns: Date, Type, Reference, Description, Debit, Credit, Balance, Actions
- ✅ One entry shows: "Opening Balance" with -5000
- ✅ Download PDF and Excel buttons visible

**Console Check:**
```
[MOCK API] GET /customers/{id}/ledger
```

---

### Test 4.2: Ledger Entry Details
**What to Verify:**
- ✅ Date: Today's date
- ✅ Type: Badge with "opening_balance"
- ✅ Reference: "OPENING"
- ✅ Description: "Opening Balance"
- ✅ Debit: -5000 (or shown in appropriate column)
- ✅ Balance: -5000

---

## 🧪 TEST SUITE 5: PAYMENT PROCESSING

### Test 5.1: Record Payment
**Action:**
1. On customer overview page, click "Receive Payment" button
2. Fill payment form:
```
Amount: 2000
Payment Date: (Today's date - auto-filled)
Payment Method: Cash
Reference: PAY-001
Notes: Partial payment received
```

**Click "Save" or submit button**

**What to Check:**
- ✅ Modal/form closes
- ✅ Success message: "✅ Payment recorded successfully!"
- ✅ Outstanding balance updates (-5000 → -3000)
- ✅ Last Payment stat card updates to 2000

**Console Check:**
```
[MOCK API] POST /payments
[MOCK API] POST /customers/{id}/ledger (for payment entry)
```

---

### Test 5.2: Verify Payment in Ledger
**Action:** Click "Ledger" tab

**What to Check:**
- ✅ New entry at top of ledger
- ✅ Type: "Payment" (green badge)
- ✅ Reference: "PAY-001"
- ✅ Description: "Payment received - Cash"
- ✅ Credit: 2000
- ✅ Balance: -3000 (updated from -5000)

**LocalStorage Verification:**
```javascript
// Check payments
const payments = JSON.parse(localStorage.getItem('payments'));
console.log(payments); // Should have 1 payment

// Check ledger
const ledger = JSON.parse(localStorage.getItem('customer_ledger'));
console.log(ledger.length); // Should be 2 (opening + payment)

// Check customer balance updated
const customers = JSON.parse(localStorage.getItem('customers'));
const testCustomer = customers.find(c => c.name === 'Test Trading LLC');
console.log(testCustomer.balance); // Should be -3000
```

---

### Test 5.3: View Payments Tab
**Action:** Click "Payments" tab

**What to Check:**
- ✅ Payment history table displays
- ✅ Shows payment with:
  - Date: Today
  - Reference: PAY-001
  - Method: Cash
  - Amount: 2000
- ✅ "Receive New Payment" button visible

---

## 🧪 TEST SUITE 6: ANALYTICS & REPORTS

### Test 6.1: Overdue Customers
**Action:** Navigate to Customers → Overdue Reports (if available in menu)

**What to Check:**
- ✅ Shows customers with negative balance
- ✅ "Test Trading LLC" appears (balance: -3000)
- ✅ "Al-Khaleej Trading Co." appears (balance: -15000)
- ✅ "Pakistan Motors Ltd." appears (balance: -8500)
- ✅ "Gulf Petroleum Services" NOT shown (balance: 0)

**Console Check:**
```
[MOCK API] GET /customers/overdue
```

---

### Test 6.2: Customer Statistics
**If stats dashboard exists:**

**What to Check:**
- ✅ Total Customers: 4
- ✅ Active Customers: 4
- ✅ Total Receivables: 26,500 (15000 + 8500 + 3000)
- ✅ Overdue Amount: 26,500

---

## 🧪 TEST SUITE 7: DELETE CUSTOMER (CRUD - DELETE)

### Test 7.1: Delete Customer
**Action:**
1. Navigate to customer list
2. Find "Test Trading LLC"
3. Click to view details
4. Look for Delete button (might be in Edit page or dropdown menu)
5. Click Delete
6. Confirm deletion

**What to Check:**
- ✅ Confirmation dialog appears
- ✅ After confirming, redirects to customer list
- ✅ "Test Trading LLC" no longer in list
- ✅ Customer count back to 3

**Console Check:**
```
[MOCK API] DELETE /customers/{id}
```

**LocalStorage Verification:**
```javascript
const customers = JSON.parse(localStorage.getItem('customers'));
console.log(customers.length); // Should be 3
const testCustomer = customers.find(c => c.name === 'Test Trading LLC');
console.log(testCustomer); // Should be undefined
```

---

## 🧪 TEST SUITE 8: ERROR HANDLING & EDGE CASES

### Test 8.1: Network Simulation (Mock Delays)
**What to Check:**
- ✅ Loading states appear during data fetch
- ✅ Buttons disable during save operations
- ✅ No UI freezing

---

### Test 8.2: Empty States
**Action:** Clear all customers from localStorage

```javascript
// Run in Console:
localStorage.setItem('customers', '[]');
location.reload();
```

**What to Check:**
- ✅ Empty state message displays
- ✅ "No customers found" or similar message
- ✅ "Add New Customer" button still works
- ✅ No console errors

---

### Test 8.3: Invalid Customer ID
**Action:** Navigate to `/customers/invalid-id-12345`

**What to Check:**
- ✅ Error message or "Customer not found"
- ✅ "Back to Customers" button works
- ✅ No app crash

---

## 🧪 TEST SUITE 9: BROWSER COMPATIBILITY

### Test 9.1: Console Errors
**Throughout all tests, monitor Console tab:**

**✅ ACCEPTABLE:**
- Mock API log messages
- Development warnings

**❌ NOT ACCEPTABLE:**
- TypeScript errors
- Undefined variable errors
- Failed to fetch errors
- React errors/warnings

---

### Test 9.2: Network Tab
**What to Check:**
- ✅ No failed network requests (404, 500, etc.)
- ✅ In mock mode: No actual HTTP requests to localhost:8000

---

## 📊 MOCK MODE TEST RESULTS TEMPLATE

```
=== CUSTOMER MODULE MOCK MODE TEST RESULTS ===
Date: [DATE]
Tester: [YOUR NAME]

✅ PASSED | ❌ FAILED | ⚠️  PARTIAL

[ ] Test Suite 1: Customer List & Viewing
    [ ] 1.1 View Customer List
    [ ] 1.2 Search Customers
    [ ] 1.3 View Customer Details

[ ] Test Suite 2: Create Customer
    [ ] 2.1 Open Create Form
    [ ] 2.2 Form Validation
    [ ] 2.3 Create New Customer

[ ] Test Suite 3: Update Customer
    [ ] 3.1 Navigate to Edit
    [ ] 3.2 Update Customer Information

[ ] Test Suite 4: Customer Ledger
    [ ] 4.1 View Ledger
    [ ] 4.2 Ledger Entry Details

[ ] Test Suite 5: Payment Processing
    [ ] 5.1 Record Payment
    [ ] 5.2 Verify Payment in Ledger
    [ ] 5.3 View Payments Tab

[ ] Test Suite 6: Analytics & Reports
    [ ] 6.1 Overdue Customers
    [ ] 6.2 Customer Statistics

[ ] Test Suite 7: Delete Customer
    [ ] 7.1 Delete Customer

[ ] Test Suite 8: Error Handling
    [ ] 8.1 Network Simulation
    [ ] 8.2 Empty States
    [ ] 8.3 Invalid Customer ID

[ ] Test Suite 9: Browser Compatibility
    [ ] 9.1 Console Errors
    [ ] 9.2 Network Tab

OVERALL STATUS: [ ]
NOTES:
```

---

## 🔌 PHASE 2: BACKEND INTEGRATION TESTING

### Prerequisites
Before starting Phase 2, ensure:
1. ✅ All Phase 1 tests pass
2. ✅ Backend API is running on http://localhost:8000
3. ✅ Database is set up and accessible
4. ✅ Backend implements all required endpoints

---

### Step 1: Switch to Backend Mode

**Edit:** `/src/services/customerService.ts`
```typescript
// Line 7: Change from
const USE_MOCK = true;

// To
const USE_MOCK = false;
```

**Save and restart dev server:**
```bash
# Stop current server (Ctrl+C)
npm run dev
```

---

### Step 2: Backend Endpoint Verification

**Test each endpoint with curl or Postman:**

```bash
# 1. GET all customers
curl http://localhost:8000/api/customers

# 2. GET single customer
curl http://localhost:8000/api/customers/{id}

# 3. POST create customer
curl -X POST http://localhost:8000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Customer","email":"test@example.com"}'

# 4. PUT update customer
curl -X PUT http://localhost:8000/api/customers/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'

# 5. DELETE customer
curl -X DELETE http://localhost:8000/api/customers/{id}

# 6. GET customer ledger
curl http://localhost:8000/api/customers/{id}/ledger

# 7. POST ledger entry
curl -X POST http://localhost:8000/api/customers/{id}/ledger \
  -H "Content-Type: application/json" \
  -d '{"type":"invoice","amount":1000,"description":"Test"}'

# 8. GET customer payments
curl http://localhost:8000/api/customers/{id}/payments

# 9. POST payment
curl -X POST http://localhost:8000/api/payments \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"{id}","amount":500,"payment_method":"Cash"}'

# 10. GET overdue customers
curl http://localhost:8000/api/customers/overdue

# 11. GET customer stats
curl http://localhost:8000/api/customers/stats

# 12. GET search customers
curl http://localhost:8000/api/customers/search?q=test
```

**Expected Response Format:**
```json
// GET /customers
[
  {
    "id": "uuid-here",
    "name": "Customer Name",
    "email": "email@example.com",
    "phone": "+123456789",
    "balance": -5000,
    "credit_limit": 50000,
    ...
  }
]
```

---

### Step 3: Repeat All Phase 1 Tests

**Run ALL Test Suites 1-9 again, but now:**

**Monitor Network Tab:**
- ✅ Actual HTTP requests to localhost:8000
- ✅ Status codes: 200 (success), 201 (created)
- ✅ Response times < 1000ms
- ✅ Correct request/response payloads

**Monitor Console:**
- ✅ No mock API messages
- ✅ No CORS errors
- ✅ No 404/500 errors

**Monitor Database:**
- ✅ Data persists after page reload
- ✅ Data visible in database tool
- ✅ Relationships maintained (customer → ledger → payments)

---

### Step 4: Integration-Specific Tests

### Test I-1: Data Persistence
**Action:**
1. Create a customer
2. Close browser completely
3. Reopen browser
4. Navigate to customers

**What to Check:**
- ✅ Customer still exists
- ✅ Data loaded from database (not localStorage)

---

### Test I-2: Concurrent Users (if applicable)
**Action:**
1. Open app in two different browsers
2. Create customer in Browser A
3. Refresh Browser B

**What to Check:**
- ✅ New customer appears in Browser B
- ✅ Real-time or on-refresh sync works

---

### Test I-3: Error Responses
**Action:** Stop backend server

**What to Check:**
- ✅ Graceful error messages
- ✅ "Unable to connect to server" or similar
- ✅ No app crash
- ✅ Retry mechanism works (if implemented)

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue 1: "Failed to fetch" error
**Cause:** Backend not running or CORS issue
**Solution:**
```bash
# Check backend is running
curl http://localhost:8000/api/customers

# If CORS error, add to backend:
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type
```

---

### Issue 2: Data not persisting
**Cause:** Still in mock mode
**Solution:** Verify `USE_MOCK = false` in customerService.ts

---

### Issue 3: 404 Not Found
**Cause:** Endpoint mismatch
**Solution:** Check backend routes match exactly:
- `/api/customers` (not `/customers`)
- `/api/customers/:id` (not `/customer/:id`)

---

### Issue 4: TypeScript errors
**Cause:** Response format mismatch
**Solution:** Ensure backend returns data matching Customer interface

---

## ✅ FINAL VERIFICATION CHECKLIST

Before declaring integration complete:

**Frontend:**
- [ ] All Phase 1 tests pass
- [ ] No console errors
- [ ] Loading states work
- [ ] Error handling works
- [ ] UI responsive and smooth

**Backend:**
- [ ] All endpoints return 200/201
- [ ] Data validates correctly
- [ ] Error responses are JSON
- [ ] CORS configured
- [ ] Authentication works (if applicable)

**Integration:**
- [ ] All Phase 2 tests pass
- [ ] Data persists correctly
- [ ] Network requests successful
- [ ] No mock data used
- [ ] Database queries optimized

**Documentation:**
- [ ] API endpoints documented
- [ ] Test results recorded
- [ ] Known issues logged
- [ ] Deployment notes ready

---

## 📞 NEED HELP?

If you encounter issues:

1. **Check Console:** Look for specific error messages
2. **Check Network Tab:** Verify request/response
3. **Check Database:** Confirm data structure
4. **Review Code:** Compare with working examples
5. **Ask for Help:** Provide specific error messages and steps to reproduce

---

## 🎉 SUCCESS CRITERIA

Your integration is **COMPLETE** when:

✅ All customers CRUD operations work end-to-end
✅ Ledger entries create and display correctly
✅ Payments process and update balances
✅ Analytics show accurate data
✅ No console errors during normal operation
✅ Data persists across sessions
✅ Error handling gracefully manages failures
✅ Loading states provide good UX

**Congratulations! Your Customer Module is production-ready! 🚀**
