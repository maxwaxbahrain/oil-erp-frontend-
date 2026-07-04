import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    FileText,
    DollarSign,
    ShoppingCart,
    Edit,
    Download,
    X,
    Eye,
    CheckCircle,
    Receipt,
    Save,
    Package,
    Clock,
    Mail,
    Share2,
    MessageSquare,
    Send,
    ChevronDown
} from 'lucide-react';
// ITEM 16 — Escape closes the Send Payment modal.
import { useEscape } from '../../hooks/useEscape';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { generateStandardPDF } from '../../utils/documentGenerator';
import { formatDateOnly, parseDateOnlyLocal } from '../../utils/formatters';
import {
    getCompanyProfile, getSystemSettings, formatCurrency} from '../../services/settingsService';
import {
    createSupplierPayment,
    updatePurchaseOrder,
    updateSupplier,
    type Supplier,
    type PurchaseOrder,
    type SupplierPayment,
    type SupplierLedgerEntry
} from '../../services/purchasesService';
import { authFetch } from '../../api/axios';
import { getSupplierLedger, type PartyLedgerRow } from '../../services/api';

// SupplierDetail v3 (direct API): bypasses the service layer for read paths
// so cached old bundles can't show stale localStorage data. Writes still
// go through the service (createSupplierPayment / updateSupplier).
const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
const SUPPLIERS_API = `${API_HOST}/api/suppliers`;

/** Calendar date in the user's local timezone as ``YYYY-MM-DD`` (for ``type="date"`` inputs). */
function todayIsoLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Map backend PartyLedgerRow → display row; running_balance from API only. */
function mapSupplierPartyRow(row: PartyLedgerRow): SupplierLedgerEntry {
    const rawType = (row.type || '').toLowerCase();
    return {
        id: String(row.id),
        date: row.date ?? '',
        type: rawType === 'payment' ? 'Payment' : 'Purchase',
        referenceNumber: row.reference || '',
        description: row.description || '',
        debit: Number(row.debit) || 0,
        credit: Number(row.credit) || 0,
        balance: Number(row.running_balance) || 0,
        relatedId: row.purchase_order_id != null ? String(row.purchase_order_id) : String(row.id),
    };
}

const fromApiSupplier = (r: any): Supplier => ({
    id: String(r.id),
    name: r.name || '',
    code: r.code || '',
    contactPerson: r.contact_person || '',
    email: r.email || '',
    phone: r.phone || '',
    address: r.address || '',
    taxId: r.tax_id || '',
    status: (r.status === 'Blocked' ? 'Blocked' : 'Active'),
    paymentTerms: r.payment_terms || 'Net 30',
    currency: r.currency || 'USD',
    rating: r.rating || undefined,
    creditLimit: typeof r.credit_limit === 'number' ? r.credit_limit : 0,
    openingBalance: typeof r.opening_balance === 'number' ? r.opening_balance : 0,
    notes: r.notes || '',
});

const fetchSupplierFromApi = async (id: string): Promise<Supplier | null> => {
    try {
        const r = await authFetch(`${SUPPLIERS_API}/${encodeURIComponent(id)}`);
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return fromApiSupplier(await r.json());
    } catch (e) {
        console.error('[SupplierDetail v3] fetchSupplierFromApi failed:', e);
        return null;
    }
};

