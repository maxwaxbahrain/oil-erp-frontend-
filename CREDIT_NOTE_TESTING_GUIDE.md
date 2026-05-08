# 🧪 CREDIT NOTE MODULE - TESTING GUIDE

**Server Running:** http://localhost:5174/  
**Date:** January 8, 2026

---

## 🚀 QUICK START TESTING

### **Step 1: Access the Module**

1. Open browser: **http://localhost:5174/**
2. Navigate to **Sales → Credit Notes** in the sidebar
3. You should see the Credit Notes list page

---

## ✅ TEST SCENARIOS

### **Test 1: View Credit Notes List**

**Expected Result:**
- Empty state message: "No Credit Notes Found"
- Stats cards showing zeros
- "New Credit Note" button visible
- Search and filter controls visible

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 2: Create First Credit Note (Draft)**

**Steps:**
1. Click **"New Credit Note"** button
2. Select a **Customer** from dropdown
3. Select an **Invoice** (only unpaid/partial invoices shown)
4. Verify credit note number auto-generates (CN-XXXXXX)
5. Verify line items pre-populate from invoice
6. Enter return quantities (e.g., 5 for first item)
7. Verify line totals calculate automatically
8. Verify tax calculates automatically
9. Verify total credit calculates automatically
10. Select **Credit Reason** (e.g., "Product Return")
11. Toggle **Restock to Warehouse** ON
12. Add optional notes
13. Click **"Save Draft"**

**Expected Result:**
- Success alert appears
- Redirects to list page
- Credit note appears with "Draft" status
- Stats update

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 3: Issue Credit Note**

**Steps:**
1. Click **"New Credit Note"** button
2. Select customer and invoice
3. Enter return quantities
4. Select credit reason
5. Click **"Issue Credit Note"**
6. Confirm the action

**Expected Result:**
- Confirmation dialog shows details
- Success alert appears
- Redirects to customer ledger
- Customer ledger shows credit entry
- Invoice status updated
- Inventory restocked (if enabled)

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 4: Tax Calculation**

**Steps:**
1. Create credit note
2. Enter return quantity: 10
3. Unit price: $100
4. Tax rate: 17% (from invoice)

**Expected Result:**
- Line Total: $1,000
- Tax Amount: $170
- Total Amount: $1,170
- Subtotal (all lines): Sum of line totals
- Tax Amount (total): Sum of tax amounts
- Total Credit: Subtotal + Tax Amount

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 5: Return Quantity Validation**

**Steps:**
1. Create credit note
2. Invoice has 10 units of a product
3. Try to enter return quantity: 15

**Expected Result:**
- Alert: "Return quantity cannot exceed invoiced quantity (10)"
- Quantity resets or doesn't change

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 6: Form Validation**

**Test 6a: Missing Customer**
1. Click "New Credit Note"
2. Click "Issue Credit Note" without selecting customer
3. **Expected:** Alert "Please select a customer"

**Test 6b: Missing Invoice**
1. Select customer
2. Click "Issue Credit Note" without selecting invoice
3. **Expected:** Alert "Please select an invoice"

**Test 6c: No Return Quantities**
1. Select customer and invoice
2. Don't enter any return quantities (all 0)
3. Click "Issue Credit Note"
4. **Expected:** Alert "Please enter return quantities for at least one item"

**Test 6d: Missing Credit Reason**
1. Enter return quantities
2. Don't select credit reason
3. Click "Issue Credit Note"
4. **Expected:** Alert "Please select a credit reason"

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 7: Customer Ledger Update**

**Steps:**
1. Note customer's current balance
2. Create and issue credit note for $500
3. Go to **Customers** page
4. Click on the customer
5. Go to **Ledger** tab

**Expected Result:**
- New ledger entry with type "credit"
- Amount: $500
- Description: "Credit Note - [Reason]"
- Reference: Credit note number (CN-XXXXXX)
- Customer balance should decrease by $500

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 8: Inventory Restocking**

**Steps:**
1. Note current stock of a product (e.g., "Bettano 15W40")
2. Create and issue credit note for 10 units with restocking enabled
3. Go to **Products** page
4. Check the product's stock

**Expected Result:**
- Stock should increase by 10 units
- Stock update should be in Main Warehouse location

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 9: Invoice Status Update**

**Steps:**
1. Find an unpaid invoice with total $1,000
2. Create and issue credit note for $500
3. Check invoice status

**Expected Result:**
- Invoice status: "Partial"
- Credit status: "Partially Credited"
- Credited amount: $500
- Remaining balance: $500

**Test 9b: Full Credit**
1. Create and issue credit note for remaining $500
2. Check invoice status

**Expected Result:**
- Invoice status: "Paid"
- Credit status: "Fully Credited"
- Credited amount: $1,000
- Remaining balance: $0

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 10: Edit Draft Credit Note**

**Steps:**
1. Create credit note and save as draft
2. Go to credit notes list
3. Click edit icon on draft credit note
4. Change return quantities
5. Save draft again

**Expected Result:**
- Draft loads with existing data
- Changes save successfully
- Updated values reflected in list

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 11: Void Credit Note**

