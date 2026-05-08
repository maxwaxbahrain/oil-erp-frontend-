# 💰 ERP Payment Method Logic - Complete Documentation

## Overview
This document describes the **ERP-grade payment method logic** implemented in the Van Sales module. The system supports 6 payment methods with strict accounting rules to ensure data integrity and proper financial tracking.

---

## 📋 Payment Methods

### 1. **Cash (Full Payment)**
- **Code**: `cash`
- **Description**: 100% cash payment
- **Business Rules**:
  - Amount received must be ≥ total amount
  - Change can be given if amount received > total
  - No credit balance
- **Accounting Impact**:
  - **Debit**: Cash Account
  - **Credit**: Sales Revenue
- **Validation**:
  ```typescript
  if (amountReceived < totalAmount) {
      return 'Cash payment requires full amount or more';
  }
  ```

---

### 2. **Card (Full Payment)**
- **Code**: `card`
- **Description**: 100% card payment (Credit/Debit card)
- **Business Rules**:
  - Amount received must equal total amount exactly
  - No change given
  - No credit balance
- **Accounting Impact**:
  - **Debit**: Bank Account (Card)
  - **Credit**: Sales Revenue
- **Validation**:
  ```typescript
  if (amountReceived !== totalAmount) {
      return 'Card payment must be exact amount (no change given)';
  }
  ```

---

### 3. **Digital (Full Payment)**
- **Code**: `digital`
- **Description**: 100% digital payment (Mobile wallets, online transfers)
- **Business Rules**:
  - Amount received must equal total amount exactly
  - No change given
  - No credit balance
- **Accounting Impact**:
  - **Debit**: Digital Wallet Account
  - **Credit**: Sales Revenue
- **Validation**:
  ```typescript
  if (amountReceived !== totalAmount) {
      return 'Digital payment must be exact amount (no change given)';
  }
  ```

---

### 4. **Credit (No Advance)**
- **Code**: `credit_no_advance`
- **Description**: Full amount on credit - no advance payment
- **Business Rules**:
  - Amount received MUST be exactly 0
  - Full invoice amount goes to Accounts Receivable
  - Payment status: `unpaid`
  - Field is **locked** to prevent user input
- **Accounting Impact**:
  - **Debit**: Accounts Receivable
  - **Credit**: Sales Revenue
- **Validation**:
  ```typescript
  if (amountReceived !== 0) {
      return 'Full credit sales must have 0 amount received';
  }
  ```
- **UI Behavior**:
  - Amount field is **disabled**
  - Auto-set to 0
  - Shows warning: "(Locked for Credit)"

---

### 5. **Credit (With Advance)**
- **Code**: `credit_with_advance`
- **Description**: Partial advance payment + remaining on credit
- **Business Rules**:
  - Advance must be > 0
  - Advance must be < total amount
  - Remaining balance goes to Accounts Receivable
  - Payment status: `partial`
- **Accounting Impact**:
  - **Debit**: Cash/Bank (advance amount)
  - **Debit**: Accounts Receivable (remaining)
  - **Credit**: Sales Revenue (total)
- **Validation**:
  ```typescript
  if (amountReceived <= 0) {
      return 'Advance payment must be greater than 0';
  }
  if (amountReceived >= totalAmount) {
      return 'Advance must be less than total. Use full payment method instead';
  }
  ```
- **Example**:
  - Invoice Total: $1,000
  - Advance Paid: $300
  - Accounts Receivable: $700

---

### 6. **Cash + Credit Split**
- **Code**: `cash_credit_split`
- **Description**: Split payment - percentage in cash, remainder on credit
- **Business Rules**:
  - User selects cash percentage (0-100%)
  - System auto-calculates cash and credit amounts
  - Amount field is **read-only** (calculated)
  - Cash amount must be between 0 and total
- **Accounting Impact**:
  - **Debit**: Cash Account (cash portion)
  - **Debit**: Accounts Receivable (credit portion)
  - **Credit**: Sales Revenue (total)
- **Validation**:
  ```typescript
  if (amountReceived < 0 || amountReceived > totalAmount) {
      return 'Cash amount must be between 0 and total';
  }
  ```
- **UI Behavior**:
  - Percentage slider (0-100%, step 5%)
  - Shows cash and credit breakdown
  - Amount field is **read-only**
  - Auto-calculates: `cashAmount = total × percentage / 100`
- **Example**:
  - Invoice Total: $1,000
  - Cash Percentage: 40%
  - Cash Received: $400
  - Accounts Receivable: $600

---

## 🔒 Validation Rules

### Global Validation
1. **Amount cannot be negative**
   ```typescript
   if (amountReceived < 0) {
       return 'Amount received cannot be negative';
   }
   ```

2. **Van must be selected**
3. **Customer must be selected**
4. **At least one product must be added**

### Payment-Specific Validation
Each payment method has specific validation rules (see above sections).

---

## 📊 Accounting Breakdown Display

The payment section shows a real-time accounting breakdown:

```
📊 Accounting Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 Cash/Payment Received:        $400.00
📋 Accounts Receivable:          $600.00
💰 Change to Return:             $0.00
```

### Calculation Logic
```typescript
switch (paymentMethod) {
    case 'cash':
        changeGiven = max(0, amountReceived - total);
        accountsReceivable = 0;
        break;
    
    case 'credit_no_advance':
        changeGiven = 0;
        accountsReceivable = total;
        break;
    
    case 'credit_with_advance':
    case 'cash_credit_split':
        changeGiven = 0;
        accountsReceivable = total - amountReceived;
        break;
}
```

