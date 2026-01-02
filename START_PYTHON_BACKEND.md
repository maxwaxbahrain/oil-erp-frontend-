# 🐍 How to Start Python Backend

## ❌ **WRONG** (What You Tried)
```bash
npm run dev  # ❌ This is for Node.js, not Python!
```

## ✅ **CORRECT** (Python Backend)

### **Method 1: Use the Helper Script** (Easiest)
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-frontend
./start-backend.sh
```

This will:
- Activate virtual environment
- Start FastAPI server
- Run on http://localhost:8000

---

### **Method 2: Manual Start**
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend

# Activate virtual environment
source .venv/bin/activate

# Start server
uvicorn app.main:app --reload --port 8000
```

---

### **Method 3: Without Virtual Environment**
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
python -m uvicorn app.main:app --reload --port 8000
```

---

## ✅ **Success Indicators**

When backend starts successfully, you'll see:

```
INFO:     Will watch for changes in these directories: ['/Users/abdulqadeer/Desktop/oil-erp-backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

---

## 🧪 **Test Backend is Working**

Open a **new terminal** and run:

```bash
curl http://localhost:8000/api/customers
```

**Expected**: JSON response with customer data

Or open in browser:
- http://localhost:8000/docs (API documentation)
- http://localhost:8000/api/customers (Customer data)

---

## 🔧 **Troubleshooting**

### **Error: "uvicorn: command not found"**

**Solution**: Install dependencies
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
source .venv/bin/activate
pip install -r requirements.txt
```

---

### **Error: "No module named 'app'"**

**Solution**: Make sure you're in the backend directory
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
uvicorn app.main:app --reload --port 8000
```

---

### **Error: "Address already in use"**

**Solution**: Port 8000 is busy
```bash
# Find what's using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>

# Or use different port
uvicorn app.main:app --reload --port 8001
```

---

## 📊 **Backend vs Frontend**

| Aspect | Backend | Frontend |
|--------|---------|----------|
| **Language** | Python | JavaScript/TypeScript |
| **Framework** | FastAPI | React + Vite |
| **Start Command** | `uvicorn app.main:app --reload` | `npm run dev` |
| **Port** | 8000 | 5173/5174/5175 |
| **Package Manager** | pip | npm |
| **Dependencies** | requirements.txt | package.json |

---

## 🎯 **Quick Commands**

**Start Backend:**
```bash
./start-backend.sh
```

**Test Backend:**
```bash
curl http://localhost:8000/api/customers
```

**Check if Running:**
```bash
lsof -i :8000
```

**Stop Backend:**
```
Press Ctrl+C in the terminal where it's running
```

---

## ✅ **Summary**

**Your backend is Python, not Node.js!**

- ❌ Don't use: `npm run dev`
- ✅ Use: `uvicorn app.main:app --reload`
- ✅ Or: `./start-backend.sh`

**That's it! 🚀**
