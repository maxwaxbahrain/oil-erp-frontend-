import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseNewExpenseParams } from './expenseQueryParams';
import {
    DollarSign, Upload, Plus,
    Edit2, Trash2, RefreshCw,
    Sparkles, Download, Send, Search, Paperclip, Bot, X
} from 'lucide-react';
import { getSalesOrders } from '../../services/salesService';
import {
    getExpensesSnapshot,
    getExpenseCategories,
    saveExpense,
    deleteExpense,
    exportExpensesAsCSV,
    extractExpenseFromReceipt,
    suggestExpenseCategory,
    resolveCoaCategoryName,
    type Expense,
    type ExpenseCategory,
    type AIExtractedData,
} from '../../services/expenseService';
import { ExpenseManualForm } from './ExpenseManualForm';
import type { CustomerComboboxOption } from '../../components/forms/CustomerCombobox';
// STEP 11B — load customers for Bill-to dropdown.
import { getCustomers as loadCustomerList } from '../../services/customerService';
// ITEM 16 — Escape closes the manual entry modal and the category dropdown.
import { useEscape } from '../../hooks/useEscape';
import { useBankingAccounts } from '../../hooks/useBankingAccounts';

export { PaidFromBankPicker } from './paidFromBankPicker';

function pickDefaultExpenseAccountId(categories: ExpenseCategory[]): string {
    const general = categories.find(a => a.name.toLowerCase().includes('general expenses'));
    return general ? String(general.id) : (categories[0] ? String(categories[0].id) : '');
}

function formatCoaCategoryLabel(cat: ExpenseCategory): string {
    return cat.code ? `${cat.code} · ${cat.name}` : cat.name;
}

function expenseAccountLabel(
    accountId: number | string | null | undefined,
    categories: ExpenseCategory[],
): string | null {
    if (accountId == null || accountId === '') return null;
    const acc = categories.find(a => String(a.id) === String(accountId));
    return acc ? formatCoaCategoryLabel(acc) : `#${accountId}`;
}

const panelStyle: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '14px',
    padding: '14px 16px',
};

function formatMoney(n: number) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatExpenseDate(raw: string): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

function statusBadgeStyle(status: Expense['status']): CSSProperties {
    const map: Record<string, CSSProperties> = {
        Approved: {
            background: 'var(--color-badge-green-bg)',
            color: 'var(--color-brand-green-tint)',
            border: '1px solid rgba(34,197,94,.28)',
        },
        'Pending Approval': {
            background: 'var(--color-badge-amber-bg)',
            color: 'var(--color-brand-amber-tint)',
            border: '1px solid rgba(245,158,11,.28)',
        },
        Submitted: {
            background: 'var(--color-badge-blue-bg)',
            color: 'var(--color-brand-blue-tint)',
            border: '1px solid rgba(79,142,247,.28)',
        },
        'Under Review': {
            background: 'var(--color-badge-blue-bg)',
            color: 'var(--color-brand-blue-tint)',
            border: '1px solid rgba(79,142,247,.28)',
        },
        Rejected: {
            background: 'var(--color-badge-red-bg)',
            color: 'var(--color-brand-red-tint)',
            border: '1px solid rgba(239,68,68,.2)',
        },
        Paid: {
            background: 'var(--color-badge-teal-bg)',
            color: 'var(--color-brand-teal)',
            border: '1px solid rgba(0,212,170,.28)',
        },
        Reimbursed: {
            background: 'rgba(124,58,237,.12)',
            color: '#C4B5FD',
            border: '1px solid rgba(124,58,237,.28)',
        },
        Draft: {
            background: 'rgba(255,255,255,.06)',
            color: 'var(--color-redwood-text-muted)',
            border: '1px solid var(--color-redwood-border)',
        },
    };
    return map[status] ?? map.Draft;
}

