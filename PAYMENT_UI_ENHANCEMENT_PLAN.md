# Payment & UI Enhancement Implementation Plan

## Phase 1: Bug Fixes ✅
### Sales Order Form
- [x] Remove default quantity value (1 → empty)
- [x] Add placeholder text for quantity field
- [x] Add validation for quantity > 0

### Invoice Form  
- [x] Remove default quantity value (1 → empty)
- [x] Remove default rate value (0 → empty)
- [x] Add placeholder text for both fields

## Phase 2: Payment Form Enhancement 🔄
### Invoice Linking
- [ ] Add Invoice Number dropdown field
- [ ] Fetch unpaid/partially paid invoices for selected customer
- [ ] Implement search functionality in dropdown
- [ ] Display invoice details on selection (amount, date, balance)
- [ ] Link payment to invoice in database
- [ ] Update invoice status when payment received

### Advance Payment
- [ ] Add "Advance Payment" checkbox/toggle
- [ ] Disable invoice selection when advance is checked
- [ ] Store advance payment separately
- [ ] Show available advance balance
- [ ] Option to apply advance to future invoices

### Business Logic
- [ ] Validate payment doesn't exceed invoice balance
- [ ] Calculate remaining balance after payment
- [ ] Auto-update invoice status
- [ ] Handle partial payments
- [ ] Track payment history per invoice

## Phase 3: UI/UX Redesign - QuickBooks Theme 🎨
### Color Palette Implementation
```css
Primary: #45B854 (Success Green)
Secondary: #0077C8 (QuickBooks Blue)
Background: #F8F9FA (Light Gray)
Text: #2C3E50 (Dark Gray)
Borders: #CED4DA (Light Gray)
```

### Forms to Update
1. **Sales Order Form**
   - [ ] Update header with new color scheme
   - [ ] Redesign buttons (green primary, gray secondary)
   - [ ] Update input fields styling
   - [ ] Add proper shadows and borders
   - [ ] Improve spacing and layout

2. **Invoice Form**
   - [ ] Update header with new color scheme
   - [ ] Redesign buttons
   - [ ] Update table styling
   - [ ] Add hover effects
   - [ ] Improve responsive design

3. **Payment Receipt Form**
   - [ ] Complete redesign with QuickBooks theme
   - [ ] Add invoice dropdown
   - [ ] Add advance payment toggle
   - [ ] Update button styling
   - [ ] Add proper form validation

### Design Components
- [ ] Create reusable button components
- [ ] Create form input components
- [ ] Create card/section components
- [ ] Add icons to buttons
- [ ] Implement smooth transitions

## Phase 4: Testing & Validation ✓
- [ ] Test invoice linking functionality
- [ ] Test advance payment option
- [ ] Test form validations
- [ ] Test responsive design
- [ ] Test accessibility (keyboard navigation)
- [ ] Visual consistency check
- [ ] Cross-browser testing

## Implementation Order
1. ✅ Bug fixes (Sales Order & Invoice forms)
2. 🔄 Payment form enhancement (invoice linking + advance)
3. 🎨 UI redesign (all 3 forms)
4. ✓ Testing and validation

## Files to Modify
- `/src/pages/Sales/SalesOrderFormPage.tsx`
- `/src/pages/Sales/InvoiceFormPage.tsx`
- `/src/pages/Customers/PaymentReceipt.tsx`
- `/src/services/api.ts` (add invoice fetching methods)
- `/src/index.css` (add QuickBooks theme styles)

## Success Criteria
✅ No default values in quantity/rate fields
✅ Invoice linking works correctly
✅ Advance payment option functional
✅ Professional QuickBooks-inspired design
✅ Consistent styling across all forms
✅ All validations working
✅ Responsive and accessible
