# Van Sale Invoice - Customer Ledger Integration

## Summary
Successfully linked van sale invoices with the customer ledger system. All van sales now automatically appear in the customer ledger with complete van and salesman information.

## Changes Made

### 1. Updated LedgerEntry Interface
**Files Modified:**
- `/src/services/customerService.ts`
- `/src/services/api.ts`

**Changes:**
- Added `'van_sale'` as a new ledger entry type
- Added `van_number?: string` field to track which van made the sale
- Added `salesman_name?: string` field to track the salesman/driver

```typescript
export interface LedgerEntry {
    id: string;
    customer_id: string;
    date: string;
    type: 'invoice' | 'payment' | 'credit' | 'debit' | 'opening_balance' | 'van_sale';
    amount: number;
    balance: number;
    description?: string;
    reference?: string;
    invoice_number?: string;
    payment_method?: string;
    van_number?: string;        // Van number for van sales
    salesman_name?: string;     // Salesman/driver name for van sales
}
```

### 2. Updated Van Sales Service
**File Modified:** `/src/services/vanSalesService.ts`

**Changes:**
- Imported `addLedgerEntry` from customerService
- Added automatic ledger entry creation when a van sale is completed
- Ledger entry includes:
  - Receipt number as reference
  - Van number from van assignment
  - Salesman/driver name from van assignment
  - Payment method
  - Total amount

**Code Added:**
```typescript
// Create ledger entry for this van sale
await addLedgerEntry({
    customer_id: formData.customer_id,
    date: newSale.sale_date,
    type: 'van_sale',
    amount: total,
    balance: 0, // Will be calculated by addLedgerEntry
    description: `Van Sale - ${newSale.receipt_number}`,
    reference: newSale.receipt_number,
    invoice_number: newSale.receipt_number,
    payment_method: formData.payment_method,
    van_number: van?.van_number || `Van ${formData.van_id}`,
    salesman_name: van?.driver_name || 'Unknown'
});
```

### 3. Enhanced Customer Ledger Display
**File Modified:** `/src/pages/Customers/CustomerLedger.tsx`

**Changes:**
- Added "Van" column to display van number
- Added "Salesman" column to display salesman/driver name
- Improved date formatting (now shows localized date)
- Added `.toFixed(2)` for proper currency formatting
- Van sales now appear in the Debit column (as they increase customer balance)

**Display Logic:**
- Van sales show in Debit column (customer owes money)
- Payments show in Credit column (customer pays money)
- Van number and salesman name display for van sales, "-" for other entries

## How It Works

### Flow:
1. **Van Sale Created** → Van salesman creates a sale using VanSalesForm
2. **Ledger Entry Auto-Created** → System automatically creates a ledger entry with:
   - Type: 'van_sale'
   - Van number from van assignment
   - Salesman name from van driver
   - Receipt number as reference
   - Payment method and amount
3. **Customer Balance Updated** → Customer balance is automatically updated
4. **Ledger Display** → Customer ledger shows all van sales with van and salesman details

### Example Ledger Entry:
```
Date        | Description              | Van    | Salesman      | Debit   | Credit | Balance
------------|--------------------------|--------|---------------|---------|--------|--------
2026-01-19  | Van Sale - VS-20260119-0001 | Van 1  | Ahmed Ali     | 1,250.00| -      | -1,250.00
```

## Benefits

1. **Complete Traceability** - Every van sale is tracked in customer ledger
2. **Van Attribution** - Know which van made each sale
3. **Salesman Tracking** - Track which salesman served each customer
4. **Unified View** - All customer transactions (invoices, payments, van sales) in one place
5. **Automatic Integration** - No manual entry required
6. **Audit Trail** - Complete history of van-based transactions

## Testing

To test the integration:

1. Navigate to Van Sales → New Van Sale
2. Create a van sale for any customer
3. Navigate to Customers → Select the customer → View Ledger
4. Verify the van sale appears with:
   - Correct van number
   - Correct salesman name
   - Correct amount in Debit column
   - Updated balance

## Technical Notes

- All changes are backward compatible
- Existing ledger entries without van info will display "-" in van/salesman columns
- Van sales update customer balance just like regular invoices
- The ledger entry type 'van_sale' allows filtering/reporting specifically on van sales
- Receipt numbers are used as invoice numbers for consistency

## Future Enhancements

Potential improvements:
1. Add filtering by van number in customer ledger
2. Add filtering by salesman in customer ledger
3. Create van sales report showing all sales per van
4. Create salesman performance report
5. Add van sales analytics to customer profile
