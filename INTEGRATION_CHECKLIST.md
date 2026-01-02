# ✅ Customer Module Integration Checklist

## 🎯 Goal
Integrate frontend Customer module with backend API

---

## 📋 Step-by-Step Checklist

### **PHASE 1: Backend Setup** ⏳

- [ ] **Step 1.1**: Create database tables
  ```bash
  cd /Users/abdulqadeer/Desktop/oil-erp-backend
  python create_customer_tables.py
  ```

- [ ] **Step 1.2**: Create `app/models/customer.py`
  - Copy code from `BACKEND_CUSTOMER_IMPLEMENTATION.md`
  - Save file

- [ ] **Step 1.3**: Create `app/routes/customers.py`
  - Copy code from `BACKEND_CUSTOMER_IMPLEMENTATION.md`
  - Save file

- [ ] **Step 1.4**: Update `app/main.py`
  - Add: `from app.routes import customers`
  - Add: `app.include_router(customers.router)`
  - Add CORS middleware

- [ ] **Step 1.5**: Start backend
  ```bash
  cd /Users/abdulqadeer/Desktop/oil-erp-backend
  source .venv/bin/activate
  uvicorn app.main:app --reload --port 8000
  ```

- [ ] **Step 1.6**: Test backend API
  ```bash
  curl http://localhost:8000/api/customers
  ```
  Expected: `[]` (empty array) or customer data

---

### **PHASE 2: Frontend Connection** ⏳

- [ ] **Step 2.1**: Verify backend is running
  ```bash
  curl http://localhost:8000/api/customers
  ```

- [ ] **Step 2.2**: Switch frontend to backend mode
  - Edit: `src/services/customerService.ts`
  - Line 7: Change `USE_MOCK = true` → `USE_MOCK = false`
  - Save (Vite will auto-reload)

- [ ] **Step 2.3**: Check integration status
  ```bash
  cd /Users/abdulqadeer/Desktop/oil-erp-frontend
  ./check-backend.sh
  ```
  Expected: "✓ INTEGRATED AND SYNCED"

---

### **PHASE 3: Browser Testing** ⏳

- [ ] **Step 3.1**: Open browser
  - URL: http://localhost:5175

- [ ] **Step 3.2**: Open DevTools
  - Press F12
  - Go to Network tab

- [ ] **Step 3.3**: Navigate to Customers
  - Click "Customers" in sidebar
  - Check Network tab shows: `GET http://localhost:8000/api/customers`
  - Status should be: 200 OK

- [ ] **Step 3.4**: Test Create Customer
  - Click "Add New Customer"
  - Fill form
  - Click Save
  - Check Network: `POST http://localhost:8000/api/customers`
  - Verify customer appears in list

- [ ] **Step 3.5**: Test Update Customer
  - Click on a customer
  - Click "Edit"
  - Change something
  - Save
  - Check Network: `PUT http://localhost:8000/api/customers/{id}`

- [ ] **Step 3.6**: Test Customer Ledger
  - Click on a customer
  - Click "Ledger" tab
  - Check Network: `GET http://localhost:8000/api/customers/{id}/ledger`

- [ ] **Step 3.7**: Test Payment
  - Click "Receive Payment"
  - Enter amount
  - Submit
  - Check Network: `POST http://localhost:8000/api/payments`

- [ ] **Step 3.8**: Test Data Persistence
  - Close browser completely
  - Reopen browser
  - Go to Customers
  - Verify data still exists (from database, not localStorage)

---

### **PHASE 4: Verification** ⏳

- [ ] **Step 4.1**: No console errors
  - Check browser console
  - Should be no red errors

- [ ] **Step 4.2**: All Network requests successful
  - All API calls show 200/201 status
  - No 404 or 500 errors

- [ ] **Step 4.3**: CORS working
  - No CORS errors in console
  - API calls complete successfully

- [ ] **Step 4.4**: Data syncing
  - Create customer in browser
  - Check database has the customer
  - Refresh browser
  - Customer still there

---

## 🎯 Quick Commands Reference

**Start Backend:**
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Test Backend:**
```bash
curl http://localhost:8000/api/customers
```

**Check Integration:**
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-frontend
./check-backend.sh
```

**Switch to Backend Mode:**
```
Edit: src/services/customerService.ts
Line 7: USE_MOCK = false
```

**Switch Back to Mock:**
```
Edit: src/services/customerService.ts
Line 7: USE_MOCK = true
```

---

## ✅ Success Criteria

Integration is complete when:

- ✅ Backend running on port 8000
- ✅ All API endpoints responding
- ✅ Frontend connected (USE_MOCK = false)
- ✅ Browser shows API calls to localhost:8000
- ✅ No console errors
- ✅ CRUD operations work
- ✅ Data persists after browser refresh
- ✅ `./check-backend.sh` shows "INTEGRATED AND SYNCED"

---

## 📚 Documentation Files

- `BACKEND_CUSTOMER_IMPLEMENTATION.md` - Complete backend code
- `START_PYTHON_BACKEND.md` - How to start backend
- `HOW_TO_CHECK_BACKEND.md` - How to verify integration
- `INTEGRATION_TESTING.md` - Full testing guide

---

## 🎉 You're Done When...

All checkboxes above are checked ✅

**Then your Customer module is fully integrated! 🚀**
