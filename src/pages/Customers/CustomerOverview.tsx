import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    FileText,
    DollarSign,
    ShoppingCart,
    Download,
    FileDown,
    X,
    Eye,
    CheckCircle,
    Receipt,
    Share2,
    ChevronDown,
    MessageCircle,
    Smartphone,
    Mail,
    Link2,
    Edit2,
} from 'lucide-react';
// ITEM 16 — Escape closes the payment / invoice preview modals.
import { useEscape } from '../../hooks/useEscape';
import {
    getCustomerInvoices,
    getCustomerSalesOrders,
    convertOrderToInvoice,
    voidPayment,
    type Invoice,
    type SalesOrder
} from '../../services/api';
import {
    getCustomers,
    getCustomerPayments,
    getCustomerLedger,
    type Customer,
    type Payment
} from '../../services/customerService';
import { getCustomerCreditNotes, updateCreditNote, type CreditNote } from '../../services/creditNoteService';
// STEP 11B — load customer billable expenses for the Unbilled tab.
import { saveExpense, type Expense } from '../../services/expenseService';
import { getCompanySettings , getSystemSettings } from '../../services/settingsService';
import {
    downloadInvoicePDF,
    downloadInvoiceWord,
    shareInvoicePDF,
    type SharePdfResult,
} from '../../services/invoiceDocumentService';
import { WORLD_CURRENCIES } from '../../constants/currencies';
import SearchableSelect from '../../components/common/SearchableSelect';
import PaymentReceipt from './PaymentReceipt';

interface CustomerStats {
    outstandingBalance: number;
    totalSalesYTD: number;
    creditLimit: number;
    creditUtilization: number;
    overdueAmount: number;
    overdueDays: number;
    lastPaymentAmount: number;
    lastPaymentDate: string;
    lastInvoiceDate: string;
}

interface LedgerEntry {
    id: string;
    date: string;
    type: 'Invoice' | 'Payment' | 'Credit Note' | 'Debit Note' | 'Van Sale';
    referenceNumber: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    relatedId?: string;
    van_number?: string;
    salesman_name?: string;
}



