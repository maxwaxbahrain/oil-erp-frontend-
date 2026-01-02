# 🚀 Customer Module Integration - Quick Start

## ✅ What I've Done For You

1. ✅ **Switched frontend to backend mode**
   - Changed `USE_MOCK = false` in `customerService.ts`
   - Frontend will now use real API instead of localStorage

2. ✅ **Created helper scripts**
   - `start-backend.sh` - Start backend server
   - `test-integration.sh` - Test integration

---

## 🎯 How to Test Integration (3 Steps)

### **Step 1: Start Backend** (New Terminal)

```bash
cd /Users/abdulqadeer/Desktop/oil-erp-frontend
./start-backend.sh
```

**Wait for**: `Application startup complete`

---

### **Step 2: Test Integration**

```bash
cd /Users/abdulqadeer/Desktop/oil-erp-frontend
./test-integration.sh
```

**This will**:
- ✅ Check backend is running
- ✅ Test API endpoints
- ✅ Verify frontend configuration
- ✅ Create a test customer
- ✅ Confirm integration works

---

### **Step 3: Test in Browser**

1. **Open**: http://localhost:5175/ (or 5173/5174)

2. **Open DevTools**: Press F12

3. **Go to Network tab**

4. **Click "Customers"** in sidebar

5. **Look for**:
   ```
   GET http://localhost:8000/api/customers
   Status: 200 OK
   ```

6. **Test CRUD**:
   - Create new customer
   - Edit customer
   - View ledger
   - Record payment

7. **Verify**: All Network requests go to `localhost:8000`

---

## 📊 Current Status

✅ Frontend: Configured for backend API  
⏳ Backend: **You need to start it** (Step 1)  
⏳ Integration: **Ready to test** (Steps 2-3)

---

## 🔧 Manual Commands (If Scripts Don't Work)

### Start Backend Manually:
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
uvicorn app.main:app --reload --port 8000
```

### Test Backend Manually:
```bash
curl http://localhost:8000/api/customers
```

### Switch Back to Mock Mode (If Needed):
Edit `src/services/customerService.ts` line 7:
```typescript
const USE_MOCK = true; // Back to mock mode
```

---

## ✅ Success Checklist

```
[ ] Backend running on port 8000
[ ] Frontend running (already ✅)
[ ] USE_MOCK = false (already ✅)
[ ] Browser shows API calls to localhost:8000
[ ] No CORS errors in console
[ ] Customers load from database
[ ] Create/Update works
[ ] Data persists after refresh
```

---

## 🎉 That's It!

**Just run the 3 steps above to test your integration!**

Questions? Check:
- `INTEGRATION_TESTING.md` - Full guide
- `CUSTOMER_TESTING_GUIDE.md` - Complete testing
- `TESTING_README.md` - Overview
