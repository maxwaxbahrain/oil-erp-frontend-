# Customer Overview Stats - Logic Corrections

## 🐛 Issues Fixed

Based on the screenshot provided, the following hardcoded/incorrect values were fixed:

### Before (Hardcoded Values)
- ❌ **Total Sales**: 185,000 (hardcoded)
- ❌ **Credit Limit**: 20,000 (hardcoded)
- ❌ **Overdue Amount**: 4,200 (hardcoded)
- ❌ **Overdue Days**: "15 days overdue" (hardcoded)
- ❌ **Credit Utilization**: 62% (hardcoded)

### After (Dynamic Calculations)
- ✅ **Total Sales**: Calculated from actual invoices
- ✅ **Credit Limit**: Retrieved from customer record
- ✅ **Overdue Amount**: Calculated from unpaid invoices past due date
- ✅ **Overdue Days**: Calculated from oldest overdue invoice
- ✅ **Credit Utilization**: Calculated as (Outstanding Balance / Credit Limit) × 100

---

## 🔧 Changes Made

### 1. Updated CustomerStats Interface
**File**: `/src/pages/Customers/CustomerOverview.tsx`

Added `overdueDays` field:
```typescript
interface CustomerStats {
    outstandingBalance: number;
    totalSalesYTD: number;
    creditLimit: number;
    creditUtilization: number;
    overdueAmount: number;
    overdueDays: number;        // ← NEW
    lastPaymentAmount: number;
    lastPaymentDate: string;
    lastInvoiceDate: string;
}
```

---

### 2. Fixed Initial State
**Before:**
```typescript
const [stats, setStats] = useState<CustomerStats>({
    outstandingBalance: 0,
    totalSalesYTD: 185000,      // ❌ Hardcoded
    creditLimit: 20000,          // ❌ Hardcoded
    creditUtilization: 62,       // ❌ Hardcoded
    overdueAmount: 4200,         // ❌ Hardcoded
    lastPaymentAmount: 3000,
    lastPaymentDate: '2024-12-18',
    lastInvoiceDate: '2024-12-22'
});
```

**After:**
```typescript
const [stats, setStats] = useState<CustomerStats>({
    outstandingBalance: 0,
    totalSalesYTD: 0,           // ✅ Will be calculated
    creditLimit: 0,              // ✅ Will be calculated
    creditUtilization: 0,        // ✅ Will be calculated
    overdueAmount: 0,            // ✅ Will be calculated
    overdueDays: 0,              // ✅ Will be calculated
    lastPaymentAmount: 0,
    lastPaymentDate: '',
    lastInvoiceDate: ''
});
```

---

### 3. Implemented Real Calculations

**Location**: `loadAllData()` function

#### A. Total Sales Calculation
```typescript
// Calculate total sales from all invoices
const totalSales = custInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
```

**Logic**: Sum of all invoice grand totals for this customer

---

#### B. Credit Limit
```typescript
// Get credit limit from customer record
const creditLimit = customer?.credit_limit || 0;
```

**Logic**: Retrieved directly from customer's credit_limit field

---

#### C. Overdue Amount Calculation
```typescript
// Find all unpaid invoices past their due date
const today = new Date();
const overdueInvoices = custInvoices.filter(inv => {
    const dueDate = new Date(inv.dueDate);
    const isOverdue = inv.status !== 'Paid' && dueDate < today;
    return isOverdue;
});

// Calculate total overdue amount (considering partial payments)
const overdueAmount = overdueInvoices.reduce((sum, inv) => 
    sum + (inv.grandTotal - (inv.amount_paid || 0)), 0
);
```

**Logic**: 
1. Filter invoices where status ≠ 'Paid' AND due date < today
2. Sum (invoice total - amount paid) for each overdue invoice

---

#### D. Overdue Days Calculation
```typescript
// Find the oldest overdue invoice
let oldestOverdueDays = 0;
if (overdueInvoices.length > 0) {
    const oldestInvoice = overdueInvoices.reduce((oldest, inv) => {
        const invDate = new Date(inv.dueDate);
        const oldestDate = new Date(oldest.dueDate);
        return invDate < oldestDate ? inv : oldest;
    });
    
    // Calculate days overdue
    oldestOverdueDays = Math.floor(
        (today.getTime() - new Date(oldestInvoice.dueDate).getTime()) 
        / (1000 * 60 * 60 * 24)
    );
}
```

**Logic**:
1. Find invoice with earliest due date among overdue invoices
2. Calculate days between today and that due date

---

#### E. Credit Utilization Calculation
```typescript
// Calculate percentage of credit limit used
const creditUtilization = creditLimit > 0 
    ? Math.round((Math.abs(runningBalance) / creditLimit) * 100) 
    : 0;
```

**Logic**: (Outstanding Balance / Credit Limit) × 100, rounded to nearest integer

---

### 4. Updated Display Logic

