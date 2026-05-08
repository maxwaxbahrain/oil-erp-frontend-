# Van Sales Module - Testing Guide

## 🧪 Complete Testing Checklist

### **Phase 1: Service Layer Testing**

#### **vanSalesService.ts**
- [ ] Receipt number generation
  - [ ] Format is correct (VS-YYYYMMDD-XXXX)
  - [ ] Counter increments properly
  - [ ] Counter resets daily
  - [ ] No duplicate receipt numbers

- [ ] Sale creation
  - [ ] Creates sale with all required fields
  - [ ] Calculates totals correctly
  - [ ] Calculates tax correctly
  - [ ] Calculates change for cash payments
  - [ ] Calculates outstanding balance
  - [ ] Sets payment status correctly
  - [ ] Updates product inventory
  - [ ] Hydrates customer and van data

- [ ] Data retrieval
  - [ ] getAll returns all sales
  - [ ] getById returns correct sale
  - [ ] getByReceipt finds by receipt number
  - [ ] getByVan filters correctly
  - [ ] getByCustomer filters correctly
  - [ ] getByDateRange filters correctly

- [ ] Statistics
  - [ ] getStats calculates totals correctly
  - [ ] getDailySummary groups by van and date
  - [ ] Payment method counts are accurate

- [ ] Sale cancellation
  - [ ] Status updates to cancelled
  - [ ] Inventory is restored
  - [ ] Notes are updated

#### **receiptService.ts**
- [ ] Receipt generation
  - [ ] generateReceiptData creates correct structure
  - [ ] Company info is included
  - [ ] All sale data is present

- [ ] Formatting
  - [ ] formatCurrency displays USD correctly
  - [ ] formatDateTime shows readable format
  - [ ] formatDate shows date only

- [ ] HTML generation
  - [ ] generateReceiptHTML creates valid HTML
  - [ ] All items are listed
  - [ ] Totals are correct
  - [ ] Payment details show
  - [ ] Change/outstanding displays correctly

- [ ] Printing
  - [ ] printReceipt opens print dialog
  - [ ] Receipt prints correctly
  - [ ] Print window can be closed

---

### **Phase 2: Component Testing**

#### **ProductSelector Component**
- [ ] Product search
  - [ ] Search filters by name
  - [ ] Search filters by SKU
  - [ ] Search filters by category
  - [ ] Dropdown shows/hides correctly
  - [ ] Clicking outside closes dropdown

- [ ] Adding products
  - [ ] Clicking product adds to list
  - [ ] Adding existing product increments quantity
  - [ ] New items have correct default values
  - [ ] Search clears after adding

- [ ] Item management
  - [ ] Quantity input updates line total
  - [ ] Price input updates line total
  - [ ] Remove button deletes item
  - [ ] Empty state shows when no items

- [ ] Display
  - [ ] Table shows all columns
  - [ ] Data displays correctly
  - [ ] Responsive on mobile
  - [ ] Hover effects work

#### **PaymentSection Component**
- [ ] Payment method selection
  - [ ] All 4 methods display
  - [ ] Selection updates state
  - [ ] Selected method is highlighted
  - [ ] Icons show correctly

- [ ] Amount input
  - [ ] Accepts decimal numbers
  - [ ] Updates on change
  - [ ] Quick amount buttons work (cash only)
  - [ ] Exact button sets total amount

- [ ] Calculations
  - [ ] Subtotal displays correctly
  - [ ] Tax calculates at 5%
  - [ ] Total is subtotal + tax
  - [ ] Change calculates for cash
  - [ ] Outstanding balance shows for partial

- [ ] Auto-fill
  - [ ] Card payment auto-fills total
  - [ ] Digital payment auto-fills total
  - [ ] Cash doesn't auto-fill
  - [ ] Credit allows zero payment

- [ ] Validation
  - [ ] Warning shows if amount < total (non-credit)
  - [ ] Change shows in green
  - [ ] Outstanding shows in orange
  - [ ] Credit note displays

#### **ReceiptPrint Component**
- [ ] Modal display
  - [ ] Modal appears on success
  - [ ] Backdrop darkens screen
  - [ ] Close button works
  - [ ] Click outside doesn't close

