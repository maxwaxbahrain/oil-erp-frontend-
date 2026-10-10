import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import CustomerCombobox, { type CustomerComboboxOption } from '../../components/forms/CustomerCombobox';
import { getSystemSettings } from '../../services/settingsService';
import {
    checkExpenseDuplicate,
    checkExpensePolicy,
    resolveCoaCategoryName,
    saveExpense,
    suggestExpenseCategory,
    uploadExpenseReceipt,
    type CategorySuggestion,
    type DuplicateResult,
    type Expense,
    type ExpenseCategory,
    type PolicyFlag,
} from '../../services/expenseService';
import type { BankingAccount } from '../../services/glService';
import { expenseMethodIsCash, expensePaymentAccountIdForSave } from '../../utils/bankingAccounts';
import { PaidFromBankPicker } from './paidFromBankPicker';

const RECEIPT_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';
const RECEIPT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

function pickDefaultExpenseAccountId(categories: ExpenseCategory[]): string {
    const general = categories.find(a => a.name.toLowerCase().includes('general expenses'));
    return general ? String(general.id) : (categories[0] ? String(categories[0].id) : '');
}

function formatCoaCategoryLabel(cat: ExpenseCategory): string {
    return cat.code ? `${cat.code} · ${cat.name}` : cat.name;
}