**Steps:**
1. Create credit note and save as draft
2. Go to credit notes list
3. Click void icon (X)
4. Enter void reason: "Test void"
5. Confirm

**Expected Result:**
- Credit note status changes to "Void"
- Void reason saved
- Cannot edit voided credit note
- Voided credit notes excluded from totals

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 12: Cannot Void Applied Credit Note**

**Steps:**
1. Create and issue credit note (status: Applied)
2. Try to void it

**Expected Result:**
- Alert: "Cannot void an applied credit note. Please create a reversal instead."
- Credit note remains Applied

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 13: Search and Filter**

**Steps:**
1. Create 3-4 credit notes with different statuses
2. Use search bar to search by:
   - Credit note number
   - Customer name
   - Invoice number
   - Credit reason
3. Use filter dropdown to filter by status

**Expected Result:**
- Search filters results correctly
- Filter shows only matching status
- Results update in real-time

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 14: Stats Dashboard**

**Steps:**
1. Create multiple credit notes with different amounts
2. Check stats cards

**Expected Result:**
- **Total Credit Notes:** Correct count
- **Total Credit Amount:** Sum of all credit amounts (excluding voided)
- **Average Credit:** Total amount / count
- **Credit Rate:** (Credit notes / Invoices) × 100

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 15: Reason Badges**

**Steps:**
1. Create credit notes with different reasons
2. View list page

**Expected Result:**
- Each reason has different color badge:
  - Product Return: Blue
  - Damaged/Defective: Red
  - Pricing Error: Orange
  - Billing Error: Purple
  - Customer Discount: Green
  - Service Not Rendered: Yellow
  - Cancellation: Gray
  - Other: Gray

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 16: Status Badges**

**Steps:**
1. Create credit notes with different statuses
2. View list page

**Expected Result:**
- Draft: Yellow badge
- Issued: Blue badge
- Applied: Green badge
- Void: Gray badge

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 17: Responsive Design**

**Steps:**
1. Resize browser to mobile width (375px)
2. Resize to tablet width (768px)
3. Resize to desktop width (1440px)

**Expected Result:**
- Form adapts to screen size
- Table scrolls horizontally on mobile
- All elements remain accessible
- No overlapping or broken layouts

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 18: Data Persistence**

**Steps:**
1. Create a credit note
2. Refresh the page
3. Navigate back to Credit Notes

**Expected Result:**
- Credit note still appears in list
- All data intact
- Stats still correct

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 19: Multiple Line Items**

**Steps:**
1. Select invoice with 3+ line items
2. Enter different return quantities for each
3. Verify calculations

**Expected Result:**
- Each line calculates correctly
- Subtotal = sum of all line totals
- Tax = sum of all tax amounts
- Total = subtotal + tax

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 20: Restock Toggle**

**Steps:**
1. Create credit note with restock ENABLED
2. Issue credit note
3. Check inventory (should increase)

**Then:**
4. Create another credit note with restock DISABLED
5. Issue credit note
6. Check inventory (should NOT change)

**Expected Result:**
- Restock enabled: Inventory increases
- Restock disabled: Inventory unchanged

**Status:** ✅ PASS / ❌ FAIL

---

## 🐛 BUG REPORTING

If you find any issues, please note:

**Bug #:** ___  
**Description:** _______________________________________________  
**Steps to Reproduce:**
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Expected Behavior:** _______________________________________________  
**Actual Behavior:** _______________________________________________  
**Screenshot:** (if applicable)

---

## 📊 TEST SUMMARY

**Total Tests:** 20  
**Passed:** ___  
**Failed:** ___  
**Pass Rate:** ___%

---

## ✅ ACCEPTANCE CRITERIA

Module is ready for production when:

- ✅ All 20 tests pass
- ✅ No console errors
- ✅ No visual glitches
- ✅ Responsive on all screen sizes
- ✅ Data persists correctly
- ✅ Integrations work (customer, invoice, product)
- ✅ No existing functionality broken
- ✅ Tax calculations accurate
- ✅ Customer ledger updates correctly
- ✅ Inventory updates correctly (if restocking)
- ✅ Invoice status updates correctly

---

## 🚀 NEXT STEPS

After testing:

1. **If all tests pass:**
   - Mark module as production-ready
   - Deploy to staging environment
   - User acceptance testing
   - Production deployment

2. **If tests fail:**
   - Document bugs
   - Prioritize fixes
   - Re-test after fixes
   - Regression testing

---

## 📋 INTEGRATION TESTING

### **Test with Sales Return Module:**
1. Create sales return for an invoice
2. Create credit note for same invoice
3. Verify both work independently
4. Verify customer ledger shows both entries
5. Verify inventory updates correctly

**Status:** ✅ PASS / ❌ FAIL

### **Test with Invoice Module:**
1. Create invoice
2. Create credit note for invoice
3. Verify invoice status updates
4. Verify credited amount tracked
5. Verify remaining balance correct

**Status:** ✅ PASS / ❌ FAIL

### **Test with Customer Module:**
1. Create credit note
2. Check customer overview
3. Verify balance updated
4. Check customer ledger
5. Verify credit entry exists

**Status:** ✅ PASS / ❌ FAIL

---

**Happy Testing! 🎉**