- [ ] Receipt preview
  - [ ] All data displays
  - [ ] Formatting is correct
  - [ ] Scrollable if long
  - [ ] Professional appearance

- [ ] Actions
  - [ ] Print button opens print dialog
  - [ ] Download button works
  - [ ] Buttons are styled correctly
  - [ ] Hover effects work

---

### **Phase 3: Page Testing**

#### **VanSalesForm Page**
- [ ] Data loading
  - [ ] Vans load on mount
  - [ ] Customers load on mount
  - [ ] Loading spinner shows
  - [ ] Error handling works

- [ ] Van selection
  - [ ] Dropdown shows all vans
  - [ ] Selection updates state
  - [ ] Driver name auto-fills
  - [ ] Required validation works

- [ ] Customer selection
  - [ ] SearchableSelect works
  - [ ] Search filters customers
  - [ ] Selection updates state
  - [ ] Required validation works

- [ ] Product management
  - [ ] ProductSelector integrates correctly
  - [ ] Items update in real-time
  - [ ] Totals recalculate on change

- [ ] Payment section
  - [ ] PaymentSection integrates correctly
  - [ ] Totals display correctly
  - [ ] Payment method selection works
  - [ ] Amount input works

- [ ] Form submission
  - [ ] Validation prevents empty van
  - [ ] Validation prevents empty customer
  - [ ] Validation prevents no products
  - [ ] Validation prevents insufficient payment
  - [ ] Loading state shows during save
  - [ ] Success shows receipt modal
  - [ ] Error shows alert

- [ ] Receipt modal
  - [ ] Appears after successful sale
  - [ ] Shows correct sale data
  - [ ] Print works
  - [ ] Close options work
  - [ ] "Another sale" resets form
  - [ ] "No" navigates to history

- [ ] Navigation
  - [ ] Back button works
  - [ ] Cancel button works
  - [ ] Breadcrumbs work

#### **VanSalesHistory Page**
- [ ] Data loading
  - [ ] Sales load on mount
  - [ ] Loading spinner shows
  - [ ] Empty state shows if no sales

- [ ] Statistics
  - [ ] Total sales count correct
  - [ ] Total amount correct
  - [ ] Cash sales count correct
  - [ ] Credit sales count correct
  - [ ] Stats update with filters

- [ ] Search
  - [ ] Filters by receipt number
  - [ ] Filters by customer name
  - [ ] Filters by driver name
  - [ ] Case insensitive
  - [ ] Real-time filtering

- [ ] Filters
  - [ ] Van filter works
  - [ ] Payment method filter works
  - [ ] Status filter works
  - [ ] Multiple filters combine
  - [ ] Clear filters resets all
  - [ ] Active filter indicator shows

- [ ] Table display
  - [ ] All columns show
  - [ ] Data formats correctly
  - [ ] Badges color-coded
  - [ ] Hover effects work
  - [ ] Responsive on mobile

- [ ] Actions
  - [ ] View receipt button works
  - [ ] Receipt prints correctly
  - [ ] New sale button navigates
  - [ ] Refresh button reloads

- [ ] Empty states
  - [ ] No sales message shows
  - [ ] No results message shows
  - [ ] Helpful text displays

#### **VanSalesDashboard Page**
- [ ] Navigation buttons
  - [ ] "VIEW HISTORY" navigates to history
  - [ ] "NEW VAN SALE" navigates to form
  - [ ] Buttons styled correctly
  - [ ] Existing functionality unchanged

---

### **Phase 4: Integration Testing**

#### **Routing**
- [ ] `/van-sales` loads dashboard
- [ ] `/van-sales/new` loads form
- [ ] `/van-sales/history` loads history
- [ ] Navigation between pages works
- [ ] Browser back/forward works
- [ ] Direct URL access works

#### **Data Flow**
- [ ] Form → Service → Storage
- [ ] Storage → Service → History
- [ ] Customer data integrates
- [ ] Product data integrates
- [ ] Van data integrates
- [ ] Inventory updates correctly