// STEP 2 — Per-field confidence indicator for AI-extracted receipt fields.
// Green ≥ 90 (high), Amber 60-89 (please verify), Red < 60 (manual entry).
// Returns null when confidence is missing — keeps backward-compat with
// older AIExtractedData blobs that don't have perFieldConfidence.
function ConfidenceBadge({ value }: { value?: number }) {
    if (value == null || !Number.isFinite(value)) return null;
    const n = Math.round(value);
    const tone =
        n >= 90 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
        n >= 60 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  'bg-rose-100 text-rose-700 border-rose-200';
    const icon =
        n >= 90 ? '✓' :
        n >= 60 ? '⚠' :
                  '✗';
    const label =
        n >= 90 ? `${n}% confident` :
        n >= 60 ? `${n}% — verify` :
                  `${n}% — enter manually`;
    return (
        <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-black border ${tone}`}>
            {icon} {label}
        </span>
    );
}

export default function ExpenseManagement() {
    const navigate = useNavigate();
    const location = useLocation();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [dataUnavailable, setDataUnavailable] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [monthRevenue, setMonthRevenue] = useState(0);
    const [saving, setSaving] = useState(false);

    // Manual entry state
    const [showManualForm, setShowManualForm] = useState(false);
    const [showAiUpload, setShowAiUpload] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [prefillClientId, setPrefillClientId] = useState<string | null>(null);

    function closeAiUpload() {
        setShowAiUpload(false);
        setAiExtractedData(null);
        setUploadedFile(null);
    }

    // ITEM 16 — Escape closes the manual entry modal. The category
    // dropdown (declared below) has its own outside-click handler; Escape
    // closes both at once which is the expected behavior.
    useEscape(() => {
        setShowManualForm(false);
        setEditingExpense(null);
        setPrefillClientId(null);
    }, showManualForm);
    useEscape(closeAiUpload, showAiUpload);

    // AI upload state
    const [, setUploadedFile] = useState<File | null>(null);
    const [aiProcessing, setAiProcessing] = useState(false);
    const [aiExtractedData, setAiExtractedData] = useState<AIExtractedData | null>(null);

    const [expDateFrom, setExpDateFrom] = useState('');
    const [expDateTo, setExpDateTo] = useState('');
    const [expSearch, setExpSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [customers, setCustomers] = useState<CustomerComboboxOption[]>([]);
    const { banks, defaultBank } = useBankingAccounts();

    const refreshCategories = useCallback(async () => {
        try {
            const rows = await getExpenseCategories();
            setCategories(rows);
        } catch (error) {
            console.warn('[expenses] failed to refresh COA categories', error);
        }
    }, []);

    useEffect(() => {
        const onFocus = () => { void refreshCategories(); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [refreshCategories]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (loading) return;
        const { open, clientId } = parseNewExpenseParams(location.search);
        if (!open) return;
        setEditingExpense(null);
        setPrefillClientId(clientId);
        setShowManualForm(true);
        navigate('/finance/expenses', { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, location.search]);

    const loadData = async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        try {
            const [expensesSnapshot, categoriesData] = await Promise.all([
                getExpensesSnapshot(),
                getExpenseCategories()
            ]);
            setDataUnavailable(expensesSnapshot.stale);
            setExpenses(expensesSnapshot.stale ? [] : expensesSnapshot.expenses);
            setCategories(categoriesData);
            try {
                const list = await loadCustomerList();
                setCustomers(list.map((customer) => {
                    const raw = customer as typeof customer & { is_active?: boolean };
                    const address = [customer.address, customer.city, customer.state, customer.postal_code]
                        .filter(Boolean)
                        .join(', ');
                    const inactiveStatus = customer.status === 'Inactive' || customer.status === 'Suspended';
                    return {
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone,
                        code: customer.code,
                        address,
                        is_active: raw.is_active !== undefined ? raw.is_active : inactiveStatus ? false : undefined,
                    };
                }));
            } catch { /* customer list is optional for the form */ }
            try {
                const orders = await getSalesOrders();
                const now = new Date();
                const revenue = orders
                    .filter(o => {
                        const raw = o.order_date || o.created_at || '';
                        if (!raw) return false;
                        const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    })
                    .reduce((sum, o) => sum + (Number(o.total ?? o.total_amount ?? 0) || 0), 0);
                setMonthRevenue(revenue);
            } catch {
                setMonthRevenue(0);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            setDataUnavailable(true);
            setExpenses([]);
        } finally {
            if (!opts?.silent) setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadData({ silent: true });
        } finally {
            setRefreshing(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadedFile(file);
        setAiProcessing(true);

        try {
            const extracted = await extractExpenseFromReceipt(file);
            // STEP 3 — replace the hardcoded 'Other' default with a
            // real categorization call.  Errors here are non-fatal —
            // we still show the OCR result so the user can pick.
            try {
                const sug = await suggestExpenseCategory(
                    extracted.vendor,
                    extracted.items.join(', '),
                    extracted.amount,
                );
                extracted.suggestedCategory = sug.mappedCategory;
            } catch {
                /* keep 'Other' fallback set by extractExpenseFromReceipt */
            }
            setAiExtractedData(extracted);
        } catch (error) {
            console.error('AI extraction failed:', error);
            alert('Failed to process receipt');
        } finally {
            setAiProcessing(false);
        }
    };

    const handleAIConfirm = async () => {
        if (!aiExtractedData) return;

        setSaving(true);
        try {
            const match = resolveCoaCategoryName(categories, aiExtractedData.suggestedCategory);
            const fallbackId = pickDefaultExpenseAccountId(categories);
            await saveExpense({
                category: match?.name ?? aiExtractedData.suggestedCategory,
                amount: aiExtractedData.amount,
                currency: aiExtractedData.currency,
                date: aiExtractedData.date,
                vendor: aiExtractedData.vendor,
                description: aiExtractedData.items.join(', '),
                paymentMethod: 'Card',
                taxAmount: aiExtractedData.taxAmount,
                isRecurring: false,
                status: 'Draft',
                aiExtracted: true,
                aiConfidence: aiExtractedData.confidence,
                account_id: match?.id ?? (fallbackId ? Number(fallbackId) : undefined),
            });
            await loadData();
            closeAiUpload();
        } catch (error) {
            console.error('Failed to save AI expense:', error);
            alert('Failed to save expense');
        } finally {
            setSaving(false);
        }
    };

    // ITEM 10 — Draft actions: flip a Draft expense to Submitted in one click.
    // The expense then enters the approval queue (ExpenseApprovals page).
    const handleSubmitDraft = async (expense: Expense) => {
        if (expense.status !== 'Draft') return;
        if (!confirm(`Submit "${expense.vendor || expense.id}" for approval? You won't be able to edit it after submission.`)) return;
        try {
            await saveExpense({ ...expense, status: 'Submitted' });
            await loadData();
        } catch (e) {
            console.error('Failed to submit draft:', e);
            alert('Failed to submit draft: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const handleDelete = async (id: string) => {
        const exp = expenses.find(e => e.id === id);
        if (!exp) return;

        if (!confirm(`Are you sure you want to delete expense ${exp.vendor || exp.id}?`)) return;

        // FIX W7-2 — If the expense was pushed to Accounting, surface a
        // second, scarier confirm before forcing the delete. Deleting
        // leaves the JV on the backend with no expense linkage.
        let force = false;
        if (exp.journal_voucher_number) {
            const really = confirm(
                `⚠️ Warning — this expense has a linked journal entry (JV ${exp.journal_voucher_number}).\n\n` +
                `Deleting will leave the JV on the books with NO matching expense record. ` +
                `The accounting entry will become orphaned.\n\n` +
                `Are you really sure you want to delete this expense?`
            );
            if (!really) return;
            force = true;
        }

        try {
            await deleteExpense(id, force ? { force: true } : undefined);
            await loadData();
        } catch (error) {
            console.error('Failed to delete expense:', error);
            alert('Failed to delete expense: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    // FIX W7-3 — One-shot CSV download. Uses Blob + ObjectURL so no
    // server roundtrip and no extra dependency. Filename includes today's
    // date for easy versioning of successive backups.
    const handleExportCSV = () => {
        try {
            const csv = exportExpensesAsCSV();
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('CSV export failed: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const now = new Date();
    const thisMonthExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const thisMonthCount = thisMonthExpenses.length;
    const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const pendingApprovalCount = expenses.filter(e => e.status === 'Pending Approval').length;
    const aiProcessedCount = expenses.filter(e => e.aiExtracted).length;
    const expenseRatioPct = monthRevenue > 0 ? Math.round((thisMonthTotal / monthRevenue) * 100) : null;

    const filteredExpenses = expenses.filter(expense => {
        if (expDateFrom && (expense.date || '') < expDateFrom) return false;
        if (expDateTo && (expense.date || '') > expDateTo) return false;
        if (expSearch && !expense.vendor?.toLowerCase().includes(expSearch.toLowerCase()) &&
            !expense.category?.toLowerCase().includes(expSearch.toLowerCase()) &&
            !String(expense.amount).includes(expSearch)) return false;
        if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
        if (statusFilter !== 'all' && expense.status !== statusFilter) return false;
        return true;
    }).slice(0, 50);

    const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const filteredApprovedCount = filteredExpenses.filter(e => e.status === 'Approved').length;
    const filteredReceiptsCount = filteredExpenses.filter(e => e.receiptUrl).length;

    const STATUS_OPTIONS: Expense['status'][] = [
        'Draft', 'Pending Approval', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid', 'Reimbursed',
    ];

    const ghostBtn: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 11px',
        borderRadius: '6px',
        fontSize: '10.5px',
        fontWeight: 500,
        cursor: 'pointer',
        border: '1px solid var(--color-redwood-border)',
        background: 'rgba(255,255,255,.04)',
        color: 'var(--color-redwood-text-muted)',
        fontFamily: "'DM Sans',sans-serif",
        transition: '.12s',
    };

    const primaryBtn: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 11px',
        borderRadius: '6px',
        fontSize: '10.5px',
        fontWeight: 500,
        cursor: 'pointer',
        border: 'none',
        background: '#4F8EF7',
        color: '#fff',
        fontFamily: "'DM Sans',sans-serif",
        transition: '.12s',
    };

    const purpleBtn: CSSProperties = {
        ...primaryBtn,
        background: '#7C3AED',
    };

    const inputStyle: CSSProperties = {
        background: 'var(--color-redwood-row-bg)',
        border: '1px solid var(--color-redwood-border)',
        borderRadius: 8,
        outline: 'none',
        color: 'var(--color-redwood-text-main)',
        fontSize: 12,
        padding: '8px 12px',
    };

    const selectStyle: CSSProperties = { ...inputStyle, cursor: 'pointer' };

    if (loading) {
        return (
            <div style={{ paddingBottom: '40px' }}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '80px 16px',
                        color: 'var(--color-redwood-text-muted)',
                    }}
                >
                    <div
                        className="w-12 h-12 border-2 rounded-full animate-spin mb-3"
                        style={{ borderColor: '#4F8EF7', borderTopColor: 'transparent' }}
                    />
                    <p style={{ fontSize: 12, fontWeight: 500 }}>Loading expenses…</p>
                </div>
            </div>
        );
    }

    return (
        <>
        <div style={{ paddingBottom: '40px' }}>
            <div className="space-y-3">
                {/* Page header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                        flexWrap: 'wrap',
                        gap: 12,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'var(--color-badge-blue-bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <DollarSign size={20} style={{ color: '#4F8EF7' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontFamily: "'Syne',sans-serif",
                                    fontSize: '20px',
                                    fontWeight: 600,
                                    letterSpacing: '-.5px',
                                    color: 'var(--color-brand-blue)',
                                }}
                            >
                                Expense management
                            </div>
                            <div
                                style={{
                                    fontSize: '11px',
                                    color: 'var(--color-redwood-text-subtle)',
                                    marginTop: '2px',
                                }}
                            >
                                AI-powered tracking · approvals · mileage · reports
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                        <button type="button" onClick={handleExportCSV} style={ghostBtn} title="Export all expenses as CSV">
                            <Download size={14} /> Export CSV
                        </button>
                        <button type="button" onClick={() => navigate('/finance/expenses/reports')} style={ghostBtn}>
                            Reports
                        </button>
                        <button type="button" onClick={() => navigate('/finance/expenses/mileage')} style={ghostBtn}>
                            Mileage
                        </button>
                        <button type="button" onClick={() => navigate('/finance/expenses/approvals')} style={ghostBtn}>
                            Approvals
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowManualForm(true); setEditingExpense(null); }}
                            style={primaryBtn}
                        >
                            <Plus size={14} /> Add expense
                        </button>
                        <button type="button" onClick={() => navigate('/finance/expenses/bulk-upload')} style={purpleBtn}>
                            <Sparkles size={14} /> AI bulk upload
                        </button>
                        <button type="button" onClick={() => void handleRefresh()} style={ghostBtn} disabled={refreshing}>
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '10px', marginBottom: '12px' }}>
                    {[
                        {
                            label: 'This Month',
                            value: `$${formatMoney(thisMonthTotal)}`,
                            sub: `${monthLabel} · ${thisMonthCount} expense${thisMonthCount !== 1 ? 's' : ''}`,
                            stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                            valueColor: 'var(--color-brand-blue)',
                            subColor: 'var(--color-redwood-text-subtle)',
                        },
                        {
                            label: 'Pending Approval',
                            value: String(pendingApprovalCount),
                            sub: pendingApprovalCount === 0 ? 'nothing awaiting review' : 'awaiting review',
                            stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
                            valueColor: 'var(--color-brand-amber)',
                            subColor: 'var(--color-brand-amber-tint)',
                        },
                        {
                            label: 'Processed',
                            value: String(aiProcessedCount),
                            sub: 'AI PROCESSED via smart upload',
                            stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                            valueColor: 'var(--color-brand-green)',
                            subColor: 'var(--color-brand-green-tint)',
                        },
                        {
                            label: 'Expense Ratio',
                            value: expenseRatioPct == null ? '—' : `${expenseRatioPct}%`,
                            sub: monthRevenue > 0 ? `$${formatMoney(thisMonthTotal)} of $${formatMoney(monthRevenue)} revenue` : 'No revenue data',
                            stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)',
                            valueColor: 'var(--color-brand-red)',
                            subColor: 'var(--color-brand-red-tint)',
                        },
                    ].map((k) => (
                        <div
                            key={k.label}
                            style={{
                                background: 'var(--color-redwood-bg-surface)',
                                border: '1px solid var(--color-redwood-border)',
                                borderRadius: '14px',
                                padding: '13px 14px',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '2px',
                                    borderRadius: '14px 14px 0 0',
                                    background: k.stripe,
                                }}
                            />
                            <div style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)', fontWeight: 500, marginBottom: '6px' }}>
                                {k.label}
                            </div>
                            <div
                                style={{
                                    fontFamily: "'Syne',sans-serif",
                                    fontSize: '22px',
                                    fontWeight: 600,
                                    letterSpacing: '-.5px',
                                    marginBottom: '3px',
                                    lineHeight: '1.1',
                                    color: k.valueColor,
                                }}
                            >
                                {k.value}
                            </div>
                            <div style={{ fontSize: '10px', color: k.subColor }}>{k.sub}</div>
                        </div>
                    ))}
                </div>

                {dataUnavailable && (
                    <div style={{ ...panelStyle, background: 'rgba(245,158,11,.08)', borderColor: 'rgba(245,158,11,.25)', color: 'var(--color-brand-amber-tint)', fontSize: 12 }}>
                        Expense data unavailable. Cached data is not shown as live.
                    </div>
                )}

                {/* Primary action buttons */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '12px' }}>
                    <button
                        type="button"
                        onClick={() => { setShowManualForm(true); setEditingExpense(null); }}
                        style={{
                            flex: '1 1 200px',
                            padding: '14px 20px',
                            borderRadius: '10px',
                            border: '1.5px solid #4F8EF7',
                            background: 'rgba(79,142,247,.06)',
                            color: 'var(--color-brand-blue-tint)',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: "'DM Sans',sans-serif",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        <Edit2 size={16} /> Manual entry
                    </button>
                    <button
                        type="button"
                        onClick={() => { setShowManualForm(false); setPrefillClientId(null); setShowAiUpload(true); }}
                        style={{
                            flex: '1 1 200px',
                            padding: '14px 20px',
                            borderRadius: '10px',
                            border: '1.5px solid #7C3AED',
                            background: 'rgba(124,58,237,.08)',
                            color: '#C4B5FD',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: "'DM Sans',sans-serif",
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        <Sparkles size={16} /> AI smart upload
                    </button>
                </div>

                {/* Filters row */}
                <div style={panelStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px', minWidth: 180 }}>
                            <Search size={16} style={{ color: 'var(--color-redwood-text-muted)', flexShrink: 0 }} />
                            <input
                                type="search"
                                placeholder="Search expenses by category, vendor, amount..."
                                value={expSearch}
                                onChange={e => setExpSearch(e.target.value)}
                                style={{ ...inputStyle, width: '100%' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>From</span>
                            <input type="date" value={expDateFrom} onChange={e => setExpDateFrom(e.target.value)} style={inputStyle} />
                            <span style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>To</span>
                            <input type="date" value={expDateTo} onChange={e => setExpDateTo(e.target.value)} style={inputStyle} />
                        </div>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ ...selectStyle, minWidth: 140 }}>
                            <option value="all">All categories</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...selectStyle, minWidth: 130 }}>
                            <option value="all">All statuses</option>
                            {STATUS_OPTIONS.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        {(expDateFrom || expDateTo || expSearch || categoryFilter !== 'all' || statusFilter !== 'all') && (
                            <button
                                type="button"
                                onClick={() => {
                                    setExpDateFrom('');
                                    setExpDateTo('');
                                    setExpSearch('');
                                    setCategoryFilter('all');
                                    setStatusFilter('all');
                                }}
                                style={{ ...ghostBtn, color: 'var(--color-brand-red-tint)', borderColor: 'rgba(239,68,68,.25)' }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Recent expenses list */}
                <div
                    style={{
                        background: 'var(--color-redwood-bg-surface)',
                        border: '1px solid var(--color-redwood-border)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 16px',
                            borderBottom: '1px solid var(--color-redwood-border)',
                        }}
                    >
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                            Recent expenses ({filteredExpenses.length})
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand-green)' }}>
                            ${formatMoney(filteredTotal)}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 10px 0' }}>
                        {filteredExpenses.length === 0 ? (
                            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 12 }}>
                                No expenses match your filters.
                            </div>
                        ) : (
                            filteredExpenses.map(expense => (
                                <div
                                    key={expense.id}
                                    className="group"
                                    style={{
                                        background: 'var(--color-redwood-row-bg)',
                                        border: '1px solid var(--color-redwood-border)',
                                        borderRadius: '10px',
                                        padding: '14px 16px',
                                        transition: 'background .12s',
                                    }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-redwood-row-hover)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-redwood-row-bg)'; }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-redwood-text-main)' }}>
                                                    {expense.category}
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 600,
                                                        padding: '2px 8px',
                                                        borderRadius: 20,
                                                        display: 'inline-block',
                                                        ...statusBadgeStyle(expense.status),
                                                    }}
                                                >
                                                    {expense.status}
                                                </span>
                                                {expense.aiExtracted && (
                                                    <span
                                                        style={{
                                                            fontSize: 9,
                                                            fontWeight: 600,
                                                            padding: '2px 8px',
                                                            borderRadius: 20,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            background: 'rgba(124,58,237,.12)',
                                                            color: '#C4B5FD',
                                                            border: '1px solid rgba(124,58,237,.28)',
                                                        }}
                                                    >
                                                        <Bot size={10} /> AI
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)', marginBottom: 4 }}>
                                                {expense.vendor || '—'} · {expense.description || '—'} · {formatExpenseDate(expense.date)} · {expense.paymentMethod}
                                                {(expense.account_id ?? expense.accountId) ? (
                                                    <span style={{ marginLeft: 6, color: 'var(--color-brand-blue-tint)' }}>
                                                        · {expenseAccountLabel(expense.account_id ?? expense.accountId, categories)}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {expense.currency && expense.currency !== 'USD' && (
                                                <div style={{ fontSize: 10, color: 'var(--color-brand-amber)', fontWeight: 500 }}>
                                                    {expense.currency} entered — converted
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-redwood-text-main)' }}>
                                                    USD ${formatMoney(expense.amount)}
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
                                                    {expense.receiptUrl ? (
                                                        <><Paperclip size={10} /> 1 receipt</>
                                                    ) : (
                                                        '— no receipt'
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {expense.status === 'Draft' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSubmitDraft(expense)}
                                                        style={{ ...ghostBtn, padding: '6px 8px' }}
                                                        title="Submit this draft for approval"
                                                    >
                                                        <Send size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingExpense(expense); setShowManualForm(true); }}
                                                    style={{ ...ghostBtn, padding: '6px 8px' }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(expense.id)}
                                                    style={{ ...ghostBtn, padding: '6px 8px', color: 'var(--color-brand-red-tint)' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer bar */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            marginTop: 10,
                            borderTop: '1px solid var(--color-redwood-border)',
                            fontSize: 11,
                            color: 'var(--color-redwood-text-muted)',
                        }}
                    >
                        <span>
                            {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''} · {filteredApprovedCount} approved · {filteredReceiptsCount} receipt{filteredReceiptsCount !== 1 ? 's' : ''} attached
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-brand-blue)' }}>
                            ${formatMoney(filteredTotal)} total
                        </span>
                    </div>
                </div>
            {/* AI Smart Upload Modal */}
            {showAiUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 backdrop-blur-md bg-black/50">
                    <div
                        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
                        style={{
                            background: 'var(--color-redwood-bg-surface)',
                            border: '1px solid var(--color-redwood-border)',
                        }}
                    >
                        <div
                            style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid var(--color-redwood-border)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 12,
                                position: 'sticky',
                                top: 0,
                                background: 'var(--color-redwood-bg-surface)',
                                zIndex: 1,
                            }}
                        >
                            <div>
                                <h3
                                    style={{
                                        fontFamily: "'Syne',sans-serif",
                                        fontSize: 18,
                                        fontWeight: 600,
                                        color: 'var(--color-redwood-text-main)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        margin: 0,
                                    }}
                                >
                                    <Sparkles size={20} style={{ color: '#A78BFA' }} />
                                    AI smart upload
                                </h3>
                                <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', margin: '4px 0 0' }}>
                                    Upload a receipt — AI extracts vendor, amount, and date
                                </p>
                            </div>
                            <button type="button" onClick={closeAiUpload} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--color-redwood-text-muted)', cursor: 'pointer', padding: 4 }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            {!aiExtractedData ? (
                                <label className="cursor-pointer block" style={{ padding: '40px 24px', borderRadius: 14, border: '2px dashed var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)' }}>
                                    <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" disabled={aiProcessing} />
                                    <div className="text-center">
                                        {aiProcessing ? (
                                            <>
                                                <div className="animate-spin rounded-full h-14 w-14 mx-auto mb-4" style={{ border: '3px solid #7C3AED', borderTopColor: 'transparent' }} />
                                                <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-redwood-text-main)', margin: '0 0 6px' }}>AI Processing…</h4>
                                                <p style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)', margin: 0 }}>Extracting data from your receipt</p>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={48} className="mx-auto mb-4" style={{ color: '#A78BFA' }} />
                                                <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-redwood-text-main)', margin: '0 0 6px' }}>Drag & drop receipt here</h4>
                                                <p style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)', margin: '0 0 8px' }}>or click to upload</p>
                                                <p style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', margin: 0 }}>Supports JPG, PNG, PDF</p>
                                            </>
                                        )}
                                    </div>
                                </label>
                            ) : (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)' }}>
                                            <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginBottom: 4 }}>Vendor</p>
                                            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-redwood-text-main)', margin: 0 }}>{aiExtractedData.vendor}</p>
                                            <ConfidenceBadge value={aiExtractedData.perFieldConfidence?.vendor ?? aiExtractedData.confidence} />
                                        </div>
                                        <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)' }}>
                                            <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginBottom: 4 }}>Amount</p>
                                            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-redwood-text-main)', margin: 0 }}>{aiExtractedData.currency} ${aiExtractedData.amount}</p>
                                            <ConfidenceBadge value={aiExtractedData.perFieldConfidence?.amount ?? aiExtractedData.confidence} />
                                        </div>
                                        <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)' }}>
                                            <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginBottom: 4 }}>Date</p>
                                            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-redwood-text-main)', margin: 0 }}>{new Date(aiExtractedData.date).toLocaleDateString()}</p>
                                            <ConfidenceBadge value={aiExtractedData.perFieldConfidence?.date ?? aiExtractedData.confidence} />
                                        </div>
                                        <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)' }}>
                                            <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginBottom: 4 }}>Tax</p>
                                            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-redwood-text-main)', margin: 0 }}>${aiExtractedData.taxAmount}</p>
                                        </div>
                                    </div>
                                    <div style={{ padding: 14, borderRadius: 10, background: 'rgba(124,58,237,.12)', border: '1px solid rgba(124,58,237,.28)' }}>
                                        <p style={{ fontSize: 10, color: '#C4B5FD', marginBottom: 4 }}>Category (AI suggested)</p>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-redwood-text-main)', margin: 0 }}>{aiExtractedData.suggestedCategory}</p>
                                        <p style={{ fontSize: 11, color: '#C4B5FD', marginTop: 4 }}>{aiExtractedData.confidence}% match confidence</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button type="button" onClick={() => { setAiExtractedData(null); setUploadedFile(null); }} style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--color-redwood-border)', background: 'transparent', color: 'var(--color-redwood-text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reject</button>
                                        <button type="button" onClick={handleAIConfirm} disabled={saving} style={{ flex: 2, padding: '12px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#4F8EF7)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Looks good — Save'}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            </div>
        </div>

                    {showManualForm && (
                        <ExpenseManualForm
                            editingExpense={editingExpense}
                            prefillClientId={prefillClientId}
                            categories={categories}
                            refreshCategories={refreshCategories}
                            customers={customers}
                            banks={banks}
                            defaultBank={defaultBank}
                            onClose={() => {
                                setShowManualForm(false);
                                setEditingExpense(null);
                                setPrefillClientId(null);
                            }}
                            onSaved={async () => {
                                await loadData();
                                setShowManualForm(false);
                                setEditingExpense(null);
                                setPrefillClientId(null);
                            }}
                            onOpenChart={() => navigate('/finance/chart-of-accounts')}
                        />
                    )}

    </>
    );
}