#### Overdue Days Display
**Before:**
```tsx
<div className="text-xs text-red-500 mt-1">15 days overdue</div>
```

**After:**
```tsx
<div className="text-xs text-red-500 mt-1">
    {stats.overdueDays > 0 ? `${stats.overdueDays} days overdue` : 'No overdue'}
</div>
```

**Logic**: Shows actual days if overdue, otherwise shows "No overdue"

---

#### Credit Limit Display
**Before:**
```tsx
{((customer as any).creditLimit || stats.creditLimit).toLocaleString()}
```

**After:**
```tsx
{stats.creditLimit.toLocaleString()}
```

**Logic**: Uses calculated value from stats (which comes from customer record)

---

## 📊 Calculation Examples

### Example Customer: "KHAN"

**Customer Data:**
- Credit Limit: $50,000
- Outstanding Balance: $13,040

**Invoices:**
- Invoice #1: $5,000 (Due: 2025-12-01, Status: Unpaid)
- Invoice #2: $3,000 (Due: 2025-12-15, Status: Unpaid)
- Invoice #3: $8,000 (Due: 2025-12-20, Status: Paid)
- Invoice #4: $2,000 (Due: 2026-01-05, Status: Unpaid)

**Calculations (as of 2026-01-01):**

1. **Total Sales**: $5,000 + $3,000 + $8,000 + $2,000 = **$18,000**

2. **Credit Limit**: **$50,000** (from customer record)

3. **Overdue Invoices**: 
   - Invoice #1 (past due by 31 days)
   - Invoice #2 (past due by 17 days)
   - Invoice #4 is NOT overdue (due date is future)

4. **Overdue Amount**: $5,000 + $3,000 = **$8,000**

5. **Overdue Days**: **31 days** (oldest overdue invoice)

6. **Credit Utilization**: ($13,040 / $50,000) × 100 = **26%**

---

## ✅ Verification Steps

To verify the fixes are working:

1. **Navigate to Customer Overview**
   - Go to any customer detail page
   - Check the stats cards at the top

2. **Verify Total Sales**
   - Click "Sales" tab
   - Manually sum all invoice amounts
   - Compare with "Total Sales" stat

3. **Verify Credit Limit**
   - Check customer's credit_limit field
   - Should match "Credit Limit" stat

4. **Verify Overdue Amount**
   - Click "Sales" tab
   - Find unpaid invoices past due date
   - Sum their amounts
   - Compare with "Overdue Amount" stat

5. **Verify Overdue Days**
   - Find oldest unpaid invoice past due date
   - Calculate days from due date to today
   - Compare with displayed days

6. **Verify Credit Utilization**
   - Calculate: (Outstanding Balance / Credit Limit) × 100
   - Compare with "Used: X%" display

---

## 🔄 Data Flow

```
Customer Record
    ↓
    ├─→ credit_limit → Credit Limit stat
    └─→ balance → Outstanding Balance stat

Invoices
    ↓
    ├─→ Sum(grandTotal) → Total Sales stat
    ├─→ Filter(unpaid & past due) → Overdue invoices
    │   ├─→ Sum(amounts) → Overdue Amount stat
    │   └─→ Oldest due date → Overdue Days stat
    └─→ Used in ledger → Running Balance

Payments
    ↓
    └─→ Latest payment → Last Payment stat

Calculations
    ↓
    └─→ (Balance / Credit Limit) × 100 → Credit Utilization stat
```

---

## 🐛 Edge Cases Handled

1. **No Invoices**: Total Sales = 0
2. **No Overdue Invoices**: Overdue Amount = 0, Days = "No overdue"
3. **Zero Credit Limit**: Credit Utilization = 0% (prevents division by zero)
4. **Partial Payments**: Overdue amount considers amount_paid field
5. **No Payments**: Last Payment = 0
6. **Future Due Dates**: Not counted as overdue

---

## 📝 Testing Checklist

- [ ] Total Sales matches sum of all invoices
- [ ] Credit Limit matches customer record
- [ ] Overdue Amount matches unpaid invoices past due
- [ ] Overdue Days shows correct number of days
- [ ] Credit Utilization percentage is accurate
- [ ] "No overdue" shows when no overdue invoices
- [ ] Stats update when new invoice/payment added
- [ ] No console errors
- [ ] Values format correctly (commas, decimals)

---

## 🎯 Summary

**All stats are now calculated dynamically from real data:**

✅ **Total Sales** - Sum of all invoice amounts
✅ **Credit Limit** - From customer record
✅ **Overdue Amount** - Sum of unpaid invoices past due
✅ **Overdue Days** - Days since oldest overdue invoice
✅ **Credit Utilization** - Percentage of credit used
✅ **Outstanding Balance** - Running balance from ledger
✅ **Last Payment** - Most recent payment amount/date
✅ **Last Invoice** - Most recent invoice date

**No more hardcoded values! All calculations are accurate and real-time! 🎉**