#### **Cross-Module Integration**
- [ ] Customer list loads correctly
- [ ] Product catalog loads correctly
- [ ] Van list loads correctly
- [ ] No conflicts with existing sales
- [ ] No conflicts with POD system
- [ ] No conflicts with invoices

---

### **Phase 5: User Experience Testing**

#### **Workflow Testing**
- [ ] Complete sale workflow (happy path)
  1. Navigate to form
  2. Select van
  3. Select customer
  4. Add products
  5. Enter payment
  6. Submit sale
  7. Print receipt
  8. Create another sale

- [ ] Error handling workflow
  1. Try to submit without van
  2. Try to submit without customer
  3. Try to submit without products
  4. Try to submit with insufficient payment
  5. Verify error messages

- [ ] Search and filter workflow
  1. Navigate to history
  2. Search for sale
  3. Apply filters
  4. View receipt
  5. Clear filters

#### **Performance Testing**
- [ ] Page loads quickly
- [ ] Search is responsive
- [ ] Filters apply instantly
- [ ] No lag when adding products
- [ ] Receipt generates quickly
- [ ] Print dialog opens fast

#### **Accessibility Testing**
- [ ] Keyboard navigation works
- [ ] Tab order is logical
- [ ] Enter submits forms
- [ ] Escape closes modals
- [ ] Focus indicators visible
- [ ] Color contrast sufficient

#### **Responsive Testing**
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] All layouts work
- [ ] No horizontal scroll

---

### **Phase 6: Data Validation Testing**

#### **Receipt Number**
- [ ] Format: VS-YYYYMMDD-XXXX
- [ ] Unique per sale
- [ ] Sequential numbering
- [ ] Date-based grouping

#### **Calculations**
- [ ] Subtotal = sum of line totals
- [ ] Tax = subtotal × 0.05
- [ ] Total = subtotal + tax
- [ ] Change = received - total (if cash)
- [ ] Outstanding = total - received

#### **Payment Status**
- [ ] "paid" if received >= total
- [ ] "partial" if 0 < received < total
- [ ] "unpaid" if received = 0
- [ ] Correct for all payment methods

#### **Inventory Updates**
- [ ] Stock decreases on sale
- [ ] Stock increases on cancellation
- [ ] Correct quantities
- [ ] No negative stock

---

### **Phase 7: Edge Cases**

- [ ] Sale with 1 item
- [ ] Sale with 10+ items
- [ ] Sale with $0.01 amount
- [ ] Sale with $10,000+ amount
- [ ] Cash payment with exact change
- [ ] Cash payment with large change
- [ ] Credit sale with $0 received
- [ ] Partial payment
- [ ] Same product added multiple times
- [ ] Product with $0 price
- [ ] Product with decimal quantity
- [ ] Very long customer name
- [ ] Very long product name
- [ ] Special characters in notes
- [ ] Empty notes field

---

## ✅ Test Results Template

```
Date: ___________
Tester: ___________

| Test Category | Pass | Fail | Notes |
|---------------|------|------|-------|
| Service Layer |      |      |       |
| Components    |      |      |       |
| Pages         |      |      |       |
| Integration   |      |      |       |
| UX/Workflow   |      |      |       |
| Data Validation |    |      |       |
| Edge Cases    |      |      |       |

Overall Status: [ ] PASS [ ] FAIL

Issues Found:
1. 
2. 
3. 

Recommendations:
1. 
2. 
3. 
```

---

## 🐛 Known Issues

*None at this time - pending testing*

---

## 📝 Testing Notes

- Test with real data when possible
- Test on multiple browsers (Chrome, Firefox, Safari)
- Test with different screen sizes
- Test with slow network (throttling)
- Test with localStorage cleared
- Test with many sales records (100+)
- Test concurrent operations
- Test browser refresh during operations

---

## 🎯 Success Criteria

All tests must pass before marking module as complete:
- ✅ All service functions work correctly
- ✅ All components render and function
- ✅ All pages load and navigate
- ✅ All integrations work seamlessly
- ✅ User workflows are smooth
- ✅ Data validation is accurate
- ✅ Edge cases are handled
- ✅ No console errors
- ✅ No lint errors
- ✅ Responsive on all devices
