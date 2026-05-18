import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, FileText, UserPlus, X, Download } from 'lucide-react';
import { getCustomers, getInvoices, createInvoice, updateInvoice, getProducts, createCustomer, type Customer, type Product } from '../../services/api';
import { getCustomerPrice } from '../../services/api';
// ITEM 7A — Pull salesmen via getSalesmen() so newly-added entries
// from the quick-add UI show up without a page reload.
import { getSalesmen, addSalesman, VANS, PAYMENT_METHODS, type Salesman } from '../../constants/data';
import SearchableSelect from '../../components/common/SearchableSelect';
// ITEM 7F — Deposit (bank/cash) account picker for inline Record Payment.
import { getAccounts, type Account } from '../Accounts/ChartOfAccounts';
// ITEM 7G — Real PDF download (mirrors payslip/receipt PDFs).
import { generateInvoicePDF } from '../../utils/invoicePDF';
// ITEM 16 — Escape closes the topmost open inline modal.
import { useEscape } from '../../hooks/useEscape';

interface InvoiceLineItem {
    id: string;
    productId: string;
    product: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    isService?: boolean;
    // ITEM 7D — Per-line discount % and tax %. Default to 0 — when both
    // are 0 across all lines, the header-level Tax Rate + Discount still
    // drive the totals (backward-compat). When any line has a non-zero
    // value, that line contributes to the tax / discount aggregates and
    // overrides the header default for that line.
    lineDiscount?: number;
    lineTaxRate?: number;
}

interface InvoiceFormData {
    customerId: string;
    customerName: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    lineItems: InvoiceLineItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discount: number;
    roundOff: number;
    grandTotal: number;
    notes: string;
    salesmanId: string;
    vanId: string;
    paymentStatus: 'Paid' | 'Unpaid' | 'Advance Paid';
    paymentMethod: string;
    amountPaid: number;
    remainingBalance: number;
    // ITEM 7F — Deposit account for inline Record Payment. Persisted as
    // deposit_account_id on the invoice payload so the journal posting
    // hits the correct Cash/Bank sub-account.
    depositAccountId: string;
}




// FIX 5 — defensive optimistic update of the cached customers list.
// The backend already increments customer.balance on invoice POST
// (per the comment in CustomerList.tsx) — this writes the same
// delta into the localStorage cache so any page reading from cache
// sees the change immediately, without waiting for the next fetch.
// Authoritative server value will overwrite on next getCustomers().

// FIX 6 - defensive optimistic decrement of cached product stock.
// Mirrors FIX 5's pattern.  Writes through to the localStorage key
// productService.ts uses ('zavi_products') so any page reading from
// the cache sees the new stock immediately.  Authoritative server
// value will overwrite on next getProducts().
// Multi-warehouse note: this decrements locations[0] only - if a
// product is split across warehouses we cannot tell which one the
// sale came from.  Reasonable for the single-warehouse default.
function decrementCachedStock(productId: string | number, qty: number) {
    const id = String(productId || '');
    if (!id || !Number.isFinite(qty) || qty <= 0) return;
    try {
        const raw = localStorage.getItem('zavi_products');
        if (!raw) return;
        type LocLite = { currentStock?: number; [k: string]: unknown };
        type ProdLite = { id: string | number; locations?: LocLite[]; [k: string]: unknown };
        const list = JSON.parse(raw) as ProdLite[];
        const updated = list.map(p => {
            if (String(p.id) !== id) return p;
            const locs = Array.isArray(p.locations) ? [...p.locations] : [];
            if (locs.length === 0) return p;
            const cur = Number(locs[0]?.currentStock) || 0;
            locs[0] = { ...locs[0], currentStock: Math.max(0, cur - qty) };
            return { ...p, locations: locs };
        });
        localStorage.setItem('zavi_products', JSON.stringify(updated));
    } catch { /* cache update is best-effort */ }
}

// CLEANUP-1 — Removed bumpCachedCustomerBalance. The PHASE-3 consistency
// check confirmed getCustomers() in production goes straight to the
// backend without merging the localStorage 'customers' cache, so the
// optimistic write was a dead operation. Backend updates customer.balance
// atomically on invoice POST; next refetch shows the correct value.

