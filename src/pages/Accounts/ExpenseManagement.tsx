import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSystemSettings } from '../../services/settingsService';
import {
    DollarSign, Upload, Plus, FileText,
    Edit2, Trash2, RefreshCw,
    Sparkles, Brain, TrendingUp, Download, Send
} from 'lucide-react';
import clsx from 'clsx';
import {
    getExpenses,
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
    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [expFromDate, setExpFromDate] = useState('');
    const [expToDate, setExpToDate] = useState('');
    const [saving, setSaving] = useState(false);

    // Manual entry state
    const [showManualForm, setShowManualForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    // ITEM 16 — Escape closes the manual entry modal. The category
    // dropdown (declared below) has its own outside-click handler; Escape
    // closes both at once which is the expected behavior.
    useEscape(() => {
        setShowManualForm(false);
        setEditingExpense(null);
    }, showManualForm);

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

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [expensesData, categoriesData] = await Promise.all([
                getExpenses(),
                getExpenseCategories()
            ]);
            setExpenses(expensesData);
            setCategories(categoriesData);
            try {
                const list = await loadCustomerList();
                setCustomers((list as any[]).map(c => ({ id: c.id, name: c.name })));
            } catch { /* customer list is optional for the form */ }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
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
            });
            await loadData();
            setShowManualForm(false);
            setEditingExpense(null);
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
            setAiExtractedData(null);
            setUploadedFile(null);
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
            const suggestion = await generateExpenseHeadWithAI(categoryDescription);
            setAiCategorySuggestion(suggestion);
        } catch (error) {
            console.error('Failed to generate category:', error);
            alert('Failed to generate category');
        } finally {
            setGeneratingCategory(false);
        }
    };

    const handleAcceptCategorySuggestion = async () => {
        if (!aiCategorySuggestion) return;

        try {
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

    const thisMonthTotal = expenses
        .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
        .reduce((sum, e) => sum + e.amount, 0);

    const pendingApprovalCount = expenses.filter(e => e.status === 'Pending Approval').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Loading expenses...</p>
                </div>
            </div>
        );
    }

    return (
        <>
        {/* TASK 2 — W7-3 amber localStorage warning removed: expenses now
            live on the backend (POST /api/expenses/), so the "clearing
            browser data wipes history" risk no longer applies. Export CSV
            stays available in the sub-nav below as a reporting helper. */}

        {/* STEP 6+7 — Sub-navigation: Approvals + AI Bulk Upload + Export */}
        <div className="flex justify-end gap-2 mb-3">
            {/* TASK 2 — CSV export moved here from the removed W7-3 banner. */}
            <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-sm"
                title="Export all expenses as CSV"
            >
                <Download size={14} /> Export CSV
            </button>
            <button
                onClick={() => navigate('/finance/expenses/settings')}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-sm"
            >
                ⚙ Settings
            </button>
            <button
                onClick={() => navigate('/finance/expenses/reports')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-sm"
            >
                📊 Reports
            </button>
            <button
                onClick={() => navigate('/finance/expenses/mileage')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-sm"
            >
                🚗 Mileage
            </button>
            <button
                onClick={() => navigate('/finance/expenses/approvals')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-sm"
            >
                ✓ Approvals
            </button>
            <button
                onClick={() => navigate('/finance/expenses/bulk-upload')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-sm"
            >
                ✨ AI Bulk Upload
            </button>
        </div>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                        <span className="text-xs text-gray-500 font-bold">From:</span>
                        <input type="date" value={expFromDate} onChange={e => setExpFromDate(e.target.value)} className="text-xs font-mono focus:outline-none" />
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                        <span className="text-xs text-gray-500 font-bold">To:</span>
                        <input type="date" value={expToDate} onChange={e => setExpToDate(e.target.value)} className="text-xs font-mono focus:outline-none" />
                    </div>
                    {(expFromDate || expToDate) && <button onClick={() => { setExpFromDate(''); setExpToDate(''); }} className="text-xs text-red-400 hover:text-red-600 font-bold px-3 py-2 bg-white border border-red-200 rounded-xl">✕ Clear Date Filter</button>}
                </div>
                <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header with KPIs */}
            <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-4">
                            <DollarSign className="text-gray-900" size={32} />
                            Expense Management
                        </h2>
                        <p className="text-gray-500 mt-2 text-sm font-medium uppercase tracking-widest">
                            AI-Powered Expense Tracking & Management
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowCategoryCreator(true)}
                            className="px-6 py-4 bg-purple-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-purple-700 transition-all flex items-center gap-2"
                        >
                            <Brain size={18} /> AI Custom Head
                        </button>
                        <button
                            onClick={loadData}
                            className="px-6 py-4 bg-gray-50 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all"
                        >
                            <RefreshCw size={18} className="inline mr-2" /> Refresh
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 rounded-3xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <TrendingUp size={80} />
                        </div>
                        <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-2">This Month</p>
                        <p className="text-4xl font-black tracking-tighter">${thisMonthTotal.toLocaleString()}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-8 rounded-3xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <FileText size={80} />
                        </div>
                        <p className="text-[10px] font-black text-amber-200 uppercase tracking-widest mb-2">Pending Approval</p>
                        <p className="text-4xl font-black tracking-tighter">{pendingApprovalCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 rounded-3xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <Sparkles size={80} />
                        </div>
                        <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">AI Processed</p>
                        <p className="text-4xl font-black tracking-tighter">{expenses.filter(e => e.aiExtracted).length}</p>
                    </div>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="bg-white p-2 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-2 w-fit">
                <button
                    onClick={() => setActiveTab('manual')}
                    className={clsx(
                        "px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                        activeTab === 'manual'
                            ? "bg-gray-900 text-white shadow-xl"
                            : "text-gray-400 hover:text-gray-900"
                    )}
                >
                    <Edit2 size={16} /> Manual Entry
                </button>
                <button
                    onClick={() => setActiveTab('ai')}
                    className={clsx(
                        "px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                        activeTab === 'ai'
                            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-xl"
                            : "text-gray-400 hover:text-purple-600"
                    )}
                >
                    <Sparkles size={16} /> AI Smart Upload
                </button>
            </div>

            {/* Manual Entry Tab */}
            {activeTab === 'manual' && (
                <div className="space-y-8">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Manual Expense Entry</h3>
                        <button
                            onClick={() => {
                                setShowManualForm(true);
                                setEditingExpense(null);
                            }}
                            className="px-8 py-4 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all flex items-center gap-2 shadow-xl"
                        >
                            <Plus size={18} /> Add Expense
                        </button>
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

                    {/* Expense List */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                            <h4 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Recent Expenses</h4>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {/* Date range filter */}
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <input type="text" value={expSearch} onChange={e => setExpSearch(e.target.value)}
                                    placeholder="Search expenses..."
                                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400 flex-1 min-w-[150px]" />
                                <input type="date" value={expDateFrom} onChange={e => setExpDateFrom(e.target.value)}
                                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400" />
                                <span className="text-xs text-gray-400">to</span>
                                <input type="date" value={expDateTo} onChange={e => setExpDateTo(e.target.value)}
                                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400" />
                                {(expDateFrom || expDateTo || expSearch) && (
                                    <button onClick={() => { setExpDateFrom(''); setExpDateTo(''); setExpSearch(''); }}
                                        className="text-xs text-red-500 font-bold hover:text-red-700">Clear</button>
                                )}
                            </div>
                            {expenses.filter(expense => {
                                if (expDateFrom && (expense.date || '') < expDateFrom) return false;
                                if (expDateTo && (expense.date || '') > expDateTo) return false;
                                if (expSearch && !expense.vendor?.toLowerCase().includes(expSearch.toLowerCase()) &&
                                    !expense.category?.toLowerCase().includes(expSearch.toLowerCase()) &&
                                    !String(expense.amount).includes(expSearch)) return false;
                                return true;
                            }).slice(0, 50).map(expense => (
                                <div key={expense.id} className="p-8 hover:bg-gray-50 transition-colors group">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h5 className="text-lg font-black text-gray-900">{expense.category}</h5>
                                                <span className={clsx(
                                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                                    expense.status === 'Approved' ? "bg-emerald-100 text-emerald-700" :
                                                        expense.status === 'Pending Approval' ? "bg-amber-100 text-amber-700" :
                                                            expense.status === 'Rejected' ? "bg-rose-100 text-rose-700" :
                                                                "bg-gray-100 text-gray-700"
                                                )}>{expense.status}</span>
                                                {expense.aiExtracted && (
                                                    <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 flex items-center gap-1">
                                                        <Sparkles size={10} /> AI
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 font-medium mb-1">{expense.vendor} • {expense.description}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                {new Date(expense.date).toLocaleDateString()} • {expense.paymentMethod}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-2xl font-black text-gray-900">{expense.currency} ${expense.amount.toLocaleString()}</p>
                                                {expense.taxAmount && expense.taxAmount > 0 && (
                                                    <p className="text-[10px] text-gray-400 font-bold">Tax: ${expense.taxAmount}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* ITEM 10 — Submit-draft action. Only shown for Draft
                                                    expenses; one click flips status → Submitted. */}
                                                {expense.status === 'Draft' && (
                                                    <button
                                                        onClick={() => handleSubmitDraft(expense)}
                                                        className="p-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                                                        title="Submit this draft for approval"
                                                    >
                                                        <Send size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setEditingExpense(expense);
                                                        setShowManualForm(true);
                                                    }}
                                                    className="p-3 bg-gray-100 rounded-xl hover:bg-gray-900 hover:text-white transition-all"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(expense.id)}
                                                    className="p-3 bg-gray-100 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Smart Upload Tab */}
            {activeTab === 'ai' && (
                <div className="space-y-8">
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
                        <Sparkles className="text-purple-600" size={24} />
                        AI-Powered Receipt Processing
                    </h3>

                    {!aiExtractedData ? (
                        <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-gray-200 hover:border-purple-400 transition-all">
                            <label className="cursor-pointer block">
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    disabled={aiProcessing}
                                />
                                <div className="text-center">
                                    {aiProcessing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-6"></div>
                                            <h4 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2">AI Processing...</h4>
                                            <p className="text-sm text-gray-500 font-medium">Extracting data from your receipt</p>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={64} className="mx-auto text-gray-300 mb-6" />
                                            <h4 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2">
                                                📁 Drag & Drop Receipt Here
                                            </h4>
                                            <p className="text-sm text-gray-500 font-medium mb-4">or Click to Upload</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                Supports: JPG, PNG, PDF
                                            </p>
                                        </>
                                    )}
                                </div>
                            </label>
                        </div>
                    ) : (
                        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center text-white">
                                    <Sparkles size={24} />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Extracted Information</h4>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">AI Confidence: {aiExtractedData.confidence}%</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Vendor</p>
                                    <p className="text-lg font-black text-gray-900">{aiExtractedData.vendor}</p>
                                    <ConfidenceBadge value={aiExtractedData.perFieldConfidence?.vendor ?? aiExtractedData.confidence} />
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Amount</p>
                                    <p className="text-lg font-black text-gray-900">{aiExtractedData.currency} ${aiExtractedData.amount}</p>
                                    <ConfidenceBadge value={aiExtractedData.perFieldConfidence?.amount ?? aiExtractedData.confidence} />
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Date</p>
                                    <p className="text-lg font-black text-gray-900">{new Date(aiExtractedData.date).toLocaleDateString()}</p>
                                    <ConfidenceBadge value={aiExtractedData.perFieldConfidence?.date ?? aiExtractedData.confidence} />
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tax</p>
                                    <p className="text-lg font-black text-gray-900">${aiExtractedData.taxAmount}</p>
                                </div>
                            </div>

                            <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100 mb-8">
                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">Category (AI Suggested)</p>
                                <p className="text-lg font-black text-purple-900">{aiExtractedData.suggestedCategory}</p>
                                <p className="text-sm text-purple-700 font-medium mt-1">{aiExtractedData.confidence}% match confidence</p>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setAiExtractedData(null);
                                        setUploadedFile(null);
                                    }}
                                    className="flex-1 py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all"
                                >
                                    ❌ Reject
                                </button>
                                <button
                                    onClick={handleAIConfirm}
                                    disabled={saving}
                                    className="flex-[2] py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-xl disabled:opacity-50"
                                >
                                    {saving ? '⏳ Saving...' : '✓ Looks Good - Save'}
                                </button>
                            </div>
                        </div>
                    )}
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
        </div>
    </>
    );
}
