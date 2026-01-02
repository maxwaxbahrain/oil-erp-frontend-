# Backend Integration Checklist
## Oil ERP System

**Date:** January 1, 2026  
**Purpose:** Track backend implementation progress

---

## ✅ Database Tables Required

- [ ] **customers** table
  - [ ] id (primary key)
  - [ ] name
  - [ ] email
  - [ ] phone
  - [ ] address
  - [ ] balance (decimal)
  - [ ] credit_limit (decimal)
  - [ ] category
  - [ ] opening_balance (decimal)
  - [ ] gps_location
  - [ ] notes
  - [ ] code
  - [ ] created_at (timestamp)

- [ ] **payments** table
  - [ ] id (primary key)
  - [ ] customer_id (foreign key)
  - [ ] amount (decimal)
  - [ ] payment_date (date)
  - [ ] payment_method
  - [ ] reference
  - [ ] notes
  - [ ] created_at (timestamp)

- [ ] **ledger_entries** table
  - [ ] id (primary key)
  - [ ] customer_id (foreign key)
  - [ ] date (date)
  - [ ] type (enum: invoice, payment, credit, debit)
  - [ ] amount (decimal)
  - [ ] balance (decimal)
  - [ ] description
  - [ ] reference
  - [ ] created_at (timestamp)

- [ ] **products** table
  - [ ] id (primary key)
  - [ ] name
  - [ ] sku (unique)
  - [ ] category
  - [ ] unit_price (decimal)
  - [ ] cost_price (decimal)
  - [ ] current_stock (integer)
  - [ ] minimum_stock (integer)
  - [ ] created_at (timestamp)

- [ ] **vans** table
  - [ ] id (primary key)
  - [ ] van_number
  - [ ] driver_name
  - [ ] driver_phone
  - [ ] vehicle_number
  - [ ] capacity_liters (decimal)
  - [ ] status (enum: active, inactive, maintenance)
  - [ ] created_at (timestamp)

- [ ] **sales_orders** table
  - [ ] id (primary key)
  - [ ] order_number (unique)
  - [ ] customer_id (foreign key)
  - [ ] customer_name
  - [ ] order_date (date)
  - [ ] salesman
  - [ ] van
  - [ ] status (enum: Pending, Converted, Cancelled)
  - [ ] subtotal (decimal)
  - [ ] tax_amount (decimal)
  - [ ] discount (decimal)
  - [ ] grand_total (decimal)
  - [ ] notes
  - [ ] created_at (timestamp)

- [ ] **sales_order_items** table
  - [ ] id (primary key)
  - [ ] sales_order_id (foreign key)
  - [ ] product
  - [ ] description
  - [ ] quantity (decimal)
  - [ ] rate (decimal)
  - [ ] amount (decimal)

- [ ] **invoices** table
  - [ ] id (primary key)
  - [ ] invoice_number (unique)
  - [ ] customer_id (foreign key)
  - [ ] customer_name
  - [ ] invoice_date (date)
  - [ ] due_date (date)
  - [ ] salesman
  - [ ] van
  - [ ] subtotal (decimal)
  - [ ] tax_rate (decimal)
  - [ ] tax_amount (decimal)
  - [ ] discount (decimal)
  - [ ] grand_total (decimal)
  - [ ] notes
  - [ ] status (enum: Unpaid, Paid, Partial, Overdue)
  - [ ] payment_status
  - [ ] payment_method
  - [ ] amount_paid (decimal)
  - [ ] remaining_balance (decimal)
  - [ ] created_at (timestamp)

- [ ] **invoice_items** table
  - [ ] id (primary key)
  - [ ] invoice_id (foreign key)
  - [ ] product
  - [ ] description
  - [ ] quantity (decimal)
  - [ ] rate (decimal)
  - [ ] amount (decimal)

---

## ✅ API Endpoints Required

### Customer Endpoints
- [ ] `GET /api/customers` - List all customers
- [ ] `GET /api/customers/{id}` - Get single customer
- [ ] `POST /api/customers` - Create customer
- [ ] `PUT /api/customers/{id}` - Update customer
- [ ] `DELETE /api/customers/{id}` - Delete customer
- [ ] `GET /api/customers/overdue` - Get overdue customers
- [ ] `GET /api/customers/{id}/ledger` - Get customer ledger

