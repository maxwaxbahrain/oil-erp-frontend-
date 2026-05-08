# Quick Reference: Van Sale Ledger Integration

## For Van Salesmen

### Creating a Van Sale
1. Navigate to **Van Sales** → **New Van Sale**
2. Select your van from the dropdown
3. Select the customer
4. Add products to the sale
5. Choose payment method
6. Submit the sale

**What Happens Automatically:**
- ✅ Sale is recorded with receipt number (e.g., VS-20260119-0001)
- ✅ Customer ledger is updated with van number and your name
- ✅ Customer balance is updated (if credit sale)
- ✅ Product inventory is decreased
- ✅ Receipt is generated

## For Customers

### Viewing Your Ledger
1. Navigate to **Customers** → Find your account
2. Click **View Ledger**
3. See all transactions including:
   - Regular invoices
   - Van sales (with van number and salesman name)
   - Payments
   - Credit notes

### Ledger Columns Explained
- **Date**: When the transaction occurred
- **Description**: Type of transaction (e.g., "Van Sale - VS-20260119-0001")
- **Van**: Which van made the delivery (e.g., "Van 1")
- **Salesman**: Who served you (e.g., "Ahmed Ali")
- **Debit**: Money you owe (invoices, van sales)
- **Credit**: Money you paid (payments)
- **Balance**: Running total of what you owe

## For Managers

### Tracking Van Sales
All van sales automatically appear in:
1. **Customer Ledger** - See which van and salesman served each customer
2. **Van Sales History** - Complete list of all van sales
3. **Customer Balance** - Automatically updated for credit sales

### Reports Available
- Customer transaction history (includes van sales)
- Van sales by customer
- Van sales by date range
- Salesman performance (via customer ledger filtering)

## Example Ledger Entry

```
Date        | Description              | Van    | Salesman      | Debit    | Credit | Balance
------------|--------------------------|--------|---------------|----------|--------|----------
2026-01-19  | Van Sale - VS-20260119-0001 | Van 1  | Ahmed Ali     | 1,250.00 | -      | -1,250.00
2026-01-20  | Payment received - Cash  | -      | -             | -        | 500.00 | -750.00
2026-01-21  | Van Sale - VS-20260121-0005 | Van 2  | Mohammed Khan | 800.00   | -      | -1,550.00
```

## Key Features

### 🚚 Van Attribution
Every sale shows which van made the delivery

### 👤 Salesman Tracking
Every sale shows which salesman served the customer

### 💰 Automatic Balance Updates
Customer balances update automatically for credit sales

### 📄 Complete Audit Trail
Full history of all transactions in one place

### 🔗 Seamless Integration
No manual entry required - everything is automatic

## Payment Methods Supported

1. **Cash** - Full payment with change
2. **Card** - Full payment via card
3. **Digital** - Full payment via digital wallet
4. **Credit (No Advance)** - Full credit, no payment
5. **Credit with Advance** - Partial payment + credit
6. **Cash + Credit Split** - Mixed payment

## Troubleshooting

### Van/Salesman showing as "-"
- This means the entry is not a van sale (e.g., regular invoice or payment)
- Only van sales show van number and salesman name

### Balance not updating
- Check if the sale was completed successfully
- Verify the payment method was set correctly
- Contact support if issue persists

### Can't find a van sale in ledger
- Verify the correct customer was selected during sale
- Check the date range filter
- Ensure the sale status is "completed"

## Support

For issues or questions:
- Contact your system administrator
- Refer to the full documentation: VAN_SALE_LEDGER_INTEGRATION.md
- Check the van sales dashboard for sale status
