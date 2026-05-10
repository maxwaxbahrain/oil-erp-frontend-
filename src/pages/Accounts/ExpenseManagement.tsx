import { useState, useEffect, useRef } from 'react';
import { getSystemSettings } from '../../services/settingsService';
import {
    DollarSign, Upload, Plus, FileText,
    Edit2, Trash2, RefreshCw,
    Sparkles, Brain, TrendingUp
} from 'lucide-react';
import clsx from 'clsx';
import {
    getExpenses,
    getExpenseCategories,
    saveExpense,
    saveExpenseCategory,
    deleteExpense,
    extractExpenseFromReceipt,
    generateExpenseHeadWithAI,
    type Expense,
    type ExpenseCategory,
    type AIExtractedData
} from '../../services/expenseService';

export default function ExpenseManagement() {
    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Manual entry state
    const [showManualForm, setShowManualForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

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
    const categoryRef = useRef<HTMLSelectElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);
    const dateRef = useRef<HTMLInputElement>(null);
    const vendorRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const paymentMethodRef = useRef<HTMLSelectElement>(null);
    const currencyRef = useRef<HTMLSelectElement>(null);
    const taxAmountRef = useRef<HTMLInputElement>(null);
    const recurringRef = useRef<HTMLInputElement>(null);

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
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleManualSave = async () => {
        const category = categoryRef.current?.value;
        const amount = parseFloat(amountRef.current?.value || '0');
        const date = dateRef.current?.value;
        const vendor = vendorRef.current?.value;
        const description = descriptionRef.current?.value;
        const paymentMethod = paymentMethodRef.current?.value as any;
        const currency = currencyRef.current?.value || 'USD';
        const taxAmount = parseFloat(taxAmountRef.current?.value || '0');
        const isRecurring = recurringRef.current?.checked || false;

        if (!category || !amount || !date || !vendor) {
            alert('Please fill in all required fields');
            return;
        }

        setSaving(true);
        try {
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
                status: 'Draft'
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

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;

        try {
            await deleteExpense(id);
            await loadData();
        } catch (error) {
            console.error('Failed to delete expense:', error);
            alert('Failed to delete expense');
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
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Expense Category *</label>
                                            <select
                                                ref={categoryRef}
                                                defaultValue={editingExpense?.category}
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                ))}
                                            </select>
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
                                </div>

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
                                    <button
                                        onClick={handleManualSave}
                                        disabled={saving}
                                        className="flex-[2] py-5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl disabled:opacity-50"
                                    >
                                        {saving ? '⏳ Saving...' : '✅ Save Expense'}
                                    </button>
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
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Amount</p>
                                    <p className="text-lg font-black text-gray-900">{aiExtractedData.currency} ${aiExtractedData.amount}</p>
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Date</p>
                                    <p className="text-lg font-black text-gray-900">{new Date(aiExtractedData.date).toLocaleDateString()}</p>
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
    );
}