const fetchSupplierPurchasesFromApi = async (id: string): Promise<PurchaseOrder[]> => {
    try {
        const r = await authFetch(`${SUPPLIERS_API}/${encodeURIComponent(id)}/purchases`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        console.error('[SupplierDetail v3] fetchSupplierPurchasesFromApi failed:', e);
        return [];
    }
};

const fetchSupplierPaymentsFromApi = async (id: string): Promise<SupplierPayment[]> => {
    try {
        const r = await authFetch(`${SUPPLIERS_API}/${encodeURIComponent(id)}/payments`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        console.error('[SupplierDetail v3] fetchSupplierPaymentsFromApi failed:', e);
        return [];
    }
};
import { WORLD_CURRENCIES } from '../../constants/currencies';
import SearchableSelect from '../../components/common/SearchableSelect';
// import SupplierForm from './SupplierForm'; // Remove for now to fix lint

// ─── Dark-theme table styles (match CustomerOverview) ──
const ledgerThStyle: CSSProperties = {
    fontSize: 10, color: 'var(--t3,#3E5678)', fontWeight: 700, letterSpacing: '.5px',
    padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.07)',
    textAlign: 'left', textTransform: 'uppercase',
};

const ledgerTdStyle: CSSProperties = {
    fontSize: 11, color: 'var(--t,#EEF2FF)', padding: '8px 10px',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

const ledgerTfootStyle: CSSProperties = {
    fontSize: 11, color: 'var(--t2,#8BA3C7)', padding: '10px',
    borderTop: '2px solid rgba(255,255,255,.07)', background: 'var(--bg2,#0a1726)',
};

const _tableRowHoverEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.background = 'rgba(255,255,255,.025)';
};
const _tableRowHoverLeave = (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.background = 'transparent';
};

export default function SupplierDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'purchases' | 'payments'>('overview');
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Data state
    const [ledger, setLedger] = useState<SupplierLedgerEntry[]>([]);
    const [ledgerOpeningBalance, setLedgerOpeningBalance] = useState<number | null>(null);
    const [ledgerClosingBalance, setLedgerClosingBalance] = useState<number | null>(null);
    const [ledgerError, setLedgerError] = useState<string | null>(null);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const ledgerRequestRef = useRef(0);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
    const [payments, setPayments] = useState<SupplierPayment[]>([]);

    // Modal state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPOModal, setShowPOModal] = useState(false);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    // ITEM 16 — Escape closes whichever modal is open (PO preview wins
    // precedence since it's typically opened on top of the payment one).
    useEscape(() => {
        if (showPOModal) setShowPOModal(false);
        else if (showEditModal) setShowEditModal(false);
        else if (showPaymentModal) setShowPaymentModal(false);
    }, showPaymentModal || showEditModal || showPOModal);
    const [converting, setConverting] = useState<string | null>(null);
    const [showShareMenu, setShowShareMenu] = useState(false);

    // Payment Form state
    const [paymentForm, setPaymentForm] = useState({
        amount: 0,
        date: todayIsoLocal(),
        paymentMethod: 'Cash',
        reference: '',
        notes: '',
        poId: ''
    });
    // ITEM 6E — Multi-PO checklist state (mirror of customer 5E).
    const [selectedPOIds, setSelectedPOIds] = useState<string[]>([]);
    // ITEM 6G — Pay-from-account (COA 1110 subtree).
    const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; code: string; name: string }>>([]);
    const [payFromAccountId, setPayFromAccountId] = useState<string>('');

    const [selectedCurrency, setSelectedCurrency] = useState(WORLD_CURRENCIES[0]); // Default to USD

    // Check for tab parameter in URL
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tab = searchParams.get('tab');
        if (tab === 'ledger' || tab === 'purchases' || tab === 'payments') {
            setActiveTab(tab as any);
        }
    }, [location.search]);

    // ITEM 6G — Load bank/cash COA accounts (1110 subtree). Same recursive
    // parent-chain walk used on the customer side (5H).
    useEffect(() => {
        (async () => {
            try {
                const { getAccounts } = await import('../Accounts/ChartOfAccounts');
                const all = getAccounts();
                const isUnderCashBank = (a: typeof all[number]): boolean => {
                    if (a.id === '1110') return true;
                    let pid = a.parentId;
                    while (pid) {
                        if (pid === '1110') return true;
                        const parent = all.find(x => x.id === pid);
                        pid = parent ? parent.parentId : null;
                    }
                    return false;
                };
                const bank = all.filter(isUnderCashBank).map(a => ({ id: a.id, code: a.code, name: a.name }));
                setBankAccounts(bank);
                const firstChild = bank.find(a => all.find(x => x.id === a.id)?.parentId === '1110');
                setPayFromAccountId(firstChild?.id || bank.find(a => a.id === '1110')?.id || '');
            } catch (e) {
                console.warn('Could not load COA accounts:', e);
            }
        })();
    }, []);

    // FIX W2-3 — Auto-open the edit modal when the user clicked the
    // per-row Edit button on SupplierList. We clear the history state
    // after consuming it so a refresh doesn't re-open the modal.
    useEffect(() => {
        if ((location.state as any)?.openEdit && supplier) {
            setShowEditModal(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, supplier]);

    // Fetch supplier data — direct API to dodge stale service bundles.
    useEffect(() => {
        const fetchSupplier = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const data = await fetchSupplierFromApi(id);
                if (data) {
                    setSupplier(data);
                } else {
                    // Old URLs like /suppliers/SUP-1700... can't be resolved.
                    // Bounce back to the list rather than alerting in a loop.
                    console.warn(`[SupplierDetail v3] supplier id=${id} not on backend — redirecting to list`);
                    navigate('/purchases/suppliers');
                }
            } catch (error) {
                console.error('[SupplierDetail v3] Error fetching supplier:', error);
                navigate('/purchases/suppliers');
            } finally {
                setLoading(false);
            }
        };
        fetchSupplier();
    }, [id, navigate]);

    // Root B — ledger display from API (opening/closing/running from backend).
    const loadLedger = async (start?: string, end?: string) => {
        if (!id) return;
        const reqId = ++ledgerRequestRef.current;
        setLoadingLedger(true);
        setLedgerError(null);
        try {
            const data = await getSupplierLedger(id, start || undefined, end || undefined);
            if (reqId !== ledgerRequestRef.current) return;
            if (!data || !Array.isArray(data.rows)) {
                throw new Error('Invalid ledger response (expected opening_balance, rows, closing_balance)');
            }
            setLedger(data.rows.map(mapSupplierPartyRow));
            setLedgerOpeningBalance(data.opening_balance);
            setLedgerClosingBalance(data.closing_balance);
        } catch (error) {
            if (reqId !== ledgerRequestRef.current) return;
            setLedger([]);
            setLedgerOpeningBalance(null);
            setLedgerClosingBalance(null);
            const msg = error instanceof Error ? error.message : 'Failed to load supplier ledger';
            setLedgerError(msg);
            console.error('Failed to load supplier ledger:', error);
        } finally {
            if (reqId === ledgerRequestRef.current) setLoadingLedger(false);
        }
    };

    // Load detailed data (purchases/payments — ledger loaded separately)
    const loadAllData = async () => {
        if (!id) return;
        try {
            setLoadingDetails(true);
            const [suppPurchases, suppPayments] = await Promise.all([
                fetchSupplierPurchasesFromApi(id),
                fetchSupplierPaymentsFromApi(id),
            ]);

            // eslint-disable-next-line no-console
            console.log(`[SupplierDetail v3] id=${id} fetched POs=${suppPurchases.length} payments=${suppPayments.length}`, { samplePO: suppPurchases[0], samplePayment: suppPayments[0] });

            setPurchases(suppPurchases);
            setPayments(suppPayments);
        } catch (error) {
            console.error('Failed to load supplier details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    useEffect(() => {
        if (id) loadAllData();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        loadLedger(fromDate || undefined, toDate || undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, fromDate, toDate]);

    const handleSendPayment = async () => {
        if (!id || paymentForm.amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            setLoadingDetails(true);
            // ITEM 6E — Multi-PO fan-out. Each selected PO gets its full
            // remaining balance applied in a separate createSupplierPayment.
            // If no PO is selected, fall back to a single direct payment
            // for the user-entered amount.
            const succeeded: string[] = [];
            const failures: Array<{ poNumber?: string; reason: string }> = [];

            if (selectedPOIds.length === 0) {
                // Direct/general payment, no PO link.
                const paymentReference = paymentForm.reference || `PAY-${Date.now().toString().slice(-4)}`;
                try {
                    await createSupplierPayment({
                        supplierId: id,
                        amount: paymentForm.amount,
                        date: paymentForm.date,
                        paymentMethod: paymentForm.paymentMethod,
                        reference: paymentReference,
                        notes: paymentForm.notes,
                        // ITEM 6G — Pay-from-account metadata (backend-forward).
                        pay_from_account_id: payFromAccountId || undefined,
                    } as any);
                    succeeded.push('(direct)');
                } catch (err) {
                    failures.push({ reason: err instanceof Error ? err.message : String(err) });
                }
            } else {
                // Multi-PO: one POST per PO with its full remaining balance.
                for (const poId of selectedPOIds) {
                    const po = purchases.find(p => String(p.id) === poId);
                    if (!po) continue;
                    const poBal = Number(po.remaining_balance ?? po.grandTotal) || 0;
                    if (poBal <= 0.005) continue;
                    const ref = paymentForm.reference || `PAY-RE-${po.poNumber}`;
                    try {
                        await createSupplierPayment({
                            supplierId: id,
                            amount: poBal,
                            date: paymentForm.date,
                            paymentMethod: paymentForm.paymentMethod,
                            reference: ref,
                            notes: paymentForm.notes,
                            // ITEM 6G — Same pay-from account for the whole batch.
                            pay_from_account_id: payFromAccountId || undefined,
                            // Forward the linked PO id as metadata so the backend
                            // can apply it to the right purchase order once the
                            // schema supports it.
                            purchase_order_id: po.id,
                        } as any);
                        succeeded.push(po.poNumber || `#${po.id}`);
                    } catch (err) {
                        failures.push({
                            poNumber: po.poNumber,
                            reason: err instanceof Error ? err.message : String(err),
                        });
                    }
                }
            }

            if (failures.length > 0) {
                const failList = failures.map(f => `• ${f.poNumber || '?'}: ${f.reason}`).join('\n');
                alert(
                    `Recorded ${succeeded.length} of ${succeeded.length + failures.length} payments.\n\n` +
                    `Failed:\n${failList}`
                );
                if (succeeded.length === 0) {
                    setLoadingDetails(false);
                    return;
                }
            }

            setShowPaymentModal(false);
            setSelectedPOIds([]);
            setPaymentForm({
                amount: 0,
                date: todayIsoLocal(),
                paymentMethod: 'Cash',
                reference: '',
                notes: '',
                poId: ''
            });

            await loadAllData();
            await loadLedger(fromDate || undefined, toDate || undefined);
            const msg = succeeded.length === 1
                ? '✅ Payment executed successfully! Ledger and balance have been updated.'
                : `✅ ${succeeded.length} payments recorded. Ledger and balance have been updated.`;
            alert(msg);
        } catch (error) {
            console.error('Failed to record payment:', error);
            alert('❌ Execution failed. Please verify network connectivity.');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleConvertOrder = async (orderId: string) => {
        try {
            setConverting(orderId);
            await updatePurchaseOrder(orderId, { status: 'Received' });
            await loadAllData();
            await loadLedger(fromDate || undefined, toDate || undefined);
            alert('✅ Order converted to Purchase Order successfully!');
        } catch (error) {
            console.error('Failed to convert order:', error);
            alert('❌ Failed to convert order');
        } finally {
            setConverting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-redwood-brand mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading supplier...</p>
                </div>
            </div>
        );
    }

    if (!supplier) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <p className="text-gray-600">Supplier not found</p>
                    <button
                        onClick={() => navigate('/purchases/suppliers')}
                        className="mt-4 px-4 py-2 bg-redwood-brand text-white rounded-sm"
                    >
                        Back to Suppliers
                    </button>
                </div>
            </div>
        );
    }

    const outstandingBalance = ledgerClosingBalance ?? (ledger.length > 0 ? ledger[ledger.length - 1].balance : supplier.openingBalance ?? 0);
    const totalPurchases = purchases.filter(p => p.status !== 'Draft' && p.status !== 'Pending').reduce((sum, p) => sum + p.grandTotal, 0);
    const _liabilityColor = outstandingBalance > 0 ? '#EF4444' : outstandingBalance < 0 ? '#22C55E' : '#4F8EF7';
    const _creditLimitDisplay = supplier.creditLimit && supplier.creditLimit > 0 ? supplier.creditLimit : 0;
    const _ratingLabel = supplier.rating ? `Tier ${supplier.rating}` : 'Tier A';
    const _ratingColor = supplier.rating === 'A' ? '#22C55E' : supplier.rating === 'B' ? '#F59E0B' : '#EF4444';
    const _lastPurchaseDays = purchases.length > 0 ? (() => {
        const poDate = parseDateOnlyLocal(purchases[0].date);
        return poDate ? Math.floor((new Date().getTime() - poDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
    })() : null;

    const handleExportPDF = () => {
        if (!supplier) return;

        generateStandardPDF(
            "SUPPLIER LEDGER STATEMENT",
            `Ledger_${supplier.name.replace(/\s+/g, '_')}`,
            (doc) => {
                let currentY = 100;

                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text("SUPPLIER INFORMATION", 14, currentY);
                doc.line(14, currentY + 2, 100, currentY + 2);

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(`Supplier: ${supplier.name}`, 14, currentY + 10);
                doc.text(`Code: ${supplier.code}`, 14, currentY + 15);
                doc.text(`Contact: ${supplier.contactPerson}`, 14, currentY + 20);
                doc.text(`Email: ${supplier.email}`, 14, currentY + 25);

                doc.setFont('helvetica', 'bold');
                doc.text(`Outstanding Balance: ${outstandingBalance.toLocaleString()}`, 14, currentY + 35);

                const tableData = ledger.map((entry: any) => [
                    formatDateOnly(entry.date),
                    entry.description,
                    entry.referenceNumber,
                    entry.debit > 0 ? entry.debit.toLocaleString() : '-',
                    entry.credit > 0 ? entry.credit.toLocaleString() : '-',
                    entry.balance.toLocaleString()
                ]);

                autoTable(doc, {
                    startY: currentY + 45,
                    head: [['Date', 'Description', 'Reference', 'Debit (-)', 'Credit (+)', 'Balance']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
                    styles: { fontSize: 8, cellPadding: 3 },
                    columnStyles: {
                        3: { halign: 'right' },
                        4: { halign: 'right' },
                        5: { halign: 'right' }
                    }
                });

                const finalY = (doc as any).lastAutoTable.cursor.y + 10;
                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text(`Total Payments (Debit): ${ledger.reduce((sum, e) => sum + (e.debit || 0), 0).toLocaleString()}`, 14, finalY);
                doc.text(`Total Purchases (Credit): ${ledger.reduce((sum, e) => sum + (e.credit || 0), 0).toLocaleString()}`, 14, finalY + 5);
                doc.text(`Closing Balance: ${outstandingBalance.toLocaleString()}`, 14, finalY + 10);
            },
            'ledger'
        );
    };

    const handleExportPODocument = (po: PurchaseOrder) => {
        generateStandardPDF(
            "PURCHASE ORDER",
            `PO_${po.poNumber}`,
            (doc) => {
                let currentY = 100;

                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text("SUPPLIER DETAILS", 14, currentY);
                doc.line(14, currentY + 2, 80, currentY + 2);

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(`Supplier: ${po.supplierName}`, 14, currentY + 10);
                doc.text(`PO Number: ${po.poNumber}`, 140, currentY + 10);
                doc.text(`Date: ${formatDateOnly(po.date)}`, 140, currentY + 15);
                doc.text(`Expected Date: ${po.expectedDate ? formatDateOnly(po.expectedDate) : 'N/A'}`, 140, currentY + 20);

                const itemData = po.items.map((item, idx) => [
                    idx + 1,
                    item.productName,
                    item.quantity,
                    item.unitPrice.toLocaleString(),
                    item.total.toLocaleString()
                ]);

                autoTable(doc, {
                    startY: currentY + 40,
                    head: [['No.', 'Product Name', 'Qty', 'Unit Price', 'Total']],
                    body: itemData,
                    theme: 'striped',
                    headStyles: { fillColor: [20, 20, 20] }
                });

                const finalY = (doc as any).lastAutoTable.cursor.y + 10;
                doc.text(`Subtotal: ${po.subtotal.toLocaleString()}`, 140, finalY);
                doc.text(`Tax Total: ${po.taxTotal.toLocaleString()}`, 140, finalY + 5);
                doc.text(`Grand Total: ${po.grandTotal.toLocaleString()}`, 140, finalY + 10);
            },
            'po'
        );
    };

    const handleSharePO = (po: PurchaseOrder, method: 'email' | 'whatsapp' | 'sms') => {
        const profile = getCompanyProfile();
        const subject = encodeURIComponent(`Purchase Order - ${po.poNumber} - ${profile.name}`);
        const body = encodeURIComponent(`Dear Sir/Madam,\n\nPlease find attached the Purchase Order ${po.poNumber} for your reference.\n\nOrder Details:\n- PO Number: ${po.poNumber}\n- Date: ${formatDateOnly(po.date)}\n- Amount: ${po.grandTotal.toLocaleString()}\n\nBest regards,\n${profile.name}\n${profile.phone}`);

        if (method === 'email') {
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
        } else if (method === 'whatsapp') {
            const waText = encodeURIComponent(`*Purchase Order - ${po.poNumber}*\n\nDear Supplier,\n\nI'm sharing the Purchase Order ${po.poNumber} with you.\n\n📄 Date: ${formatDateOnly(po.date)}\n💰 Amount: ${po.grandTotal.toLocaleString()}\n\nSent via SOLTOL ONE`);
            window.open(`https://wa.me/?text=${waText}`, '_blank');
        } else {
            window.location.href = `sms:?body=${encodeURIComponent(`PO ${po.poNumber} from ${profile.name}. Amount: ${po.grandTotal.toLocaleString()}`)}`;
        }
    };

    const handleExportExcel = () => {
        if (!supplier) return;

        const worksheetData = [
            ["SUPPLIER LEDGER STATEMENT"],
            [`Supplier: ${supplier.name}`],
            [`Code: ${supplier.code}`],
            [`Generated: ${new Date().toLocaleString()}`],
            [],
            ["Date", "Type", "Reference", "Description", "Debit (-)", "Credit (+)", "Balance"],
            ...ledger.map(entry => [
                formatDateOnly(entry.date),
                entry.type,
                entry.referenceNumber,
                entry.description,
                entry.debit || 0,
                entry.credit || 0,
                entry.balance || 0
            ]),
            [],
            ["", "", "", "TOTALS",
                ledger.reduce((sum, e) => sum + (e.debit || 0), 0),
                ledger.reduce((sum, e) => sum + (e.credit || 0), 0),
                outstandingBalance
            ]
        ];

        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ledger");
        XLSX.writeFile(wb, `Ledger_${supplier.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleShareEmail = () => {
        if (!supplier) return;
        const profile = getCompanyProfile();
        const subject = encodeURIComponent(`Ledger Statement - ${supplier.name} - ${profile.name}`);
        const body = encodeURIComponent(`Dear Sir/Madam,\n\nPlease find the ledger summary for ${supplier.name} attached.\n\nAccount Summary:\n- Outstanding Balance: ${outstandingBalance.toLocaleString()}\n- Total Purchases: ${totalPurchases.toLocaleString()}\n\nBest regards,\n${profile.name}\n${profile.phone}`);
        window.location.href = `mailto:${supplier.email}?cc=${profile.email}&subject=${subject}&body=${body}`;
    };

    const handleShareWhatsApp = () => {
        if (!supplier) return;
        const profile = getCompanyProfile();
        const text = encodeURIComponent(`*Ledger Statement - ${supplier.name}*\n\nPeriod: ${new Date().toLocaleDateString()}\nOutstanding Balance: ${outstandingBalance.toLocaleString()}\nCompany: ${profile.name}\n\nSent via SOLTOL ONE`);
        window.open(`https://wa.me/${supplier.phone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
    };

    const handleShareSMS = () => {
        if (!supplier) return;
        const profile = getCompanyProfile();
        const text = encodeURIComponent(`Ledger for ${supplier.name} from ${profile.name}. Balance: ${outstandingBalance.toLocaleString()}`);
        window.location.href = `sms:${supplier.phone.replace(/[^0-9]/g, '')}?body=${text}`;
    };

    return (
        <div className="p-6 space-y-6">
            {/* ── V3 Header — dark Soltol shell (matches CustomerOverview) ── */}
            <div style={{ background: 'var(--bg2,#0a1726)', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '14px 18px', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <div style={{
                        width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.06)',
                        border: '1px solid rgba(255,255,255,.07)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <button
                            type="button"
                            onClick={() => navigate('/purchases/suppliers')}
                            aria-label="Back to suppliers"
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
                        {(supplier.name ?? 'SU').substring(0, 2).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>
                                {supplier.name}
                            </span>
                            <span style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 8,
                                background: 'rgba(255,255,255,.08)', color: 'var(--t2,#8BA3C7)', fontWeight: 600,
                            }}>
                                {supplier.code || `SUP-${id?.slice(-4)}`}
                            </span>
                            <span style={{
                                fontSize: 10, padding: '2px 9px', borderRadius: 20,
                                background: supplier.status === 'Active' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                                border: supplier.status === 'Active' ? '1px solid rgba(34,197,94,.25)' : '1px solid rgba(239,68,68,.25)',
                                color: supplier.status === 'Active' ? '#22C55E' : '#EF4444', fontWeight: 700,
                            }}>
                                ● {supplier.status === 'Active' ? 'Active' : supplier.status}
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>
                            {supplier.address || 'No address on file'}
                            {' · '}
                            {supplier.paymentTerms || 'Net 30'} terms
                            {' · '}
                            {supplier.currency || 'USD'}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/purchases/new', { state: { supplierId: supplier.id, supplierName: supplier.name } })}
                        style={{
                            background: '#4F8EF7', color: '#fff', border: 'none',
                            borderRadius: 8, padding: '7px 13px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        📄 New purchase order
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
                        💵 Send payment
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/purchases/new', { state: { supplierId: supplier.id, supplierName: supplier.name, isPending: true } })}
                        style={{
                            background: 'transparent', color: 'var(--t2,#8BA3C7)',
                            border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '7px 13px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        🛒 New pending order
                    </button>

                    <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,.07)', margin: '0 2px' }} />

                    <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        style={{
                            background: 'transparent', color: 'var(--t2,#8BA3C7)',
                            border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '7px 13px',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        ✏ Edit supplier
                    </button>
                </div>
            </div>

            {/* ── V3 Stats Row ── */}
            {(() => {
                const liabilityValue = outstandingBalance > 0
                    ? outstandingBalance.toLocaleString()
                    : outstandingBalance < 0
                        ? `+${Math.abs(outstandingBalance).toLocaleString()} credit`
                        : '0';
                const statCells: Array<{ label: string; value: string; color: string; sub: string; subColor?: string }> = [
                    {
                        label: 'Outstanding Liability',
                        value: liabilityValue,
                        color: _liabilityColor,
                        sub: outstandingBalance > 0 ? 'Amount owed' : outstandingBalance < 0 ? 'Supplier credit' : 'Settled',
                    },
                    {
                        label: 'Total Purchases (YTD)',
                        value: totalPurchases > 0 ? totalPurchases.toLocaleString() : '—',
                        color: '#22C55E',
                        sub: 'This year',
                    },
                    {
                        label: 'Credit Ceiling',
                        value: _creditLimitDisplay > 0 ? formatCurrency(_creditLimitDisplay) : 'Not set',
                        color: '#4F8EF7',
                        sub: _creditLimitDisplay > 0 ? 'Configured limit' : 'No limit set',
                    },
                    {
                        label: 'Overdue',
                        value: outstandingBalance > 0 ? formatCurrency(outstandingBalance) : '$0.00',
                        color: outstandingBalance > 0 ? '#EF4444' : '#22C55E',
                        sub: outstandingBalance > 0 ? 'Outstanding balance' : 'No overdue ✓',
                        subColor: outstandingBalance > 0 ? '#EF4444' : '#22C55E',
                    },
                    {
                        label: 'Last Payment',
                        value: payments.length > 0 && payments[0].amount > 0 ? payments[0].amount.toLocaleString() : '—',
                        color: '#4F8EF7',
                        sub: payments.length > 0 ? formatDateOnly(payments[0].date) : 'N/A',
                    },
                    {
                        label: 'Last Purchase',
                        value: _lastPurchaseDays != null ? `${_lastPurchaseDays} days ago` : 'N/A',
                        color: 'var(--t,#EEF2FF)',
                        sub: purchases.length > 0 ? formatDateOnly(purchases[0].date) : 'No purchases',
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
                        { key: 'purchases', label: 'Purchases' },
                        { key: 'payments', label: 'Payments' },
                    ].map(tab => {
                        const active = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
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
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 10,
                                marginBottom: 10,
                            }}>
                                {/* Supplier information */}
                                <div style={{
                                    background: 'var(--bg3,#0f1f33)',
                                    border: '1px solid rgba(255,255,255,.12)',
                                    borderRadius: 12,
                                    padding: 14,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span aria-hidden>🏭</span> Supplier information
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowEditModal(true)}
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
                                        { label: 'Company', value: supplier.name },
                                        { label: 'Code', value: supplier.code || '—' },
                                        { label: 'Contact', value: supplier.contactPerson || 'N/A' },
                                        { label: 'Email', value: supplier.email || 'N/A', isBlue: true },
                                        { label: 'Phone', value: supplier.phone || 'N/A' },
                                        { label: 'Address', value: supplier.address || 'Not on file' },
                                        { label: 'Tax ID', value: supplier.taxId || 'Not on file' },
                                        { label: 'Payment terms', value: supplier.paymentTerms || 'Net 30' },
                                        { label: 'Currency', value: supplier.currency || 'USD' },
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

                                {/* Payment profile (mirrors Credit health) */}
                                <div style={{
                                    background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.12)',
                                    borderRadius: 12, padding: 14,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>💳 Payment profile</span>
                                        <span style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>supplier terms</span>
                                    </div>

                                    <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
                                        <div style={{ fontSize: 22, fontWeight: 700, color: _ratingColor }}>
                                            {_ratingLabel}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--t3,#3E5678)', marginTop: 2 }}>
                                            Risk rating
                                        </div>
                                    </div>

                                    {[
                                        { label: 'Payment terms', value: supplier.paymentTerms || 'Net 30', color: 'var(--t,#EEF2FF)' },
                                        { label: 'Currency', value: `${supplier.currency || 'USD'}`, color: '#4F8EF7' },
                                        { label: 'Credit limit', value: _creditLimitDisplay > 0 ? formatCurrency(_creditLimitDisplay) : 'Not set', color: '#4F8EF7' },
                                        { label: 'Outstanding', value: outstandingBalance > 0 ? outstandingBalance.toLocaleString() : outstandingBalance < 0 ? `+${Math.abs(outstandingBalance).toLocaleString()} credit` : '0', color: _liabilityColor },
                                        { label: 'Avg lead time', value: '4.2 days', color: '#22C55E' },
                                        { label: 'Order reliability', value: '99.8%', color: '#22C55E' },
                                    ].map(row => (
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

                                {/* Recent activity */}
                                <div style={{
                                    background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.12)',
                                    borderRadius: 12, padding: 14,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>⚡ Recent activity</span>
                                        <span style={{ fontSize: 10, color: 'var(--t3,#3E5678)' }}>latest records</span>
                                    </div>
                                    {[
                                        ...payments.slice(0, 3).map(pay => ({
                                            icon: '💵', bg: 'rgba(34,197,94,.1)',
                                            text: `Payment sent — ${Number(pay.amount ?? 0).toLocaleString()}`,
                                            sub: [pay.reference || `PAY-${String(pay.id).slice(-4)}`, formatDateOnly(pay.date)].filter(Boolean).join(' · '),
                                        })),
                                        ...purchases.slice(0, 2).map(po => ({
                                            icon: '📦', bg: 'rgba(74,143,245,.1)',
                                            text: `Purchase — ${Number(po.grandTotal ?? 0).toLocaleString()}`,
                                            sub: [po.poNumber, formatDateOnly(po.date)].filter(Boolean).join(' · '),
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
                                                width: 28, height: 28, borderRadius: 8, background: item.bg,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            }}>
                                                {item.icon}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ color: 'var(--t,#EEF2FF)', fontWeight: 600 }}>{item.text}</div>
                                                <div style={{ color: 'var(--t3,#3E5678)', fontSize: 10, marginTop: 1 }}>{item.sub}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {payments.length === 0 && purchases.length === 0 && (
                                        <div style={{ fontSize: 11, color: 'var(--t3,#3E5678)', padding: '12px 0' }}>No recent activity.</div>
                                    )}
                                </div>
                            </div>

                            {supplier.notes && (
                                <div style={{
                                    background: 'rgba(250,204,21,.06)', border: '1px solid rgba(250,204,21,.25)',
                                    borderRadius: 10, padding: '12px 14px', marginTop: 4,
                                }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#FACC15', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                        Internal notes
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)', lineHeight: 1.5 }}>{supplier.notes}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Ledger Tab */}
                    {activeTab === 'ledger' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                    Statement of Account
                                </h3>
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={handleExportExcel}
                                        style={{
                                            padding: '6px 12px', background: 'transparent',
                                            border: '1px solid rgba(255,255,255,.12)', borderRadius: 7,
                                            fontSize: 11, fontWeight: 600, color: 'var(--t2,#8BA3C7)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        <Download size={12} /> Export Excel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportPDF}
                                        style={{
                                            padding: '6px 12px', background: 'transparent',
                                            border: '1px solid rgba(255,255,255,.12)', borderRadius: 7,
                                            fontSize: 11, fontWeight: 600, color: 'var(--t2,#8BA3C7)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        <FileText size={12} /> Export PDF
                                    </button>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowShareMenu(!showShareMenu)}
                                            style={{
                                                padding: '6px 12px', background: 'transparent',
                                                border: '1px solid rgba(255,255,255,.12)', borderRadius: 7,
                                                fontSize: 11, fontWeight: 600, color: 'var(--t2,#8BA3C7)',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            <Share2 size={12} /> Share <ChevronDown size={12} />
                                        </button>
                                        {showShareMenu && (
                                            <div style={{
                                                position: 'absolute', right: 0, marginTop: 8, width: 192,
                                                background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.12)',
                                                borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.4)', zIndex: 50, padding: '4px 0',
                                            }}>
                                                <button type="button" onClick={() => { handleShareEmail(); setShowShareMenu(false); }} style={{ width: '100%', padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--t,#EEF2FF)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Mail size={14} color="#4F8EF7" /> Share via Email
                                                </button>
                                                <button type="button" onClick={() => { handleShareWhatsApp(); setShowShareMenu(false); }} style={{ width: '100%', padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--t,#EEF2FF)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <MessageSquare size={14} color="#22C55E" /> Share via WhatsApp
                                                </button>
                                                <button type="button" onClick={() => { handleShareSMS(); setShowShareMenu(false); }} style={{ width: '100%', padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--t,#EEF2FF)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Send size={14} color="#4F8EF7" /> Share via SMS
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

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
                                        value={fromDate}
                                        onChange={e => setFromDate(e.target.value)}
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
                                        value={toDate}
                                        onChange={e => setToDate(e.target.value)}
                                        style={{
                                            background: 'var(--bg4,#142540)', color: 'var(--t,#EEF2FF)',
                                            border: '1px solid rgba(255,255,255,.12)', borderRadius: 6,
                                            padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'inherit',
                                        }}
                                    />
                                </div>
                                {(fromDate || toDate) && (
                                    <button
                                        type="button"
                                        onClick={() => { setFromDate(''); setToDate(''); }}
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
                                {(fromDate || toDate) && (
                                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 600, color: 'var(--t3,#3E5678)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                                        Showing entries from {fromDate || '∞'} to {toDate || 'today'}
                                    </span>
                                )}
                                {ledgerError && (
                                    <p className="text-xs font-bold text-red-600 mt-2" style={{ width: '100%', color: '#EF4444' }}>
                                        {ledgerError}
                                    </p>
                                )}
                            </div>

                            <div className="overflow-x-auto overflow-y-visible" style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10 }}>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr style={{ background: 'var(--bg2,#0a1726)' }}>
                                            <th style={ledgerThStyle}>Date</th>
                                            <th style={ledgerThStyle}>Operation</th>
                                            <th style={ledgerThStyle}>Reference</th>
                                            <th style={ledgerThStyle}>Description</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Debit (-)</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Credit (+)</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Balance</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center', width: 40 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingLedger ? (
                                            <tr>
                                                <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--t2,#8BA3C7)', fontSize: 12 }}>
                                                    Loading ledger...
                                                </td>
                                            </tr>
                                        ) : ledger.length === 0 && !(fromDate || toDate) ? (
                                            <tr>
                                                <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                                                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3,#3E5678)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                                        No commercial records detected.
                                                    </p>
                                                </td>
                                            </tr>
                                        ) : (
                                            <>
                                            {(fromDate || toDate) && ledgerOpeningBalance !== null && (
                                                <tr style={{ background: 'rgba(79,142,247,.08)' }}>
                                                    <td colSpan={6} style={{ ...ledgerTdStyle, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '.5px' }}>
                                                        Opening balance
                                                        <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--t3,#3E5678)', textTransform: 'none' }}>
                                                            (as at {fromDate || 'start'})
                                                        </span>
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>
                                                        {ledgerOpeningBalance.toLocaleString()}
                                                    </td>
                                                    <td style={ledgerTdStyle}></td>
                                                </tr>
                                            )}
                                            {ledger.map(entry => (
                                                <tr
                                                    key={`${entry.type}-${entry.id}`}
                                                    style={{ cursor: entry.type === 'Purchase' ? 'pointer' : 'default' }}
                                                    onClick={() => {
                                                        if (entry.type === 'Purchase') {
                                                            const po = purchases.find(p => p.id === entry.relatedId);
                                                            if (po) {
                                                                setSelectedPO(po);
                                                                setShowPOModal(true);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>
                                                        {formatDateOnly(entry.date)}
                                                    </td>
                                                    <td style={ledgerTdStyle}>
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                                                            background: entry.type === 'Purchase' ? 'rgba(79,142,247,.15)' : entry.type === 'Payment' ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)',
                                                            color: entry.type === 'Purchase' ? '#4F8EF7' : entry.type === 'Payment' ? '#22C55E' : 'var(--t2,#8BA3C7)',
                                                        }}>
                                                            {entry.type}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, fontFamily: 'ui-monospace,monospace', fontWeight: 600 }}>
                                                        {entry.referenceNumber}
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>{entry.description}</td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', color: entry.debit > 0 ? '#22C55E' : 'var(--t3,#3E5678)' }}>
                                                        {entry.debit > 0 ? entry.debit.toLocaleString() : '—'}
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', color: entry.credit > 0 ? '#EF4444' : 'var(--t3,#3E5678)' }}>
                                                        {entry.credit > 0 ? entry.credit.toLocaleString() : '—'}
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>
                                                        {entry.balance.toLocaleString()}
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                        {entry.type === 'Purchase' && (
                                                            <Eye size={16} color="var(--t3,#3E5678)" />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {ledger.length === 0 && (fromDate || toDate) && (
                                                <tr>
                                                    <td colSpan={8} style={{ padding: '24px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--t3,#3E5678)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                                        No transactions in this date range.
                                                    </td>
                                                </tr>
                                            )}
                                            </>
                                        )}
                                    </tbody>
                                    {(fromDate || toDate) && ledgerClosingBalance !== null && (
                                        <tfoot>
                                            <tr style={ledgerTfootStyle}>
                                                <td colSpan={6} style={{ ...ledgerTfootStyle, textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '.5px' }}>
                                                    Closing balance
                                                    <span style={{ marginLeft: 8, fontWeight: 600, textTransform: 'none' }}>
                                                        (as at {toDate || 'today'})
                                                    </span>
                                                </td>
                                                <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>
                                                    {ledgerClosingBalance.toLocaleString()}
                                                </td>
                                                <td style={ledgerTfootStyle}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Purchases Tab */}
                    {activeTab === 'purchases' && (
                        <div className="space-y-6">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--t,#EEF2FF)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ShoppingCart size={14} color="#4F8EF7" />
                                    Purchase Orders
                                </h3>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3,#3E5678)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Unified Order &amp; Purchase Stream</div>
                            </div>
                            <div style={{ background: 'var(--bg3,#0f1f33)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden' }}>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr style={{ background: 'var(--bg2,#0a1726)' }}>
                                            <th style={ledgerThStyle}>Order ID</th>
                                            <th style={ledgerThStyle}>Date</th>
                                            <th style={ledgerThStyle}>Items</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center' }}>Operation Status</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center' }}>Payment Status</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'right' }}>{`Value (${getSystemSettings().defaultCurrencyCode})`}</th>
                                            <th style={{ ...ledgerThStyle, textAlign: 'center', width: 160 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchases.length === 0 ? (
                                            <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center' }}>
                                                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 4 }}>No purchase orders yet</div>
                                                <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>No purchase orders for this supplier</div>
                                            </td></tr>
                                        ) : (
                                            [...purchases]
                                                .sort((a, b) => (parseDateOnlyLocal(b.date)?.getTime() ?? 0) - (parseDateOnlyLocal(a.date)?.getTime() ?? 0))
                                                .map((po) => (
                                                    <tr
                                                        key={po.id}
                                                        onMouseEnter={_tableRowHoverEnter}
                                                        onMouseLeave={_tableRowHoverLeave}
                                                        style={{ transition: 'background .15s' }}
                                                    >
                                                        <td style={{ ...ledgerTdStyle, fontFamily: 'monospace', fontWeight: 700 }}>
                                                            {po.poNumber}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>
                                                            {formatDateOnly(po.date)}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>
                                                            {(po.items?.length ?? 0)} {(po.items?.length ?? 0) === 1 ? 'Item' : 'Items'}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                            {po.status === 'Pending' || po.status === 'Draft' ? (
                                                                <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(245,158,11,.12)', color: '#B45309', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                                                                    🟡 Pending
                                                                </span>
                                                            ) : (
                                                                <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(34,197,94,.12)', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                                                                    🟢 Received
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                            {(() => {
                                                                const grand = Number((po as any).grandTotal) || 0;
                                                                const rb = Number((po as any).remaining_balance ?? grand);
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
                                                            })()}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>
                                                            {po.grandTotal.toLocaleString()}
                                                        </td>
                                                        <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setSelectedPO(po); setShowPOModal(true); }}
                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t2,#8BA3C7)', padding: 4, display: 'inline-flex', alignItems: 'center' }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#4F8EF7'; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t2,#8BA3C7)'; }}
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                                {(po.status === 'Pending' || po.status === 'Draft') && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleConvertOrder(po.id)}
                                                                        disabled={converting === po.id}
                                                                        style={{ padding: '4px 9px', background: '#22C55E', color: '#fff', borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: converting === po.id ? 0.5 : 1, fontFamily: 'inherit' }}
                                                                    >
                                                                        {converting === po.id ? '...' : (
                                                                            <>
                                                                                <CheckCircle size={11} />
                                                                                Receive
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
                                    {purchases.length > 0 && (() => {
                                        const totalPurchases = purchases.reduce((s, p) => s + (Number((p as any).grandTotal) || 0), 0);
                                        const totalOutstanding = purchases.reduce((s, p) => {
                                            const grand = Number((p as any).grandTotal) || 0;
                                            const rb = Number((p as any).remaining_balance ?? grand);
                                            return s + Math.max(0, rb);
                                        }, 0);
                                        return (
                                            <tfoot>
                                                <tr style={{ fontWeight: 700 }}>
                                                    <td colSpan={4} style={ledgerTfootStyle}></td>
                                                    <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                                                        <span style={{ display: 'block', color: 'var(--t2,#8BA3C7)' }}>Total Purchases</span>
                                                        <span style={{ display: 'block', color: '#F59E0B', marginTop: 4 }}>Total Outstanding</span>
                                                    </td>
                                                    <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                                                        <span style={{ display: 'block', color: 'var(--t,#EEF2FF)' }}>{totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                                    type="button"
                                    onClick={() => setShowPaymentModal(true)}
                                    style={{
                                        padding: '6px 13px', background: '#4F8EF7', color: '#fff',
                                        border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    <DollarSign size={13} />
                                    Send Payment
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
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.length === 0 ? (
                                            <tr><td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center' }}>
                                                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t,#EEF2FF)', marginBottom: 4 }}>No payments yet</div>
                                                <div style={{ fontSize: 11, color: 'var(--t2,#8BA3C7)' }}>No payments recorded for this supplier</div>
                                            </td></tr>
                                        ) : (
                                            payments.map(pay => (
                                                <tr
                                                    key={pay.id}
                                                    onMouseEnter={_tableRowHoverEnter}
                                                    onMouseLeave={_tableRowHoverLeave}
                                                    style={{ transition: 'background .15s' }}
                                                >
                                                    <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>{formatDateOnly(pay.date)}</td>
                                                    <td style={{ ...ledgerTdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{pay.reference || `PAY-${pay.id.slice(-4)}`}</td>
                                                    <td style={{ ...ledgerTdStyle, color: 'var(--t2,#8BA3C7)' }}>{pay.paymentMethod}</td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#22C55E' }}>
                                                        {pay.amount.toLocaleString()}
                                                    </td>
                                                    <td style={{ ...ledgerTdStyle, textAlign: 'center' }}>
                                                        <button
                                                            type="button"
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t3,#3E5678)', padding: 4 }}
                                                            onMouseEnter={(e) => { e.currentTarget.style.color = '#22C55E'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t3,#3E5678)'; }}
                                                        >
                                                            <Receipt size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {payments.length > 0 && (() => {
                                        const totalPaid = payments.reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
                                        return (
                                            <tfoot>
                                                <tr style={{ fontWeight: 700 }}>
                                                    <td colSpan={3} style={{ ...ledgerTfootStyle, textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--t2,#8BA3C7)' }}>Total Paid</td>
                                                    <td style={{ ...ledgerTfootStyle, textAlign: 'right', fontFamily: 'monospace', color: '#EF4444' }}>{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td style={ledgerTfootStyle}></td>
                                                </tr>
                                            </tfoot>
                                        );
                                    })()}
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SEND PAYMENT MODAL */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border-2 border-redwood-brand overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-redwood-brand px-8 py-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                                    <DollarSign size={24} />
                                    Send Fund Disbursement
                                </h2>
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-1">Vendor: {supplier.name}</p>
                            </div>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                            >
                                <X size={28} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* ITEM 6E + 6F — Multi-PO checklist. Filters out POs
                                with remaining_balance ≤ 0 (so fully-paid POs no
                                longer appear). Auto-sums selected PO balances
                                into the disbursement amount. */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Apply To Purchase Order(s)
                                    </label>
                                    {(() => {
                                        const open = purchases.filter(p => {
                                            if (p.status === 'Draft') return false;
                                            const bal = Number(p.remaining_balance ?? p.grandTotal) || 0;
                                            return bal > 0.005;
                                        });
                                        return open.length > 0 && (
                                            <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                <button type="button" onClick={() => {
                                                    const ids = open.map(p => String(p.id));
                                                    setSelectedPOIds(ids);
                                                    const total = open.reduce((s, p) => s + (Number(p.remaining_balance ?? p.grandTotal) || 0), 0);
                                                    setPaymentForm(pf => ({ ...pf, amount: Number(total.toFixed(2)) }));
                                                }} className="hover:text-redwood-brand">Select all</button>
                                                <span className="text-gray-300">|</span>
                                                <button type="button" onClick={() => {
                                                    setSelectedPOIds([]);
                                                    setPaymentForm(pf => ({ ...pf, amount: 0 }));
                                                }} className="hover:text-rose-600">Clear</button>
                                            </div>
                                        );
                                    })()}
                                </div>
                                {(() => {
                                    const openPOs = purchases.filter(p => {
                                        if (p.status === 'Draft') return false;
                                        const bal = Number(p.remaining_balance ?? p.grandTotal) || 0;
                                        return bal > 0.005;
                                    });
                                    if (openPOs.length === 0) {
                                        return (
                                            <div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-lg p-4 text-xs text-amber-700">
                                                No open POs with outstanding balance. Submit as a direct payment (leave selection empty).
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="border-2 border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
                                            {openPOs.map(po => {
                                                const idStr = String(po.id);
                                                const isChecked = selectedPOIds.includes(idStr);
                                                const bal = Number(po.remaining_balance ?? po.grandTotal) || 0;
                                                return (
                                                    <label
                                                        key={idStr}
                                                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isChecked ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(ev) => {
                                                                let next: string[];
                                                                if (ev.target.checked) next = [...selectedPOIds, idStr];
                                                                else next = selectedPOIds.filter(x => x !== idStr);
                                                                setSelectedPOIds(next);
                                                                // Auto-sum new selection
                                                                const total = openPOs
                                                                    .filter(p => next.includes(String(p.id)))
                                                                    .reduce((s, p) => s + (Number(p.remaining_balance ?? p.grandTotal) || 0), 0);
                                                                setPaymentForm(pf => ({ ...pf, amount: Number(total.toFixed(2)) }));
                                                            }}
                                                            className="w-4 h-4 rounded border-gray-300 text-redwood-brand focus:ring-redwood-brand"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="text-sm font-bold text-gray-900">{po.poNumber}</div>
                                                            <div className="text-[9px] text-gray-400 uppercase font-bold tracking-widest mt-0.5">
                                                                Status: {po.status}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs font-mono font-black text-rose-600">{formatCurrency(bal)}</div>
                                                            <div className="text-[8px] text-gray-400 uppercase font-bold tracking-widest">Outstanding</div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                                {selectedPOIds.length > 0 && (
                                    <div className="mt-2 bg-emerald-50 border-2 border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                                            {selectedPOIds.length} PO{selectedPOIds.length === 1 ? '' : 's'} selected
                                        </span>
                                        <span className="font-mono font-black text-emerald-900 text-sm">
                                            Total: {formatCurrency(paymentForm.amount)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* ITEM 6G — Pay-From Account dropdown sourced from
                                COA 1110 subtree. Same metadata pattern as 5H. */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                    Pay From Account <span className="text-red-500">*</span>
                                </label>
                                {bankAccounts.length === 0 ? (
                                    <div className="px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-lg text-xs text-amber-800">
                                        No bank or cash accounts configured. Set up sub-accounts under <strong>Chart of Accounts → Cash &amp; Bank (1110)</strong>.
                                    </div>
                                ) : (
                                    <select
                                        value={payFromAccountId}
                                        onChange={(e) => setPayFromAccountId(e.target.value)}
                                        className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-4 text-sm font-black focus:border-redwood-brand focus:bg-white outline-none transition-all uppercase"
                                    >
                                        {bankAccounts.map(a => (
                                            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Operation Date</label>
                                <input
                                    type="date"
                                    value={paymentForm.date}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                                    className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-4 text-sm font-black focus:border-redwood-brand focus:bg-white outline-none transition-all uppercase"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Disbursement Amount</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={paymentForm.amount || ''}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                                        className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-4 text-xl font-black focus:border-redwood-brand focus:bg-white outline-none transition-all font-mono"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Transfer Channel</label>
                                <select
                                    value={paymentForm.paymentMethod}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                                    className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-4 text-sm font-black focus:border-redwood-brand focus:bg-white outline-none transition-all bg-white"
                                >
                                    <option value="Cash">Cash / Petty Cash</option>
                                    <option value="Bank Transfer">Bank Wire (SWIFT)</option>
                                    <option value="Check">Commercial Check</option>
                                    <option value="Zelle">Zelle / App Transfer</option>
                                    <option value="Credit Card">Corporate Credit Card</option>
                                    <option value="Other">Other Adjustment</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Invoice Reference / Internal ID</label>
                            <input
                                type="text"
                                value={paymentForm.reference}
                                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                                className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-4 text-sm font-black focus:border-redwood-brand focus:bg-white outline-none transition-all font-mono placeholder:font-sans"
                                placeholder="Enter invoice No. or reference..."
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Logistics Notes</label>
                            <textarea
                                value={paymentForm.notes}
                                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold focus:border-redwood-brand focus:bg-white outline-none transition-all resize-none"
                                rows={3}
                                placeholder="Add transaction narrative or internal memo..."
                            />
                        </div>
                    </div>

                    <div className="bg-gray-50 px-8 py-6 flex gap-4 justify-end border-t border-gray-100">
                        <button
                            onClick={() => setShowPaymentModal(false)}
                            className="px-6 py-3 bg-white border-2 border-gray-100 rounded-xl text-xs font-black hover:bg-gray-100 transition-all uppercase tracking-widest text-gray-500"
                        >
                            Abort
                        </button>
                        <button
                            onClick={handleSendPayment}
                            disabled={loadingDetails || paymentForm.amount <= 0}
                            className="px-10 py-3 bg-redwood-brand text-white rounded-xl text-xs font-black hover:brightness-95 transition-all flex items-center gap-3 shadow-xl uppercase tracking-[0.15em] disabled:opacity-50"
                        >
                            <Save size={18} />
                            {loadingDetails ? 'Processing...' : 'Execute Payment'}
                        </button>
                    </div>
                </div>
            )}
            {/* EDIT SUPPLIER MODAL */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1000px] border-2 border-redwood-brand animate-in zoom-in-95 duration-200 my-8">
                        <div className="bg-gray-900 border-b border-gray-800 px-8 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <Edit size={24} className="text-amber-400" />
                                Edit Commercial Partner
                            </h2>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={28} />
                            </button>
                        </div>
                        <div className="p-8">
                            {supplier && (
                                <>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Legal Entity Name</label>
                                                <input
                                                    value={supplier.name}
                                                    onChange={e => setSupplier({ ...supplier, name: e.target.value })}
                                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-black focus:border-redwood-brand outline-none transition-all uppercase"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
                                                    <input
                                                        value={supplier.email}
                                                        onChange={e => setSupplier({ ...supplier, email: e.target.value })}
                                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-redwood-brand outline-none transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Phone Number</label>
                                                    <input
                                                        value={supplier.phone}
                                                        onChange={e => setSupplier({ ...supplier, phone: e.target.value })}
                                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-redwood-brand outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Primary Contact Person</label>
                                                <input
                                                    value={supplier.contactPerson}
                                                    onChange={e => setSupplier({ ...supplier, contactPerson: e.target.value })}
                                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-redwood-brand outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Business Address</label>
                                                <textarea
                                                    value={supplier.address || ''}
                                                    onChange={e => setSupplier({ ...supplier, address: e.target.value })}
                                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-redwood-brand outline-none transition-all"
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tax ID / VAT</label>
                                                    <input
                                                        type="text"
                                                        value={supplier.taxId || ''}
                                                        onChange={e => setSupplier({ ...supplier, taxId: e.target.value })}
                                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-black focus:border-redwood-brand outline-none transition-all"
                                                        placeholder="e.g. TAX-12345"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Payment Terms</label>
                                                    <select
                                                        value={supplier.paymentTerms || 'Net 30'}
                                                        onChange={e => setSupplier({ ...supplier, paymentTerms: e.target.value })}
                                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-black focus:border-redwood-brand outline-none transition-all"
                                                    >
                                                        <option>Net 7</option>
                                                        <option>Net 15</option>
                                                        <option>Net 30</option>
                                                        <option>Net 45</option>
                                                        <option>Net 60</option>
                                                        <option>Advance Payment</option>
                                                        <option>COD</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Credit Limit</label>
                                                    <input
                                                        type="number"
                                                        value={supplier.creditLimit || ''}
                                                        onChange={e => setSupplier({ ...supplier, creditLimit: parseFloat(e.target.value) || 0 })}
                                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-black focus:border-redwood-brand outline-none transition-all font-mono"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Fiscal Currency</label>
                                                    <select
                                                        value={supplier.currency || 'USD'}
                                                        onChange={e => setSupplier({ ...supplier, currency: e.target.value })}
                                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-black focus:border-redwood-brand outline-none transition-all"
                                                    >
                                                        <option>USD</option>
                                                        <option>AED</option>
                                                        <option>BHD</option>
                                                        <option>{getSystemSettings().defaultCurrencyCode}</option>
                                                        <option>GBP</option>
                                                        <option>EUR</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Internal Notes</label>
                                                <textarea
                                                    value={supplier.notes || ''}
                                                    onChange={e => setSupplier({ ...supplier, notes: e.target.value })}
                                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-redwood-brand outline-none transition-all"
                                                    rows={2}
                                                    placeholder="Internal notes about this supplier..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-gray-100">
                                        <button className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all" onClick={() => setShowEditModal(false)}>Cancel</button>
                                        <button className="px-10 py-2.5 bg-redwood-brand text-white rounded-lg text-xs font-black uppercase tracking-widest hover:brightness-95 transition-all shadow-lg flex items-center gap-2" onClick={async () => {
                                            if (supplier) await updateSupplier(supplier.id, supplier);
                                            setShowEditModal(false);
                                            alert('✅ Supplier updated successfully!');
                                        }}>
                                            <Save size={18} />
                                            Commit Changes
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PURCHASE ORDER MODAL */}
            {showPOModal && selectedPO && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200">
                        <div className="bg-gray-900 border-b border-gray-800 px-8 py-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <FileText size={20} className="text-blue-400" />
                                    Purchase Order Document
                                </h2>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mt-1">{selectedPO.poNumber}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleExportPODocument(selectedPO)}
                                    className="p-2.5 bg-gray-800 text-gray-400 hover:text-white rounded-sm transition-all"
                                    title="Download PDF"
                                >
                                    <Download size={20} />
                                </button>
                                <div className="relative group/share">
                                    <button
                                        className="p-2.5 bg-gray-800 text-gray-400 hover:text-white rounded-sm transition-all flex items-center gap-2"
                                    >
                                        <Share2 size={20} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Share</span>
                                    </button>
                                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-sm shadow-2xl z-50 py-2 opacity-0 group-hover/share:opacity-100 pointer-events-none group-hover/share:pointer-events-auto transition-all">
                                        <button onClick={() => handleSharePO(selectedPO, 'email')} className="w-full px-4 py-2 text-left text-[10px] font-black text-gray-600 hover:bg-gray-50 flex items-center gap-3 uppercase tracking-widest">
                                            <Mail size={14} className="text-blue-500" /> Email Link
                                        </button>
                                        <button onClick={() => handleSharePO(selectedPO, 'whatsapp')} className="w-full px-4 py-2 text-left text-[10px] font-black text-gray-600 hover:bg-gray-50 flex items-center gap-3 uppercase tracking-widest">
                                            <MessageSquare size={14} className="text-emerald-500" /> WhatsApp
                                        </button>
                                        <button onClick={() => handleSharePO(selectedPO, 'sms')} className="w-full px-4 py-2 text-left text-[10px] font-black text-gray-600 hover:bg-gray-50 flex items-center gap-3 uppercase tracking-widest">
                                            <Send size={14} className="text-blue-400" /> SMS
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowPOModal(false); setSelectedPO(null); }}
                                    className="text-gray-400 hover:text-white transition-all p-2 hover:bg-white/10 rounded-full ml-4"
                                >
                                    <X size={28} />
                                </button>
                            </div>
                        </div>

                        <div className="p-10 max-h-[80vh] overflow-y-auto font-inter">
                            <div className="flex justify-between items-start mb-12">
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Commercial Partner</p>
                                        <p className="text-2xl font-black text-gray-900 uppercase tracking-tighter">{selectedPO.supplierName}</p>
                                        <p className="text-sm font-bold text-redwood-brand mt-1 italic">Authorized Vendor Network</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-12">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Issue Date</p>
                                            <p className="text-sm font-black text-gray-700">{formatDateOnly(selectedPO.date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Expected Delivery</p>
                                            <p className="text-sm font-black text-gray-700">{selectedPO.expectedDate ? formatDateOnly(selectedPO.expectedDate) : 'Immediate'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-12 mt-6">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Logistics Agent</p>
                                            <p className="text-sm font-black text-gray-700">{selectedPO.salesman || 'Unassigned'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Transport Vehicle</p>
                                            <p className="text-sm font-black text-gray-700">{selectedPO.van || 'Unassigned'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right space-y-6">
                                    <div className={`inline-block px-6 py-2 border-2 rounded-sm font-black text-[11px] uppercase tracking-[0.2em] ${selectedPO.status === 'Received' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-amber-50 border-amber-500 text-amber-700'
                                        }`}>
                                        {selectedPO.status}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fiscal Liability</p>
                                        <p className="text-4xl font-black text-redwood-brand tracking-tighter font-mono">{selectedCurrency.symbol}{selectedPO.grandTotal.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-10 p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Display Currency for Print/Share</label>
                                <div className="w-64">
                                    <SearchableSelect
                                        options={WORLD_CURRENCIES}
                                        value={selectedCurrency.code}
                                        onChange={(code) => {
                                            const curr = WORLD_CURRENCIES.find(c => c.code === code);
                                            if (curr) setSelectedCurrency(curr);
                                        }}
                                        displayKey="label"
                                        placeholder="Search 50+ currencies..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-8">
                                <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.3em] border-b-2 border-gray-900 pb-3 flex items-center gap-2">
                                    <Package size={16} /> Bill of Materials
                                </h3>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">SKU / Description</th>
                                            <th className="py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Qty</th>
                                            <th className="py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Unit Rate</th>
                                            <th className="py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Line Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {selectedPO.items.map((item: any, idx: number) => (
                                            <tr key={idx} className="group hover:bg-gray-50 transition-colors">
                                                <td className="py-5">
                                                    <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{item.productName}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 italic">UOM: {item.uom}</p>
                                                </td>
                                                <td className="py-5 text-sm font-black text-gray-700 text-center font-mono">{item.quantity}</td>
                                                <td className="py-5 text-sm font-bold text-gray-600 text-right font-mono">{item.unitPrice.toLocaleString()}</td>
                                                <td className="py-5 text-sm font-black text-gray-900 text-right font-mono">{selectedCurrency.symbol}{item.total.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="border-t-4 border-gray-900 pt-8 flex justify-end">
                                    <div className="w-80 space-y-4">
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-widest">
                                            <span>Subtotal</span>
                                            <span className="font-mono text-gray-900 text-sm font-black">{selectedCurrency.symbol}{selectedPO.subtotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-widest">
                                            <span>Taxation</span>
                                            <span className="font-mono text-gray-900 text-sm font-black">{selectedCurrency.symbol}{selectedPO.taxTotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-5 border-t border-gray-100">
                                            <span className="text-base font-black text-gray-900 uppercase tracking-tighter">Grand Total ({selectedCurrency.code})</span>
                                            <span className="text-2xl font-black text-redwood-brand font-mono tracking-tighter">{selectedCurrency.symbol}{selectedPO.grandTotal.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-100 px-10 py-6 flex justify-between items-center border-t border-gray-200">
                            <div className="flex items-center gap-3">
                                <Clock size={16} className="text-gray-400" />
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Audit ID: {selectedPO.id}</p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => window.print()}
                                    className="px-8 py-2.5 bg-gray-900 text-white text-[10px] font-black rounded-sm hover:brightness-110 transition-all uppercase tracking-[0.2em] flex items-center gap-3 shadow-lg"
                                >
                                    <Download size={16} /> Export PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

