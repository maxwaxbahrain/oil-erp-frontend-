# 🔌 Customer Module Backend Implementation Guide

## 📋 Overview

This guide will help you create the Python/FastAPI backend for the Customer module that matches your frontend exactly.

---

## 🎯 Required API Endpoints

Based on your frontend `customerService.ts`, you need these endpoints:

### **1. Customer CRUD**
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create customer
- `GET /api/customers/{id}` - Get single customer
- `PUT /api/customers/{id}` - Update customer
- `DELETE /api/customers/{id}` - Delete customer

### **2. Ledger Operations**
- `GET /api/customers/{id}/ledger` - Get customer ledger
- `POST /api/customers/{id}/ledger` - Add ledger entry

### **3. Payment Operations**
- `GET /api/customers/{id}/payments` - Get customer payments
- `POST /api/payments` - Create payment

### **4. Analytics**
- `GET /api/customers/overdue` - Get overdue customers
- `GET /api/customers/stats` - Get customer statistics
- `GET /api/customers/search?q=query` - Search customers

---

## 📊 Database Schema

### **Table: customers**
```sql
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    postal_code TEXT,
    balance REAL DEFAULT 0,
    credit_limit REAL DEFAULT 0,
    category TEXT,
    opening_balance REAL DEFAULT 0,
    gps_location TEXT,
    notes TEXT,
    code TEXT,
    tax_id TEXT,
    payment_terms TEXT DEFAULT 'Net 30',
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Table: customer_ledger**
```sql
CREATE TABLE customer_ledger (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    date TIMESTAMP NOT NULL,
    type TEXT NOT NULL,  -- 'invoice', 'payment', 'credit', 'debit', 'opening_balance'
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    description TEXT,
    reference TEXT,
    invoice_number TEXT,
    payment_method TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

### **Table: payments**
```sql
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

---

## 🐍 Python Backend Code

### **File: app/models/customer.py**

```python
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

class CustomerBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    balance: Optional[float] = 0
    credit_limit: Optional[float] = 0
    category: Optional[str] = None
    opening_balance: Optional[float] = 0
    gps_location: Optional[str] = None
    notes: Optional[str] = None
    code: Optional[str] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[str] = "Net 30"
    status: Optional[Literal['Active', 'Inactive', 'Suspended']] = 'Active'

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    balance: Optional[float] = None
    credit_limit: Optional[float] = None
    category: Optional[str] = None
    gps_location: Optional[str] = None
    notes: Optional[str] = None
    code: Optional[str] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[str] = None
    status: Optional[Literal['Active', 'Inactive', 'Suspended']] = None

class Customer(CustomerBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class LedgerEntryBase(BaseModel):
    customer_id: str
    date: datetime
    type: Literal['invoice', 'payment', 'credit', 'debit', 'opening_balance']
    amount: float
    balance: float
    description: Optional[str] = None
    reference: Optional[str] = None
    invoice_number: Optional[str] = None
    payment_method: Optional[str] = None

class LedgerEntryCreate(LedgerEntryBase):
    pass

class LedgerEntry(LedgerEntryBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class PaymentBase(BaseModel):
    customer_id: str
    amount: float
    payment_date: str
    payment_method: str
    reference: Optional[str] = None
    notes: Optional[str] = None

class PaymentCreate(PaymentBase):
    pass

class Payment(PaymentBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerStats(BaseModel):
    total_customers: int
    active_customers: int
    total_receivables: float
    overdue_amount: float
    total_sales: float
    average_order_value: float
```

---

### **File: app/routes/customers.py**

```python
from fastapi import APIRouter, HTTPException, Depends
from typing import List
import sqlite3
import uuid
from datetime import datetime
from app.models.customer import (
    Customer, CustomerCreate, CustomerUpdate,
    LedgerEntry, LedgerEntryCreate,
    Payment, PaymentCreate,
    CustomerStats
)

router = APIRouter(prefix="/api/customers", tags=["customers"])

def get_db():
    conn = sqlite3.connect('oil_erp.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# ============================================
# CUSTOMER CRUD
# ============================================

@router.get("", response_model=List[Customer])
async def get_customers(conn: sqlite3.Connection = Depends(get_db)):
    """Get all customers"""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers ORDER BY created_at DESC")
    customers = cursor.fetchall()
    return [dict(row) for row in customers]

@router.post("", response_model=Customer, status_code=201)
async def create_customer(customer: CustomerCreate, conn: sqlite3.Connection = Depends(get_db)):
    """Create a new customer"""
    customer_id = str(uuid.uuid4())
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO customers (
            id, name, email, phone, address, city, state, country, postal_code,
            balance, credit_limit, category, opening_balance, gps_location, notes,
            code, tax_id, payment_terms, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        customer_id, customer.name, customer.email, customer.phone, customer.address,
        customer.city, customer.state, customer.country, customer.postal_code,
        customer.balance, customer.credit_limit, customer.category, customer.opening_balance,
        customer.gps_location, customer.notes, customer.code, customer.tax_id,
        customer.payment_terms, customer.status, datetime.now()
    ))
    
    # Create opening balance ledger entry if applicable
    if customer.opening_balance and customer.opening_balance != 0:
        ledger_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO customer_ledger (
                id, customer_id, date, type, amount, balance, description, reference
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ledger_id, customer_id, datetime.now(), 'opening_balance',
            customer.opening_balance, customer.opening_balance,
            'Opening Balance', 'OPENING'
        ))
    
    conn.commit()
    
    cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    return dict(cursor.fetchone())

@router.get("/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Get a single customer by ID"""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    customer = cursor.fetchone()
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return dict(customer)

@router.put("/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: str,
    customer_update: CustomerUpdate,
    conn: sqlite3.Connection = Depends(get_db)
):
    """Update a customer"""
    cursor = conn.cursor()
    
    # Check if customer exists
    cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Build update query dynamically
    update_fields = []
    values = []
    
    for field, value in customer_update.dict(exclude_unset=True).items():
        update_fields.append(f"{field} = ?")
        values.append(value)
    
    if update_fields:
        values.append(customer_id)
        query = f"UPDATE customers SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
    
    cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    return dict(cursor.fetchone())

@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Delete a customer"""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    conn.commit()
    return None

# ============================================
# LEDGER OPERATIONS
# ============================================

@router.get("/{customer_id}/ledger", response_model=List[LedgerEntry])
async def get_customer_ledger(customer_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Get customer ledger entries"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM customer_ledger 
        WHERE customer_id = ? 
        ORDER BY date DESC
    """, (customer_id,))
    
    ledger = cursor.fetchall()
    return [dict(row) for row in ledger]

@router.post("/{customer_id}/ledger", response_model=LedgerEntry, status_code=201)
async def add_ledger_entry(
    customer_id: str,
    entry: LedgerEntryCreate,
    conn: sqlite3.Connection = Depends(get_db)
):
    """Add a ledger entry"""
    entry_id = str(uuid.uuid4())
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO customer_ledger (
            id, customer_id, date, type, amount, balance, description,
            reference, invoice_number, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        entry_id, customer_id, entry.date, entry.type, entry.amount, entry.balance,
        entry.description, entry.reference, entry.invoice_number, entry.payment_method
    ))
    
    # Update customer balance
    cursor.execute("""
        UPDATE customers SET balance = ? WHERE id = ?
    """, (entry.balance, customer_id))
    
    conn.commit()
    
    cursor.execute("SELECT * FROM customer_ledger WHERE id = ?", (entry_id,))
    return dict(cursor.fetchone())

# ============================================
# PAYMENT OPERATIONS
# ============================================

@router.get("/{customer_id}/payments", response_model=List[Payment])
async def get_customer_payments(customer_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Get customer payments"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM payments 
        WHERE customer_id = ? 
        ORDER BY payment_date DESC
    """, (customer_id,))
    
    payments = cursor.fetchall()
    return [dict(row) for row in payments]

@router.post("/payments", response_model=Payment, status_code=201)
async def create_payment(payment: PaymentCreate, conn: sqlite3.Connection = Depends(get_db)):
    """Create a payment"""
    payment_id = str(uuid.uuid4())
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO payments (
            id, customer_id, amount, payment_date, payment_method,
            reference, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        payment_id, payment.customer_id, payment.amount, payment.payment_date,
        payment.payment_method, payment.reference, payment.notes, datetime.now()
    ))
    
    conn.commit()
    
    cursor.execute("SELECT * FROM payments WHERE id = ?", (payment_id,))
    return dict(cursor.fetchone())

# ============================================
# ANALYTICS
# ============================================

@router.get("/overdue", response_model=List[Customer])
async def get_overdue_customers(conn: sqlite3.Connection = Depends(get_db)):
    """Get customers with negative balance (overdue)"""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE balance < 0 ORDER BY balance ASC")
    customers = cursor.fetchall()
    return [dict(row) for row in customers]

@router.get("/stats", response_model=CustomerStats)
async def get_customer_stats(conn: sqlite3.Connection = Depends(get_db)):
    """Get customer statistics"""
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM customers")
    total_customers = cursor.fetchone()['total']
    
    cursor.execute("SELECT COUNT(*) as active FROM customers WHERE status = 'Active'")
    active_customers = cursor.fetchone()['active']
    
    cursor.execute("SELECT SUM(ABS(balance)) as receivables FROM customers WHERE balance < 0")
    result = cursor.fetchone()
    total_receivables = result['receivables'] or 0
    
    cursor.execute("SELECT SUM(ABS(balance)) as overdue FROM customers WHERE balance < 0")
    result = cursor.fetchone()
    overdue_amount = result['overdue'] or 0
    
    # Mock total sales and average order value (you can calculate from invoices table)
    total_sales = total_receivables * 1.5
    average_order_value = total_sales / max(total_customers, 1)
    
    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "total_receivables": total_receivables,
        "overdue_amount": overdue_amount,
        "total_sales": total_sales,
        "average_order_value": average_order_value
    }

@router.get("/search", response_model=List[Customer])
async def search_customers(q: str, conn: sqlite3.Connection = Depends(get_db)):
    """Search customers"""
    cursor = conn.cursor()
    search_term = f"%{q}%"
    cursor.execute("""
        SELECT * FROM customers 
        WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR code LIKE ?
        ORDER BY name
    """, (search_term, search_term, search_term, search_term))
    
    customers = cursor.fetchall()
    return [dict(row) for row in customers]
```

---

## 📝 **Implementation Steps**

### **Step 1: Create Database Tables**

Create file: `/Users/abdulqadeer/Desktop/oil-erp-backend/create_customer_tables.py`

```python
import sqlite3

conn = sqlite3.connect('oil_erp.db')
cursor = conn.cursor()

# Create customers table
cursor.execute('''
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    postal_code TEXT,
    balance REAL DEFAULT 0,
    credit_limit REAL DEFAULT 0,
    category TEXT,
    opening_balance REAL DEFAULT 0,
    gps_location TEXT,
    notes TEXT,
    code TEXT,
    tax_id TEXT,
    payment_terms TEXT DEFAULT 'Net 30',
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
''')

# Create customer_ledger table
cursor.execute('''
CREATE TABLE IF NOT EXISTS customer_ledger (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    date TIMESTAMP NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    description TEXT,
    reference TEXT,
    invoice_number TEXT,
    payment_method TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
)
''')

# Create payments table
cursor.execute('''
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
)
''')

conn.commit()
conn.close()

print("✅ Customer tables created successfully!")
```

Run it:
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
python create_customer_tables.py
```

---

### **Step 2: Add Routes to Main App**

Edit: `/Users/abdulqadeer/Desktop/oil-erp-backend/app/main.py`

Add:
```python
from app.routes import customers

app.include_router(customers.router)
```

---

### **Step 3: Enable CORS**

In `app/main.py`, add:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## ✅ **Testing the Integration**

### **1. Start Backend**
```bash
cd /Users/abdulqadeer/Desktop/oil-erp-backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### **2. Test API**
```bash
curl http://localhost:8000/api/customers
```

### **3. Connect Frontend**
Edit `customerService.ts` line 7:
```typescript
const USE_MOCK = false;
```

### **4. Test in Browser**
- Open: http://localhost:5175
- Go to Customers
- Check Network tab for API calls

---

## 🎯 **Summary**

This guide provides:
- ✅ Complete database schema
- ✅ All required API endpoints
- ✅ Python/FastAPI implementation
- ✅ Integration steps
- ✅ Testing instructions

**Follow the steps to integrate your Customer module! 🚀**
