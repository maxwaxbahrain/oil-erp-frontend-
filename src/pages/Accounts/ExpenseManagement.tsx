import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSystemSettings } from '../../services/settingsService';
import {
    DollarSign, Upload, Plus,
    Edit2, Trash2, RefreshCw,
    Sparkles, Brain, Download, Send, Search, Paperclip, Bot, X
} from 'lucide-react';
import { getSalesOrders } from '../../services/salesService';
import clsx from 'clsx';
import {
    getExpensesSnapshot,
    getExpenseCategories,
    saveExpense,
    saveExpenseCategory,
    deleteExpense,
    exportExpensesAsCSV,
    extractExpenseFromReceipt,
    generateExpenseHeadWithAI,
    suggestExpenseCategory,
    checkExpenseDuplicate,
    checkExpensePolicy,
    type Expense,
    type ExpenseCategory,
    type AIExtractedData,
    type CategorySuggestion,
    type DuplicateResult,
    type PolicyFlag
} from '../../services/expenseService';
// STEP 11B — load customers for Bill-to dropdown.
import { getCustomers as loadCustomerList } from '../../services/customerService';
// ITEM 16 — Escape closes the manual entry modal and the category dropdown.
import { useEscape } from '../../hooks/useEscape';
import SearchableSelect from '../../components/common/SearchableSelect';
import { authFetch } from '../../api/axios';
import { getOilErpApiBase } from '../../config/apiBase';

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
    }, showManualForm);
    useEscape(closeAiUpload, showAiUpload);

    // AI upload state
    const [, setUploadedFile] = useState<File | null>(null);
    const [aiProcessing, setAiProcessing] = useState(false);
    const [aiExtractedData, setAiExtractedData] = useState<AIExtractedData | null>(null);

    // Custom category creator state
    const [showCategoryCreator, setShowCategoryCreator] = useState(false);
    const [categoryDescription, setCategoryDescription] = useState('');
    const [expDateFrom, setExpDateFrom] = useState('');
    const [expDateTo, setExpDateTo] = useState('');
    const [expSearch, setExpSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [aiCategorySuggestion, setAiCategorySuggestion] = useState<any>(null);
    const [generatingCategory, setGeneratingCategory] = useState(false);

    // Form refs for manual entry
    // ITEM 10 — Category is now controlled state (backed by a custom
    // searchable input). The legacy ref is kept around for nothing — all
    // read/write sites have been migrated to selectedCategory below.
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [categorySearch, setCategorySearch] = useState<string>('');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const categoryWrapRef = useRef<HTMLDivElement>(null);

    // Sync the selected category whenever the user opens the form for
    // editing — keeps the new searchable input in lock-step with the
    // editingExpense record. Resets on close.
    useEffect(() => {
        if (showManualForm) {
            setSelectedCategory(editingExpense?.category || '');
            setCategorySearch('');
        } else {
            setSelectedCategory('');
            setCategorySearch('');
            setCategoryOpen(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingExpense?.id, /* re-fire when modal opens fresh */ /* showManualForm intentionally omitted */]);
    useEffect(() => {
        if (showManualForm) {
            setSelectedCategory(editingExpense?.category || '');
        }
    }, [showManualForm, editingExpense?.category]);

    // Close the category dropdown on outside click.
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!categoryWrapRef.current) return;
            if (!categoryWrapRef.current.contains(e.target as Node)) setCategoryOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);
    // ITEM 16 — Escape closes the category dropdown (separately from the
    // modal — that way Esc on the dropdown alone doesn't kill the modal).
    useEscape(() => setCategoryOpen(false), categoryOpen);

    const amountRef = useRef<HTMLInputElement>(null);
    // STEP 3 — Smart Categorization state
    const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
    const [suggestionLoading, setSuggestionLoading] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    // STEP 4 — Duplicate Detection
    const [duplicateWarning, setDuplicateWarning] = useState<DuplicateResult | null>(null);
    // STEP 5 — Policy Checker violations (yellow banner above duplicate banner).
    const [policyViolations, setPolicyViolations] = useState<PolicyFlag[]>([]);
    // TASK 8 — Hard-block acknowledgement state for high-confidence duplicates
    // (≥90% confidence) and severity=error policy violations. User must
    // explicitly tick each acknowledgement before Save unlocks. Both reset
    // whenever the underlying warning list changes (so a fix that clears
    // the warning also clears stale acks).
    const [dupAcknowledged, setDupAcknowledged] = useState(false);
    const [policyErrorAcks, setPolicyErrorAcks] = useState<Record<number, boolean>>({});
    useEffect(() => { setDupAcknowledged(false); }, [duplicateWarning]);
    useEffect(() => { setPolicyErrorAcks({}); }, [policyViolations]);
    // STEP 11B — customers loaded once for the Bill-to dropdown.
    const [customers, setCustomers] = useState<Array<{ id: string | number; name: string }>>([]);
    const dateRef = useRef<HTMLInputElement>(null);
    const vendorRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const paymentMethodRef = useRef<HTMLSelectElement>(null);
    const currencyRef = useRef<HTMLSelectElement>(null);
    const taxAmountRef = useRef<HTMLInputElement>(null);
    const recurringRef = useRef<HTMLInputElement>(null);
    // STEPs 11B + 11C — billable + reimbursable refs
    const isBillableRef = useRef<HTMLInputElement>(null);
    const clientIdRef = useRef<HTMLSelectElement>(null);
    const isReimbursableRef = useRef<HTMLInputElement>(null);
    const [expenseAccounts, setExpenseAccounts] = useState<Array<{ id: string; name: string; code: string }>>([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');

    useEffect(() => {
        loadData();
    }, []);

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
                setCustomers((list as any[]).map(c => ({ id: c.id, name: c.name })));
            } catch { /* customer list is optional for the form */ }
            try {
                const ar = await authFetch(`${getOilErpApiBase()}/accounts/`);
                if (ar.ok) {
                    const rows = await ar.json();
                    setExpenseAccounts(
                        (Array.isArray(rows) ? rows : [])
                            .filter((a: { type?: string }) => String(a.type || '').toLowerCase() === 'expense')
                            .map((a: { id: number; name: string; code: string }) => ({
                                id: String(a.id),
                                name: a.name,
                                code: a.code,
                            }))
                    );
                }
            } catch { /* expense accounts optional */ }
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

    const handleManualSave = async () => {
        // ITEM 10 — Category comes from controlled state (searchable input).
        const category = selectedCategory;
        const amount = parseFloat(amountRef.current?.value || '0');
        const date = dateRef.current?.value;
        const vendor = vendorRef.current?.value;
        const description = descriptionRef.current?.value;
        const paymentMethod = paymentMethodRef.current?.value as any;
        const currency = currencyRef.current?.value || 'USD';
        const taxAmount = parseFloat(taxAmountRef.current?.value || '0');
        const isRecurring = recurringRef.current?.checked || false;
        // STEPs 11B/11C — read billable + reimbursable from refs
        const isBillable = isBillableRef.current?.checked || false;
        const clientIdValue = clientIdRef.current?.value || '';
        const isReimbursable = isReimbursableRef.current?.checked || false;

        if (!category || !amount || !date || !vendor) {
            alert('Please fill in all required fields');
            return;
        }

        setSaving(true);
        try {
            // STEP 4/5 — re-check at save time + persist both flags.
            const dupCheck = checkExpenseDuplicate({ vendor, amount, date, category, excludeId: editingExpense?.id });
            const policy = checkExpensePolicy({ category, amount, date, hasReceipt: false });
            await saveExpense({
                id: editingExpense?.id,
                category,
                amount,
                currency,
                date,
                vendor,
                description: description || '',
                paymentMethod,
                taxAmount,
                isRecurring,
                status: 'Draft',
                is_duplicate_flag: dupCheck.isDuplicate,
                duplicate_of_id: dupCheck.matches[0]?.expenseId || null,
                policy_flags: policy.length > 0 ? policy : undefined,
                // STEPs 11B/11C — billable + reimbursable persistence
                is_billable: isBillable,
                client_id: isBillable && clientIdValue ? clientIdValue : null,
                is_reimbursable: isReimbursable,
                account_id: selectedAccountId ? Number(selectedAccountId) : undefined,
            });
            await loadData();
            setShowManualForm(false);
            setEditingExpense(null);
            setSelectedAccountId('');
        } catch (error) {
            console.error('Failed to save expense:', error);
            alert('Failed to save expense');
        } finally {
            setSaving(false);
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

    // STEP 4 — On-blur duplicate check: runs against last 90 days of
    // expenses from localStorage.  Pure-local, no API call.  Sets the
    // yellow banner state below the submit button.  Re-evaluated every
    // time the amount field loses focus (most reliable trigger since
    // the form is uncontrolled / ref-based).
    const handleCheckDuplicates = () => {
        const vendor = vendorRef.current?.value?.trim() || '';
        const amount = parseFloat(amountRef.current?.value || '0') || 0;
        const date = dateRef.current?.value || '';
        const category = selectedCategory;
        if (!vendor || !amount || !date) {
            setDuplicateWarning(null);
            return;
        }
        const result = checkExpenseDuplicate({
            vendor, amount, date, category,
            excludeId: editingExpense?.id,
        });
        setDuplicateWarning(result.isDuplicate ? result : null);
        // STEP 5 — Policy check uses the same trigger.  Receipts aren't
        // attached on the manual entry form, so hasReceipt is false here.
        const violations = checkExpensePolicy({
            category, amount, date,
            hasReceipt: false,
        });
        setPolicyViolations(violations);
    };

    // STEP 3 — Smart Categorization: explicit "AI Suggest" button next
    // to the Category field.  Reads current vendor/description/amount
    // refs (form is uncontrolled) and calls the service.  Sets
    // `suggestion` which renders the inline badge with a "Use" button.
    const handleSuggestCategory = async () => {
        const vendor = vendorRef.current?.value?.trim() || '';
        const description = descriptionRef.current?.value?.trim() || '';
        const amount = parseFloat(amountRef.current?.value || '0') || 0;
        if (!vendor) {
            setSuggestionError('Enter a vendor first.');
            return;
        }
        setSuggestion(null);
        setSuggestionError(null);
        setSuggestionLoading(true);
        try {
            const s = await suggestExpenseCategory(vendor, description, amount);
            setSuggestion(s);
        } catch (e) {
            setSuggestionError(e instanceof Error ? e.message : 'Could not categorize.');
        } finally {
            setSuggestionLoading(false);
        }
    };

    const handleAIConfirm = async () => {
        if (!aiExtractedData) return;

        setSaving(true);
        try {
            await saveExpense({
                category: aiExtractedData.suggestedCategory,
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
                aiConfidence: aiExtractedData.confidence
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

    const handleGenerateCategory = async () => {
        if (!categoryDescription.trim()) {
            alert('Please describe your expense');
            return;
        }

        setGeneratingCategory(true);
        try {
            const amount = parseFloat(amountRef.current?.value || '0') || 0;
            const suggestion = await generateExpenseHeadWithAI(categoryDescription, amount);
            setAiCategorySuggestion(suggestion);
        } catch (error) {
            console.error('Failed to generate category:', error);
            setAiCategorySuggestion({
                name: '—',
                parentCategory: '—',
                type: '—',
                isRecurring: false,
                taxTreatment: '—',
                accountCode: '—',
                similarCategories: [],
            });
        } finally {
            setGeneratingCategory(false);
        }
    };

    const handleAcceptCategorySuggestion = async () => {
        if (!aiCategorySuggestion) return;

        try {
            if (aiCategorySuggestion.name === '—') {
                alert('No real AI suggestion is available to create.');
                return;
            }
            await saveExpenseCategory({
                name: aiCategorySuggestion.name,
                parentCategory: aiCategorySuggestion.parentCategory,
                type: aiCategorySuggestion.type,
                isRecurring: aiCategorySuggestion.isRecurring,
                taxTreatment: aiCategorySuggestion.taxTreatment,
                accountCode: aiCategorySuggestion.accountCode
            });
            await loadData();
            setShowCategoryCreator(false);
            setCategoryDescription('');
            setAiCategorySuggestion(null);
            alert('Category created successfully!');
        } catch (error) {
            console.error('Failed to save category:', error);
            alert('Failed to save category');
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
                        onClick={() => { setShowManualForm(false); setShowAiUpload(true); }}
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
                                                        · Acct #{expense.account_id ?? expense.accountId}
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

                    {/* Manual Form Modal */}
                    {showManualForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
                            <div className="bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                                <div className="p-10 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
                                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
                                        <Plus size={24} />
                                        {editingExpense ? 'Edit Expense' : 'Add Expense Manually'}
                                    </h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                        Fill in the details below
                                    </p>
                                </div>

                                <div className="p-12 space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Expense Category *</label>
                                                {/* ITEM 10 — Inline "+ New" opens the existing category creator. */}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCategoryCreator(true)}
                                                    className="text-[10px] font-black text-purple-600 hover:text-purple-800 uppercase tracking-widest flex items-center gap-1"
                                                >
                                                    <Plus size={12} /> New Category
                                                </button>
                                            </div>
                                            {/* ITEM 10 — Searchable category combobox. Filters categories
                                                by name and lets the user pick with mouse or keyboard. */}
                                            <div ref={categoryWrapRef} className="relative">
                                                <input
                                                    type="text"
                                                    value={categoryOpen ? categorySearch : selectedCategory}
                                                    onChange={(e) => { setCategorySearch(e.target.value); setCategoryOpen(true); }}
                                                    onFocus={() => { setCategorySearch(''); setCategoryOpen(true); }}
                                                    placeholder="Search category…"
                                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                                />
                                                {categoryOpen && (
                                                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-2xl">
                                                        {categories
                                                            .filter(c => !categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                                            .map(cat => (
                                                                <button
                                                                    key={cat.id}
                                                                    type="button"
                                                                    onClick={() => { setSelectedCategory(cat.name); setCategorySearch(''); setCategoryOpen(false); }}
                                                                    className={clsx(
                                                                        'w-full text-left px-5 py-3 text-sm font-bold hover:bg-gray-50',
                                                                        cat.name === selectedCategory ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                                                                    )}
                                                                >
                                                                    {cat.name}
                                                                </button>
                                                            ))}
                                                        {categories.filter(c => !categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                                                            <div className="px-5 py-6 text-center text-xs text-gray-400 font-bold">
                                                                No matching category. Use <strong>+ New Category</strong> to create one.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {/* STEP 3 — AI suggest button + suggestion badge */}
                                            <button
                                                type="button"
                                                onClick={handleSuggestCategory}
                                                disabled={suggestionLoading}
                                                className="mt-2 text-[10px] font-black uppercase tracking-widest text-purple-700 hover:text-purple-900 disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {suggestionLoading ? '⏳ Asking AI…' : '✨ AI Suggest from Vendor'}
                                            </button>
                                            {suggestionError && (
                                                <p className="mt-2 text-[10px] font-bold text-rose-600">{suggestionError}</p>
                                            )}
                                            {suggestion && (
                                                <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest">
                                                            AI suggests: {suggestion.category} → <span className="text-purple-900">{suggestion.mappedCategory}</span>
                                                        </p>
                                                        <p className="text-[10px] text-purple-700 mt-0.5">{suggestion.confidence}% confident — {suggestion.reason}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            // ITEM 10 — Write directly to the controlled category state.
                                                            setSelectedCategory(suggestion.mappedCategory);
                                                            setSuggestion(null);
                                                        }}
                                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                                                    >Use</button>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Amount *</label>
                                            <div className="flex gap-2">
                                                <select
                                                    ref={currencyRef}
                                                    defaultValue={editingExpense?.currency || 'USD'}
                                                    className="w-24 bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-4 py-4 text-sm font-bold outline-none"
                                                >
                                                    <option value="USD">USD</option>
                                                    <option value="EUR">EUR</option>
                                                    <option value="GBP">GBP</option>
                                                    <option value={getSystemSettings().defaultCurrencyCode}>{getSystemSettings().defaultCurrencyCode}</option>
                                                </select>
                                                <input
                                                    ref={amountRef}
                                                    type="number"
                                                    step="0.01"
                                                    defaultValue={editingExpense?.amount}
                                                    placeholder="0.00"
                                                    onBlur={handleCheckDuplicates}
                                                    className="flex-1 bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Date *</label>
                                            <input
                                                ref={dateRef}
                                                type="date"
                                                defaultValue={editingExpense?.date || new Date().toISOString().split('T')[0]}
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Vendor *</label>
                                            <input
                                                ref={vendorRef}
                                                type="text"
                                                defaultValue={editingExpense?.vendor}
                                                placeholder="Vendor name"
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Description</label>
                                        <textarea
                                            ref={descriptionRef}
                                            defaultValue={editingExpense?.description}
                                            placeholder="Brief description"
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none h-24 resize-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Expense account (GL)</label>
                                        <SearchableSelect
                                            options={expenseAccounts}
                                            value={selectedAccountId || String(editingExpense?.account_id ?? editingExpense?.accountId ?? '')}
                                            onChange={setSelectedAccountId}
                                            placeholder="Select expense account..."
                                            displayKey="name"
                                            theme="dark"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Payment Method</label>
                                            <select
                                                ref={paymentMethodRef}
                                                defaultValue={editingExpense?.paymentMethod || 'Cash'}
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                            >
                                                <option value="Cash">Cash</option>
                                                <option value="Card">Card</option>
                                                <option value="Bank Transfer">Bank Transfer</option>
                                                <option value="Check">Check</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Tax Amount</label>
                                            <input
                                                ref={taxAmountRef}
                                                type="number"
                                                step="0.01"
                                                defaultValue={editingExpense?.taxAmount}
                                                placeholder="0.00"
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                                        <input
                                            ref={recurringRef}
                                            type="checkbox"
                                            defaultChecked={editingExpense?.isRecurring}
                                            className="w-5 h-5"
                                        />
                                        <label className="text-sm font-bold text-gray-700">Recurring Expense</label>
                                    </div>

                                    {/* STEP 11B — Billable to client */}
                                    <div className="p-4 bg-blue-50 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                ref={isBillableRef}
                                                type="checkbox"
                                                defaultChecked={editingExpense?.is_billable}
                                                className="w-5 h-5"
                                            />
                                            <label className="text-sm font-bold text-gray-700">Billable to client</label>
                                        </div>
                                        <select
                                            ref={clientIdRef}
                                            defaultValue={editingExpense?.client_id || ''}
                                            className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="">Select customer…</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={String(c.id)}>{c.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-blue-700">When billable, this expense appears on the customer's Unbilled Expenses tab.</p>
                                    </div>

                                    {/* STEP 11C — Reimbursable to employee */}
                                    <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl">
                                        <input
                                            ref={isReimbursableRef}
                                            type="checkbox"
                                            defaultChecked={editingExpense?.is_reimbursable}
                                            className="w-5 h-5"
                                        />
                                        <label className="text-sm font-bold text-gray-700">Reimbursable to employee (out-of-pocket)</label>
                                    </div>
                                </div>

                                {/* TASK 8 — Policy violations: split errors (red, blocking)
                                    from warnings (amber, advisory). */}
                                {policyViolations.filter(v => v.severity === 'error').length > 0 && (
                                    <div className="mx-10 mt-2 mb-2 p-4 bg-red-50 border-2 border-red-400 rounded-2xl">
                                        <p className="text-sm font-black text-red-800 uppercase tracking-widest mb-2">🚫 Policy errors — acknowledge each to enable Save</p>
                                        <ul className="text-xs text-red-700 space-y-2">
                                            {policyViolations
                                                .map((v, i) => ({ v, i }))
                                                .filter(({ v }) => v.severity === 'error')
                                                .map(({ v, i }) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!policyErrorAcks[i]}
                                                            onChange={(e) => setPolicyErrorAcks(prev => ({ ...prev, [i]: e.target.checked }))}
                                                            className="mt-0.5 shrink-0"
                                                        />
                                                        <span><strong>{v.rule}:</strong> {v.message}</span>
                                                    </li>
                                                ))}
                                        </ul>
                                    </div>
                                )}
                                {policyViolations.filter(v => v.severity !== 'error').length > 0 && (
                                    <div className="mx-10 mt-2 mb-2 p-4 bg-amber-50 border border-amber-300 rounded-2xl">
                                        <p className="text-sm font-black text-amber-800 uppercase tracking-widest mb-1">⚠️ Policy warnings</p>
                                        <ul className="text-xs text-amber-700 space-y-1">
                                            {policyViolations.filter(v => v.severity !== 'error').map((v, i) => (
                                                <li key={i}>· {v.message}</li>
                                            ))}
                                        </ul>
                                        <p className="text-[10px] text-amber-600 font-bold mt-2 uppercase tracking-widest">You can still save — these are just warnings.</p>
                                    </div>
                                )}
                                {/* TASK 8 — Duplicate banner: red + hard-block when confidence ≥ 90%,
                                    amber + advisory below 90%. The high-confidence case requires a
                                    single confirmation checkbox before Save unlocks. */}
                                {duplicateWarning && duplicateWarning.maxConfidence >= 90 && (
                                    <div className="mx-10 mt-2 mb-4 p-4 bg-red-50 border-2 border-red-400 rounded-2xl">
                                        <p className="text-sm font-black text-red-800 uppercase tracking-widest mb-1">🚫 Possible duplicate — please review before saving</p>
                                        <ul className="text-xs text-red-700 space-y-1 mb-3">
                                            {duplicateWarning.matches.map((m, i) => (
                                                <li key={i}>· {m.vendor} — {m.amount.toFixed(2)} on {m.date} <span className="opacity-75">({m.reason}, {m.confidence}% conf.)</span></li>
                                            ))}
                                        </ul>
                                        <label className="flex items-start gap-2 text-xs font-bold text-red-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={dupAcknowledged}
                                                onChange={(e) => setDupAcknowledged(e.target.checked)}
                                                className="mt-0.5 shrink-0"
                                            />
                                            <span>I confirm this is not a duplicate</span>
                                        </label>
                                    </div>
                                )}
                                {duplicateWarning && duplicateWarning.maxConfidence < 90 && (
                                    <div className="mx-10 mt-2 mb-4 p-4 bg-amber-50 border border-amber-300 rounded-2xl">
                                        <p className="text-sm font-black text-amber-800 uppercase tracking-widest mb-1">⚠️ Possible duplicate</p>
                                        <ul className="text-xs text-amber-700 space-y-1">
                                            {duplicateWarning.matches.map((m, i) => (
                                                <li key={i}>· {m.vendor} — {m.amount.toFixed(2)} on {m.date} <span className="opacity-75">({m.reason})</span></li>
                                            ))}
                                        </ul>
                                        <p className="text-[10px] text-amber-600 font-bold mt-2 uppercase tracking-widest">You can still save — this is just a warning.</p>
                                    </div>
                                )}
                                <div className="p-10 bg-gray-50 border-t border-gray-100 flex gap-4 sticky bottom-0">
                                    <button
                                        onClick={() => {
                                            setShowManualForm(false);
                                            setEditingExpense(null);
                                        }}
                                        disabled={saving}
                                        className="flex-1 py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    {/* TASK 8 — Save unlocks only when (a) no high-confidence
                                        duplicate is unacknowledged AND (b) every error-severity
                                        policy violation has been individually acknowledged. */}
                                    {(() => {
                                        const hasHighDup = !!duplicateWarning && duplicateWarning.maxConfidence >= 90;
                                        const errorPolicyIdxs = policyViolations
                                            .map((v, i) => v.severity === 'error' ? i : -1)
                                            .filter(i => i >= 0);
                                        const unackedErrors = errorPolicyIdxs.filter(i => !policyErrorAcks[i]);
                                        const blockedByDup = hasHighDup && !dupAcknowledged;
                                        const blockedByPolicy = unackedErrors.length > 0;
                                        const isBlocked = saving || blockedByDup || blockedByPolicy;
                                        const label = blockedByDup
                                            ? '🚫 Confirm duplicate check above'
                                            : blockedByPolicy
                                                ? `🚫 Acknowledge ${unackedErrors.length} policy error${unackedErrors.length === 1 ? '' : 's'}`
                                                : saving
                                                    ? '⏳ Saving...'
                                                    : '✅ Save Expense';
                                        return (
                                            <button
                                                onClick={handleManualSave}
                                                disabled={isBlocked}
                                                className="flex-[2] py-5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={blockedByDup ? 'Tick the confirmation checkbox in the red duplicate banner' : blockedByPolicy ? 'Tick each policy error checkbox above' : undefined}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

            {/* Custom Category Creator Modal */}
            {showCategoryCreator && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
                    <div className="bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden">
                        <div className="p-10 border-b border-gray-100 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                            <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                                <Brain size={28} />
                                Create Custom Expense Head (AI Assistant) 🤖
                            </h3>
                            <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest mt-1">
                                Describe your expense in plain language
                            </p>
                        </div>

                        <div className="p-12 space-y-8">
                            <div>
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">
                                    Describe your expense in plain language:
                                </label>
                                <textarea
                                    value={categoryDescription}
                                    onChange={(e) => setCategoryDescription(e.target.value)}
                                    placeholder='e.g., "We pay monthly for email marketing software like Mailchimp"'
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-purple-600 rounded-2xl px-8 py-6 text-sm font-bold outline-none h-32 resize-none"
                                />
                            </div>

                            <button
                                onClick={handleGenerateCategory}
                                disabled={generatingCategory || !categoryDescription.trim()}
                                className="w-full py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {generatingCategory ? (
                                    <>
                                        <RefreshCw size={18} className="animate-spin" /> Generating with AI...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} /> Generate with AI 🚀
                                    </>
                                )}
                            </button>

                            {aiCategorySuggestion && (
                                <div className="p-8 bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl border-2 border-purple-100">
                                    <h4 className="text-lg font-black text-purple-900 uppercase tracking-tighter mb-6 flex items-center gap-2">
                                        <Sparkles size={20} /> AI Suggestion:
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Expense Head</p>
                                                <p className="text-lg font-black text-gray-900">{aiCategorySuggestion.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Parent Category</p>
                                                <p className="text-lg font-black text-gray-900">{aiCategorySuggestion.parentCategory}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Type</p>
                                                <p className="text-sm font-bold text-gray-700">{aiCategorySuggestion.isRecurring ? 'Recurring' : 'One-time'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Tax Category</p>
                                                <p className="text-sm font-bold text-gray-700">{aiCategorySuggestion.taxTreatment}</p>
                                            </div>
                                        </div>

                                        {aiCategorySuggestion.similarCategories.length > 0 && (
                                            <div className="pt-4 border-t border-purple-200">
                                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">Similar expenses found:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {aiCategorySuggestion.similarCategories.map((cat: string, idx: number) => (
                                                        <span key={idx} className="px-3 py-1 bg-white rounded-full text-[10px] font-bold text-gray-700 border border-purple-100">
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-10 bg-gray-50 border-t border-gray-100 flex gap-4">
                            <button
                                onClick={() => {
                                    setShowCategoryCreator(false);
                                    setCategoryDescription('');
                                    setAiCategorySuggestion(null);
                                }}
                                className="flex-1 py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            {aiCategorySuggestion && (
                                <button
                                    onClick={handleAcceptCategorySuggestion}
                                    className="flex-[2] py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-xl"
                                >
                                    ✅ Accept & Create Category
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
    </>
    );
}