// PDF Generation for Ledger
const generateCustomerLedgerPDF = (customer: Customer, ledger: LedgerEntry[]) => {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Customer Ledger - ${customer.name}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; border-bottom: 2px solid #000; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #f0f0f0; padding: 10px; text-align: left; border: 1px solid #ddd; }
                td { padding: 8px; border: 1px solid #ddd; }
                .totals { background-color: #f9fafb; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>Customer Ledger Statement</h1>
            <p><strong>Customer:</strong> ${customer.name}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${ledger.map(entry => `
                        <tr>
                            <td>${new Date(entry.date).toLocaleDateString()}</td>
                            <td>${entry.type}</td>
                            <td>${entry.referenceNumber}</td>
                            <td>${entry.debit > 0 ? '' + entry.debit.toLocaleString() : '-'}</td>
                            <td>${entry.credit > 0 ? '' + entry.credit.toLocaleString() : '-'}</td>
                            <td>${entry.balance.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    }
};

// Excel/CSV Generation
const generateCustomerLedgerExcel = (customer: Customer, ledger: LedgerEntry[]) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Customer Ledger - ${customer.name}\n\n`;
    csvContent += "Date,Type,Reference,Debit,Credit,Balance\n";

    ledger.forEach(entry => {
        csvContent += `${new Date(entry.date).toLocaleDateString()},`;
        csvContent += `${entry.type},${entry.referenceNumber},`;
        csvContent += `${entry.debit},${entry.credit},${entry.balance}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ledger_${customer.code}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ─── Document vault constants (visual-only, outside component) ──────────
// Part of the Customer Overview V3 spec. Pure UI mockup — no service
// calls, just renders inside the new vault panel.

const DOC_FILTER_OPTIONS = ['All', 'Tax forms', 'Agreements', 'ID & compliance'] as const;
type DocFilter = typeof DOC_FILTER_OPTIONS[number];

interface CustomerDoc {
  id: string;
  name: string;
  docType: string;
  status: 'ok' | 'missing' | 'expiring';
  uploadDate: string;
  note: string;
}

const CUSTOMER_DOCS: CustomerDoc[] = [
  { id: 'd1', name: 'W-9 Form',         docType: 'Tax forms',       status: 'ok',       uploadDate: '14 Jan 2024', note: 'Tax ID declaration' },
  { id: 'd2', name: '1120 — Corp tax',  docType: 'Tax forms',       status: 'missing',  uploadDate: '',            note: 'Required for credit limit' },
  { id: 'd3', name: 'Trade licence',    docType: 'ID & compliance', status: 'expiring', uploadDate: '3 Mar 2024',  note: 'Expires Aug 2026' },
  { id: 'd4', name: 'Credit agreement', docType: 'Agreements',      status: 'ok',       uploadDate: '22 Jan 2024', note: 'Signed credit terms' },
  { id: 'd5', name: 'Passport copy',    docType: 'ID & compliance', status: 'ok',       uploadDate: '14 Jan 2024', note: 'Owner ID on file' },
  { id: 'd6', name: 'Bank letter',      docType: 'Agreements',      status: 'ok',       uploadDate: '5 Feb 2024',  note: 'Account confirmation' },
];

// Computed once — outside component, never re-runs on render.
const DOCS_MISSING_COUNT: number = CUSTOMER_DOCS.filter(d => d.status === 'missing').length;

const DOC_ICONS: Record<string, string> = {
  d1: '📋', d2: '📄', d3: '🏢', d4: '🤝', d5: '🪪', d6: '🏦',
};

// Visual-only date helper (Month YYYY). Project has no equivalent.
function _fmtMonthYear(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Shared dark-theme table styles (used by Ledger/Sales/Payments/Credits/Unbilled) ──
const ledgerThStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--t3,#3E5678)', fontWeight: 700, letterSpacing: '.5px',
  padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.07)',
  textAlign: 'left', textTransform: 'uppercase',
};

const ledgerTdStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--t,#EEF2FF)', padding: '8px 10px',
  borderBottom: '1px solid rgba(255,255,255,.04)',
};

const ledgerTfootStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--t2,#8BA3C7)', padding: '10px',
  borderTop: '2px solid rgba(255,255,255,.07)', background: 'var(--bg2,#0a1726)',
};

const _tableRowHoverEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
  e.currentTarget.style.background = 'rgba(255,255,255,.025)';
};
const _tableRowHoverLeave = (e: React.MouseEvent<HTMLTableRowElement>) => {
  e.currentTarget.style.background = 'transparent';
};
// ─────────────────────────────────────────────────────────────────────────

export default function CustomerOverview() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'sales' | 'payments' | 'credits' | 'unbilled' | 'expenses'>('overview');
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);

    // Ledger state
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [ledgerDateFrom, setLedgerDateFrom] = useState('');
    const [ledgerDateTo, setLedgerDateTo] = useState('');
    const [loadingLedger, setLoadingLedger] = useState(false);

    // Stats state
    const [stats, setStats] = useState<CustomerStats>({
        outstandingBalance: 0,
        totalSalesYTD: 0,
        creditLimit: 0,
        creditUtilization: 0,
        overdueAmount: 0,
        overdueDays: 0,
        lastPaymentAmount: 0,
        lastPaymentDate: '',
        lastInvoiceDate: ''
    });

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    // FIX W6-1 — track void-in-flight per payment id.
    const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
    const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
    // STEP 11B — Billable expenses tagged with this customer's id.
    const [unbilledExpenses, setUnbilledExpenses] = useState<Expense[]>([]);

    // Modal state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | any>(null);
    // ITEM 16 — Escape closes whichever modal is open. Invoice preview
    // wins precedence (it's typically opened on top of the payment one).
    useEscape(() => {
        if (showInvoiceModal) setShowInvoiceModal(false);
        else if (showPaymentModal) setShowPaymentModal(false);
    }, showInvoiceModal || showPaymentModal);
    const [converting, setConverting] = useState<string | null>(null);
    const [shareMenuPos, setShareMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [shareMenuInvoiceId, setShareMenuInvoiceId] = useState<string | null>(null);
    const shareButtonRef = useRef<Record<string, HTMLButtonElement | null>>({});
    const [shareAttachModal, setShareAttachModal] = useState<{
        channel: 'whatsapp' | 'sms' | 'email';
        fileName: string;
    } | null>(null);
    const [selectedCurrency, setSelectedCurrency] = useState(WORLD_CURRENCIES[0]); // Default to USD

    // V3 spec — document vault toggle + filter (visual-only).
    const [showDocVault, setShowDocVault] = useState<boolean>(false);
    const [docFilter, setDocFilter] = useState<DocFilter>('All');

    // Check for tab parameter in URL
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tab = searchParams.get('tab');
        if (tab === 'ledger' || tab === 'sales' || tab === 'payments' || tab === 'credits') {
            setActiveTab(tab);
        }
    }, [location.search]);

    // Fetch customer data
    useEffect(() => {
        const fetchCustomer = async () => {
            if (!id) return;

            try {
                setLoading(true);
                const customers = await getCustomers();
                const foundCustomer = customers.find((c: any) => c.id === id);

                if (foundCustomer) {
                    setCustomer(foundCustomer);
                } else {
                    alert('Customer not found');
                    navigate('/customers');
                }
            } catch (error) {
                console.error('Error fetching customer:', error);
                alert('Failed to load customer data');
                navigate('/customers');
            } finally {
                setLoading(false);
            }
        };

        fetchCustomer();
    }, [id, navigate]);

    // Load all customer data
    const loadAllData = async () => {
        if (!id) return;

        try {
            setLoadingLedger(true);

            // Fetch everything in parallel including ledger entries from customer_ledger
            const [custInvoices, custOrders, custPayments, customerLedgerEntries, custCreditNotes] = await Promise.all([
                getCustomerInvoices(id),
                getCustomerSalesOrders(id),
                getCustomerPayments(id),
                getCustomerLedger(id),
                getCustomerCreditNotes(id)
            ]);

            setInvoices(custInvoices);
            setSalesOrders(custOrders);
            setPayments(custPayments);
            setCreditNotes(custCreditNotes);

            // Build Ledger from the backend ledger endpoint ONLY. That endpoint already
            // returns invoices (as synthetic rows) and payments (as Transaction rows),
            // so we don't need to merge in custInvoices/custPayments — which would
            // duplicate every row and, when two payments share an empty reference,
            // get collapsed by the dedup filter (losing one). Stats and the Sales /
            // Payments tabs still use custInvoices and custPayments separately below.
            const allTransactions: any[] = customerLedgerEntries.map(entry => {
                const invId =
                    entry.invoice_id != null && entry.invoice_id !== ''
                        ? String(entry.invoice_id)
                        : entry.type === 'invoice'
                          ? (() => {
                              const n = Number(entry.id);
                              return !Number.isNaN(n) && n >= 100000 ? String(n - 100000) : undefined;
                            })()
                          : undefined;
                return {
                    id: entry.id,
                    relatedInvoiceId: invId,
                    date: entry.date,
                    type: entry.type === 'van_sale' ? 'Van Sale' as const :
                        entry.type === 'opening_balance' ? 'Credit Note' as const :
                            entry.type === 'credit' ? 'Credit Note' as const :
                                entry.type === 'debit' ? 'Debit Note' as const :
                                    entry.type === 'payment' ? 'Payment' as const :
                                        'Invoice' as const,
                    referenceNumber: entry.reference || entry.invoice_number || `${entry.type.toUpperCase()}-${String(entry.id).slice(-4)}`,
                    description: entry.description || `${entry.type} transaction`,
                    debit: entry.type === 'van_sale' || entry.type === 'invoice' || entry.type === 'debit' || entry.type === 'opening_balance' ? entry.amount : 0,
                    credit:
                        entry.type === 'payment' ||
                        entry.type === 'credit' ||
                        entry.type === 'credit_note' ||
                        entry.type === 'return_credit' ||
                        entry.type === 'credit_adjustment'
                            ? entry.amount
                            : 0,
                    van_number: entry.van_number,
                    salesman_name: entry.salesman_name
                };
            });

            // Single source of truth — no dedup needed. Each backend ledger row is one
            // unique entry. Keeping the variable name for downstream compatibility.
            const uniqueTransactions = allTransactions;

            // ITEM 5B — Display ledger chronologically (oldest at top, newest
            // at bottom) to match how accountants read a ledger book. The
            // running balance accumulates oldest-to-newest, so removing the
            // .reverse() also fixes the visual flow (balance grows downward).
            const sortedTransactions = uniqueTransactions.sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            let runningBalance = 0;
            const ledgerEntries: LedgerEntry[] = sortedTransactions.map(tx => {
                runningBalance += (tx.debit - tx.credit);
                return {
                    ...tx,
                    balance: runningBalance,
                    relatedId: tx.relatedInvoiceId != null ? String(tx.relatedInvoiceId) : String(tx.id),
                    van_number: tx.van_number,
                    salesman_name: tx.salesman_name
                };
            });

            setLedger(ledgerEntries);

            // Calculate real stats from actual data.
            // (1) Outstanding balance = the server-side customer.balance — same source
            //     the Customers list shows. Single source of truth.
            // (2) Total sales = sum of every debit entry in the ledger (invoices +
            //     opening balance + van sales + debit notes). For BETTANO legacy
            //     customers whose invoice rows are encoded as ledger opening
            //     balance, this includes their historical billed total.
            // (3) Overdue = any invoice older than 30 days with a remaining balance.
            //     If a customer has no unpaid invoice rows but a positive
            //     customer.balance (legacy BETTANO data), the whole outstanding
            //     is treated as overdue.
            // (4) Last payment / last invoice — pick the actual most-recent one by
            //     date, not whatever happened to be at the end of the array. Guard
            //     date math so 'NaN days ago' never appears.
            const today = new Date();
            const outstandingBalance = Number(customer?.balance) || 0;
            const totalSales = ledgerEntries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
            const creditLimit = customer?.credit_limit || 0;

            const overdueInvoices = custInvoices.filter(inv => {
                const remaining = (Number(inv.grandTotal) || 0) - (Number(inv.amount_paid) || 0);
                if (remaining <= 0) return false;
                const ref = inv.dueDate || inv.invoiceDate || '';
                const refDate = new Date(ref);
                if (Number.isNaN(refDate.getTime())) return false;
                const daysOld = Math.floor((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
                return daysOld >= 30;
            });

            const invoiceOverdueAmount = overdueInvoices.reduce(
                (sum, inv) => sum + ((Number(inv.grandTotal) || 0) - (Number(inv.amount_paid) || 0)),
                0,
            );
            // No tracked invoices but customer still owes? Treat as legacy overdue.
            const overdueAmount = invoiceOverdueAmount > 0
                ? invoiceOverdueAmount
                : (outstandingBalance > 0 ? outstandingBalance : 0);

            let oldestOverdueDays = 0;
            if (overdueInvoices.length > 0) {
                const oldestInvoice = overdueInvoices.reduce((oldest, inv) => {
                    const a = new Date(inv.dueDate || inv.invoiceDate || '');
                    const b = new Date(oldest.dueDate || oldest.invoiceDate || '');
                    return a < b ? inv : oldest;
                });
                const oldRef = new Date(oldestInvoice.dueDate || oldestInvoice.invoiceDate || '');
                oldestOverdueDays = Number.isNaN(oldRef.getTime())
                    ? 0
                    : Math.floor((today.getTime() - oldRef.getTime()) / (1000 * 60 * 60 * 24));
            }

            const creditUtilization = creditLimit > 0
                ? Math.round((Math.abs(outstandingBalance) / creditLimit) * 100)
                : 0;

            // Most-recent-by-date selection (not array order).
            const safeTime = (s?: string) => {
                if (!s) return 0;
                const t = new Date(s).getTime();
                return Number.isNaN(t) ? 0 : t;
            };
            const sortedPayments = [...custPayments].sort((a, b) => safeTime(b.payment_date) - safeTime(a.payment_date));
            const lastPayment = sortedPayments[0];

            // 'Last Invoice' = most recent DEBIT entry in the ledger, EXCLUDING the
            // opening-balance row. Opening balance is a carry-forward, not a sale,
            // and its date is the moment the customer was created on the backend
            // (today) — not a real invoice date. Skipping reference='OPENING' lets
            // the tile fall back to 'No invoices yet' for legacy customers and
            // show real invoice dates for everyone else.
            const debitLedgerRows = ledgerEntries
                .filter((e) => Number(e.debit) > 0 && String(e.referenceNumber || '').toUpperCase() !== 'OPENING')
                .sort((a, b) => safeTime(b.date) - safeTime(a.date));
            const lastInvoiceDate = debitLedgerRows[0]?.date || '';

            setStats({
                outstandingBalance,
                totalSalesYTD: totalSales,
                creditLimit,
                creditUtilization,
                overdueAmount,
                overdueDays: oldestOverdueDays,
                lastPaymentAmount: lastPayment ? Number(lastPayment.amount) || 0 : 0,
                lastPaymentDate: lastPayment?.payment_date || '',
                lastInvoiceDate,
            });

        } catch (error) {
            console.error('Failed to load customer data:', error);
        } finally {
            setLoadingLedger(false);
        }
    };

    useEffect(() => {
        // Wait for customer to load so customer.credit_limit (and any other field
        // loadAllData reads from the customer record) is available when stats are
        // computed. Without this, credit_limit, last_payment, etc. compute as 0.
        if (!customer) return;
        loadAllData();
    }, [id, customer]);

    // TASK 5 — Silent refetch on tab return so a payment recorded in
    // another tab reflects immediately on this profile when the user
    // comes back. Throttled to one fetch per 5s to avoid hammering the
    // backend on rapid tab-switching. Resolves ISSUE-T from the W6 trace.
    const lastSilentLoadAtRef = useRef<number>(Date.now());
    useEffect(() => {
        if (!customer || !id) return;
        function silentRefresh() {
            const now = Date.now();
            if (now - lastSilentLoadAtRef.current < 5000) return;
            lastSilentLoadAtRef.current = now;
            // loadAllData already swallows errors; no need for our own try/catch.
            void loadAllData();
        }
        function onVisibilityChange() {
            if (!document.hidden) silentRefresh();
        }
        function onFocus() {
            silentRefresh();
        }
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onFocus);
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', onFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, customer]);

    // FIX W6-1 — Void a customer payment via reversing entry (same
    // mechanism as Banking page). Original record stays for audit;
    // backend recomputes customer balance + linked invoice balance.
    const handleVoidPayment = async (pay: Payment) => {
        if ((pay.amount ?? 0) < 0) {
            alert('Negative-amount payments are reversal entries — cannot void.');
            return;
        }
        if (pay.reference?.startsWith('VOID/')) {
            alert('This is already a reversal entry — cannot void a void.');
            return;
        }
        const reason = prompt(
            `Void payment of $${pay.amount.toFixed(2)}?\n\n` +
            `A reversing entry will be created. The original record stays for audit. ` +
            `Customer balance and any linked invoice will adjust.\n\n` +
            `Enter a reason (optional):`
        );
        if (reason === null) return;
        setVoidingPaymentId(String(pay.id));
        try {
            await voidPayment({
                id: String(pay.id),
                customer_id: String(pay.customer_id),
                amount: pay.amount,
                // customerService.Payment doesn't include invoice_id, but the
                // backend row often does; cast through any to surface it.
                invoice_id: (pay as any).invoice_id,
                reason: reason || undefined,
            });
            // Refetch via the existing loader so customer balance + ledger update too.
            await loadAllData();
            alert('✅ Payment voided. Reversal entry created.');
        } catch (e) {
            alert('Could not void payment: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setVoidingPaymentId(null);
        }
    };

    const handleConvertOrder = async (orderId: string) => {
        try {
            setConverting(orderId);
            await convertOrderToInvoice(orderId);
            await loadAllData();
            alert('✅ Order converted to Invoice successfully!');
        } catch (error) {
            console.error('Failed to convert order:', error);
            alert('❌ Failed to convert order');
        } finally {
            setConverting(null);
        }
    };

    // TC-40 — Cancel a credit note from the Credits tab.  Mirrors the
    // pattern in CreditNotes.tsx so behaviour stays consistent across
    // the customer view, the credit-notes list, and the detail page.
    // STEP 11B — mark an expense as 'billed' (stub link to invoice id).
    const markBilled = async (exp: Expense) => {
        if (!window.confirm(`Mark ${exp.vendor} expense as billed to this customer?`)) return;
        try {
            await saveExpense({ id: exp.id, invoiced_to: 'manual-' + Date.now() });
            setUnbilledExpenses(prev => prev.filter(e => e.id !== exp.id));
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Could not mark billed.');
        }
    };

    const cancelNote = async (cn: CreditNote) => {
        if (!window.confirm(`Cancel ${cn.creditNoteNumber}?`)) return;
        try {
            await updateCreditNote(cn.id, { status: 'cancelled' });
            await loadAllData();
        } catch (err) {
            console.error('Failed to cancel credit note:', err);
            alert('Failed to cancel credit note');
        }
    };

    const handleDownloadLedger = (format: 'pdf' | 'excel') => {
        if (!customer) return;

        if (format === 'pdf') {
            generateCustomerLedgerPDF(customer, ledger);
        } else {
            generateCustomerLedgerExcel(customer, ledger);
        }
    };

    const companyForShare = getCompanySettings();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-redwood-brand mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading customer...</p>
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <p className="text-gray-600">Customer not found</p>
                    <button
                        onClick={() => navigate('/customers')}
                        className="mt-4 px-4 py-2 bg-redwood-brand text-white rounded-sm"
                    >
                        Back to Customers
                    </button>
                </div>
            </div>
        );
    }

    // ── V3 spec: visual-only derived display values ────────────────────
    // None of these mutate existing state — they read invoices / payments
    // / stats and produce display-only numbers. The authoritative numbers
    // remain in `stats` (server-computed).
    const _CY = new Date().getFullYear();

    const _unpaidCount: number = (invoices ?? []).filter(
      (inv: any) => String(inv.status ?? '').toLowerCase() !== 'paid'
    ).length;

    const _overdueInvoices = (invoices ?? []).filter(
      (inv: any) =>
        inv.isOverdue === true ||
        String(inv.status ?? '').toLowerCase() === 'overdue'
    );
    const _overdueAmount: number = _overdueInvoices.reduce((sum: number, inv: any) => {
      const due =
        Number(inv.amountDue ?? inv.balance ?? inv.amount ?? 0) -
        Number(inv.amountPaid ?? 0);
      return sum + Math.max(0, due);
    }, 0);
    const _overdueCount: number = _overdueInvoices.length;

    const _totalSalesYTD: number = (invoices ?? [])
      .filter((inv: any) => {
        const dateVal = inv.invoiceDate ?? inv.invoice_date ?? inv.date ?? inv.createdAt;
        if (!dateVal) return false;
        try { return new Date(dateVal).getFullYear() === _CY; } catch { return false; }
      })
      .reduce((sum: number, inv: any) => sum + (Number(inv.amount ?? (inv as any).grandTotal) || 0), 0);

    const _balanceDisplay: number = Math.max(0, Number(stats.outstandingBalance) || 0);
    const _creditLimitDisplay: number = Number(stats.creditLimit) || 0;

    const _creditUsedPct: number = _creditLimitDisplay > 0
      ? Math.min(100, (_balanceDisplay / _creditLimitDisplay) * 100)
      : 0;

    const _balanceColor: string = _overdueAmount > 0
      ? '#EF4444'
      : _creditUsedPct > 80
        ? '#F59E0B'
        : '#4F8EF7';

    const _sortedPayments = [...(payments ?? [])].sort((a: any, b: any) => {
      const da = new Date(a.payment_date ?? a.date ?? a.createdAt ?? 0).getTime();
      const db = new Date(b.payment_date ?? b.date ?? b.createdAt ?? 0).getTime();
      return db - da; // newest first
    });
    const _lastPayment: any = _sortedPayments[0] ?? null;

    const _paymentsYTD = _sortedPayments.filter((p: any) => {
      const dateVal = p.payment_date ?? p.date ?? p.createdAt;
      if (!dateVal) return false;
      try { return new Date(dateVal).getFullYear() === _CY; } catch { return false; }
    });
    const _collectedYTD: number = _paymentsYTD.reduce(
      (sum: number, p: any) => sum + (Number(p.amount) || 0), 0
    );

    const _paymentMaxAmt: number = _sortedPayments.length > 0
      ? Math.max(..._sortedPayments.slice(0, 5).map((p: any) => Number(p.amount) || 0))
      : 1;

    const _creditHealthLabel: string = _overdueAmount > 0
      ? 'Overdue'
      : _creditUsedPct > 80
        ? 'Fair'
        : 'Good';
    const _creditHealthColor: string = _overdueAmount > 0
      ? '#EF4444'
      : _creditUsedPct > 80
        ? '#F59E0B'
        : '#22C55E';
    // ──────────────────────────────────────────────────────────────────

    return (
        <div className="p-6 space-y-6">
            {/* ── V3 Header — dark Soltol shell wrapping ALL existing handlers ── */}
            <div style={{ background: 'var(--bg2,#0a1726)', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '14px 18px', borderRadius: 10 }}>
                {/* Back + avatar + name row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <div style={{
                        width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.06)',
                        border: '1px solid rgba(255,255,255,.07)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <button
                            type="button"
                            onClick={() => navigate('/customers')}
                            aria-label="Back to customers"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                        >
                            <ArrowLeft size={16} color="#8BA3C7" />
                        </button>
                    </div>

                    <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'linear-gradient(135deg,#4F8EF7,#7C3AED)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                        {(customer.name ?? 'CU').substring(0, 2).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>
                                {customer.name}
                            </span>
                            <span style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 8,
                                background: 'rgba(255,255,255,.08)', color: 'var(--t2,#8BA3C7)', fontWeight: 600,
                            }}>
                                {customer.code || `CUST-${id?.slice(-4)}`}
                            </span>
                            <span style={{
                                fontSize: 10, padding: '2px 9px', borderRadius: 20,
                                background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.25)',
                                color: '#22C55E', fontWeight: 700,
                            }}>
                                ● Active
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>
                            {(customer as any).address ?? (customer as any).city ?? ''}
                            {((customer as any).address || (customer as any).city) ? ' · ' : ''}
                            Customer since {_fmtMonthYear((customer as any).createdAt ?? (customer as any).created_at)}
                            {' · '}
                            {(customer as any).paymentTerms ?? (customer as any).payment_terms ?? 'COD'} terms
                        </div>
                    </div>
                </div>

                {/* ACTION BUTTONS — keep ALL existing onClick handlers */}
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/sales/invoices/new', { state: { customerId: customer.id, customerName: customer.name } })}
                        style={{
                            background: '#4F8EF7', color: '#fff', border: 'none',
                            borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        📄 New invoice
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        style={{
                            background: 'rgba(34,197,94,.12)', color: '#16A34A',
                            border: '1px solid rgba(34,197,94,.3)', borderRadius: 8, padding: '7px 13px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        💵 Receive payment
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/sales/orders/new', { state: { customerId: customer.id, customerName: customer.name } })}
                        style={{
                            background: 'transparent', color: 'var(--t2,#8BA3C7)',
                            border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '7px 13px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        🛒 New sales order
                    </button>

                    <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,.07)', margin: '0 2px' }} />

                    <button
                        type="button"
                        onClick={() => navigate(`/customers/edit/${customer.id}`)}
                        style={{
                            background: 'transparent', color: 'var(--t2,#8BA3C7)',
                            border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '7px 13px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        ✏ Edit customer
                    </button>

                    {/* Send statement + Credit hold — new visual buttons, no handler */}
                    <button
                        type="button"
                        style={{
                            background: 'rgba(245,158,11,.12)', color: '#B45309',
                            border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, padding: '7px 13px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        📧 Send statement
                    </button>
                    <button
                        type="button"
                        style={{
                            background: 'rgba(239,68,68,.1)', color: '#B91C1C',
                            border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '7px 13px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        🚫 Credit hold
                    </button>

                    {/* Documents — toggles vault below */}
                    <button
                        type="button"
                        onClick={() => setShowDocVault(prev => !prev)}
                        style={{
                            background: showDocVault ? '#FDE047' : '#FEF08A', color: '#713F12',
                            border: '1px solid #FACC15', borderRadius: 8, padding: '7px 13px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        📁 Documents
                        {DOCS_MISSING_COUNT > 0 && (
                            <span style={{
                                background: 'rgba(239,68,68,.2)', color: '#B91C1C',
                                fontSize: 9, padding: '1px 5px', borderRadius: 6, fontWeight: 700,
                            }}>
                                {DOCS_MISSING_COUNT} missing
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ── V3 Stats Row — 6 cells, accounting-correct colour logic ── */}
            {(() => {
                const statCells: Array<{ label: string; value: string; color: string; sub: string; subColor?: string }> = [
                    {
                        label: 'Outstanding Balance',
                        value: `$${_balanceDisplay.toFixed(2)}`,
                        color: _balanceColor,
                        sub: `${_unpaidCount} unpaid invoice${_unpaidCount !== 1 ? 's' : ''}`,
                    },
                    {
                        label: 'Total Sales (YTD)',
                        value: `$${_totalSalesYTD.toFixed(2)}`,
                        color: '#22C55E',
                        sub: `${_CY} year to date`,
                    },
                    {
                        label: 'Credit Limit',
                        value: _creditLimitDisplay > 0 ? `$${_creditLimitDisplay.toFixed(2)}` : 'No limit',
                        color: '#4F8EF7',
                        sub: _creditLimitDisplay > 0 ? `Used: ${_creditUsedPct.toFixed(1)}%` : 'Unlimited',
                    },
                    {
                        label: 'Overdue Amount',
                        value: `$${_overdueAmount.toFixed(2)}`,
                        color: _overdueAmount > 0 ? '#EF4444' : '#22C55E',
                        sub: _overdueAmount > 0 ? `${_overdueCount} overdue` : 'No overdue ✓',
                        subColor: _overdueAmount > 0 ? '#EF4444' : '#22C55E',
                    },
                    {
                        label: 'Last Payment',
                        value: _lastPayment ? `$${Number(_lastPayment.amount).toFixed(2)}` : '—',
                        color: '#4F8EF7',
                        sub: _lastPayment
                            ? new Date(_lastPayment.payment_date ?? _lastPayment.date ?? _lastPayment.createdAt ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—',
                    },
                    {
                        label: 'Avg Payment Days',
                        value: '8 days',
                        color: '#22C55E',
                        sub: 'Within terms ✓',
                        subColor: '#22C55E',
                    },
                ];

                return (
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(6,1fr)',
                        borderBottom: '1px solid rgba(255,255,255,.07)',
                        background: 'var(--bg2,#0a1726)', borderRadius: 10, overflow: 'hidden',
                    }}>
                        {statCells.map((cell, i) => (
                            <div
                                key={cell.label}
                                style={{
                                    padding: '12px 14px',
                                    borderRight: i < 5 ? '1px solid rgba(255,255,255,.07)' : 'none',
                                }}
                            >
                                <div style={{
                                    fontSize: 9, color: 'var(--t3,#3E5678)', fontWeight: 700,
                                    letterSpacing: '.5px', marginBottom: 4, textTransform: 'uppercase',
                                }}>
                                    {cell.label}
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, marginBottom: 2, color: cell.color }}>
                                    {cell.value}
                                </div>
                                <div style={{ fontSize: 10, color: cell.subColor ?? 'var(--t3,#3E5678)' }}>
                                    {cell.sub}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {/* ── V3 Document vault — conditional, between stats and tabs ── */}
            {showDocVault && (
                <div style={{ background: 'var(--bg0,#060f1c)' }}>
                    <div style={{
                        background: 'var(--bg2,#0a1726)',
                        border: '1px solid rgba(250,204,21,.25)', borderRadius: 12,
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 14px', borderBottom: '1px solid rgba(250,204,21,.15)',
                        }}>
                            <div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 7,
                                    fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 2,
                                }}>
                                    📁 Document vault — {customer.name}
                                    <span style={{
                                        background: '#FEF9C3', color: '#713F12', fontSize: 9,
                                        fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                                    }}>
                                        {CUSTOMER_DOCS.length} docs · {DOCS_MISSING_COUNT} missing
                                    </span>
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>
                                    Click any document to view or replace
                                </div>
                            </div>
                            <button
                                type="button"
                                style={{
                                    background: '#FEF08A', color: '#713F12', border: '1px solid #FACC15',
                                    borderRadius: 8, padding: '5px 11px', fontSize: 10,
                                    fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                📤 Upload
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: 5, padding: '8px 12px 4px', flexWrap: 'wrap' }}>
                            {DOC_FILTER_OPTIONS.map(tag => (
                                <span
                                    key={tag}
                                    onClick={() => setDocFilter(tag)}
                                    style={{
                                        fontSize: 10, padding: '2px 8px', borderRadius: 20, cursor: 'pointer',
                                        background: docFilter === tag ? '#FEF9C3' : 'rgba(255,255,255,.05)',
                                        border: docFilter === tag ? '1px solid #FACC15' : '1px solid rgba(255,255,255,.07)',
                                        color: docFilter === tag ? '#713F12' : 'var(--t2,#8BA3C7)',
                                    }}
                                >
                                    {tag}{tag === 'All' ? ` (${CUSTOMER_DOCS.length})` : ''}
                                </span>
                            ))}
                        </div>

                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(158px,1fr))',
                            gap: 8, padding: '8px 12px 14px',
                        }}>
                            {CUSTOMER_DOCS
                                .filter(doc => docFilter === 'All' || doc.docType === docFilter)
                                .map(doc => {
                                    const normalBorder = doc.status === 'missing'
                                        ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.07)';
                                    const badgeBg = doc.status === 'ok' ? 'rgba(34,197,94,.12)'
                                        : doc.status === 'missing' ? 'rgba(239,68,68,.12)' : '#FEF9C3';
                                    const badgeColor = doc.status === 'ok' ? '#16A34A'
                                        : doc.status === 'missing' ? '#B91C1C' : '#92400E';
                                    const badgeLabel = doc.status === 'ok' ? '✓ On file'
                                        : doc.status === 'missing' ? '⚠ Missing' : '↻ Expiring';
                                    return (
                                        <div
                                            key={doc.id}
                                            style={{
                                                background: 'var(--bg3,#0f1f33)', border: `1px solid ${normalBorder}`,
                                                borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                                                transition: 'border-color .15s',
                                            }}
                                            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = '#FACC15'; }}
                                            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = normalBorder; }}
                                        >
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 8, background: '#FEF9C3',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 17, marginBottom: 7,
                                            }}>
                                                {DOC_ICONS[doc.id] ?? '📄'}
                                            </div>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t,#EEF2FF)', marginBottom: 2 }}>
                                                {doc.name}
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--t2,#8BA3C7)' }}>{doc.note}</div>
                                            <div style={{
                                                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
                                                display: 'inline-block', marginTop: 4,
                                                background: badgeBg, color: badgeColor,
                                            }}>
                                                {badgeLabel}
                                            </div>
                                            {doc.uploadDate && (
                                                <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)', marginTop: 3 }}>
                                                    {doc.uploadDate}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                            <div
                                style={{
                                    background: 'rgba(250,204,21,.04)', border: '1px dashed rgba(250,204,21,.3)',
                                    borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex',
                                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    gap: 5, textAlign: 'center', minHeight: 92,
                                }}
                                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                                    e.currentTarget.style.borderColor = '#FACC15';
                                    e.currentTarget.style.background = 'rgba(250,204,21,.1)';
                                }}
                                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                                    e.currentTarget.style.borderColor = 'rgba(250,204,21,.3)';
                                    e.currentTarget.style.background = 'rgba(250,204,21,.04)';
                                }}
                            >
                                <span style={{ fontSize: 20 }}>☁</span>
                                <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>Upload new document</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs — V3 dark theme */}
            <div style={{
                background: 'var(--bg2,#0a1726)',
                border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 10,
                overflow: 'hidden',
            }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', gap: 0, overflowX: 'auto' }}>
                    {[
                        { key: 'overview', label: 'Overview' },
                        { key: 'ledger', label: 'Ledger' },
                        { key: 'sales', label: 'Sales history' },
                        { key: 'payments', label: 'Payments' },
                        { key: 'credits', label: 'Credits' },
                        { key: 'unbilled', label: 'Unbilled' },
                        { key: 'expenses', label: 'Expenses' }
                    ].map(tab => {
                        const active = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                style={{
                                    fontSize: 12, fontWeight: 600, padding: '10px 16px',
                                    cursor: 'pointer', border: 'none', background: 'transparent',
                                    color: active ? '#4F8EF7' : 'var(--t3,#3E5678)',
                                    borderBottom: active ? '2px solid #4F8EF7' : '2px solid transparent',
                                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                                    transition: 'color .15s',
                                }}
                                onMouseEnter={(e) => { if (!active) (e.currentTarget.style.color = 'var(--t,#EEF2FF)'); }}
                                onMouseLeave={(e) => { if (!active) (e.currentTarget.style.color = 'var(--t3,#3E5678)'); }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="p-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div>
                            {/* ─── ROW 1 — 3-col: Customer info · Credit health · Recent activity ─── */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 10,
                                marginBottom: 10,
                            }}>
                            {/* ── V3 Fix 5 — Customer Information card (replaces plain ALL CAPS block) ── */}
                            <div style={{
                                background: 'var(--bg3,#0f1f33)',
                                border: '1px solid rgba(255,255,255,.12)',
                                borderRadius: 12,
                                padding: 14,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span aria-hidden>👤</span> Customer information
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/customers/edit/${customer.id}`)}
                                        style={{
                                            background: 'rgba(79,142,247,.12)',
                                            border: '1px solid rgba(79,142,247,.3)',
                                            color: '#4F8EF7',
                                            borderRadius: 7, padding: '4px 10px',
                                            fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            display: 'flex', alignItems: 'center', gap: 5,
                                        }}
                                    >
                                        ✏ Edit
                                    </button>
                                </div>
                                {[
                                    { label: 'Company',       value: customer.name },
                                    { label: 'Email',         value: (customer as any).email   || 'N/A', isBlue: true },
                                    { label: 'Phone',         value: (customer as any).phone   || 'N/A' },
                                    { label: 'Address',       value: (customer as any).address || 'N/A' },
                                    { label: 'Payment terms', value: (customer as any).paymentTerms ?? (customer as any).payment_terms ?? 'COD' },
                                    { label: 'Currency',      value: (customer as any).currency ?? 'USD' },
                                    { label: 'Tax reg no.',   value: (customer as any).taxRegNumber ?? (customer as any).tax_reg_number ?? 'Not on file' },
                                ].map((row, i, arr) => (
                                    <div
                                        key={row.label}
                                        style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            padding: '6px 0',
                                            borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                                            fontSize: 11,
                                        }}
                                    >
                                        <span style={{ color: 'var(--t2,#8BA3C7)' }}>{row.label}</span>
                                        <span style={{
                                            color: row.isBlue ? '#4F8EF7' : 'var(--t,#EEF2FF)',
                                            fontWeight: 500,
                                            textAlign: 'right',
                                            maxWidth: '60%',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {row.value}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* ── V3 4B — Credit health card ── */}
                            <div style={{
                                background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.12)',
                                borderRadius: 12, padding: 14,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>💳 Credit health</span>
                                    <span style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>auto-calculated</span>
                                </div>

                                <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: _creditHealthColor }}>
                                        {_creditHealthLabel}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)', marginTop: 2 }}>
                                        Credit utilisation: {_creditUsedPct.toFixed(1)}%
                                    </div>
                                    <div style={{
                                        height: 8, borderRadius: 8, background: 'rgba(255,255,255,.06)',
                                        margin: '8px 0 4px', overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            height: 8, borderRadius: 8,
                                            width: `${_creditUsedPct}%`,
                                            background: _creditUsedPct < 50
                                                ? '#22C55E'
                                                : _creditUsedPct < 80
                                                    ? '#F59E0B'
                                                    : '#EF4444',
                                            transition: 'width .6s ease',
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--t3,#3E5678)' }}>
                                        <span>Safe (0%)</span>
                                        <span>Danger (100%)</span>
                                    </div>
                                </div>

                                {((): Array<{ label: string; value: string; color: string }> => [
                                    { label: 'Credit limit',     value: _creditLimitDisplay > 0 ? `$${_creditLimitDisplay.toFixed(2)}` : 'No limit',                                                color: '#4F8EF7' },
                                    { label: 'Used',             value: `$${_balanceDisplay.toFixed(2)}`,                                                                                          color: 'var(--t,#EEF2FF)' },
                                    { label: 'Available',        value: _creditLimitDisplay > 0
                                                                      ? `$${Math.max(0, _creditLimitDisplay - _balanceDisplay).toFixed(2)}`
                                                                      : 'Unlimited',
                                                                  color: _creditLimitDisplay > 0 ? '#22C55E' : '#4F8EF7' },
                                    { label: 'Overdue',          value: _overdueAmount > 0 ? `$${_overdueAmount.toFixed(2)}` : 'None ✓',                                                          color: _overdueAmount > 0 ? '#EF4444' : '#22C55E' },
                                    { label: 'Avg payment days', value: '8 days ✓',                                                                                                                color: '#22C55E' },
                                ])().map(row => (
                                    <div
                                        key={row.label}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 11,
                                        }}
                                    >
                                        <span style={{ color: 'var(--t2,#8BA3C7)' }}>{row.label}</span>
                                        <span style={{ color: row.color, fontWeight: 500 }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* ── V3 4C — Recent activity feed ── */}
                            <div style={{
                                background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.12)',
                                borderRadius: 12, padding: 14,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>⚡ Recent activity</span>
                                    <span style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>last 30 days</span>
                                </div>
                                {[
                                    ...(payments ?? []).slice(0, 3).map((p: any) => ({
                                        icon: '💵', bg: 'rgba(34,197,94,.1)',
                                        text: `Payment received — $${Number(p.amount ?? 0).toFixed(2)}`,
                                        sub: [p.reference ?? p.ref, _fmtMonthYear(p.payment_date ?? p.date ?? p.createdAt)].filter(Boolean).join(' · '),
                                    })),
                                    ...(invoices ?? []).slice(0, 2).map((inv: any) => ({
                                        icon: '📄', bg: 'rgba(74,143,245,.1)',
                                        text: `Invoice — $${Number(inv.amount ?? inv.grandTotal ?? 0).toFixed(2)}`,
                                        sub: [inv.number ?? inv.id, _fmtMonthYear(inv.invoiceDate ?? inv.invoice_date ?? inv.date ?? inv.createdAt)].filter(Boolean).join(' · '),
                                    })),
                                ].slice(0, 5).map((item, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 8,
                                            padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 11,
                                        }}
                                    >
                                        <div style={{
                                            width: 26, height: 26, borderRadius: 7, background: item.bg,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 12, flexShrink: 0,
                                        }}>{item.icon}</div>
                                        <div>
                                            <div style={{ color: 'var(--t,#EEF2FF)', lineHeight: 1.4, marginBottom: 1 }}>{item.text}</div>
                                            <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>{item.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            </div>
                            {/* ─── END ROW 1 ─── */}

                            {/* ─── ROW 2 — 2-col: Sales trend chart + Open invoices ─── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>

                                {/* LEFT — Sales trend bar chart */}
                                <div style={{
                                    background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.12)',
                                    borderRadius: 12, padding: 14,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            📈 Sales trend — last 6 months
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>vs same period last year</span>
                                    </div>
                                    {(() => {
                                        const now = new Date();
                                        const months: Array<{ label: string; total: number }> = [];
                                        for (let i = 5; i >= 0; i--) {
                                            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                                            const label = d.toLocaleDateString('en-US', { month: 'short' });
                                            const total = (invoices ?? []).filter((inv: any) => {
                                                const invDate = new Date(inv.invoiceDate ?? inv.date ?? inv.createdAt ?? 0);
                                                return invDate.getMonth() === d.getMonth()
                                                    && invDate.getFullYear() === d.getFullYear();
                                            }).reduce((s: number, inv: any) => s + (Number(inv.grandTotal ?? inv.amount ?? 0)), 0);
                                            months.push({ label, total });
                                        }
                                        const maxVal = Math.max(...months.map(m => m.total), 1);
                                        const ytdSales = (invoices ?? [])
                                            .filter((inv: any) => {
                                                const d = new Date(inv.invoiceDate ?? inv.date ?? inv.createdAt ?? 0);
                                                return d.getFullYear() === now.getFullYear();
                                            })
                                            .reduce((s: number, inv: any) => s + (Number(inv.grandTotal ?? inv.amount ?? 0)), 0);
                                        const invCount = (invoices ?? []).length;
                                        const totalAmt = (invoices ?? []).reduce((s: number, inv: any) =>
                                            s + (Number(inv.grandTotal ?? inv.amount ?? 0)), 0);
                                        const avgInv = invCount > 0 ? Math.round(totalAmt / invCount) : 0;

                                        return (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, marginBottom: 6 }}>
                                                    {months.map((m, i) => {
                                                        const pct = Math.max(8, Math.round((m.total / maxVal) * 100));
                                                        const isLatest = i === months.length - 1;
                                                        return (
                                                            <div key={i} style={{
                                                                flex: 1, display: 'flex', flexDirection: 'column',
                                                                alignItems: 'center', gap: 2, height: '100%',
                                                            }}>
                                                                <div style={{
                                                                    width: '100%', height: `${pct}%`, alignSelf: 'flex-end',
                                                                    background: isLatest ? '#22C55E' : '#4A8FF5',
                                                                    opacity: isLatest ? 1 : 0.4 + i * 0.1,
                                                                    borderRadius: '2px 2px 0 0',
                                                                }} />
                                                                <div style={{ fontSize: 8, color: 'var(--t3,#3E5678)' }}>
                                                                    {m.label}{isLatest ? ' ↑' : ''}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 6 }}>
                                                    {[
                                                        { val: `$${ytdSales.toLocaleString()}`,        lbl: 'YTD sales',   color: '#22C55E' },
                                                        { val: String(invCount),                       lbl: 'Invoices',    color: '#4A8FF5' },
                                                        { val: `$${avgInv.toLocaleString()}`,           lbl: 'Avg invoice', color: '#9B6FE4' },
                                                    ].map(s => (
                                                        <div key={s.lbl} style={{
                                                            background: 'var(--bg4,#142540)', borderRadius: 8,
                                                            padding: 8, textAlign: 'center',
                                                            border: '1px solid rgba(255,255,255,.04)',
                                                        }}>
                                                            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, marginBottom: 1, color: s.color }}>
                                                                {s.val}
                                                            </div>
                                                            <div style={{ fontSize: 9, color: 'var(--t3,#3E5678)' }}>{s.lbl}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* RIGHT — Open invoices table */}
                                <div style={{
                                    background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.12)',
                                    borderRadius: 12, padding: 0, overflow: 'hidden',
                                }}>
                                    <div style={{
                                        padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.07)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>
                                            🧾 Open invoices
                                        </span>
                                        <span style={{ fontSize: 10, color: '#4A8FF5', cursor: 'pointer' }}>View all →</span>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                {['Invoice', 'Date', 'Amount', 'Due', 'Status'].map(h => (
                                                    <th key={h} style={{
                                                        fontSize: 10, color: 'var(--t3,#3E5678)', fontWeight: 700,
                                                        letterSpacing: '.5px', padding: '8px 10px',
                                                        borderBottom: '1px solid rgba(255,255,255,.07)',
                                                        textAlign: 'left', textTransform: 'uppercase',
                                                        background: 'var(--bg2,#0a1726)',
                                                    }}>
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(invoices ?? [])
                                                .filter((inv: any) => {
                                                    const s = String(inv.status ?? '').toLowerCase();
                                                    return s !== 'paid' && s !== 'void' && s !== 'cancelled';
                                                })
                                                .slice(0, 5)
                                                .map((inv: any, i: number) => {
                                                    const isOverdue = inv.isOverdue
                                                        || String(inv.status ?? '').toLowerCase() === 'overdue';
                                                    const dueDateStr = inv.dueDate ?? inv.due_date ?? inv.invoiceDate ?? '';
                                                    const dueFmt = dueDateStr
                                                        ? new Date(dueDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                        : '—';
                                                    return (
                                                        <tr
                                                            key={i}
                                                            style={{ cursor: 'pointer' }}
                                                            onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => {
                                                                e.currentTarget.style.background = 'rgba(255,255,255,.025)';
                                                            }}
                                                            onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => {
                                                                e.currentTarget.style.background = 'transparent';
                                                            }}
                                                        >
                                                            <td style={{ fontSize: 11, color: '#4A8FF5', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                                                                {inv.invoiceNumber ?? inv.number ?? inv.id ?? '—'}
                                                            </td>
                                                            <td style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                                                                {inv.invoiceDate
                                                                    ? new Date(inv.invoiceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                                    : '—'}
                                                            </td>
                                                            <td style={{ fontSize: 11, color: 'var(--t,#EEF2FF)', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                                                                ${Number(inv.grandTotal ?? inv.amount ?? 0).toFixed(2)}
                                                            </td>
                                                            <td style={{
                                                                fontSize: 11, padding: '8px 10px',
                                                                borderBottom: '1px solid rgba(255,255,255,.04)',
                                                                color: isOverdue ? '#EF4444' : '#F59E0B',
                                                            }}>
                                                                {dueFmt}{isOverdue ? ' ⚠' : ''}
                                                            </td>
                                                            <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                                                                <span style={{
                                                                    fontSize: 9, padding: '2px 7px', borderRadius: 8, fontWeight: 600,
                                                                    background: isOverdue ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)',
                                                                    color: isOverdue ? '#B91C1C' : '#B45309',
                                                                }}>
                                                                    {isOverdue ? 'Overdue' : 'Pending'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {/* ─── END ROW 2 ─── */}

                            {/* ── V3 4D — Payment history bars + Top products (Row 3) ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 0 }}>
                                <div style={{
                                    background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.12)',
                                    borderRadius: 12, padding: 14,
                                }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 10 }}>
                                        💰 Payment history
                                    </div>
                                    {_sortedPayments.slice(0, 5).map((p: any, i: number) => {
                                        const amt = Number(p.amount ?? 0);
                                        const pct = _paymentMaxAmt > 0 ? Math.round((amt / _paymentMaxAmt) * 100) : 0;
                                        const dateStr = p.payment_date ?? p.date ?? p.createdAt;
                                        const label = dateStr
                                            ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                            : '—';
                                        return (
                                            <div
                                                key={i}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 11,
                                                }}
                                            >
                                                <span style={{ width: 60, color: 'var(--t2,#8BA3C7)', flexShrink: 0, fontSize: 10 }}>{label}</span>
                                                <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 4, height: 6 }}>
                                                    <div style={{
                                                        height: 6, borderRadius: 4, width: `${pct}%`,
                                                        background: i === 0 ? '#22C55E' : '#4F8EF7',
                                                    }} />
                                                </div>
                                                <span style={{ color: i === 0 ? '#22C55E' : '#4F8EF7', fontWeight: 600, width: 72, textAlign: 'right' }}>
                                                    ${amt.toFixed(2)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', marginTop: 10,
                                        paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.04)',
                                    }}>
                                        <span style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>Collected {_CY} YTD</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>
                                            ${_collectedYTD.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* RIGHT — Top products ordered + Marcus tip */}
                                <div style={{
                                    background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.12)',
                                    borderRadius: 12, padding: 14,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>
                                            📦 Top products ordered
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>by revenue</span>
                                    </div>

                                    {(() => {
                                        const pmap: Record<string, number> = {};
                                        (invoices ?? []).forEach((inv: any) => {
                                            const items = (inv.items ?? inv.lineItems ?? inv.invoice_items ?? []);
                                            items.forEach((item: any) => {
                                                const name = item.productName ?? item.name ?? item.product_name ?? 'Unknown';
                                                pmap[name] = (pmap[name] ?? 0)
                                                    + Number(item.total ?? item.amount ?? item.subtotal
                                                            ?? (Number(item.price ?? 0) * Number(item.quantity ?? 1)));
                                            });
                                        });
                                        const sorted = Object.entries(pmap).sort((a, b) => b[1] - a[1]).slice(0, 4);
                                        const maxVal = sorted.length ? sorted[0][1] : 1;
                                        const colours = ['#22C55E', '#4A8FF5', '#F59E0B', '#9B6FE4'];

                                        const rows: Array<{ name: string; pct: number; color: string; val: string }> =
                                            sorted.length > 0
                                                ? sorted.map(([name, val], i) => ({
                                                    name,
                                                    pct: Math.round((val / maxVal) * 100),
                                                    color: colours[i] ?? '#4A8FF5',
                                                    val: `$${Number(val).toLocaleString()}`,
                                                }))
                                                : [{ name: '— No product data —', pct: 0, color: '#3E5678', val: '$0' }];

                                        return rows.map((p, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)',
                                                    fontSize: 11,
                                                }}
                                            >
                                                <span style={{
                                                    width: 120, color: 'var(--t2,#8BA3C7)', fontSize: 10,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    flexShrink: 0,
                                                }}>
                                                    {p.name}
                                                </span>
                                                <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 3, height: 5 }}>
                                                    <div style={{
                                                        height: 5, borderRadius: 3, width: `${p.pct}%`,
                                                        background: p.color,
                                                    }} />
                                                </div>
                                                <span style={{
                                                    color: p.color, fontWeight: 600,
                                                    width: 72, textAlign: 'right', flexShrink: 0,
                                                }}>
                                                    {p.val}
                                                </span>
                                            </div>
                                        ));
                                    })()}

                                    {/* Marcus AI tip box — small, at bottom of card */}
                                    <div style={{
                                        marginTop: 10, padding: '7px 10px',
                                        background: 'rgba(74,143,245,.07)',
                                        border: '1px solid rgba(74,143,245,.2)',
                                        borderRadius: 8, fontSize: 10,
                                        color: 'var(--t2,#8BA3C7)', lineHeight: 1.5,
                                    }}>
                                        ✦ <strong style={{ color: '#9B6FE4' }}>Marcus:</strong>{' '}
                                        {customer?.name ?? 'Customer'} purchase history analysis —
                                        consider bulk discount on top products to increase order volume.
                                    </div>
                                </div>
                            </div>
                            {/* ─── END ROW 3 ─── */}
                        </div>
                    )}

                    {/* Ledger Tab */}
                    {activeTab === 'ledger' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Customer Ledger</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDownloadLedger('pdf')}
                                        style={{
                                            padding: '6px 12px', background: 'transparent',
                                            border: '1px solid rgba(255,255,255,.12)', borderRadius: 7,
                                            fontSize: 11, fontWeight: 600, color: 'var(--t2,#8BA3C7)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        <Download size={12} />
                                        Download PDF
                                    </button>
                                    <button
                                        onClick={() => handleDownloadLedger('excel')}
                                        style={{
                                            padding: '6px 12px', background: 'transparent',
                                            border: '1px solid rgba(255,255,255,.12)', borderRadius: 7,
                                            fontSize: 11, fontWeight: 600, color: 'var(--t2,#8BA3C7)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        <Download size={12} />
                                        Download Excel
                                    </button>
                                </div>
                            </div>

                            {/* Date-range filter — dark variant */}
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12,
                                marginBottom: 16, padding: 12,
                                background: 'var(--bg3,#0f1f33)',
                                border: '1px solid rgba(255,255,255,.07)', borderRadius: 8,
                            }}>
                                <div className="flex flex-col">
                                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3,#3E5678)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 4 }}>From</label>
                                    <input
                                        type="date"
                                        value={ledgerDateFrom}
                                        onChange={(e) => setLedgerDateFrom(e.target.value)}
                                        style={{
                                            background: 'var(--bg4,#142540)', color: 'var(--t,#EEF2FF)',
                                            border: '1px solid rgba(255,255,255,.12)', borderRadius: 6,
                                            padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'inherit',
                                        }}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3,#3E5678)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 4 }}>To</label>
                                    <input
                                        type="date"
                                        value={ledgerDateTo}
                                        onChange={(e) => setLedgerDateTo(e.target.value)}
                                        style={{
                                            background: 'var(--bg4,#142540)', color: 'var(--t,#EEF2FF)',
                                            border: '1px solid rgba(255,255,255,.12)', borderRadius: 6,
                                            padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'inherit',
                                        }}
                                    />
                                </div>
                                {(ledgerDateFrom || ledgerDateTo) && (
                                    <button
                                        type="button"
                                        onClick={() => { setLedgerDateFrom(''); setLedgerDateTo(''); }}
                                        style={{
                                            padding: '6px 10px', background: 'transparent', border: 'none',
                                            fontSize: 9, fontWeight: 700, color: '#EF4444',
                                            textTransform: 'uppercase', letterSpacing: '.6px',
                                            cursor: 'pointer', fontFamily: 'inherit',
                                        }}
                                    >
                                        ✕ Clear Filter
                                    </button>
                                )}
                                {(ledgerDateFrom || ledgerDateTo) && (
                                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 600, color: 'var(--t3,#3E5678)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                                        Showing entries from {ledgerDateFrom || '∞'} to {ledgerDateTo || 'today'}
                                    </span>
                                )}
                            </div>

                            <div className="overflow-x-auto overflow-y-visible" style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10 }}>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr style={{ background: 'var(--bg2,#0a1726)' }}>
                                            <th style={ledgerThStyle}>Date</th>
                                            <th style={ledgerThStyle}>Type</th>
                                            <th style={ledgerThStyle}>Reference</th>
                                            <th style={ledgerThStyle}>Description</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Debit</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Credit</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Balance</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center', minWidth: '7.5rem' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingLedger ? (
                                            <tr>
                                                <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--t2,#8BA3C7)', fontSize: 12 }}>
                                                    Loading ledger...
                                                </td>
                                            </tr>
                                        ) : ledger.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 4 }}>No transactions yet</div>
                                                    <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>Create an invoice to see it here</div>
                                                </td>
                                            </tr>
                                        ) : (
                                            ledger
                                            .filter(entry => {
                                                // ITEM 5A — Filter logic; ITEM 5D — same filter
                                                // feeds the tfoot totals below.
                                                if (ledgerDateFrom && entry.date.slice(0,10) < ledgerDateFrom) return false;
                                                if (ledgerDateTo && entry.date.slice(0,10) > ledgerDateTo) return false;
                                                return true;
                                            })
                                            .map(entry => (
                                                <tr
                                                    key={entry.id}
                                                    onMouseEnter={_tableRowHoverEnter}
                                                    onMouseLeave={_tableRowHoverLeave}
                                                    style={{ transition: 'background .15s' }}
                                                >
                                                    <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>
                                                        {new Date(entry.date).toLocaleDateString()}
                                                    </td>
                                                    <td style={ledgerTdStyle}>
                                                        <span style={{
                                                            padding: '2px 7px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                                                            background: entry.type === 'Invoice' ? 'rgba(79,142,247,.12)'
                                                                : entry.type === 'Payment' ? 'rgba(34,197,94,.12)'
                                                                    : entry.type === 'Van Sale' ? 'rgba(245,158,11,.12)'
                                                                        : 'rgba(255,255,255,.06)',
                                                            color: entry.type === 'Invoice' ? '#4F8EF7'
                                                                : entry.type === 'Payment' ? '#16A34A'
                                                                    : entry.type === 'Van Sale' ? '#F59E0B'
                                                                        : 'var(--t2,#8BA3C7)',
                                                        }}>
                                                            {entry.type}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, fontFamily: 'monospace', fontWeight: 700 }}>
                                                        {entry.referenceNumber}
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>
                                                        {entry.description}
                                                        {entry.type === 'Van Sale' && (entry.van_number || entry.salesman_name) && (
                                                            <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)', marginTop: 4 }}>
                                                                {entry.van_number && <span>Van: {entry.van_number}</span>}
                                                                {entry.van_number && entry.salesman_name && <span> • </span>}
                                                                {entry.salesman_name && <span>Driver: {entry.salesman_name}</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'right', color: '#EF4444', fontFamily: 'monospace', fontWeight: 600 }}>
                                                        {entry.debit > 0 ? `${entry.debit.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'right', color: '#22C55E', fontFamily: 'monospace', fontWeight: 600 }}>
                                                        {entry.credit > 0 ? `${entry.credit.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'right', color: 'var(--t,#EEF2FF)', fontFamily: 'monospace', fontWeight: 700 }}>
                                                        {entry.balance.toLocaleString()}
                                                    </td>
                                                    <td className="text-center relative align-middle" style={{ ...ledgerTdStyle, textAlign: 'center', padding: '8px 10px' }}>
                                                        {entry.type === 'Invoice' && (() => {
                                                            const inv = invoices.find(i => String(i.id) === String(entry.relatedId));
                                                            return (
                                                                <div className="flex items-center justify-center gap-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (inv) {
                                                                                setSelectedInvoice(inv);
                                                                                setShowInvoiceModal(true);
                                                                            }
                                                                        }}
                                                                        title="View Invoice"
                                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    >
                                                                        <Eye size={18} />
                                                                    </button>
                                                                    {inv && (
                                                                        <button
                                                                            ref={(el) => {
                                                                                shareButtonRef.current[entry.id] = el;
                                                                            }}
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (shareMenuInvoiceId === entry.id) {
                                                                                    setShareMenuInvoiceId(null);
                                                                                    setShareMenuPos(null);
                                                                                    return;
                                                                                }
                                                                                const btn = shareButtonRef.current[entry.id];
                                                                                if (!btn) return;
                                                                                const rect = btn.getBoundingClientRect();
                                                                                const dropdownHeight = 280;
                                                                                const spaceBelow = window.innerHeight - rect.bottom;
                                                                                const top =
                                                                                    spaceBelow > dropdownHeight
                                                                                        ? rect.bottom + 4
                                                                                        : rect.top - dropdownHeight - 4;
                                                                                const left = Math.min(rect.left, window.innerWidth - 210);
                                                                                setShareMenuPos({ top, left });
                                                                                setShareMenuInvoiceId(entry.id);
                                                                            }}
                                                                            title="Share invoice"
                                                                            className="p-1.5 text-[#800020] hover:bg-red-50 rounded transition-colors flex items-center gap-0.5"
                                                                        >
                                                                            <Share2 size={16} />
                                                                            <ChevronDown size={14} className="opacity-70" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        {entry.type === 'Payment' && (
                                                            <button
                                                                title="View Receipt"
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                            >
                                                                <Receipt size={18} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {/* ITEM 5D — Totals row. Sums the FILTERED ledger so the
                                        totals always match what's visible on screen. */}
                                    {ledger.length > 0 && (() => {
                                        const visible = ledger.filter(entry => {
                                            if (ledgerDateFrom && entry.date.slice(0,10) < ledgerDateFrom) return false;
                                            if (ledgerDateTo && entry.date.slice(0,10) > ledgerDateTo) return false;
                                            return true;
                                        });
                                        const totalDebit = visible.reduce((s, e) => s + (Number(e.debit) || 0), 0);
                                        const totalCredit = visible.reduce((s, e) => s + (Number(e.credit) || 0), 0);
                                        const net = totalDebit - totalCredit;
                                        return (
                                            <tfoot>
                                                <tr style={{ fontWeight: 700 }}>
                                                    <td colSpan={4} style={{ ...ledgerTfootStyle, textAlign: 'right', fontSize: 10, color: 'var(--t2,#8BA3C7)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Totals</td>
                                                    <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'monospace', color: '#4F8EF7' }}>{totalDebit.toFixed(2)}</td>
                                                    <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'monospace', color: '#22C55E' }}>{totalCredit.toFixed(2)}</td>
                                                    <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'monospace', color: net >= 0 ? 'var(--t,#EEF2FF)' : '#EF4444' }}>{net.toFixed(2)}</td>
                                                    <td style={ledgerTfootStyle}></td>
                                                </tr>
                                            </tfoot>
                                        );
                                    })()}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Sales Tab */}
                    {activeTab === 'sales' && (
                        <div className="space-y-6">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ShoppingCart size={14} color="#4F8EF7" />
                                    Sequential Sales Ledger
                                </h3>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3,#3E5678)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Unified Order &amp; Invoice Stream</div>
                            </div>
                            <div style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden' }}>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr style={{ background: 'var(--bg2,#0a1726)' }}>
                                            <th style={ledgerThStyle}>Document ID</th>
                                            <th style={ledgerThStyle}>Date</th>
                                            <th style={ledgerThStyle}>Items</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center' }}>Operation Status</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center' }}>Payment Status</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'right' }}>{`Value (${getSystemSettings().defaultCurrencyCode})`}</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center', width: 160 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Combine Invoices and Sales Orders into one list */}
                                        {[
                                            ...invoices.map(inv => ({ ...inv, docType: 'Invoice' as const })),
                                            ...salesOrders.map(so => ({ ...so, docType: 'SalesOrder' as const }))
                                        ]
                                            .sort((a, b) => new Date(b.docType === 'Invoice' ? (a as any).invoiceDate : (a as any).orderDate).getTime() - new Date(b.docType === 'Invoice' ? (b as any).invoiceDate : (b as any).orderDate).getTime())
                                            .length === 0 ? (
                                            <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center' }}>
                                                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 4 }}>No sales records yet</div>
                                                <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>No invoices or sales orders for this customer</div>
                                            </td></tr>
                                        ) : (
                                            [
                                                ...invoices.map(inv => ({ ...inv, docType: 'Invoice' as const })),
                                                ...salesOrders.map(so => ({ ...so, docType: 'SalesOrder' as const }))
                                            ]
                                                .sort((a, b) => {
                                                    const dateA = new Date(a.docType === 'Invoice' ? (a as any).invoiceDate : (a as any).orderDate).getTime();
                                                    const dateB = new Date(b.docType === 'Invoice' ? (b as any).invoiceDate : (b as any).orderDate).getTime();
                                                    return dateB - dateA;
                                                })
                                                .map((doc: any) => (
                                                    <tr
                                                        key={doc.id}
                                                        onMouseEnter={_tableRowHoverEnter}
                                                        onMouseLeave={_tableRowHoverLeave}
                                                        style={{ transition: 'background .15s' }}
                                                    >
                                                        <td style={{ ...ledgerTdStyle, fontFamily: 'monospace', fontWeight: 700 }}>
                                                            {doc.docType === 'Invoice' ? doc.invoiceNumber : doc.orderNumber}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>
                                                            {new Date(doc.docType === 'Invoice' ? doc.invoiceDate : doc.orderDate).toLocaleDateString()}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>
                                                            {doc.lineItems.length} {doc.lineItems.length === 1 ? 'Item' : 'Items'}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                            {doc.docType === 'SalesOrder' ? (
                                                                <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(245,158,11,.12)', color: '#B45309', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                                                                    🟡 Pending
                                                                </span>
                                                            ) : (
                                                                <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(34,197,94,.12)', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                                                                    🟢 Sold
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                            {doc.docType === 'Invoice' ? (() => {
                                                                const grand = Number((doc as any).grandTotal) || 0;
                                                                const rb = Number((doc as any).remaining_balance ?? grand);
                                                                const isPaid = rb <= 0.005;
                                                                const isPartial = !isPaid && rb < grand;
                                                                const bg = isPaid ? 'rgba(34,197,94,.12)'
                                                                    : isPartial ? 'rgba(245,158,11,.12)'
                                                                    : 'rgba(239,68,68,.12)';
                                                                const color = isPaid ? '#16A34A'
                                                                    : isPartial ? '#B45309'
                                                                    : '#B91C1C';
                                                                const label = isPaid ? '🔵 Paid'
                                                                    : isPartial ? '🟠 Partial'
                                                                    : '🔴 Unpaid';
                                                                return (
                                                                    <span
                                                                        style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: bg, color, textTransform: 'uppercase', letterSpacing: '.4px' }}
                                                                        title={isPartial ? `${rb.toFixed(2)} of ${grand.toFixed(2)} outstanding` : undefined}
                                                                    >
                                                                        {label}
                                                                    </span>
                                                                );
                                                            })() : (
                                                                <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,.06)', color: 'var(--t3,#3E5678)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                                                                    -
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>
                                                            {doc.grandTotal.toLocaleString()}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        if (doc.docType === 'Invoice') {
                                                                            setSelectedInvoice(doc);
                                                                            setShowInvoiceModal(true);
                                                                        } else {
                                                                            // Show Sales Order Modal (reusing selected invoice state for now or handle separately)
                                                                            setSelectedInvoice(doc);
                                                                            setShowInvoiceModal(true);
                                                                        }
                                                                    }}
                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t2,#8BA3C7)', padding: 4, display: 'inline-flex', alignItems: 'center' }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#4F8EF7'; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t2,#8BA3C7)'; }}
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                                {doc.docType === 'SalesOrder' &&
                                                                    doc.status === 'Pending' &&
                                                                    doc.workflowStatus === 'delivered' &&
                                                                    doc.podConfirmed &&
                                                                    doc.signatureConfirmed && (
                                                                    <button
                                                                        onClick={() => handleConvertOrder(doc.id)}
                                                                        disabled={converting === doc.id}
                                                                        style={{ padding: '4px 9px', background: '#22C55E', color: '#fff', borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: converting === doc.id ? 0.5 : 1, fontFamily: 'inherit' }}
                                                                    >
                                                                        {converting === doc.id ? '...' : (
                                                                            <>
                                                                                <CheckCircle size={11} />
                                                                                Convert
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                    {/* ITEM 5D — Totals row. Invoices only (sales orders are
                                        pending and excluded from financial totals). */}
                                    {invoices.length > 0 && (() => {
                                        const totalInvoiced = invoices.reduce((s, i) => s + (Number((i as any).grandTotal) || 0), 0);
                                        const totalOutstanding = invoices.reduce((s, i) => {
                                            const grand = Number((i as any).grandTotal) || 0;
                                            const rb = Number((i as any).remaining_balance ?? grand);
                                            return s + Math.max(0, rb);
                                        }, 0);
                                        return (
                                            <tfoot>
                                                <tr style={{ fontWeight: 700 }}>
                                                    <td colSpan={4} style={ledgerTfootStyle}></td>
                                                    <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                                                        <span style={{ display: 'block', color: 'var(--t2,#8BA3C7)' }}>Total Invoiced</span>
                                                        <span style={{ display: 'block', color: '#F59E0B', marginTop: 4 }}>Total Outstanding</span>
                                                    </td>
                                                    <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                                                        <span style={{ display: 'block', color: 'var(--t,#EEF2FF)' }}>{totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        <span style={{ display: 'block', color: '#F59E0B', marginTop: 4 }}>{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    </td>
                                                    <td style={ledgerTfootStyle}></td>
                                                </tr>
                                            </tfoot>
                                        );
                                    })()}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Payments Tab */}
                    {activeTab === 'payments' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Payment History</h3>
                                <button
                                    onClick={() => setShowPaymentModal(true)}
                                    style={{
                                        padding: '6px 13px', background: '#4F8EF7', color: '#fff',
                                        border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    <DollarSign size={13} />
                                    Receive New Payment
                                </button>
                            </div>
                            <div style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden' }} className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr style={{ background: 'var(--bg2,#0a1726)' }}>
                                            <th style={ledgerThStyle}>Date</th>
                                            <th style={ledgerThStyle}>Reference</th>
                                            <th style={ledgerThStyle}>Method</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Amount</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center', width: 80 }}>Receipt</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center', width: 80 }}>Edit</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center', width: 96 }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.length === 0 ? (
                                            <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center' }}>
                                                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 4 }}>No payments yet</div>
                                                <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>No payments recorded for this customer</div>
                                            </td></tr>
                                        ) : (
                                            payments.map(pay => {
                                                const isReversal = (pay.amount ?? 0) < 0 || pay.reference?.startsWith('VOID/');
                                                return (
                                                    <tr
                                                        key={pay.id}
                                                        onMouseEnter={_tableRowHoverEnter}
                                                        onMouseLeave={_tableRowHoverLeave}
                                                        style={{ transition: 'background .15s', background: isReversal ? 'rgba(239,68,68,.04)' : 'transparent' }}
                                                    >
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>{new Date(pay.payment_date).toLocaleDateString()}</td>
                                                        <td style={{ ...ledgerTdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{pay.reference || `PAY-${String(pay.id).slice(-4)}`}</td>
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>{pay.payment_method}</td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: isReversal ? '#EF4444' : '#22C55E' }}>
                                                            {isReversal ? '-' : ''}{Math.abs(pay.amount).toLocaleString()}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t3,#3E5678)', padding: 4 }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.color = '#22C55E'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t3,#3E5678)'; }}
                                                            >
                                                                <Receipt size={16} />
                                                            </button>
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                            {isReversal ? (
                                                                <span style={{ color: 'var(--t3,#3E5678)' }}>—</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => navigate(`/finance/payment-edit?id=${encodeURIComponent(String(pay.id))}`)}
                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t3,#3E5678)', padding: 4 }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#4F8EF7'; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t3,#3E5678)'; }}
                                                                    title="Edit this payment"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                            {isReversal ? (
                                                                <span style={{ fontSize: 9, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '.6px' }}>Reversal</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => void handleVoidPayment(pay)}
                                                                    disabled={voidingPaymentId === String(pay.id)}
                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '.6px', opacity: voidingPaymentId === String(pay.id) ? 0.5 : 1, fontFamily: 'inherit' }}
                                                                    title="Void this payment — creates a reversing entry, keeps the original for audit"
                                                                >
                                                                    {voidingPaymentId === String(pay.id) ? 'Voiding…' : 'Void'}
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                    {payments.length > 0 && (() => {
                                        const totalReceived = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                                        return (
                                            <tfoot>
                                                <tr style={{ fontWeight: 700 }}>
                                                    <td colSpan={3} style={{ ...ledgerTfootStyle, textAlign: 'right', fontSize: 10, color: 'var(--t2,#8BA3C7)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Total Received (net of voids)</td>
                                                    <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'monospace', color: totalReceived >= 0 ? '#22C55E' : '#EF4444' }}>{totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td colSpan={3} style={ledgerTfootStyle}></td>
                                                </tr>
                                            </tfoot>
                                        );
                                    })()}
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'credits' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Credit Notes</h3>
                                <button
                                    onClick={() => navigate('/sales/credit-notes/new', { state: { customerId: customer.id } })}
                                    style={{
                                        padding: '6px 13px', background: '#4F8EF7', color: '#fff',
                                        border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                        cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                >
                                    + New Credit Note
                                </button>
                            </div>
                            {creditNotes.length === 0 ? (
                                <div style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 4 }}>No credit notes yet</div>
                                    <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)', marginBottom: 16 }}>No credit notes recorded for this customer</div>
                                    <button
                                        onClick={() => navigate('/sales/credit-notes/new', { state: { customerId: customer.id } })}
                                        style={{ background: '#4F8EF7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        + Create Credit Note
                                    </button>
                                </div>
                            ) : (
                                <div style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden' }} className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr style={{ background: 'var(--bg2,#0a1726)' }}>
                                                <th style={ledgerThStyle}>CN #</th>
                                                <th style={ledgerThStyle}>Issue Date</th>
                                                <th style={ledgerThStyle}>Reason</th>
                                                <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Total</th>
                                                <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Remaining</th>
                                                <th style={ledgerThStyle}>Status</th>
                                                <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {creditNotes.map(cn => {
                                                const statusLower = String(cn.status).toLowerCase();
                                                const statusBg = statusLower === 'fully_used' ? 'rgba(34,197,94,.12)'
                                                    : statusLower === 'cancelled' ? 'rgba(239,68,68,.12)'
                                                    : statusLower === 'partially_used' ? 'rgba(245,158,11,.12)'
                                                    : 'rgba(79,142,247,.12)';
                                                const statusColor = statusLower === 'fully_used' ? '#16A34A'
                                                    : statusLower === 'cancelled' ? '#B91C1C'
                                                    : statusLower === 'partially_used' ? '#B45309'
                                                    : '#4F8EF7';
                                                return (
                                                    <tr
                                                        key={cn.id}
                                                        onClick={() => navigate(`/sales/credit-notes/${cn.id}`)}
                                                        onMouseEnter={_tableRowHoverEnter}
                                                        onMouseLeave={_tableRowHoverLeave}
                                                        style={{ cursor: 'pointer', transition: 'background .15s' }}
                                                    >
                                                        <td style={{ ...ledgerTdStyle, fontFamily: 'monospace', fontWeight: 700, color: '#4F8EF7' }}>{cn.creditNoteNumber}</td>
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>{cn.issueDate}</td>
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>{cn.reason.replace('_', ' ')}</td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{cn.totalCreditAmount.toLocaleString()}</td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#22C55E' }}>{cn.remainingCredit.toLocaleString()}</td>
                                                        <td style={ledgerTdStyle}>
                                                            <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: statusBg, color: statusColor, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                                                                {cn.status.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'right' }}>
                                                            {cn.status !== 'cancelled' && cn.status !== 'fully_used' ? (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); void cancelNote(cn); }}
                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '.4px', fontFamily: 'inherit' }}
                                                                    title="Cancel this credit note"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            ) : (
                                                                <span style={{ color: 'var(--t3,#3E5678)', fontSize: 11 }}>—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        {creditNotes.length > 0 && (() => {
                                            const totalAvailable = creditNotes
                                                .filter(cn => cn.status !== 'cancelled')
                                                .reduce((s, cn) => s + (Number(cn.remainingCredit) || 0), 0);
                                            const totalIssued = creditNotes
                                                .filter(cn => cn.status !== 'cancelled')
                                                .reduce((s, cn) => s + (Number(cn.totalCreditAmount) || 0), 0);
                                            return (
                                                <tfoot>
                                                    <tr style={{ fontWeight: 700 }}>
                                                        <td colSpan={3} style={{ ...ledgerTfootStyle, textAlign: 'right', fontSize: 10, color: 'var(--t2,#8BA3C7)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Totals</td>
                                                        <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'monospace', color: 'var(--t,#EEF2FF)' }}>{totalIssued.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'monospace', color: '#22C55E' }}>{totalAvailable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        <td colSpan={2} style={ledgerTfootStyle}></td>
                                                    </tr>
                                                </tfoot>
                                            );
                                        })()}
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 11B — Unbilled Expenses tab */}
                    {activeTab === 'unbilled' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Unbilled Expenses</h3>
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2,#8BA3C7)' }}>{unbilledExpenses.length} pending</span>
                            </div>
                            {unbilledExpenses.length === 0 ? (
                                <div style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 4 }}>No billable expenses</div>
                                    <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>No billable expenses tagged to this customer</div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden' }} className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr style={{ background: 'var(--bg2,#0a1726)' }}>
                                                    <th style={ledgerThStyle}>Date</th>
                                                    <th style={ledgerThStyle}>Vendor</th>
                                                    <th style={ledgerThStyle}>Category</th>
                                                    <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Amount</th>
                                                    <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {unbilledExpenses.map(exp => (
                                                    <tr
                                                        key={exp.id}
                                                        onMouseEnter={_tableRowHoverEnter}
                                                        onMouseLeave={_tableRowHoverLeave}
                                                        style={{ transition: 'background .15s' }}
                                                    >
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>{new Date(exp.date).toLocaleDateString()}</td>
                                                        <td style={{ ...ledgerTdStyle, fontWeight: 700 }}>{exp.vendor}</td>
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>{exp.category}</td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{exp.currency} ${exp.amount.toFixed(2)}</td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => void markBilled(exp)}
                                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: '#4F8EF7', textTransform: 'uppercase', letterSpacing: '.4px', fontFamily: 'inherit' }}
                                                                title="Add to next invoice (marker only — real invoice line wiring is a future step)"
                                                            >
                                                                Mark Billed
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p style={{ fontSize: 10, color: 'var(--t3,#3E5678)', fontStyle: 'italic' }}>Marking as billed is a placeholder — real invoice line-item creation is a future integration step.</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── V3 Fix 4 — Expenses tab (7th tab, hardcoded empty state) ── */}
                    {activeTab === 'expenses' && (
                        <div style={{
                            background: 'var(--bg3,#0f1f33)',
                            border: '1px solid rgba(255,255,255,.12)',
                            borderRadius: 12,
                            padding: 40,
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 4 }}>
                                No expenses recorded
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)', marginBottom: 16 }}>
                                No expenses are linked to this customer yet
                            </div>
                            <button style={{
                                background: '#4F8EF7', color: '#fff', border: 'none',
                                borderRadius: 8, padding: '8px 16px',
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'inherit',
                            }}>
                                + Add expense
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal - NEW QuickBooks Style */}
            {showPaymentModal && customer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
                        <PaymentReceipt
                            customer={customer}
                            onBack={() => {
                                setShowPaymentModal(false);
                                loadAllData(); // Refresh data after payment
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Invoice Detail Modal */}
            {showInvoiceModal && selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-sm shadow-2xl w-full max-w-3xl overflow-hidden">
                        <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <FileText size={20} className="text-blue-400" />
                                    Invoice Detail
                                </h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">{selectedInvoice.invoiceNumber}</p>
                            </div>
                            <button
                                onClick={() => { setShowInvoiceModal(false); setSelectedInvoice(null); }}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-8 max-h-[80vh] overflow-y-auto">
                            <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-8">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer / Entity</p>
                                        <p className="text-xl font-black text-gray-900 leading-tight">{selectedInvoice.customerName}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-1">Registry Code: {customer.code}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-8 pt-2">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Instrument Date</p>
                                            <p className="text-xs font-black text-gray-700">{new Date(selectedInvoice.invoiceDate || selectedInvoice.orderDate).toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Maturity Date</p>
                                            <p className="text-xs font-black text-gray-700">{selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString() : 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-8 pt-2">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Field Salesman</p>
                                            <p className="text-xs font-black text-gray-700">{selectedInvoice.salesman || 'Direct Office'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Logistics / Van</p>
                                            <p className="text-xs font-black text-gray-700">{selectedInvoice.van || 'Customer Pickup'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right space-y-6">
                                    <div className="inline-block px-4 py-1.5 bg-gray-50 border-2 border-dashed border-blue-500/30 rounded-full">
                                        <p className="text-[9px] font-black text-blue-800 uppercase text-center tracking-widest">{selectedInvoice.docType === 'Invoice' ? 'Sequential Invoice' : 'Pending Requisition'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Receivable</p>
                                        <p className="text-3xl font-black text-redwood-brand font-mono tracking-tighter">{selectedCurrency.symbol}{selectedInvoice.grandTotal.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-8 p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Statement Currency for Print/Share</label>
                                <div className="w-64">
                                    <SearchableSelect
                                        options={WORLD_CURRENCIES}
                                        value={selectedCurrency.code}
                                        onChange={(code) => {
                                            const curr = WORLD_CURRENCIES.find(c => c.code === code);
                                            if (curr) setSelectedCurrency(curr);
                                        }}
                                        displayKey="label"
                                        placeholder="Select settlement currency..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xs font-black text-gray-900 uppercase border-b border-gray-900 pb-2">Line Items</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="py-3 text-[10px] font-black text-gray-500 uppercase">Item Description</th>
                                                <th className="py-3 text-[10px] font-black text-gray-500 uppercase text-center w-20">Qty</th>
                                                <th className="py-3 text-[10px] font-black text-gray-500 uppercase text-right w-32">Rate</th>
                                                <th className="py-3 text-[10px] font-black text-gray-500 uppercase text-right w-32">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {selectedInvoice.lineItems.map((item: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="py-4">
                                                        <p className="text-sm font-bold text-gray-900">{item.product}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                                    </td>
                                                    <td className="py-4 text-sm font-bold text-gray-700 text-center">{item.quantity}</td>
                                                    <td className="py-4 text-sm font-bold text-gray-600 text-right font-mono">{selectedCurrency.symbol}{item.rate.toLocaleString()}</td>
                                                    <td className="py-4 text-sm font-black text-gray-900 text-right font-mono">{selectedCurrency.symbol}{item.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="border-t-2 border-gray-900 pt-6 flex justify-end">
                                    <div className="w-64 space-y-3">
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-600 uppercase tracking-widest">
                                            <span>Subtotal</span>
                                            <span className="font-mono text-gray-900 font-black">{selectedCurrency.symbol}{selectedInvoice.subtotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-600 uppercase tracking-widest">
                                            <span>Fiscal Levies</span>
                                            <span className="font-mono text-gray-900 font-black">{selectedCurrency.symbol}{selectedInvoice.taxAmount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-5 mt-2 border-t border-gray-100">
                                            <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Gross Total ({selectedCurrency.code})</span>
                                            <span className="text-2xl font-black text-redwood-brand font-mono tracking-tighter">{selectedCurrency.symbol}{selectedInvoice.grandTotal.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedInvoice.notes && (
                                    <div className="mt-8 p-4 bg-gray-50 border-l-4 border-gray-300 rounded-r-sm">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Notes</p>
                                        <p className="text-xs text-gray-600 leading-relaxed font-medium">{selectedInvoice.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-gray-50 px-6 py-4 flex justify-between border-t border-gray-100 items-center">
                            <p className="text-[10px] font-bold text-gray-400 italic">Created on {new Date(selectedInvoice.createdAt).toLocaleString()}</p>
                            <button
                                onClick={() => window.print()}
                                className="px-6 py-2 bg-gray-900 text-white text-xs font-bold rounded-sm hover:bg-gray-800 transition-colors uppercase tracking-wider flex items-center gap-2"
                            >
                                <Download size={16} />
                                Print Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {shareMenuInvoiceId &&
                shareMenuPos &&
                (() => {
                    const shareEntry = ledger.find((e) => e.id === shareMenuInvoiceId);
                    const portalInv =
                        shareEntry != null
                            ? invoices.find((i) => String(i.id) === String(shareEntry.relatedId))
                            : undefined;
                    if (!portalInv) return null;

                    const shareOptClass =
                        'w-full flex items-center gap-3 text-left text-[#1a1a1a] hover:bg-[#f3f4f6] cursor-pointer border-0 bg-transparent rounded-none';
                    const shareOptStyle = { padding: '10px 16px', fontSize: '14px' } as const;

                    const closeShareMenu = () => {
                        setShareMenuInvoiceId(null);
                        setShareMenuPos(null);
                    };

                    const finishShare = (res: SharePdfResult) => {
                        closeShareMenu();
                        if (res.showAttachModal) {
                            setShareAttachModal({
                                channel: res.channel,
                                fileName: res.fileName,
                            });
                        }
                    };

                    return createPortal(
                        <>
                            <div
                                style={{ position: 'fixed', inset: 0, zIndex: 99997 }}
                                onClick={closeShareMenu}
                                aria-hidden
                            />
                            <div
                                style={{
                                    position: 'fixed',
                                    top: shareMenuPos.top,
                                    left: shareMenuPos.left,
                                    zIndex: 99999,
                                    background: '#FFFFFF',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                    minWidth: '200px',
                                    overflow: 'hidden',
                                }}
                                onClick={(e) => e.stopPropagation()}
                                role="menu"
                            >
                                <button
                                    type="button"
                                    className={shareOptClass}
                                    style={shareOptStyle}
                                    onClick={() => {
                                        void downloadInvoicePDF(portalInv, companyForShare).finally(closeShareMenu);
                                    }}
                                >
                                    <FileDown className="shrink-0 text-red-600" size={18} />
                                    <span>Download PDF</span>
                                </button>
                                <button
                                    type="button"
                                    className={shareOptClass}
                                    style={shareOptStyle}
                                    onClick={async () => {
                                        await downloadInvoiceWord(portalInv, companyForShare);
                                        closeShareMenu();
                                    }}
                                >
                                    <FileText className="shrink-0 text-blue-600" size={18} />
                                    <span>Download Word</span>
                                </button>
                                <button
                                    type="button"
                                    className={shareOptClass}
                                    style={shareOptStyle}
                                    onClick={() => {
                                        void shareInvoicePDF(portalInv, companyForShare, 'whatsapp').then(finishShare);
                                    }}
                                >
                                    <MessageCircle className="shrink-0 text-emerald-600" size={18} />
                                    <span>WhatsApp</span>
                                </button>
                                <button
                                    type="button"
                                    className={shareOptClass}
                                    style={shareOptStyle}
                                    onClick={() => {
                                        void shareInvoicePDF(portalInv, companyForShare, 'sms').then(finishShare);
                                    }}
                                >
                                    <Smartphone className="shrink-0 text-orange-600" size={18} />
                                    <span>SMS / Text Message</span>
                                </button>
                                <button
                                    type="button"
                                    className={shareOptClass}
                                    style={shareOptStyle}
                                    onClick={() => {
                                        void shareInvoicePDF(portalInv, companyForShare, 'email').then(finishShare);
                                    }}
                                >
                                    <Mail className="shrink-0 text-gray-600" size={18} />
                                    <span>Email</span>
                                </button>
                                <button
                                    type="button"
                                    className={shareOptClass}
                                    style={shareOptStyle}
                                    onClick={() => {
                                        void shareInvoicePDF(portalInv, companyForShare, 'copy').then(() =>
                                            closeShareMenu()
                                        );
                                    }}
                                >
                                    <Link2 className="shrink-0 text-violet-700" size={18} />
                                    <span>Copy link</span>
                                </button>
                            </div>
                        </>,
                        document.body
                    );
                })()}

            {shareAttachModal && (
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="share-attach-modal-title"
                    onClick={() => setShareAttachModal(null)}
                >
                    <div
                        className="bg-white rounded-sm border border-redwood-border shadow-xl max-w-md w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-redwood-border bg-redwood-bg-light/50">
                            <h2
                                id="share-attach-modal-title"
                                className="text-lg font-black text-redwood-text-main uppercase tracking-tight"
                            >
                                {shareAttachModal.channel === 'whatsapp' && 'Share Invoice on WhatsApp'}
                                {shareAttachModal.channel === 'sms' && 'Share Invoice via SMS'}
                                {shareAttachModal.channel === 'email' && 'Share Invoice via Email'}
                            </h2>
                        </div>
                        <div className="px-6 py-5 text-sm text-gray-700 leading-relaxed space-y-4">
                            {shareAttachModal.channel === 'whatsapp' && (
                                <p className="whitespace-pre-line">
                                    {`Your PDF has been downloaded as:\n${shareAttachModal.fileName}\n\nTo attach it on WhatsApp Web:\n1. Find the downloaded PDF in your Downloads folder\n2. In WhatsApp Web click the 📎 paperclip/attach button\n3. Select the PDF file\n4. Send to your customer`}
                                </p>
                            )}
                            {shareAttachModal.channel === 'sms' && (
                                <p className="whitespace-pre-line">
                                    {`Your PDF has been downloaded as:\n${shareAttachModal.fileName}\n\nTo attach it in the Messages app:\n1. Find the downloaded PDF in your Downloads folder (or Files on mobile)\n2. Open or start your SMS conversation with your customer\n3. Tap the attach / paperclip icon and choose the PDF\n4. Send the message`}
                                </p>
                            )}
                            {shareAttachModal.channel === 'email' && (
                                <p className="whitespace-pre-line">
                                    {`Your PDF has been downloaded as:\n${shareAttachModal.fileName}\n\nTo attach it in your email:\n1. Find the downloaded PDF in your Downloads folder\n2. In your email window, click attach / paperclip\n3. Select the PDF file\n4. Send to your customer`}
                                </p>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-redwood-border flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setShareAttachModal(null)}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-sm border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-100 uppercase tracking-wide"
                            >
                                Close
                            </button>
                            {shareAttachModal.channel === 'whatsapp' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.open('https://web.whatsapp.com', '_blank', 'noopener,noreferrer');
                                    }}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-sm bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 uppercase tracking-wide"
                                >
                                    Open WhatsApp Web
                                </button>
                            )}
                            {shareAttachModal.channel === 'sms' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.location.href = 'sms:';
                                    }}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-sm bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 uppercase tracking-wide"
                                >
                                    Open Messages
                                </button>
                            )}
                            {shareAttachModal.channel === 'email' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.open('mailto:', '_blank', 'noopener,noreferrer');
                                    }}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-sm bg-gray-700 text-white text-sm font-bold hover:bg-gray-800 uppercase tracking-wide"
                                >
                                    Open email
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}