### Payment Endpoints
- [ ] `GET /api/payments` - List all payments
- [ ] `POST /api/payments` - Create payment
- [ ] `GET /api/payments/customer/{id}` - Get customer payments

### Product Endpoints
- [ ] `GET /api/products` - List all products
- [ ] `GET /api/products/{id}` - Get single product
- [ ] `POST /api/products` - Create product
- [ ] `PUT /api/products/{id}` - Update product

### Van Endpoints
- [ ] `GET /api/vans` - List all vans
- [ ] `GET /api/vans/{id}` - Get single van
- [ ] `POST /api/vans` - Create van
- [ ] `PUT /api/vans/{id}` - Update van
- [ ] `DELETE /api/vans/{id}` - Delete van

### Sales Order Endpoints
- [ ] `GET /api/sales-orders` - List all orders
- [ ] `POST /api/sales-orders` - Create order
- [ ] `GET /api/sales-orders/customer/{id}` - Get customer orders
- [ ] `PUT /api/sales-orders/{id}/convert` - Convert to invoice

### Invoice Endpoints
- [ ] `GET /api/invoices` - List all invoices
- [ ] `POST /api/invoices` - Create invoice
- [ ] `GET /api/invoices/{id}` - Get single invoice
- [ ] `GET /api/invoices/customer/{id}` - Get customer invoices
- [ ] `PUT /api/invoices/{id}` - Update invoice

---

## ✅ Business Logic Required

### Customer Balance Management
- [ ] When payment is created → Decrease customer balance
- [ ] When invoice is created → Increase customer balance
- [ ] Calculate credit utilization (balance / credit_limit)
- [ ] Identify overdue customers (balance > 0 and overdue)

### Ledger Management
- [ ] Auto-create ledger entry when invoice is created
- [ ] Auto-create ledger entry when payment is received
- [ ] Maintain running balance in ledger
- [ ] Sort ledger by date (newest first)

### Invoice Management
- [ ] Auto-generate invoice numbers (sequential)
- [ ] Calculate subtotal from line items
- [ ] Calculate tax amount (subtotal × tax_rate)
- [ ] Calculate grand total (subtotal + tax - discount)
- [ ] Update status to "Overdue" when past due date

### Sales Order Management
- [ ] Auto-generate order numbers (sequential)
- [ ] Convert order to invoice (copy all data)
- [ ] Mark order as "Converted" after conversion
- [ ] Prevent duplicate conversions

---

## ✅ Configuration & Setup

- [ ] Install Python dependencies
- [ ] Set up database connection
- [ ] Create `.env` file with:
  - [ ] DATABASE_URL
  - [ ] SECRET_KEY
  - [ ] CORS_ORIGINS
- [ ] Run database migrations
- [ ] Enable CORS for frontend (http://localhost:5173)
- [ ] Start backend server on port 8000

---

## ✅ Testing

- [ ] Test customer CRUD operations
- [ ] Test payment creation and balance update
- [ ] Test ledger generation
- [ ] Test invoice creation
- [ ] Test sales order to invoice conversion
- [ ] Test overdue customer calculation
- [ ] Test frontend connection to backend
- [ ] Test data persistence after server restart

---

## ✅ Frontend Configuration

- [ ] Change `USE_MOCK = false` in `src/services/api.ts`
- [ ] Verify `API_BASE_URL = 'http://localhost:8000/api'`
- [ ] Test all frontend pages with real backend
- [ ] Verify data saves to database (not localStorage)

---

## 📝 Notes

Add any notes or issues here:

---

## 🎯 Priority Order

1. **High Priority** (Core functionality)
   - Customer CRUD
   - Payment creation
   - Ledger entries
   - Invoice creation

2. **Medium Priority** (Important features)
   - Sales orders
   - Order to invoice conversion
   - Overdue tracking

3. **Low Priority** (Nice to have)
   - Product management
   - Van management
   - Advanced reporting

---

## 🚀 Quick Start Command

Once backend is ready:
```bash
# Backend
cd /path/to/oil-erp-backend
pip install -r requirements.txt
python main.py

# Frontend (in another terminal)
cd /Users/abdulqadeer/Desktop/oil-erp-frontend
npm run dev
```

Then change `USE_MOCK = false` in `src/services/api.ts` and test!