export default function InvoiceFormPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    // FIX 1 — inline success notice replaces the blocking alert().
    const [savedNotice, setSavedNotice] = useState<string | null>(null);
    const [showNewCustomer, setShowNewCustomer] = useState(false);
    const [newCustName, setNewCustName] = useState('');
    const [newCustPhone, setNewCustPhone] = useState('');
    const [newCustAddress, setNewCustAddress] = useState('');
    const [savingCust, setSavingCust] = useState(false);
    // ITEM 7A — Salesmen state (localStorage-backed via getSalesmen) +
    // quick-add modal state. Mirrors the New Customer pattern.
    const [salesmen, setSalesmen] = useState<Salesman[]>(() => getSalesmen());
    const [showNewSalesman, setShowNewSalesman] = useState(false);
    const [newSalesmanName, setNewSalesmanName] = useState('');
    const [newSalesmanPhone, setNewSalesmanPhone] = useState('');

    // ITEM 7F — Bank/Cash accounts loaded from COA (1110 "Cash & Bank" subtree).
    // Powers the inline Record Payment "Deposit To Account" dropdown.
    const [bankAccounts, setBankAccounts] = useState<Account[]>([]);

    const { id: invoiceIdParam } = useParams<{ id: string }>();
    const locationState = location.state as { customerId?: string; customerName?: string; editMode?: boolean; invoice?: any } | null;
    const isEditMode = !!(locationState?.editMode && locationState?.invoice) || !!(invoiceIdParam && invoiceIdParam !== 'new');
    const existingInvoice = locationState?.invoice || null;
    const prefilledCustomer = locationState;

    const [formData, setFormData] = useState<InvoiceFormData>({
        customerId: prefilledCustomer?.customerId || '',
        customerName: prefilledCustomer?.customerName || '',
        // ITEM 7C — Placeholder; replaced by sequential number via useEffect
        // below once getInvoices() resolves. Was: Date.now().slice(-6) which
        // looked random and didn't increment cleanly across creations.
        invoiceNumber: `INV-000001`,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lineItems: [
            {
                id: '1',
                productId: '',
                product: '',
                description: '',
                quantity: 0,
                rate: 0,
                amount: 0
            }
        ],
        subtotal: 0,
        taxRate: 17,
        taxAmount: 0,
        discount: 0,
        roundOff: 0,
        grandTotal: 0,
        notes: '',
        salesmanId: '',
        vanId: '',
        paymentStatus: 'Unpaid',
        paymentMethod: '',
        amountPaid: 0,
        remainingBalance: 0,
        depositAccountId: '',
    });

    // ITEM 7F — Load bank/cash accounts from COA (1110 subtree). Auto-pick
    // the first sub-account of 1110 so users with a single bank get a sane
    // default without having to open the dropdown.
    useEffect(() => {
        try {
            const all = getAccounts();
            const isUnderCashBank = (a: Account): boolean => {
                if (a.id === '1110') return true;
                let pid = a.parentId;
                while (pid) {
                    if (pid === '1110') return true;
                    const parent = all.find(x => x.id === pid);
                    pid = parent ? parent.parentId : null;
                }
                return false;
            };
            const bank = all.filter(isUnderCashBank);
            setBankAccounts(bank);
            const firstChild = bank.find(a => a.parentId === '1110');
            const fallback = bank.find(a => a.id === '1110');
            const initial = firstChild?.id || fallback?.id || '';
            if (initial) setFormData(prev => ({ ...prev, depositAccountId: prev.depositAccountId || initial }));
        } catch (e) {
            console.warn('Could not load bank accounts from Chart of Accounts:', e);
        }
    }, []);

    // ITEM 16 — Escape closes the New Customer or New Salesman inline
    // modals (whichever is currently open). New Salesman wins precedence
    // because it's the more recent addition (typically on top of the
    // form when both could theoretically be opened, even though only one
    // is visible at a time).
    useEscape(() => setShowNewSalesman(false), showNewSalesman);
    useEscape(() => setShowNewCustomer(false), showNewCustomer);

    // ITEM 7C — Compute the next sequential invoice number on mount.
    // Walks existing invoice numbers like INV-NNNNNN, finds the max,
    // and uses N+1. Only fires for NEW invoices (edit mode keeps the
    // existing number from the loaded record).
    useEffect(() => {
        if (isEditMode) return;
        (async () => {
            try {
                const all = await getInvoices();
                let maxN = 0;
                for (const inv of all) {
                    const m = /INV-(\d+)$/i.exec(String(inv.invoiceNumber || ''));
                    if (m) {
                        const n = parseInt(m[1], 10);
                        if (Number.isFinite(n) && n > maxN) maxN = n;
                    }
                }
                const next = `INV-${String(maxN + 1).padStart(6, '0')}`;
                setFormData(prev => ({ ...prev, invoiceNumber: next }));
            } catch {
                // Keep the placeholder INV-000001 on fetch error.
            }
        })();
    }, [isEditMode]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [customersData, productsData] = await Promise.all([
                    getCustomers(),
                    getProducts()
                ]);
                setCustomers(customersData);
                setProducts(productsData);
                // Populate form when editing - fetch from API if navigated directly by URL
                let invoiceToEdit = existingInvoice;
                if (invoiceIdParam && invoiceIdParam !== 'new' && !invoiceToEdit) {
                    try {
                        const allInvoices = await getInvoices();
                        invoiceToEdit = allInvoices.find((inv: any) => String(inv.id) === String(invoiceIdParam)) || null;
                    } catch { /* ignore */ }
                }
                if (isEditMode && invoiceToEdit) {
                    const inv = invoiceToEdit;
                    setFormData({
                        customerId: String(inv.customerId || ''),
                        customerName: inv.customerName || '',
                        invoiceNumber: inv.invoiceNumber || '',
                        invoiceDate: inv.invoiceDate || new Date().toISOString().split('T')[0],
                        dueDate: inv.dueDate || '',
                        lineItems: (inv.lineItems || []).map((item: any, idx: number) => ({
                            id: String(idx + 1),
                            productId: item.productId || '',
                            product: item.product || '',
                            description: item.description || '',
                            quantity: Number(item.quantity) || 1,
                            rate: Number(item.rate) || 0,
                            amount: Number(item.amount) || 0,
                            isService: false,
                            // ITEM 7D — Preserve per-line discount/tax on edit.
                            lineDiscount: Number(item.lineDiscount ?? item.line_discount ?? 0) || 0,
                            lineTaxRate: Number(item.lineTaxRate ?? item.line_tax_rate ?? 0) || 0,
                        })),
                        subtotal: Number(inv.subtotal) || 0,
                        taxRate: Number(inv.taxRate) || 17,
                        taxAmount: Number(inv.taxAmount) || 0,
                        discount: Number(inv.discount) || 0,
                        roundOff: 0,
                        grandTotal: Number(inv.grandTotal) || 0,
                        notes: inv.notes || '',
                        salesmanId: inv.salesman || '',
                        vanId: inv.van || '',
                        paymentStatus: inv.payment_status || 'Unpaid',
                        paymentMethod: inv.payment_method || 'Cash',
                        amountPaid: Number(inv.amount_paid) || 0,
                        remainingBalance: Number(inv.remaining_balance) || 0,
                        // ITEM 7F — Preserve deposit account on edit.
                        depositAccountId: String(inv.deposit_account_id || ''),
                    });
                }
            } catch (error) {
                console.error('Failed to load data:', error);
                alert('Failed to load customers/products');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // ITEM 7D — Recalc now factors in per-line discount % and per-line tax %.
    // Per-line discount stacks ON TOP of the header-level Discount field.
    // For tax: if a line has a non-zero lineTaxRate, that overrides the
    // header taxRate for that line. Otherwise the header taxRate applies.
    // This keeps backward-compat: setting all lines to 0/0 reproduces the
    // old "header tax + header discount" behavior.
    useEffect(() => {
        const subtotal = formData.lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        const perLineDiscountTotal = formData.lineItems.reduce((sum, item) => {
            const amt = Number(item.amount) || 0;
            const ld = Number(item.lineDiscount) || 0;
            return sum + (amt * ld) / 100;
        }, 0);

        const perLineTaxTotal = formData.lineItems.reduce((sum, item) => {
            const amt = Number(item.amount) || 0;
            const ld = Number(item.lineDiscount) || 0;
            const lt = Number(item.lineTaxRate) || 0;
            // Header taxRate is the default — only swap it out when the line
            // explicitly sets a per-line rate (> 0).
            const effectiveRate = lt > 0 ? lt : Number(formData.taxRate) || 0;
            const net = amt - (amt * ld) / 100;
            return sum + (net * effectiveRate) / 100;
        }, 0);

        const taxAmount = Math.round(perLineTaxTotal * 100) / 100;
        const effectiveDiscount = (Number(formData.discount) || 0) + perLineDiscountTotal;
        const rawTotal = subtotal - effectiveDiscount + taxAmount;
        const grandTotal = rawTotal + (formData.roundOff || 0);
        const remainingBalance = formData.paymentStatus === 'Paid' ? 0 :
            formData.paymentStatus === 'Advance Paid' ? grandTotal - formData.amountPaid :
                grandTotal;

        setFormData(prev => ({
            ...prev,
            subtotal,
            taxAmount,
            grandTotal,
            roundOff: Math.round(subtotal - effectiveDiscount + taxAmount) - (subtotal - effectiveDiscount + taxAmount),
            remainingBalance
        }));
    }, [formData.lineItems, formData.taxRate, formData.discount, formData.paymentStatus, formData.amountPaid]);

    const handleAddLineItem = () => {
        const newItem: InvoiceLineItem = {
            id: Date.now().toString(),
            productId: '',
            product: '',
            description: '',
            quantity: 0,
            rate: 0,
            amount: 0,
            // ITEM 7D — default both per-line fields to 0 so header tax/discount drive totals.
            lineDiscount: 0,
            lineTaxRate: 0,
        };

        setFormData(prev => ({
            ...prev,
            lineItems: [...prev.lineItems, newItem]
        }));
    };

    const handleRemoveLineItem = (id: string) => {
        if (formData.lineItems.length === 1) {
            alert('Invoice must have at least one line item');
            return;
        }

        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.filter(item => item.id !== id)
        }));
    };

    // ITEM 7A — Quick-add salesman handler. Saves to localStorage
    // (via addSalesman) and auto-selects the new salesman in the form.
    const createNewSalesman = () => {
        if (!newSalesmanName.trim()) return;
        try {
            const created = addSalesman({ name: newSalesmanName, phone: newSalesmanPhone });
            setSalesmen(prev => [...prev, created]);
            setFormData(prev => ({ ...prev, salesmanId: created.id }));
            setShowNewSalesman(false);
            setNewSalesmanName('');
            setNewSalesmanPhone('');
        } catch (e) {
            alert('Failed to create salesman.');
        }
    };

    const createNewCustomer = async () => {
        if (!newCustName.trim()) return;
        setSavingCust(true);
        try {
            const newCust = await createCustomer({ name: newCustName, phone: newCustPhone, address: newCustAddress });
            setCustomers(prev => [...prev, newCust]);
            setFormData(prev => ({ ...prev, customerId: newCust.id, customerName: newCust.name }));
            setShowNewCustomer(false);
            setNewCustName(''); setNewCustPhone(''); setNewCustAddress('');
        } catch (e) {
            alert('Failed to create customer. Please try again.');
        } finally {
            setSavingCust(false);
        }
    };

    const addServiceLine = () => {
        const newId = Date.now().toString();
        setFormData(prev => ({
            ...prev,
            lineItems: [...prev.lineItems, {
                id: newId, productId: '', product: 'Service',
                description: '', quantity: 1, rate: 0, amount: 0, isService: true,
                // ITEM 7D — default both per-line fields to 0.
                lineDiscount: 0, lineTaxRate: 0,
            }]
        }));
    };

    const handleProductSelect = (lineId: string, productId: string) => {
        const selectedProduct = products.find(p => String(p.id) === String(productId));

        if (!selectedProduct) return;

        const rate = getCustomerPrice(formData.customerId, String(selectedProduct.id), selectedProduct.unit_price);
        const unitSuffix = selectedProduct.unit ? ` (${selectedProduct.unit})` : '';

        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.map(item => {
                if (item.id !== lineId) return item;

                return {
                    ...item,
                    productId: selectedProduct.id,
                    product: selectedProduct.name,
                    description: `${selectedProduct.name}${unitSuffix}`,
                    rate,
                    amount: item.quantity * rate
                };
            })
        }));
    };

    const handleLineItemChange = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.map(item => {
                if (item.id !== id) return item;

                const updatedItem = { ...item, [field]: value } as InvoiceLineItem;

                if (field === 'quantity' || field === 'rate') {
                    updatedItem.amount = (Number(updatedItem.quantity) || 0) * (Number(updatedItem.rate) || 0);
                }

                return updatedItem;
            })
        }));
    };

    const handleCustomerChange = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        setFormData(prev => ({
            ...prev,
            customerId,
            customerName: customer?.name || ''
        }));
    };

    // ITEM 7G — Download a real PDF of the invoice. Works from in-memory
    // form state so the user can preview before saving (no save side-effects).
    // Mirrors the payslip/receipt PDF utilities.
    const handleDownloadPDF = () => {
        const cust = customers.find(c => c.id === formData.customerId) || null;
        try {
            generateInvoicePDF({
                invoiceNumber: formData.invoiceNumber,
                invoiceDate: formData.invoiceDate,
                dueDate: formData.dueDate,
                customerName: formData.customerName || cust?.name || '—',
                customerCode: (cust as any)?.code || (cust as any)?.customer_code,
                customerAddress: (cust as any)?.address,
                customerPhone: (cust as any)?.phone,
                lineItems: formData.lineItems.map(li => ({
                    product: li.product,
                    description: li.description,
                    quantity: Number(li.quantity) || 0,
                    rate: Number(li.rate) || 0,
                    discount: Number(li.lineDiscount) || 0,
                    taxRate: Number(li.lineTaxRate) || 0,
                    amount: Number(li.amount) || 0,
                })),
                subtotal: formData.subtotal,
                taxAmount: formData.taxAmount,
                discount: formData.discount,
                grandTotal: formData.grandTotal,
                amountPaid: formData.amountPaid,
                remainingBalance: formData.remainingBalance,
                paymentStatus: formData.paymentStatus,
                salesman: salesmen.find(s => s.id === formData.salesmanId)?.name,
                notes: formData.notes,
            });
        } catch (e: any) {
            console.error('PDF download failed:', e);
            alert(`Could not generate PDF: ${e?.message || 'try again.'}`);
        }
    };

    // FIX 3 — Save the invoice with status 'Draft' (no full validation).
    // Minimal sanity check: at least a customer OR a line item.
    const handleSaveDraft = async () => {
        const hasCustomer = !!formData.customerId || !!formData.customerName?.trim();
        const hasLineItem = formData.lineItems.some(i => i.product && i.quantity > 0);
        if (!hasCustomer && !hasLineItem) {
            alert('Add a customer or at least one line item before saving as draft.');
            return;
        }
        try {
            setSaving(true);
            const invoiceData = {
                invoiceNumber: formData.invoiceNumber,
                customerId: formData.customerId,
                customerName: formData.customerName,
                invoiceDate: formData.invoiceDate,
                dueDate: formData.dueDate,
                lineItems: formData.lineItems.map(item => ({
                    product: item.product,
                    description: item.description,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    // ITEM 7D — persist per-line discount/tax for round-trip on edit.
                    lineDiscount: Number(item.lineDiscount) || 0,
                    lineTaxRate: Number(item.lineTaxRate) || 0,
                })),
                subtotal: formData.subtotal,
                taxRate: formData.taxRate,
                taxAmount: formData.taxAmount,
                discount: formData.discount,
                grandTotal: formData.grandTotal,
                notes: formData.notes,
                salesman: salesmen.find(s => s.id === formData.salesmanId)?.name,
                van: VANS.find(v => v.id === formData.vanId)?.name,
                payment_status: 'Unpaid',
                payment_method: formData.paymentMethod,
                amount_paid: 0,
                remaining_balance: formData.grandTotal,
                status: 'Draft' as const,
                // ITEM 7F — Deposit account on draft is mostly informational
                // (draft hasn't recorded payment yet) but we keep the link
                // so it round-trips on subsequent edits.
                deposit_account_id: formData.depositAccountId || undefined,
            };
            const editId = existingInvoice?.id || invoiceIdParam;
            const saved = isEditMode && editId && editId !== 'new'
                ? await updateInvoice(String(editId), invoiceData as any)
                : await createInvoice(invoiceData as any);
            const invNum = (saved as { invoiceNumber?: string })?.invoiceNumber || formData.invoiceNumber;
            setSavedNotice(`${invNum} (draft)`);
            setTimeout(() => navigate('/sales/invoices'), 1500);
        } catch (error: any) {
            console.error('Failed to save draft:', error);
            alert(`Could not save draft: ${error?.message || 'try again.'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!formData.customerId && !formData.customerName) {
            alert('Please select a customer');
            return;
        }

        if (formData.lineItems.some(item => !item.product || item.quantity <= 0 || item.rate <= 0)) {
            alert('Please fill in all line items with valid quantities and rates');
            return;
        }

        if (formData.grandTotal <= 0) {
            alert('Invoice total must be greater than 0');
            return;
        }

        try {
            setSaving(true);

            const invoiceData = {
                invoiceNumber: formData.invoiceNumber,
                customerId: formData.customerId,
                customerName: formData.customerName,
                invoiceDate: formData.invoiceDate,
                dueDate: formData.dueDate,
                lineItems: formData.lineItems.map(item => ({
                    product: item.product,
                    description: item.description,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    // ITEM 7D — persist per-line discount/tax.
                    lineDiscount: Number(item.lineDiscount) || 0,
                    lineTaxRate: Number(item.lineTaxRate) || 0,
                })),
                subtotal: formData.subtotal,
                taxRate: formData.taxRate,
                taxAmount: formData.taxAmount,
                discount: formData.discount,
                grandTotal: formData.grandTotal,
                notes: formData.notes,
                salesman: salesmen.find(s => s.id === formData.salesmanId)?.name,
                van: VANS.find(v => v.id === formData.vanId)?.name,
                payment_status: formData.paymentStatus,
                payment_method: formData.paymentMethod,
                amount_paid: formData.paymentStatus === 'Paid' ? formData.grandTotal : formData.amountPaid,
                remaining_balance: formData.remainingBalance,
                status: (formData.paymentStatus === 'Paid' ? 'Paid' : formData.paymentStatus === 'Advance Paid' ? 'Partial' : 'Unpaid') as any,
                // ITEM 7F — Deposit account for the journal posting.
                deposit_account_id: formData.depositAccountId || undefined,
            };

            const editId = existingInvoice?.id || invoiceIdParam;
            const savedInvoice = isEditMode && editId && editId !== 'new'
                ? await updateInvoice(String(editId), invoiceData)
                : await createInvoice(invoiceData);

            console.log('✅ Invoice saved:', savedInvoice);

            // FIX 6 — decrement each line item's product stock in the cache.
            // (Stock cache is read by the product list views, unlike the
            // customer-balance cache which CLEANUP-1 removed as a dead write.)
            if (!isEditMode) {
                for (const line of formData.lineItems) {
                    if (line.productId) {
                        decrementCachedStock(line.productId, Number(line.quantity) || 0);
                    }
                }
            }

            // FIX 1 — inline emerald banner instead of blocking alert.
            // Show for ~1.5s so the user sees confirmation, then navigate
            // to the customer ledger where the new invoice appears.
            const invNum = (savedInvoice as { invoiceNumber?: string })?.invoiceNumber || formData.invoiceNumber;
            setSavedNotice(invNum);
            setTimeout(() => {
                navigate(`/customers/${formData.customerId}?tab=ledger`);
            }, 1500);
        } catch (error: any) {
            console.error('Failed to save invoice:', error);
            alert(`❌ Failed to save invoice\n\n${error.message || 'Please try again.'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* FIX 1 — success banner (non-blocking) */}
            {savedNotice && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black">✓</div>
                    <div className="flex-1">
                        <p className="text-sm font-black text-emerald-800">Invoice {savedNotice} saved successfully</p>
                        <p className="text-[11px] text-emerald-700">Opening customer ledger…</p>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-[#800020] p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-500" />
                        </button>
                        <div className="w-14 h-14 bg-[#800020] rounded-xl flex items-center justify-center shadow-lg">
                            <FileText size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase">New Invoice</h1>
                            <p className="text-xs text-gray-500 font-semibold mt-1">Create Sales Invoice</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        {/* ITEM 7G — Real PDF download (no browser print dialog). */}
                        <button
                            onClick={handleDownloadPDF}
                            disabled={saving}
                            className="px-6 py-3 bg-white border-2 border-blue-600 text-blue-700 rounded-lg text-sm font-black hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50"
                            title="Download a PDF copy of this invoice"
                        >
                            <Download size={18} />
                            Download PDF
                        </button>
                        <button
                            onClick={handleSaveDraft}
                            disabled={saving || !!savedNotice}
                            className="px-6 py-3 bg-white border-2 border-gray-700 text-gray-700 rounded-lg text-sm font-black hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                            title="Save without submitting — fewer required fields"
                        >
                            <Save size={18} />
                            {saving ? 'Saving…' : 'Save as Draft'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !!savedNotice}
                            className="px-8 py-3 bg-[#800020] text-white rounded-lg text-sm font-black hover:bg-[#600018] flex items-center gap-2 disabled:opacity-50 shadow-xl"
                        >
                            <Save size={18} />
                            {saving ? 'Saving...' : 'Confirm & Save'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md p-8 space-y-8">
                {/* New: Salesman and Van Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b-2 border-gray-200">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-black text-gray-600 uppercase">
                                Salesman <span className="text-red-500">*</span>
                            </label>
                            {/* ITEM 7A — Quick-add new salesman, mirrors New Customer. */}
                            <button type="button" onClick={() => setShowNewSalesman(true)}
                                className="flex items-center gap-1 text-xs font-black text-orange-600 hover:text-orange-800 transition-all">
                                <UserPlus size={12} /> New Salesman
                            </button>
                        </div>
                        <SearchableSelect
                            options={salesmen}
                            value={formData.salesmanId}
                            onChange={(val) => setFormData(p => ({ ...p, salesmanId: val }))}
                            placeholder="Search and select salesman..."
                            displayKey="name"
                        />
                        {showNewSalesman && (
                            <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-black text-orange-700 uppercase">New Salesman</p>
                                    <button onClick={() => setShowNewSalesman(false)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
                                </div>
                                <input type="text" placeholder="Salesman Name *" value={newSalesmanName} onChange={e => setNewSalesmanName(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                                <input type="text" placeholder="Phone (optional)" value={newSalesmanPhone} onChange={e => setNewSalesmanPhone(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                                <button onClick={createNewSalesman} disabled={!newSalesmanName.trim()}
                                    className="w-full py-2 bg-orange-500 text-white text-xs font-black rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-all">
                                    Create &amp; Select Salesman
                                </button>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                            Van / Route
                        </label>
                        <SearchableSelect
                            options={VANS}
                            value={formData.vanId}
                            onChange={(val) => setFormData(p => ({ ...p, vanId: val }))}
                            placeholder="Search and select van..."
                            displayKey="name"
                        />
                    </div>
                </div>

                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b-2 border-gray-200">
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-black text-gray-600 uppercase">Customer <span className="text-red-500">*</span></label>
                                <button type="button" onClick={() => setShowNewCustomer(true)}
                                    className="flex items-center gap-1 text-xs font-black text-orange-600 hover:text-orange-800 transition-all">
                                    <UserPlus size={12} /> New Customer
                                </button>
                            </div>
                            <SearchableSelect
                                options={customers}
                                value={formData.customerId}
                                onChange={handleCustomerChange}
                                placeholder="Search and select customer..."
                                displayKey="name"
                                disabled={loading}
                            />
                            {showNewCustomer && (
                                <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-black text-orange-700 uppercase">New Customer</p>
                                        <button onClick={() => setShowNewCustomer(false)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
                                    </div>
                                    <input type="text" placeholder="Customer Name *" value={newCustName} onChange={e => setNewCustName(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                                    <input type="text" placeholder="Phone" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                                    <input type="text" placeholder="Address" value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                                    <button onClick={createNewCustomer} disabled={savingCust || !newCustName.trim()}
                                        className="w-full py-2 bg-orange-500 text-white text-xs font-black rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-all">
                                        {savingCust ? 'Creating...' : 'Create & Select Customer'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Invoice Date
                            </label>
                            <input
                                type="date"
                                value={formData.invoiceDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Invoice Number
                            </label>
                            <input
                                type="text"
                                value={formData.invoiceNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-mono font-black focus:border-[#800020] focus:outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] focus:outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <h3 className="text-sm font-black text-gray-700 uppercase mb-4">Line Items</h3>

                    <div className="overflow-x-auto border-2 border-gray-200 rounded-lg">
                        <table className="w-full">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-black text-gray-700 uppercase w-[18%]">Product</th>
                                    <th className="px-4 py-3 text-left text-xs font-black text-gray-700 uppercase w-[28%]">Description</th>
                                    <th className="px-3 py-3 text-center text-xs font-black text-gray-700 uppercase w-20">Qty</th>
                                    <th className="px-3 py-3 text-center text-xs font-black text-gray-700 uppercase w-28">Rate</th>
                                    {/* ITEM 7D — Per-line discount & tax. Optional; 0 = use header values. */}
                                    <th className="px-2 py-3 text-center text-xs font-black text-gray-700 uppercase w-20" title="Per-line discount % (stacks on top of header discount)">Disc %</th>
                                    <th className="px-2 py-3 text-center text-xs font-black text-gray-700 uppercase w-20" title="Per-line tax % (overrides header rate when > 0)">Tax %</th>
                                    <th className="px-4 py-3 text-right text-xs font-black text-gray-700 uppercase w-28">Amount</th>
                                    <th className="px-3 py-3 text-center text-xs font-black text-gray-700 uppercase w-16">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {formData.lineItems.map((item) => {
                                    // ITEM 7E — Look up the selected product to surface its
                                    // available stock right next to the row. Warn (rose) when
                                    // the quantity entered exceeds stock so the user spots it
                                    // before submitting.
                                    const selectedProd = products.find(p => String(p.id) === String(item.productId));
                                    const availableStock = selectedProd ? Number((selectedProd as any).stock ?? (selectedProd as any).current_stock ?? 0) : null;
                                    const qty = Number(item.quantity) || 0;
                                    const overStock = availableStock !== null && qty > availableStock;
                                    return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <SearchableSelect
                                                options={products}
                                                value={item.productId}
                                                onChange={(productId) => handleProductSelect(item.id, productId)}
                                                placeholder="Search product..."
                                                displayKey="name"
                                            />
                                            {/* ITEM 7E — Stock badge under the product selector. */}
                                            {selectedProd && availableStock !== null && (
                                                <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    availableStock === 0
                                                        ? 'bg-rose-100 text-rose-700'
                                                        : availableStock < 10
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                    In stock: {availableStock} {(selectedProd as any).unit || 'units'}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <textarea
                                                value={item.description}
                                                onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                                                placeholder="Item description..."
                                                rows={2}
                                                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#800020] focus:outline-none resize-none"
                                            />
                                        </td>

                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                value={item.quantity || ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                min="1"
                                                placeholder="Enter quantity"
                                                className={`w-full border-2 rounded-lg px-3 py-2 text-sm text-center font-mono font-bold focus:outline-none ${
                                                    overStock
                                                        ? 'border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-500'
                                                        : 'border-gray-300 focus:border-[#800020]'
                                                }`}
                                            />
                                            {/* ITEM 7E — Over-stock warning. */}
                                            {overStock && (
                                                <p className="text-[10px] font-bold text-rose-600 mt-1 text-center">
                                                    Only {availableStock} in stock
                                                </p>
                                            )}
                                        </td>

                                        <td className="px-3 py-3">
                                            <input
                                                type="number"
                                                value={item.rate || ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="0.01"
                                                placeholder="Enter rate"
                                                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm text-center font-mono font-bold focus:border-[#800020] focus:outline-none"
                                            />
                                        </td>

                                        {/* ITEM 7D — per-line Discount % */}
                                        <td className="px-2 py-3">
                                            <input
                                                type="number"
                                                value={item.lineDiscount || ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'lineDiscount', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                placeholder="0"
                                                className="w-full border-2 border-gray-300 rounded-lg px-2 py-2 text-sm text-center font-mono font-bold focus:border-[#800020] focus:outline-none"
                                            />
                                        </td>

                                        {/* ITEM 7D — per-line Tax % */}
                                        <td className="px-2 py-3">
                                            <input
                                                type="number"
                                                value={item.lineTaxRate || ''}
                                                onChange={(e) => handleLineItemChange(item.id, 'lineTaxRate', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                placeholder="0"
                                                className="w-full border-2 border-gray-300 rounded-lg px-2 py-2 text-sm text-center font-mono font-bold focus:border-[#800020] focus:outline-none"
                                            />
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono font-black text-base text-gray-900">
                                            {item.amount.toLocaleString()}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleRemoveLineItem(item.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remove item"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button onClick={handleAddLineItem}
                            className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center gap-2">
                            <Plus size={18} /> Add Product
                        </button>
                        <button onClick={addServiceLine}
                            className="px-6 py-3 bg-white border-2 border-blue-300 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-50 flex items-center gap-2">
                            <Plus size={18} /> Add Service / Cargo
                        </button>
                    </div>
                </div>

                {/* Payment Options Section */}
                <div className="border-t-2 border-gray-200 pt-8 mt-8">
                    <h3 className="text-sm font-black text-gray-700 uppercase mb-6 flex items-center gap-2">
                        <div className="w-2 h-6 bg-[#800020]"></div>
                        Payment & Terms
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300">
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Payment Status</label>
                            <select
                                value={formData.paymentStatus}
                                onChange={(e) => setFormData(p => ({ ...p, paymentStatus: e.target.value as any, paymentMethod: '', amountPaid: 0 }))}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] outline-none bg-white transition-all"
                            >
                                <option value="Unpaid">Unpaid (Full Credit)</option>
                                <option value="Paid">Paid (Full Payment)</option>
                                <option value="Advance Paid">Advance / Partial Paid</option>
                            </select>
                        </div>

                        {(formData.paymentStatus === 'Paid' || formData.paymentStatus === 'Advance Paid') && (
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Payment Method</label>
                                <select
                                    value={formData.paymentMethod}
                                    onChange={(e) => setFormData(p => ({ ...p, paymentMethod: e.target.value }))}
                                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] outline-none bg-white transition-all shadow-sm"
                                    required
                                >
                                    <option value="">-- Select Method --</option>
                                    {PAYMENT_METHODS.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* ITEM 7F — Deposit To Account (COA 1110 subtree). Tells the
                            ledger posting which Cash/Bank sub-account to debit. */}
                        {(formData.paymentStatus === 'Paid' || formData.paymentStatus === 'Advance Paid') && (
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Deposit To Account</label>
                                {bankAccounts.length === 0 ? (
                                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug">
                                        No bank or cash accounts configured. Add sub-accounts under <strong>Finance → Chart of Accounts → Cash &amp; Bank (1110)</strong>.
                                    </div>
                                ) : (
                                    <select
                                        value={formData.depositAccountId}
                                        onChange={(e) => setFormData(p => ({ ...p, depositAccountId: e.target.value }))}
                                        className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#800020] outline-none bg-white transition-all shadow-sm"
                                        required
                                    >
                                        <option value="">-- Select Account --</option>
                                        {bankAccounts.map(a => (
                                            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}

                        {formData.paymentStatus === 'Advance Paid' && (
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Amount Paid</label>
                                <input
                                    type="number"
                                    value={formData.amountPaid || ''}
                                    onChange={(e) => setFormData(p => ({ ...p, amountPaid: parseFloat(e.target.value) || 0 }))}
                                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-mono font-black focus:border-[#800020] outline-none transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Totals & Summary */}
                <div className="border-t-2 border-gray-200 pt-8">
                    <div className="flex flex-col md:flex-row gap-8 justify-between">
                        {/* Notes Area */}
                        <div className="w-full md:w-1/2">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">
                                Internal Notes & Terms
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                rows={6}
                                placeholder="Add terms & conditions, delivery notes, or internal comments..."
                                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm font-medium focus:border-[#800020] focus:ring-4 focus:ring-[#800020]/5 outline-none resize-none transition-all shadow-inner bg-gray-50/50"
                            />
                        </div>

                        {/* Totals Card */}
                        <div className="w-full md:w-5/12 bg-white rounded-2xl border-2 border-gray-900 overflow-hidden shadow-2xl skew-y-0 translate-z-0">
                            <div className="bg-gray-900 px-6 py-4">
                                <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Summary & Totals</h4>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center group">
                                    <span className="text-xs font-bold text-gray-500 uppercase group-hover:text-gray-900 transition-colors">Subtotal</span>
                                    <span className="text-lg font-mono font-black text-gray-900">{formData.subtotal.toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-gray-500 uppercase group-hover:text-gray-900 transition-colors">Tax Rate</span>
                                        <div className="flex items-center bg-gray-100 rounded-md px-2 border border-gray-200">
                                            <input
                                                type="number"
                                                value={formData.taxRate}
                                                onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                                                className="w-12 bg-transparent py-1 text-xs text-right font-mono font-black focus:outline-none"
                                                min="0"
                                            />
                                            <span className="text-[10px] font-black text-gray-400 ml-1">%</span>
                                        </div>
                                    </div>
                                    <span className="text-lg font-mono font-black text-gray-900">{formData.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>

                                <div className="flex justify-between items-center group">
                                    <span className="text-xs font-bold text-gray-500 uppercase group-hover:text-gray-900 transition-colors">Discount</span>
                                    <input
                                        type="number"
                                        value={formData.discount || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                                        className="w-32 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right font-mono font-black focus:border-[#800020] outline-none transition-all bg-gray-50"
                                        placeholder="0"
                                    />
                                </div>

                                <div className="flex justify-between items-center group">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-500 uppercase group-hover:text-gray-900 transition-colors">Round Off</span>
                                        <button type="button"
                                            onClick={() => setFormData(prev => { const base = prev.subtotal + prev.taxAmount - prev.discount; const roff = parseFloat((Math.round(base) - base).toFixed(2)); return { ...prev, roundOff: roff }; })}
                                            className="text-[10px] px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold text-gray-500 transition-all">Auto</button>
                                    </div>
                                    <input
                                        type="number"
                                        value={formData.roundOff ? parseFloat(formData.roundOff.toFixed(2)) : ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, roundOff: parseFloat(e.target.value) || 0 }))}
                                        className="w-32 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right font-mono font-black focus:border-[#800020] outline-none transition-all bg-gray-50"
                                        placeholder="0.00"
                                        step="0.01"
                                    />
                                </div>

                                <div className="pt-4 border-t-2 border-gray-900 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-black text-gray-900 uppercase tracking-widest">Grand Total</span>
                                        <span className="text-3xl font-mono font-black text-[#800020]">{formData.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    {formData.paymentStatus !== 'Unpaid' && (
                                        <div className="flex justify-between items-center bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                                            <span className="text-[10px] font-black text-emerald-700 uppercase">Paid Amount</span>
                                            <span className="text-sm font-mono font-black text-emerald-800">
                                                {formData.paymentStatus === 'Paid' ? formData.grandTotal.toLocaleString() : formData.amountPaid.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center bg-[#800020] px-4 py-3 rounded-xl border border-white/20 shadow-lg mt-2">
                                        <span className="text-xs font-black text-white uppercase tracking-widest">Balance Due</span>
                                        <span className="text-2xl font-mono font-black text-white">{formData.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}