function fileAllowed(file: File): boolean {
    if (RECEIPT_TYPES.includes(file.type.toLowerCase())) return true;
    const name = file.name.toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp', '.pdf'].some((ext) => name.endsWith(ext));
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 102.4) / 10)} KB`;
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function growDescription(el: HTMLTextAreaElement) {
    const style = window.getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 21;
    const min = line * 3;
    const max = line * 8;
    el.style.height = 'auto';
    const next = Math.min(max, Math.max(min, el.scrollHeight));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
}

function initialBillable(editing: Expense | null, prefillClientId: string | null): boolean {
    if (editing) return Boolean(editing.is_billable);
    return prefillClientId != null;
}

function initialClientId(
    editing: Expense | null,
    prefillClientId: string | null,
    customers: CustomerComboboxOption[],
): string {
    if (editing) return editing.client_id || '';
    if (prefillClientId && customers.some((customer) => String(customer.id) === String(prefillClientId))) {
        return prefillClientId;
    }
    return '';
}

export function ExpenseManualForm({
    editingExpense,
    prefillClientId,
    categories,
    refreshCategories,
    customers,
    banks,
    defaultBank,
    onClose,
    onSaved,
    onOpenChart,
}: {
    editingExpense: Expense | null;
    prefillClientId: string | null;
    categories: ExpenseCategory[];
    refreshCategories: () => Promise<void> | void;
    customers: CustomerComboboxOption[];
    banks: BankingAccount[];
    defaultBank: BankingAccount | null;
    onClose: () => void;
    onSaved: () => Promise<void> | void;
    onOpenChart: () => void;
}) {
    const amountRef = useRef<HTMLInputElement>(null);
    const dateRef = useRef<HTMLInputElement>(null);
    const vendorRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const currencyRef = useRef<HTMLSelectElement>(null);
    const taxAmountRef = useRef<HTMLInputElement>(null);
    const categoryWrapRef = useRef<HTMLDivElement>(null);
    const previewUrlRef = useRef<string>('');

    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState(editingExpense?.receiptUrl || '');
    const [receiptFileName, setReceiptFileName] = useState(editingExpense?.receiptUrl ? 'Current receipt' : '');
    const [receiptSize, setReceiptSize] = useState<number | null>(null);
    const [receiptPreview, setReceiptPreview] = useState('');
    const [receiptUploading, setReceiptUploading] = useState(false);
    const [receiptError, setReceiptError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
    const [suggestionLoading, setSuggestionLoading] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState<DuplicateResult | null>(null);
    const [policyViolations, setPolicyViolations] = useState<PolicyFlag[]>([]);
    const [dupAcknowledged, setDupAcknowledged] = useState(false);
    const [policyErrorAcks, setPolicyErrorAcks] = useState<Record<number, boolean>>({});
    const [paymentMethod, setPaymentMethod] = useState(editingExpense?.paymentMethod || 'Cash');
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [vendorText, setVendorText] = useState(editingExpense?.vendor || '');
    const [amountText, setAmountText] = useState(
        editingExpense?.amount != null ? String(editingExpense.amount) : '',
    );
    const [recurring, setRecurring] = useState(Boolean(editingExpense?.isRecurring));
    const [billable, setBillable] = useState(() => initialBillable(editingExpense, prefillClientId));
    const [clientId, setClientId] = useState(() => initialClientId(editingExpense, prefillClientId, customers));
    const rememberedClientId = useRef(initialClientId(editingExpense, prefillClientId, customers));
    const [reimbursable, setReimbursable] = useState(Boolean(editingExpense?.is_reimbursable));

    const expensePosted = Boolean(editingExpense?.journal_voucher_number);
    const currencyCode = getSystemSettings().defaultCurrencyCode;
    const amountNumber = parseFloat(amountText || '0') || 0;
    const showReceiptRule = amountNumber > 50 && !receiptUrl;

    useEffect(() => { setDupAcknowledged(false); }, [duplicateWarning]);
    useEffect(() => { setPolicyErrorAcks({}); }, [policyViolations]);

    useEffect(() => {
        const method = editingExpense?.paymentMethod || 'Cash';
        setPaymentMethod(method);
        const existing = editingExpense?.paymentAccountId;
        const posted = Boolean(editingExpense?.journal_voucher_number);
        if (expenseMethodIsCash(method)) {
            setPaymentAccountId('');
        } else if (existing != null) {
            setPaymentAccountId(String(existing));
        } else if (!posted && defaultBank) {
            setPaymentAccountId(String(defaultBank.id));
        } else {
            setPaymentAccountId('');
        }
        setSaveError(null);
    }, [editingExpense, defaultBank]);

    useEffect(() => {
        const editAcct = editingExpense?.account_id ?? editingExpense?.accountId;
        if (editAcct != null) {
            const id = String(editAcct);
            const match = categories.find(c => String(c.id) === id);
            setSelectedAccountId(id);
            setSelectedCategory(match?.name ?? editingExpense?.category ?? '');
        } else {
            const byName = categories.find(c => c.name === editingExpense?.category);
            if (byName) {
                setSelectedAccountId(String(byName.id));
                setSelectedCategory(byName.name);
            } else {
                const fallbackId = pickDefaultExpenseAccountId(categories);
                setSelectedAccountId(fallbackId);
                setSelectedCategory(categories.find(c => String(c.id) === fallbackId)?.name ?? editingExpense?.category ?? '');
            }
        }
        setCategorySearch('');
    }, [editingExpense, categories]);

    useEffect(() => {
        const onDoc = (event: MouseEvent) => {
            if (!categoryWrapRef.current?.contains(event.target as Node)) setCategoryOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    useEffect(() => () => {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    }, []);

    useEffect(() => {
        if (descriptionRef.current) growDescription(descriptionRef.current);
    }, [editingExpense]);

    const openCategoryDropdown = () => {
        void refreshCategories();
        setCategorySearch('');
        setCategoryOpen(true);
    };

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
        const violations = checkExpensePolicy({
            category, amount, date,
            hasReceipt: !!receiptUrl,
        });
        setPolicyViolations(violations);
    };

    const applyReceiptFile = async (file: File) => {
        if (!fileAllowed(file)) {
            setReceiptError('Use a PNG, JPEG, WebP, or PDF receipt.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setReceiptError('File too large (max 10MB)');
            return;
        }
        setReceiptError('');
        setReceiptUploading(true);
        try {
            const url = await uploadExpenseReceipt(file);
            setReceiptUrl(url);
            setReceiptFileName(file.name);
            setReceiptSize(file.size);
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
            if (file.type.startsWith('image/')) {
                const preview = URL.createObjectURL(file);
                previewUrlRef.current = preview;
                setReceiptPreview(preview);
            } else {
                previewUrlRef.current = '';
                setReceiptPreview('');
            }
        } catch (err) {
            setReceiptError(err instanceof Error ? err.message : 'Receipt upload failed');
            setReceiptUrl('');
            setReceiptFileName('');
            setReceiptSize(null);
            setReceiptPreview('');
        } finally {
            setReceiptUploading(false);
        }
    };

    const handleRemoveReceipt = () => {
        setReceiptUrl('');
        setReceiptFileName('');
        setReceiptSize(null);
        setReceiptError('');
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
        setReceiptPreview('');
    };

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
            const next = await suggestExpenseCategory(vendor, description, amount);
            setSuggestion(next);
        } catch (error) {
            setSuggestionError(error instanceof Error ? error.message : 'Could not categorize.');
        } finally {
            setSuggestionLoading(false);
        }
    };

    const applyCategorySuggestion = (label: string) => {
        const match = resolveCoaCategoryName(categories, label);
        if (match) {
            setSelectedAccountId(String(match.id));
            setSelectedCategory(match.name);
        } else {
            setSelectedAccountId('');
            setSelectedCategory(label);
        }
    };

    const setBillableChoice = (next: boolean) => {
        if (!next) {
            rememberedClientId.current = clientId;
            setBillable(false);
            return;
        }
        setClientId(rememberedClientId.current);
        setBillable(true);
    };

    const handleManualSave = async () => {
        const selectedAccount = categories.find(c => String(c.id) === selectedAccountId);
        const category = selectedAccount?.name ?? selectedCategory;
        const amount = parseFloat(amountRef.current?.value || '0');
        const date = dateRef.current?.value;
        const vendor = vendorRef.current?.value;
        const description = descriptionRef.current?.value;
        const paymentAccountIdToSend = expensePaymentAccountIdForSave(
            paymentMethod,
            paymentAccountId,
            Boolean(editingExpense?.journal_voucher_number),
        );
        const currency = currencyRef.current?.value || 'USD';
        const taxAmount = parseFloat(taxAmountRef.current?.value || '0');
        const clientIdValue = clientId || '';

        const nextErrors: Record<string, string> = {};
        if (!selectedAccountId || !category) nextErrors.category = 'Choose an account';
        if (!amount) nextErrors.amount = 'Enter an amount';
        if (!date) nextErrors.date = 'Choose a date';
        if (!vendor) nextErrors.vendor = 'Enter a vendor';
        setFieldErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setSaving(true);
        setSaveError(null);
        try {
            const dupCheck = checkExpenseDuplicate({ vendor: vendor!, amount, date: date!, category, excludeId: editingExpense?.id });
            const policy = checkExpensePolicy({ category, amount, date: date!, hasReceipt: !!receiptUrl });
            const nextStatus =
                !editingExpense || !editingExpense.status || editingExpense.status === 'Draft'
                    ? 'Submitted'
                    : editingExpense.status;
            await saveExpense({
                id: editingExpense?.id,
                category,
                amount,
                currency,
                date: date!,
                vendor: vendor!,
                description: description || '',
                paymentMethod: paymentMethod as Expense['paymentMethod'],
                ...(paymentAccountIdToSend != null ? { paymentAccountId: paymentAccountIdToSend } : {}),
                taxAmount,
                isRecurring: recurring,
                status: nextStatus,
                receiptUrl: receiptUrl || undefined,
                is_duplicate_flag: dupCheck.isDuplicate,
                duplicate_of_id: dupCheck.matches[0]?.expenseId || null,
                policy_flags: policy.length > 0 ? policy : undefined,
                is_billable: billable,
                client_id: billable && clientIdValue ? clientIdValue : null,
                is_reimbursable: reimbursable,
                account_id: Number(selectedAccountId),
            });
            await onSaved();
        } catch (error) {
            console.error('Failed to save expense:', error);
            setSaveError(error instanceof Error ? error.message : 'Failed to save expense');
        } finally {
            setSaving(false);
        }
    };

    const onWindowKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || !categoryOpen) return;
        event.stopPropagation();
        setCategoryOpen(false);
    };

    const filteredCategories = categories.filter(c => {
        const q = categorySearch.toLowerCase();
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    });
    const selectedAccount = categories.find(c => String(c.id) === selectedAccountId);
    const categoryValue = categoryOpen
        ? categorySearch
        : (selectedAccount ? formatCoaCategoryLabel(selectedAccount) : selectedCategory);

    const hasHighDup = !!duplicateWarning && duplicateWarning.maxConfidence >= 90;
    const errorPolicyIdxs = policyViolations
        .map((flag, index) => flag.severity === 'error' ? index : -1)
        .filter(index => index >= 0);
    const unackedErrors = errorPolicyIdxs.filter(index => !policyErrorAcks[index]);
    const saveBlocked = saving || (hasHighDup && !dupAcknowledged) || unackedErrors.length > 0;
    const existingImage = !receiptPreview && receiptUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(receiptUrl);

    return (
        <div className="expense-manual-backdrop">
            <style>{EXPENSE_FORM_CSS}</style>
            <div
                className="expense-manual-window"
                role="dialog"
                aria-modal="true"
                aria-labelledby="expense-manual-title"
                onKeyDown={onWindowKeyDown}
            >
                <header className="expense-manual-header">
                    <h2 id="expense-manual-title">{editingExpense ? 'Edit expense' : 'Add expense'}</h2>
                    <button type="button" className="expense-icon-button" aria-label="Close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </header>
                <div className="expense-manual-body">
                    <div className="expense-split">
                        <div className="expense-field">
                            <label className="expense-label" htmlFor="expense-amount">Amount <span className="expense-required">*</span></label>
                            <div className="expense-amount">
                                <select
                                    ref={currencyRef}
                                    aria-label="Currency"
                                    defaultValue={editingExpense?.currency || 'USD'}
                                >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                    <option value={currencyCode}>{currencyCode}</option>
                                </select>
                                <input
                                    id="expense-amount"
                                    ref={amountRef}
                                    type="number"
                                    step="0.01"
                                    defaultValue={editingExpense?.amount}
                                    placeholder="0.00"
                                    onChange={(event) => {
                                        setAmountText(event.target.value);
                                        if (fieldErrors.amount) setFieldErrors((prev) => ({ ...prev, amount: '' }));
                                    }}
                                    onBlur={handleCheckDuplicates}
                                />
                            </div>
                            {fieldErrors.amount && <p className="expense-error" role="alert">{fieldErrors.amount}</p>}
                        </div>
                        <div className="expense-field">
                            <label className="expense-label" htmlFor="expense-date">Date <span className="expense-required">*</span></label>
                            <input
                                id="expense-date"
                                ref={dateRef}
                                type="date"
                                className="expense-input"
                                defaultValue={editingExpense?.date || new Date().toISOString().split('T')[0]}
                                onChange={() => {
                                    if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: '' }));
                                }}
                            />
                            {fieldErrors.date && <p className="expense-error" role="alert">{fieldErrors.date}</p>}
                        </div>
                    </div>

                    <div className="expense-field">
                        <label className="expense-label" htmlFor="expense-vendor">Vendor <span className="expense-required">*</span></label>
                        <input
                            id="expense-vendor"
                            ref={vendorRef}
                            type="text"
                            className="expense-input"
                            defaultValue={editingExpense?.vendor}
                            placeholder="Vendor name"
                            onChange={(event) => {
                                setVendorText(event.target.value);
                                if (fieldErrors.vendor) setFieldErrors((prev) => ({ ...prev, vendor: '' }));
                            }}
                        />
                        {fieldErrors.vendor && <p className="expense-error" role="alert">{fieldErrors.vendor}</p>}
                    </div>

                    <div className="expense-field">
                        <div className="expense-label-row">
                            <label className="expense-label" htmlFor="expense-category">Category / account <span className="expense-required">*</span></label>
                            <button
                                type="button"
                                className="expense-text-button"
                                onClick={() => void handleSuggestCategory()}
                                disabled={suggestionLoading || !vendorText.trim()}
                            >
                                {suggestionLoading ? 'Suggesting...' : 'Suggest from vendor'}
                            </button>
                        </div>
                        <div ref={categoryWrapRef} className="expense-category">
                            <input
                                id="expense-category"
                                type="text"
                                className="expense-input"
                                value={categoryValue}
                                onChange={(event) => {
                                    setCategorySearch(event.target.value);
                                    setCategoryOpen(true);
                                    void refreshCategories();
                                    if (fieldErrors.category) setFieldErrors((prev) => ({ ...prev, category: '' }));
                                }}
                                onFocus={openCategoryDropdown}
                                placeholder="Search expense account"
                                disabled={categories.length === 0}
                            />
                            {categories.length === 0 ? (
                                <p className="expense-hint">
                                    No expense accounts yet.{' '}
                                    <button type="button" className="expense-text-button" onClick={onOpenChart}>
                                        Open Chart of Accounts
                                    </button>
                                </p>
                            ) : categoryOpen && (
                                <div className="expense-category-menu" role="listbox">
                                    {filteredCategories.map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            role="option"
                                            aria-selected={String(cat.id) === selectedAccountId}
                                            onClick={() => {
                                                setSelectedAccountId(String(cat.id));
                                                setSelectedCategory(cat.name);
                                                setCategorySearch('');
                                                setCategoryOpen(false);
                                                if (fieldErrors.category) setFieldErrors((prev) => ({ ...prev, category: '' }));
                                            }}
                                        >
                                            {formatCoaCategoryLabel(cat)}
                                        </button>
                                    ))}
                                    {filteredCategories.length === 0 && (
                                        <div className="expense-category-empty">
                                            No matching account.{' '}
                                            <button type="button" className="expense-text-button" onClick={onOpenChart}>
                                                Add to chart of accounts
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <button type="button" className="expense-text-button expense-chart-link" onClick={onOpenChart}>
                            Add to chart of accounts
                        </button>
                        {fieldErrors.category && <p className="expense-error" role="alert">{fieldErrors.category}</p>}
                        {suggestionError && <p className="expense-error" role="alert">{suggestionError}</p>}
                        {suggestion && (
                            <div className="expense-suggestion">
                                <p>
                                    Suggests {suggestion.category} → {suggestion.mappedCategory}
                                </p>
                                <p className="expense-hint">{suggestion.confidence}% confident — {suggestion.reason}</p>
                                <button
                                    type="button"
                                    className="expense-text-button"
                                    onClick={() => {
                                        applyCategorySuggestion(suggestion.mappedCategory);
                                        setSuggestion(null);
                                    }}
                                >
                                    Use
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="expense-split">
                        <div className="expense-field">
                            <label className="expense-label" htmlFor="expense-payment-method">Payment method</label>
                            <select
                                id="expense-payment-method"
                                aria-label="Payment method"
                                className="expense-input"
                                value={paymentMethod}
                                onChange={(event) => {
                                    const next = event.target.value as Expense['paymentMethod'];
                                    setPaymentMethod(next);
                                    if (expenseMethodIsCash(next)) {
                                        setPaymentAccountId('');
                                    } else if (!expensePosted) {
                                        setPaymentAccountId((prev) => prev || (defaultBank ? String(defaultBank.id) : ''));
                                    }
                                }}
                            >
                                <option value="Cash">Cash</option>
                                <option value="Card">Card</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Check">Check</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="expense-field">
                            <label className="expense-label" htmlFor="expense-tax">Tax amount</label>
                            <input
                                id="expense-tax"
                                ref={taxAmountRef}
                                type="number"
                                step="0.01"
                                className="expense-input"
                                defaultValue={editingExpense?.taxAmount}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <PaidFromBankPicker
                        method={paymentMethod}
                        banks={banks}
                        value={paymentAccountId}
                        onChange={setPaymentAccountId}
                        posted={expensePosted}
                    />
                    {saveError && <p className="expense-error" role="alert">{saveError}</p>}

                    <div className="expense-field">
                        <label className="expense-label" htmlFor="expense-description">Description</label>
                        <textarea
                            id="expense-description"
                            ref={descriptionRef}
                            className="expense-input expense-description"
                            defaultValue={editingExpense?.description}
                            placeholder="Brief description"
                            rows={3}
                            onInput={(event) => growDescription(event.currentTarget)}
                        />
                    </div>

                    <div className="expense-field">
                        <span className="expense-label">Receipt</span>
                        <label
                            className={clsx('expense-drop', dragOver && 'is-over')}
                            onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(event) => {
                                event.preventDefault();
                                setDragOver(false);
                                const file = event.dataTransfer.files?.[0];
                                if (file) void applyReceiptFile(file);
                            }}
                        >
                            <input
                                type="file"
                                accept={RECEIPT_ACCEPT}
                                className="expense-file"
                                disabled={receiptUploading}
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = '';
                                    if (file) void applyReceiptFile(file);
                                }}
                            />
                            Drop a receipt here or browse
                        </label>
                        {receiptUploading && <p className="expense-hint">Uploading…</p>}
                        {receiptUrl && !receiptUploading && (
                            <div className="expense-receipt">
                                {(receiptPreview || existingImage) && (
                                    <img src={receiptPreview || receiptUrl} alt="" className="expense-receipt-preview" />
                                )}
                                <div>
                                    <p>{receiptFileName}</p>
                                    {receiptSize != null && <p className="expense-hint">{formatFileSize(receiptSize)}</p>}
                                </div>
                                <button type="button" className="expense-text-button" onClick={handleRemoveReceipt}>Remove</button>
                            </div>
                        )}
                        {showReceiptRule && (
                            <p className="expense-receipt-rule" role="status">Receipt required for amounts over $50</p>
                        )}
                        {receiptError && <p className="expense-error" role="alert">{receiptError}</p>}
                    </div>

                    <div className="expense-options">
                        <button
                            type="button"
                            className="expense-option"
                            role="switch"
                            aria-checked={recurring}
                            onClick={() => setRecurring((value) => !value)}
                        >
                            <span className={clsx('expense-switch', recurring && 'is-on')} aria-hidden="true" />
                            <span>
                                <span className="expense-option-label">Recurring expense</span>
                                <span className="expense-hint">Repeats on a schedule</span>
                            </span>
                        </button>
                        <div>
                            <button
                                type="button"
                                className="expense-option"
                                role="switch"
                                aria-checked={billable}
                                onClick={() => setBillableChoice(!billable)}
                            >
                                <span className={clsx('expense-switch', billable && 'is-on')} aria-hidden="true" />
                                <span>
                                    <span className="expense-option-label">Billable to a customer</span>
                                    <span className="expense-hint">Adds this to the customer's Unbilled expenses tab</span>
                                </span>
                            </button>
                            {billable && (
                                <div className="expense-option-extra">
                                    <CustomerCombobox
                                        customers={customers}
                                        value={clientId}
                                        onChange={(id) => {
                                            setClientId(id);
                                            rememberedClientId.current = id;
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="expense-option"
                            role="switch"
                            aria-checked={reimbursable}
                            onClick={() => setReimbursable((value) => !value)}
                        >
                            <span className={clsx('expense-switch', reimbursable && 'is-on')} aria-hidden="true" />
                            <span>
                                <span className="expense-option-label">Reimbursable to an employee</span>
                                <span className="expense-hint">Paid out of pocket</span>
                            </span>
                        </button>
                    </div>

                    {policyViolations.some(flag => flag.severity === 'error') && (
                        <div className="expense-banner is-error">
                            <p>Policy errors — acknowledge each to enable Save</p>
                            <ul>
                                {policyViolations.map((flag, index) => flag.severity === 'error' ? (
                                    <li key={index}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={!!policyErrorAcks[index]}
                                                onChange={(event) => setPolicyErrorAcks(prev => ({ ...prev, [index]: event.target.checked }))}
                                            />
                                            <span><strong>{flag.rule}:</strong> {flag.message}</span>
                                        </label>
                                    </li>
                                ) : null)}
                            </ul>
                        </div>
                    )}
                    {policyViolations.some(flag => flag.severity !== 'error') && (
                        <div className="expense-banner is-warn">
                            <p>Policy warnings</p>
                            <ul>
                                {policyViolations.filter(flag => flag.severity !== 'error').map((flag, index) => (
                                    <li key={index}>{flag.message}</li>
                                ))}
                            </ul>
                            <p className="expense-hint">You can still save — these are just warnings.</p>
                        </div>
                    )}
                    {duplicateWarning && duplicateWarning.maxConfidence >= 90 && (
                        <div className="expense-banner is-error">
                            <p>Possible duplicate — please review before saving</p>
                            <ul>
                                {duplicateWarning.matches.map((match, index) => (
                                    <li key={index}>{match.vendor} — {match.amount.toFixed(2)} on {match.date} ({match.reason}, {match.confidence}% conf.)</li>
                                ))}
                            </ul>
                            <label>
                                <input type="checkbox" checked={dupAcknowledged} onChange={(event) => setDupAcknowledged(event.target.checked)} />
                                <span>I confirm this is not a duplicate</span>
                            </label>
                        </div>
                    )}
                    {duplicateWarning && duplicateWarning.maxConfidence < 90 && (
                        <div className="expense-banner is-warn">
                            <p>Possible duplicate</p>
                            <ul>
                                {duplicateWarning.matches.map((match, index) => (
                                    <li key={index}>{match.vendor} — {match.amount.toFixed(2)} on {match.date} ({match.reason})</li>
                                ))}
                            </ul>
                            <p className="expense-hint">You can still save — this is just a warning.</p>
                        </div>
                    )}
                </div>
                <footer className="expense-manual-footer">
                    <button type="button" className="expense-button expense-button-secondary" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="expense-button expense-button-primary"
                        onClick={() => void handleManualSave()}
                        disabled={saveBlocked}
                    >
                        {saving ? 'Saving...' : 'Save expense'}
                    </button>
                </footer>
            </div>
        </div>
    );
}

const EXPENSE_FORM_CSS = `
.expense-manual-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
}
.expense-manual-window {
  width: 640px;
  max-width: 100%;
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: var(--color-redwood-bg-surface, #0f1f33);
  color: var(--color-redwood-text-main, #EEF2FF);
  border: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
  box-shadow: 0 24px 80px rgba(0,0,0,0.45);
  font-family: inherit;
}
.expense-manual-header, .expense-manual-footer {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 24px;
}
.expense-manual-header h2 {
  margin: 0;
  font-family: 'Syne', sans-serif;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.3px;
}
.expense-manual-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 0 24px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.expense-manual-footer {
  justify-content: flex-end;
  border-top: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
}
.expense-split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.expense-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.expense-label, .expense-option-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-redwood-text-main, #EEF2FF);
}
.expense-label-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.expense-required { color: var(--color-brand-red, #EF4444); }
.expense-hint { display: block; font-size: 12px; font-weight: 500; color: var(--color-redwood-text-muted, #8BA3C7); }
.expense-error { margin: 0; font-size: 12px; font-weight: 600; color: var(--color-brand-red-tint, #FCA5A5); }
.expense-input, .expense-amount, .customer-combobox-field input, .expense-drop {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
  background: var(--color-redwood-midnight, #0a1726);
  color: var(--color-redwood-text-main, #EEF2FF);
  font: inherit;
  font-size: 14px;
}
.expense-input, .customer-combobox-field input { padding: 10px 12px; outline: none; }
.expense-input:focus, .expense-amount:focus-within, .customer-combobox-field input:focus, .expense-drop:focus-within, .expense-option:focus-visible, .expense-button:focus-visible, .expense-icon-button:focus-visible, .expense-text-button:focus-visible {
  outline: 2px solid var(--color-brand-blue, #4F8EF7);
  outline-offset: 2px;
}
.expense-input:disabled { opacity: 0.6; }
.expense-amount { display: flex; align-items: stretch; overflow: hidden; padding: 0; }
.expense-amount select {
  width: 84px;
  border: 0;
  border-right: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
  background: transparent;
  color: inherit;
  padding: 0 8px;
  font: inherit;
}
.expense-amount input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 22px;
  font-weight: 600;
  padding: 10px 12px;
  outline: none;
}
.expense-description { min-height: calc(3 * 1.4em + 20px); max-height: calc(8 * 1.4em + 20px); resize: none; line-height: 1.4; }
.expense-text-button, .expense-icon-button {
  border: 0;
  background: transparent;
  color: var(--color-brand-blue-tint, #93C5FD);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.expense-text-button:disabled { opacity: 0.45; cursor: not-allowed; }
.expense-icon-button { color: var(--color-redwood-text-muted, #8BA3C7); padding: 4px; border-radius: 8px; }
.expense-chart-link { align-self: flex-start; margin-top: 2px; }
.expense-category { position: relative; }
.expense-category-menu {
  position: absolute;
  z-index: 5;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  max-height: 220px;
  overflow: auto;
  border-radius: 10px;
  border: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
  background: var(--color-redwood-bg-surface, #0f1f33);
}
.expense-category-menu button, .expense-category-empty {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  background: transparent;
  color: inherit;
  border: 0;
  border-bottom: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.expense-category-menu button:hover, .expense-category-menu button[aria-selected="true"] {
  background: var(--color-redwood-row-hover, #1a2d4e);
}
.expense-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
  border-style: dashed;
  cursor: pointer;
  text-align: center;
  padding: 16px;
}
.expense-drop.is-over { border-color: var(--color-brand-blue, #4F8EF7); }
.expense-file { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.expense-drop { position: relative; }
.expense-receipt { display: flex; align-items: center; gap: 12px; }
.expense-receipt-preview { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; }
.expense-receipt-rule { margin: 0; font-size: 13px; font-weight: 600; color: var(--color-brand-amber, #F59E0B); }
.expense-options { display: flex; flex-direction: column; gap: 8px; }
.expense-option {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  text-align: left;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
  background: var(--color-redwood-bg-surface, #0f1f33);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.expense-switch {
  width: 36px;
  height: 22px;
  border-radius: 999px;
  background: var(--color-redwood-midnight, #0a1726);
  border: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
  position: relative;
  flex: none;
  margin-top: 1px;
}
.expense-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-redwood-text-muted, #8BA3C7);
  transition: transform 160ms ease;
}
.expense-switch.is-on { background: var(--color-brand-blue, #4F8EF7); border-color: transparent; }
.expense-switch.is-on::after { transform: translateX(14px); background: white; }
.expense-option-extra { margin-top: 8px; }
.customer-combobox { position: relative; }
.customer-combobox-field { position: relative; }
.customer-combobox-field input { padding-right: 72px; }
.customer-combobox-tag, .customer-combobox-clear {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}
.customer-combobox-tag {
  right: 36px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-brand-amber, #F59E0B);
}
.customer-combobox-clear {
  right: 8px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-redwood-text-muted, #8BA3C7);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.customer-combobox-list {
  position: absolute;
  z-index: 6;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  max-height: 240px;
  overflow: auto;
  border-radius: 10px;
  border: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
  background: var(--color-redwood-bg-surface, #0f1f33);
}
.customer-combobox-list button {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.customer-combobox-list button.is-active, .customer-combobox-list button:hover {
  background: var(--color-redwood-row-hover, #1a2d4e);
}
.customer-combobox-name, .customer-combobox-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.customer-combobox-meta { font-size: 12px; color: var(--color-redwood-text-muted, #8BA3C7); }
.customer-combobox-empty { padding: 16px 12px; font-size: 13px; color: var(--color-redwood-text-muted, #8BA3C7); }
.customer-combobox mark { background: transparent; color: var(--color-brand-blue-tint, #93C5FD); font-weight: 700; }
.expense-banner { border-radius: 12px; padding: 12px; font-size: 13px; }
.expense-banner.is-error { background: var(--color-badge-red-bg, rgba(239,68,68,.12)); color: var(--color-brand-red-tint, #FCA5A5); }
.expense-banner.is-warn { background: var(--color-badge-amber-bg, rgba(245,158,11,.12)); color: var(--color-brand-amber-tint, #FCD34D); }
.expense-banner ul { margin: 8px 0 0; padding-left: 18px; }
.expense-banner label { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; }
.expense-button {
  min-height: 40px;
  padding: 8px 16px;
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.expense-button:disabled { opacity: 0.5; cursor: not-allowed; }
.expense-button-secondary {
  background: transparent;
  color: var(--color-redwood-text-main, #EEF2FF);
  border: 1px solid var(--color-redwood-border, rgba(255,255,255,0.12));
}
.expense-button-primary {
  background: var(--color-brand-blue, #4F8EF7);
  color: white;
  border: 0;
}
@media (max-width: 700px) {
  .expense-manual-backdrop { padding: 0; align-items: stretch; }
  .expense-manual-window { width: 100%; height: 100%; max-height: 100%; border-radius: 0; }
  .expense-split { grid-template-columns: 1fr; }
}
`;
