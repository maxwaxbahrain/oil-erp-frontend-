# 🧪 SALES RETURN MODULE - TESTING GUIDE

**Server Running:** http://localhost:5174/  
**Date:** January 8, 2026

---

## 🚀 QUICK START TESTING

### **Step 1: Access the Module**

1. Open browser: **http://localhost:5174/**
2. Navigate to **Sales → Sales Returns** in the sidebar
3. You should see the Sales Returns list page

---

## ✅ TEST SCENARIOS

### **Test 1: View Sales Returns List**

**Expected Result:**
- Empty state message: "No Returns Found"
- Stats cards showing zeros
- "New Return" button visible
- Search and filter controls visible

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 2: Create First Sales Return**

**Steps:**
1. Click **"New Return"** button
2. Select a **Customer** from dropdown
3. Select an **Invoice** (must be within 30 days)
4. Verify return number auto-generates (RET-XXXXXX)
5. Add a product:
   - Click "Add Line Item"
   - Select product from dropdown
   - Enter quantity (e.g., 5)
   - Verify price auto-fills
   - Verify total calculates
6. Select **Return Reason** (e.g., "Defective/Damaged Product")
7. Select **Refund Method** (e.g., "Cash")
8. Add optional notes
9. Click **"Process Return"**

**Expected Result:**
- Success alert appears
- Redirects to list page
- Return appears in table
- Stats update

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 3: 30-Day Policy Validation**

**Steps:**
1. Create a test invoice with date > 30 days ago
2. Try to create a return for that invoice
3. Select customer
4. Check invoice dropdown

**Expected Result:**
- Old invoice should NOT appear in dropdown
- Message: "No Eligible Invoices (30-day policy)"

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 4: Form Validation**

**Test 4a: Missing Customer**
1. Click "New Return"
2. Click "Process Return" without selecting customer
3. **Expected:** Alert "Please select a customer"

**Test 4b: Missing Invoice**
1. Select customer
2. Click "Process Return" without selecting invoice
3. **Expected:** Alert "Please select an invoice"

**Test 4c: No Products**
1. Select customer and invoice
2. Click "Process Return" without adding products
3. **Expected:** Alert "Please add at least one product to return"

**Test 4d: Zero Quantity**
1. Add product but leave quantity as 0
2. Click "Process Return"
3. **Expected:** Alert "Please fill in all line items with valid quantities"

**Test 4e: Missing Return Reason**
1. Add product with valid quantity
2. Don't select return reason
3. Click "Process Return"
4. **Expected:** Alert "Please select a return reason"

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 5: Inventory Update**

**Steps:**
1. Note current stock of a product (e.g., "Bettano 15W40")
2. Create a return for 10 units of that product
3. Go to **Products** page
4. Check the product's stock

**Expected Result:**
- Stock should increase by 10 units
- Stock update should be in Main Warehouse location

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 6: Customer Ledger Update**

**Steps:**
1. Note customer's current balance
2. Create a return for $500
3. Go to **Customers** page
4. Click on the customer
5. Go to **Ledger** tab

**Expected Result:**
- New ledger entry with type "credit"
- Amount: $500
- Description: "Sales Return - [Reason]"
- Reference: Return number (RET-XXXXXX)
- Customer balance should decrease by $500

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 7: Search and Filter**

**Steps:**
1. Create 2-3 returns
2. Use search bar to search by:
   - Return number
   - Customer name
   - Invoice number
3. Use filter dropdown to filter by status

**Expected Result:**
- Search filters results correctly
- Filter shows only matching status
- Results update in real-time

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 8: Stats Dashboard**

**Steps:**
1. Create multiple returns with different amounts
2. Check stats cards

**Expected Result:**
- **Total Returns:** Correct count
- **Total Refunded:** Sum of all refund amounts
- **Return Rate:** Percentage (returns / invoices)
- **This Month:** Count of returns this month

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 9: Refund Method Tracking**

**Steps:**
1. Create returns with different refund methods:
   - Cash
   - Bank Transfer
   - Credit Note
   - Cheque
2. View list page

**Expected Result:**
- Each return shows correct refund method icon
- Icons: 💵 Cash, 🏦 Bank Transfer, 📝 Credit Note, ✅ Cheque

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 10: Return Number Generation**

**Steps:**
1. Create return from invoice "INV-123456"
2. Check generated return number

**Expected Result:**
- Return number should be "RET-123456"
- Auto-generated and read-only

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 11: Multiple Line Items**

**Steps:**
1. Create return with 3 different products
2. Add different quantities for each
3. Verify refund amount calculation

**Expected Result:**
- All products appear in table
- Each calculates correctly (qty × price)
- Total refund = sum of all line items

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 12: Remove Line Item**

**Steps:**
1. Add 3 line items
2. Click trash icon on middle item
3. Verify it's removed
4. Try to remove when only 1 item remains

**Expected Result:**
- Item removes successfully
- Refund amount recalculates
- Cannot remove last item (alert appears)

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 13: Responsive Design**

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

### **Test 14: Return Date Validation**

**Steps:**
1. Try to set return date to future date
2. Try to set return date before invoice date

**Expected Result:**
- Cannot select future date (max = today)
- System validates on submit if date < invoice date

**Status:** ✅ PASS / ❌ FAIL

---

### **Test 15: Data Persistence**

**Steps:**
1. Create a return
2. Refresh the page
3. Navigate back to Sales Returns

**Expected Result:**
- Return still appears in list
- All data intact
- Stats still correct

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

**Total Tests:** 15  
**Passed:** ___  
**Failed:** ___  
**Pass Rate:** ___%

---

## ✅ ACCEPTANCE CRITERIA

Module is ready for production when:

- ✅ All 15 tests pass
- ✅ No console errors
- ✅ No visual glitches
- ✅ Responsive on all screen sizes
- ✅ Data persists correctly
- ✅ Integrations work (customer, product, invoice)
- ✅ No existing functionality broken

---

## 🚀 NEXT STEPS

After testing:

1. **If all tests pass:**
   - Mark module as production-ready
   - Deploy to staging environment
   - User acceptance testing

2. **If tests fail:**
   - Document bugs
   - Prioritize fixes
   - Re-test after fixes

---

**Happy Testing! 🎉**
