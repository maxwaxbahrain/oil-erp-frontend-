import { useState, useEffect } from 'react';
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
    Building2,
    Truck,
    Clock,
    MapPin,
    Mail,
    Phone,
    Wallet,
    AlertCircle,
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
        date: new Date().toISOString().split('T')[0],
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
        setLoadingDetails(true);
        try {
            const data = await getSupplierLedger(id, start || undefined, end || undefined);
            setLedger(data.rows.map(mapSupplierPartyRow));
            setLedgerOpeningBalance(data.opening_balance);
            setLedgerClosingBalance(data.closing_balance);
        } catch (error) {
            console.error('Failed to load supplier ledger:', error);
        } finally {
            setLoadingDetails(false);
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
                date: new Date().toISOString().split('T')[0],
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
            <div className="flex items-center justify-center h-screen bg-gray-50/50">
                <div className="text-center p-12 bg-white rounded-xl shadow-2xl border border-gray-100">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-redwood-brand border-t-transparent mx-auto"></div>
                    <p className="mt-6 text-sm font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Synchronizing Data...</p>
                </div>
            </div>
        );
    }

    if (!supplier) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50/50">
                <div className="text-center p-12 bg-white rounded-xl shadow-2xl border border-gray-100 max-w-md">
                    <AlertCircle size={64} className="text-red-500 mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-gray-900 uppercase mb-2">Partner Not Found</h2>
                    <p className="text-gray-500 font-medium mb-8">The requested supplier record does not exist in the enterprise database.</p>
                    <button onClick={() => navigate('/purchases/suppliers')} className="w-full py-3 bg-gray-900 text-white font-black rounded-lg uppercase tracking-wider">Return to Directory</button>
                </div>
            </div>
        );
    }

    const outstandingBalance = ledgerClosingBalance ?? (ledger.length > 0 ? ledger[ledger.length - 1].balance : supplier.openingBalance ?? 0);
    const totalPurchases = purchases.filter(p => p.status !== 'Draft' && p.status !== 'Pending').reduce((sum, p) => sum + p.grandTotal, 0);

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
                    new Date(entry.date).toLocaleDateString(),
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
                doc.text(`Date: ${new Date(po.date).toLocaleDateString()}`, 140, currentY + 15);
                doc.text(`Expected Date: ${po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'}`, 140, currentY + 20);

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
        const body = encodeURIComponent(`Dear Sir/Madam,\n\nPlease find attached the Purchase Order ${po.poNumber} for your reference.\n\nOrder Details:\n- PO Number: ${po.poNumber}\n- Date: ${new Date(po.date).toLocaleDateString()}\n- Amount: ${po.grandTotal.toLocaleString()}\n\nBest regards,\n${profile.name}\n${profile.phone}`);

        if (method === 'email') {
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
        } else if (method === 'whatsapp') {
            const waText = encodeURIComponent(`*Purchase Order - ${po.poNumber}*\n\nDear Supplier,\n\nI'm sharing the Purchase Order ${po.poNumber} with you.\n\n📄 Date: ${new Date(po.date).toLocaleDateString()}\n💰 Amount: ${po.grandTotal.toLocaleString()}\n\nSent via SOLTOL ONE`);
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
                new Date(entry.date).toLocaleDateString(),
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/purchases/suppliers')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                                {supplier.name}
                            </h1>
                            <span className="text-sm text-gray-500 font-bold">{supplier.code}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${supplier.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {supplier.status.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Supplier Overview & Procurement Analytics</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/purchases/new', { state: { supplierId: supplier.id, supplierName: supplier.name } })}
                        className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-black hover:bg-orange-700 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <FileText size={18} />
                        New Purchase Order
                    </button>
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-black hover:bg-green-700 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <DollarSign size={18} />
                        Send Payment
                    </button>
                    <button
                        onClick={() => navigate('/purchases/new', { state: { supplierId: supplier.id, supplierName: supplier.name, isPending: true } })}
                        className="px-5 py-2.5 bg-yellow-400 text-gray-900 rounded-lg text-sm font-black hover:bg-yellow-500 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <ShoppingCart size={18} />
                        New Pending Order
                    </button>
                    <button
                        onClick={() => setShowEditModal(true)}
                        className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-black hover:bg-gray-900 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <Edit size={18} />
                        Edit Supplier
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white border border-[#ddd] rounded-[4px] p-[20px] shadow-sm m-[10px]">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Outstanding Liability</div>
                    <div className={`text-2xl font-black font-mono ${outstandingBalance > 0 ? 'text-rose-600' : outstandingBalance < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                        {outstandingBalance > 0
                            ? outstandingBalance.toLocaleString()
                            : outstandingBalance < 0
                                ? (
                                    <>
                                        +{Math.abs(outstandingBalance).toLocaleString()}
                                        <span className="text-xs font-bold uppercase ml-1 opacity-80">credit</span>
                                    </>
                                )
                                : '0'}
                    </div>
                </div>

                <div className="bg-white border border-[#ddd] rounded-[4px] p-[20px] shadow-sm m-[10px]">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Total Purchases</div>
                    <div className="text-2xl font-black text-gray-900 font-mono">
                        {totalPurchases > 0 ? totalPurchases.toLocaleString() : '-'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">This Year</div>
                </div>

                <div className="bg-white border border-[#ddd] rounded-[4px] p-[20px] shadow-sm m-[10px]">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Credit Ceiling</div>
                    <div className="text-2xl font-black text-gray-900 font-mono">
                        {supplier.creditLimit && supplier.creditLimit > 0 
                        ? formatCurrency(supplier.creditLimit) 
                        : <span className="text-gray-400 text-sm">Not Set</span>}
                    </div>
                </div>

                <div className="bg-white border border-[#ddd] rounded-[4px] p-[20px] shadow-sm m-[10px]">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Overdue Arrears</div>
                    <div className="text-2xl font-black font-mono">
                        {outstandingBalance > 0
                            ? <span className="text-rose-600">{formatCurrency(outstandingBalance)}</span>
                            : <span className="text-emerald-600">$0.00</span>}
                    </div>
                </div>

                <div className="bg-white border border-[#ddd] rounded-[4px] p-[20px] shadow-sm m-[10px]">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Last Payment</div>
                    <div className="text-xl font-black text-blue-600 font-mono">
                        {payments.length > 0 && payments[0].amount > 0 ? payments[0].amount.toLocaleString() : '-'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                        {payments.length > 0 ? new Date(payments[0].date).toLocaleDateString() : 'N/A'}
                    </div>
                </div>

                <div className="bg-white border border-[#ddd] rounded-[4px] p-[20px] shadow-sm m-[10px]">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Last Purchase</div>
                    <div className="text-lg font-bold text-gray-900">
                        {purchases.length > 0 ? (
                            (() => {
                                const days = Math.floor((new Date().getTime() - new Date(purchases[0].date).getTime()) / (1000 * 60 * 60 * 24));
                                return `${days} days ago`;
                            })()
                        ) : 'N/A'}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm">
                <div className="border-b border-gray-200 flex gap-1">
                    {[
                        { key: 'overview', label: 'Overview' },
                        { key: 'ledger', label: 'Ledger' },
                        { key: 'purchases', label: 'Purchases' },
                        { key: 'payments', label: 'Payments' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-6 py-4 text-sm font-black uppercase tracking-wider transition-all ${activeTab === tab.key
                                ? 'border-b-2 border-redwood-brand text-redwood-brand bg-redwood-brand/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Building2 size={16} className="text-redwood-brand" />
                                        Corporate Profile
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-100 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase">Legal Entity</p>
                                                <p className="text-sm font-bold text-gray-700">{supplier.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase">Supplier Code</p>
                                                <p className="text-sm font-mono font-bold text-redwood-brand">{supplier.code}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase">Primary Contact</p>
                                                <p className="text-sm font-bold text-gray-700">{supplier.contactPerson}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase">Tax ID / VAT</p>
                                                <p className="text-sm font-bold text-gray-700">{supplier.taxId}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Truck size={16} className="text-redwood-brand" />
                                        Communication Nexus
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-100 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm text-gray-400">
                                                <Mail size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase">Official Email</p>
                                                <a href={`mailto:${supplier.email}?cc=office@yourcompany.com&subject=Re: ${supplier.name}`} className="text-sm font-bold text-blue-600 hover:underline">
                                                    {supplier.email}
                                                </a>
                                                <p className="text-[8px] text-gray-400 lowercase">(CC: office@yourcompany.com)</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm text-gray-400">
                                                <Phone size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase">Contact Number</p>
                                                <a href={`tel:${supplier.phone}`} className="text-sm font-bold text-gray-700 hover:text-redwood-brand transition-colors">
                                                    {supplier.phone}
                                                </a>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 border-t border-gray-200 pt-4 mt-2">
                                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm text-gray-400">
                                                <MapPin size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase">Physical Address</p>
                                                <p className="text-sm font-medium text-gray-600 leading-relaxed">{supplier.address || 'Address not registered in master database.'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {supplier.notes && (
                                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                    <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1">📝 Internal Notes</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{supplier.notes}</p>
                                </div>
                            )}

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <DollarSign size={16} className="text-redwood-brand" />
                                        Fiscal Analysis
                                    </h3>
                                    <div className="bg-white border border-[#ddd] rounded-[4px] p-[20px] space-y-5 shadow-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Trading Currency</span>
                                            <span className="text-sm font-black text-gray-900">{supplier.currency} (USD)</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Payment Terms</span>
                                            <span className="text-sm font-black text-gray-900">{supplier.paymentTerms}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-5 border-t border-gray-100">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Risk Rating</span>
                                            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${supplier.rating === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                                supplier.rating === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                                }`}>Tier {supplier.rating || 'A'} Certified</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-redwood-brand/5 border border-redwood-brand/10 rounded-lg p-6">
                                    <h4 className="text-[11px] font-black text-redwood-brand uppercase tracking-[0.2em] mb-4">Strategic Insights</h4>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Clock size={16} className="text-redwood-brand opacity-60" />
                                                <span className="text-xs font-bold text-gray-600">Avg Lead Time</span>
                                            </div>
                                            <span className="text-xs font-black text-gray-900 uppercase">4.2 Commercial Days</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <CheckCircle size={16} className="text-redwood-brand opacity-60" />
                                                <span className="text-xs font-bold text-gray-600">Order Reliability</span>
                                            </div>
                                            <span className="text-xs font-black text-gray-900 uppercase">99.8% Precision</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ledger Tab */}
                    {activeTab === 'ledger' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                        <Receipt size={18} className="text-redwood-brand" />
                                        Statement of Account
                                    </h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Full transaction history and liability tracking</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleExportExcel}
                                        className="px-4 py-2 bg-emerald-600 text-white border border-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 flex items-center gap-2 transition-all shadow-md"
                                    >
                                        <Download size={14} /> Export Excel
                                    </button>
                                    <button
                                        onClick={handleExportPDF}
                                        className="px-4 py-2 bg-rose-600 text-white border border-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 flex items-center gap-2 transition-all shadow-md"
                                    >
                                        <FileText size={14} /> Export PDF
                                    </button>

                                    <div className="flex items-center gap-2">
                                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none" placeholder="From" />
                                    <span className="text-xs text-gray-400">–</span>
                                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none" placeholder="To" />
                                    {(fromDate || toDate) && <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-xs text-red-400 font-bold px-2 py-1 border border-red-200 rounded-lg hover:text-red-600">✕ Clear</button>}
                                </div>
                                <div className="relative">
                                        <button
                                            onClick={() => setShowShareMenu(!showShareMenu)}
                                            className="px-4 py-2 bg-blue-600 text-white border border-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 flex items-center gap-2 transition-all shadow-md"
                                        >
                                            <Share2 size={14} /> Share Ledger <ChevronDown size={14} />
                                        </button>

                                        {showShareMenu && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                                <button onClick={() => { handleShareEmail(); setShowShareMenu(false); }} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                                                    <Mail size={14} className="text-blue-500" /> Share via Email
                                                </button>
                                                <button onClick={() => { handleShareWhatsApp(); setShowShareMenu(false); }} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                                                    <MessageSquare size={14} className="text-emerald-500" /> Share via WhatsApp
                                                </button>
                                                <button onClick={() => { handleShareSMS(); setShowShareMenu(false); }} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                                                    <Send size={14} className="text-blue-400" /> Share via SMS
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-gray-100 shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b-2 border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Operation</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Reference</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Debit (-)</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Credit (+)</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Balance</th>
                                            <th className="px-4 py-4 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {loadingDetails ? (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-12 text-center">
                                                    <div className="animate-pulse flex flex-col items-center">
                                                        <div className="h-4 w-48 bg-gray-200 rounded mb-2"></div>
                                                        <div className="h-3 w-32 bg-gray-100 rounded"></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : ledger.length === 0 && !(fromDate || toDate) ? (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border-2 border-dashed border-gray-200">
                                                            <Receipt size={24} className="text-gray-300" />
                                                        </div>
                                                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No commercial records detected.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            <>
                                            {(fromDate || toDate) && ledgerOpeningBalance !== null && (
                                                <tr className="bg-blue-50/60 font-black">
                                                    <td colSpan={6} className="px-6 py-3 text-xs text-gray-800 uppercase tracking-widest">
                                                        Opening balance
                                                        <span className="ml-2 text-[10px] font-bold text-gray-500 normal-case">(as at {fromDate || 'start'})</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-xs text-gray-900 text-right font-mono">{ledgerOpeningBalance.toLocaleString()}</td>
                                                    <td></td>
                                                </tr>
                                            )}
                                            {ledger.map(entry => (
                                                <tr
                                                    key={`${entry.type}-${entry.id}`}
                                                    className="hover:bg-redwood-bg-light/20 transition-all group cursor-pointer"
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
                                                    <td className="px-6 py-4 text-xs font-bold text-gray-600">
                                                        {new Date(entry.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${entry.type === 'Purchase' ? 'bg-blue-100 text-blue-700' :
                                                            entry.type === 'Payment' ? 'bg-emerald-100 text-emerald-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {entry.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-black text-gray-900 font-mono tracking-tighter">
                                                        {entry.referenceNumber}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-gray-500 font-medium">{entry.description}</td>
                                                    <td className="px-6 py-4 text-xs font-black text-emerald-600 text-right font-mono">
                                                        {entry.debit > 0 ? entry.debit.toLocaleString() : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-black text-rose-600 text-right font-mono">
                                                        {entry.credit > 0 ? entry.credit.toLocaleString() : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-black text-gray-900 text-right font-mono">
                                                        {entry.balance.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {entry.type === 'Purchase' && (
                                                            <Eye size={16} className="text-gray-300 group-hover:text-redwood-brand transition-colors" />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {ledger.length === 0 && (fromDate || toDate) && (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-8 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                        No transactions in this date range.
                                                    </td>
                                                </tr>
                                            )}
                                            </>
                                        )}
                                    </tbody>
                                    {(fromDate || toDate) && ledgerClosingBalance !== null && (
                                        <tfoot className="bg-blue-50/60 border-t-2 border-gray-300">
                                            <tr className="font-black">
                                                <td colSpan={6} className="px-6 py-3 text-right text-[10px] text-gray-800 uppercase tracking-widest">
                                                    Closing balance
                                                    <span className="ml-2 font-bold text-gray-500 normal-case">(as at {toDate || 'today'})</span>
                                                </td>
                                                <td className="px-6 py-3 text-right font-mono text-gray-900">{ledgerClosingBalance.toLocaleString()}</td>
                                                <td></td>
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
                            <div className="flex justify-between items-center px-2">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                    <ShoppingCart size={18} className="text-redwood-brand" />
                                    Sequential Procurement Ledger
                                </h3>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Unified Order & Purchase Stream</div>
                            </div>
                            <div className="border border-gray-100 rounded-lg overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Order ID</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Items</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Operation Status</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Payment Status</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">{`Value (${getSystemSettings().defaultCurrencyCode})`}</th>
                                            <th className="px-6 py-4 text-center w-40">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {purchases.length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">No sequential procurement records found.</td></tr>
                                        ) : (
                                            [...purchases]
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map((po) => (
                                                    <tr key={po.id} className="hover:bg-gray-50/50 group transition-colors">
                                                        <td className="px-6 py-4 text-xs font-black font-mono text-gray-900 group-hover:text-redwood-brand transition-colors">
                                                            {po.poNumber}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-bold text-gray-600">
                                                            {new Date(po.date).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                                            {(po.items?.length ?? 0)} {(po.items?.length ?? 0) === 1 ? 'Item' : 'Items'}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {po.status === 'Pending' || po.status === 'Draft' ? (
                                                                <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[9px] font-black uppercase tracking-tighter">
                                                                    🟡 Pending
                                                                </span>
                                                            ) : (
                                                                <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[9px] font-black uppercase tracking-tighter">
                                                                    🟢 Received
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {(() => {
                                                                // ITEM 6C — Derive from remaining_balance (authoritative),
                                                                // not the stale payment_status string. Mirrors 5C.
                                                                const grand = Number((po as any).grandTotal) || 0;
                                                                const rb = Number((po as any).remaining_balance ?? grand);
                                                                const isPaid = rb <= 0.005;
                                                                const isPartial = !isPaid && rb < grand;
                                                                const cls = isPaid ? 'bg-blue-600 text-white'
                                                                    : isPartial ? 'bg-amber-500 text-white'
                                                                    : 'bg-rose-500 text-white';
                                                                const label = isPaid ? '🔵 Paid'
                                                                    : isPartial ? '🟠 Partial'
                                                                    : '🔴 Unpaid';
                                                                return (
                                                                    <span
                                                                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${cls}`}
                                                                        title={isPartial ? `${rb.toFixed(2)} of ${grand.toFixed(2)} outstanding` : undefined}
                                                                    >
                                                                        {label}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-black text-gray-900 text-right font-mono">
                                                            {po.grandTotal.toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => { setSelectedPO(po); setShowPOModal(true); }}
                                                                    className="p-1.5 text-gray-300 hover:text-redwood-brand transition-colors"
                                                                >
                                                                    <Eye size={18} />
                                                                </button>
                                                                {(po.status === 'Pending' || po.status === 'Draft') && (
                                                                    <button
                                                                        onClick={() => handleConvertOrder(po.id)}
                                                                        disabled={converting === po.id}
                                                                        className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black rounded uppercase hover:bg-emerald-700 transition-colors flex items-center gap-1 disabled:opacity-50 shadow-sm"
                                                                    >
                                                                        {converting === po.id ? '...' : (
                                                                            <>
                                                                                <CheckCircle size={12} />
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
                                    {/* ITEM 6D — Purchases totals. POs only, no orders/drafts. */}
                                    {purchases.length > 0 && (() => {
                                        const totalPurchases = purchases.reduce((s, p) => s + (Number((p as any).grandTotal) || 0), 0);
                                        const totalOutstanding = purchases.reduce((s, p) => {
                                            const grand = Number((p as any).grandTotal) || 0;
                                            const rb = Number((p as any).remaining_balance ?? grand);
                                            return s + Math.max(0, rb);
                                        }, 0);
                                        return (
                                            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                                <tr className="font-black">
                                                    <td colSpan={4} className="px-6 py-3"></td>
                                                    <td className="px-6 py-3 text-right text-[10px] text-gray-700 uppercase tracking-widest">
                                                        <span className="block">Total Purchases</span>
                                                        <span className="block text-amber-700 mt-1">Total Outstanding</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-mono">
                                                        <span className="block text-gray-900">{totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        <span className="block text-amber-700 mt-1">{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    </td>
                                                    <td></td>
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
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                        <Wallet size={18} className="text-redwood-brand" />
                                        Disbursement History
                                    </h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Confirmed payments and fund transfers</p>
                                </div>
                                <button
                                    onClick={() => setShowPaymentModal(true)}
                                    className="px-5 py-2.5 bg-red-800 text-white rounded-lg text-xs font-black hover:bg-red-900 flex items-center gap-2 shadow-lg uppercase tracking-wider transition-all active:scale-95"
                                >
                                    <DollarSign size={16} />
                                    Initiate Disbursement
                                </button>
                            </div>
                            <div className="border border-gray-100 rounded-lg overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Disbursement Date</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Reference ID</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Channel</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Amount Out (-)</th>
                                            <th className="px-6 py-4 w-16 text-center">Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {payments.length === 0 ? (
                                            <tr><td colSpan={5} className="px-6 py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">No disbursements recorded.</td></tr>
                                        ) : (
                                            payments.map(pay => (
                                                <tr key={pay.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 text-xs font-bold text-gray-600">{new Date(pay.date).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4 text-xs font-black font-mono text-gray-900 whitespace-nowrap">{pay.reference || `PAY-${pay.id.slice(-4)}`}</td>
                                                    <td className="px-6 py-4 text-xs font-bold text-gray-500">{pay.paymentMethod}</td>
                                                    <td className="px-6 py-4 text-sm font-black text-right font-mono text-emerald-600">{pay.amount.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button className="text-gray-300 hover:text-emerald-600 transition-colors">
                                                            <Receipt size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {/* ITEM 6D — Total Paid summary. */}
                                    {payments.length > 0 && (() => {
                                        const totalPaid = payments.reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
                                        return (
                                            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                                <tr className="font-black">
                                                    <td colSpan={3} className="px-6 py-3 text-right text-[10px] text-gray-700 uppercase tracking-widest">Total Paid</td>
                                                    <td className="px-6 py-3 text-right font-mono text-rose-700">{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td></td>
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
                                            <p className="text-sm font-black text-gray-700">{new Date(selectedPO.date).toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Expected Delivery</p>
                                            <p className="text-sm font-black text-gray-700">{selectedPO.expectedDate ? new Date(selectedPO.expectedDate).toLocaleDateString() : 'Immediate'}</p>
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