---

## 💾 Data Storage

### VanSale Record Structure
```typescript
interface VanSale {
    id: string;
    receipt_number: string;
    van_id: string;
    customer_id: string;
    sale_date: string;
    items: VanSaleItem[];
    
    // Financials
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total_amount: number;
    
    // Payment Details
    payment_method: PaymentMethodType;
    amount_received: number;
    change_given: number;
    accounts_receivable: number;      // NEW: Credit balance
    payment_status: 'paid' | 'partial' | 'unpaid';
    outstanding_balance: number;
    
    status: 'completed' | 'cancelled' | 'refunded';
    notes?: string;
    created_at: string;
    updated_at: string;
}
```

### Payment Status Logic
```typescript
switch (paymentMethod) {
    case 'cash':
    case 'card':
    case 'digital':
        paymentStatus = 'paid';
        break;
    
    case 'credit_no_advance':
        paymentStatus = 'unpaid';
        break;
    
    case 'credit_with_advance':
        paymentStatus = 'partial';
        break;
    
    case 'cash_credit_split':
        paymentStatus = amountReceived > 0 ? 'partial' : 'unpaid';
        break;
}
```

---

## 🔄 Customer Balance Update

When credit is involved, the customer's balance is automatically updated:

```typescript
const updateCustomerBalance = async (customerId: string, creditAmount: number) => {
    const customers = getStorage<any>('customers');
    const customerIndex = customers.findIndex(c => c.id === customerId);
    
    if (customerIndex !== -1) {
        // Negative balance = customer owes us money
        const currentBalance = customers[customerIndex].balance || 0;
        customers[customerIndex].balance = currentBalance - creditAmount;
        
        setStorage('customers', customers);
    }
};
```

**Example**:
- Customer current balance: -$500 (owes $500)
- New credit sale: $300
- New balance: -$800 (owes $800)

---

## 🎨 UI/UX Features

### 1. **Payment Method Buttons**
- Visual grid layout
- Color-coded by method
- Icons for quick recognition
- Description text for clarity

### 2. **Amount Field Behavior**
| Payment Method | Field State | Auto-Fill | User Editable |
|---|---|---|---|
| Cash | Enabled | Total amount | ✅ Yes |
| Card | Enabled | Total amount | ✅ Yes |
| Digital | Enabled | Total amount | ✅ Yes |
| Credit (No Advance) | **Disabled** | 0 (locked) | ❌ No |
| Credit (With Advance) | Enabled | 0 | ✅ Yes |
| Cash + Credit | **Read-only** | Calculated | ❌ No (use slider) |

### 3. **Quick Amount Buttons** (Cash only)
- $10, $20, $50, $100
- "Exact" button (sets to total)

### 4. **Percentage Slider** (Cash + Credit only)
- Range: 0-100%
- Step: 5%
- Real-time calculation
- Visual breakdown cards

### 5. **Validation Errors**
- Real-time validation
- Clear error messages
- Red border and icon
- Prevents form submission

---

## 🧪 Testing Scenarios

### Scenario 1: Full Cash Payment
```
Total: $100
Payment Method: Cash
Amount Received: $120
Expected Result:
  - Change Given: $20
  - Accounts Receivable: $0
  - Payment Status: paid
```

### Scenario 2: Full Credit (No Advance)
```
Total: $100
Payment Method: Credit (No Advance)
Amount Received: 0 (locked)
Expected Result:
  - Change Given: $0
  - Accounts Receivable: $100
  - Payment Status: unpaid
  - Customer Balance: decreased by $100
```

### Scenario 3: Credit with Advance
```
Total: $100
Payment Method: Credit (With Advance)
Amount Received: $30
Expected Result:
  - Change Given: $0
  - Accounts Receivable: $70
  - Payment Status: partial
  - Customer Balance: decreased by $70
```

### Scenario 4: Cash + Credit Split (60% cash)
```
Total: $100
Payment Method: Cash + Credit
Cash Percentage: 60%
Amount Received: $60 (auto-calculated)
Expected Result:
  - Change Given: $0
  - Accounts Receivable: $40
  - Payment Status: partial
  - Customer Balance: decreased by $40
```

---

## 🚀 Future Enhancements

1. **Multiple Payment Methods**
   - Allow combining card + cash
   - Support for checks

2. **Payment Terms**
   - Net 30, Net 60, Net 90
   - Due date calculation

3. **Partial Payments**
   - Track multiple payments against one invoice
   - Payment history

4. **Credit Limits**
   - Check customer credit limit before allowing credit sales
   - Warning when approaching limit

5. **Payment Reminders**
   - Automated reminders for overdue payments
   - SMS/Email notifications

---

## 📝 Summary

This payment system provides:
- ✅ **Foolproof validation** - Prevents user errors
- ✅ **Proper accounting** - Accurate financial tracking
- ✅ **Audit trail** - Complete transaction history
- ✅ **Scalable design** - Easy to add new payment methods
- ✅ **User-friendly** - Clear UI with helpful guidance
- ✅ **ERP-grade** - Matches professional accounting practices

---

**Last Updated**: January 19, 2026
**Version**: 1.0.0
**Module**: Van Sales / Payment Processing
