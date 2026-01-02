# 🔍 How to Check Backend Integration & Sync

## ✅ Quick Check (Run This Command)

```bash
cd /Users/abdulqadeer/Desktop/oil-erp-frontend
./check-backend.sh
```

This will show you:
- ✅ Backend status (running or not)
- ✅ API endpoints working
- ✅ Frontend mode (mock or backend)
- ✅ Data synchronization test
- ✅ Clear summary of integration status

---

## 📊 Current Status (Based on Check)

**Backend**: ❌ NOT RUNNING  
**Frontend**: ⚠️ MOCK MODE (using localStorage)  
**Integration**: ❌ NOT CONNECTED

---

## 🎯 How to Enable Backend Integration

### Step 1: Start Backend
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
uvicorn app.main:app --reload --port 8000
```

**Wait for**: `Application startup complete`

---

### Step 2: Verify Backend is Running
```bash
curl http://localhost:8000/api/customers
```

**Expected**: JSON response with customer data

---

### Step 3: Connect Frontend to Backend

Edit: `src/services/customerService.ts` (line 7)

**Change from:**
```typescript
const USE_MOCK = true;
```

**To:**
```typescript
const USE_MOCK = false;
```

**Save** - Vite will auto-reload!

---

### Step 4: Run Check Again
```bash
./check-backend.sh
```

**Expected Result:**
```
✓ BACKEND AND FRONTEND ARE INTEGRATED AND SYNCED!
```

---

## 🧪 Manual Verification in Browser

1. **Open**: http://localhost:5175/
2. **Press F12** (DevTools)
3. **Go to Network tab**
4. **Click "Customers"**

**Look for:**
- ✅ `GET http://localhost:8000/api/customers`
- ✅ Status: 200 OK
- ✅ Response: JSON data from database

**If you see localhost:8000 in Network tab = INTEGRATED! ✓**

---

## 📋 Integration Checklist

```
Current Status:
[ ] Backend running on port 8000
[ ] API responds to /api/customers
[ ] Frontend USE_MOCK = false
[ ] Browser shows API calls to localhost:8000
[ ] No CORS errors
[ ] Data persists after refresh

When ALL checked = FULLY INTEGRATED ✓
```

---

## 🔄 Two Modes Explained

### MOCK MODE (Current)
- ✅ No backend needed
- ✅ Uses localStorage
- ✅ Works offline
- ✅ Good for development
- ❌ Data doesn't persist across devices
- ❌ Not connected to database

### BACKEND MODE (Integration)
- ✅ Connected to real database
- ✅ Data persists everywhere
- ✅ Multi-user support
- ✅ Production ready
- ❌ Requires backend running
- ❌ Needs network connection

---

## 🎯 Quick Commands Reference

**Check Integration:**
```bash
./check-backend.sh
```

**Start Backend:**
```bash
./start-backend.sh
```

**Test Backend API:**
```bash
curl http://localhost:8000/api/customers
```

**Switch to Backend Mode:**
```bash
# Edit src/services/customerService.ts line 7
# Change: USE_MOCK = true → USE_MOCK = false
```

**Switch Back to Mock Mode:**
```bash
# Edit src/services/customerService.ts line 7
# Change: USE_MOCK = false → USE_MOCK = true
```

---

## ✅ Success Indicators

**Backend Integrated When:**
1. ✅ `./check-backend.sh` shows "INTEGRATED AND SYNCED"
2. ✅ Browser Network tab shows `localhost:8000` requests
3. ✅ Data persists after closing browser
4. ✅ No "Failed to fetch" errors in console

**Still in Mock Mode When:**
1. ⚠️ `./check-backend.sh` shows "MOCK MODE"
2. ⚠️ No network requests in browser
3. ⚠️ Data only in localStorage
4. ⚠️ Backend not needed to work

---

## 🎉 Summary

**To check if integrated:**
```bash
./check-backend.sh
```

**To enable integration:**
1. Start backend
2. Set `USE_MOCK = false`
3. Run check again
4. Test in browser

**That's it! 🚀**
