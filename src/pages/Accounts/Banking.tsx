import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import {
    Landmark,
    RefreshCw,
    Download,
    DollarSign,
    Building2,
    Edit2,
    Trash2,
    Search,
    AlertTriangle,
    Plus,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPayments, voidPayment, type Payment } from '../../services/api';
import { getCompanyProfile } from '../../services/settingsService';
import { getArSummary, getCustomers, type Customer } from '../../services/customerService';
import { getGLAccounts, type GLAccount } from '../../services/glService';
import { authFetch } from '../../api/axios';
import { formatDateOnly } from '../../utils/formatters';
import { localIsoDate } from '../../utils/localDate';
import { getOilErpApiBase } from '../../config/apiBase';
import {
    bankTxHomeState,
    bankTxIdFromSourceId,
    chequeActions,
    chequeConfirmText,
    contraAccountOptions,
    contraOptionsWithCurrent,
    filterLedgerRows,
    ledgerRowAction,
    ledgerTypeLabel,
    moneyDirectionLabel,
    orderLedgerRows,
    paymentIdFromRow,
    periodTotals,
    type LedgerRow,
    type LedgerRowOrder,
} from '../../utils/bankingLedger';

const panelStyle: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '14px',
    padding: '14px 16px',
};

function formatUsd(n: number): string {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

interface PDCheque {
    id: string;
    date: string;
    chequeNo: string;
    bankName: string;
    payee: string;
    customerId?: number | null;
    amount: number;
    type: 'Received' | 'Issued';
    status: 'Pending' | 'Cleared' | 'Bounced' | 'Cancelled';
    description: string;
    createdAt: string;
    paymentTransactionId?: number | null;
    reversalTransactionId?: number | null;
    clearedDate?: string;
    bouncedDate?: string;
    glPosted?: boolean;
}

interface BankAccountRow {
    id: number;
    code: string;
    name: string;
    role?: string;
}

interface AccountLedger {
    opening_balance: number;
    closing_balance: number;
    rows: LedgerRow[];
    account_name?: string;
    account_code?: string;
}

interface BankTxRow {
    id: string;
    date: string;
    description: string;
    type: 'Credit' | 'Debit';
    amount: number;
    reference: string;
    category: string;
    accountId?: number | null;
    contraAccountId?: number | null;
    contraAccountName?: string | null;
}

interface ApiResult<T> {
    ok: boolean;
    data?: T;
    detail?: string;
}

type PageMessage = { kind: 'success' | 'error'; text: string };

const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim().replace(/\/+$/, '');
const PDC_API = `${API_HOST}/api/pdc`;
const BANK_TX_API = `${API_HOST}/api/bank-transactions`;
const BANKING_API = `${getOilErpApiBase()}/banking`;

async function readApiDetail(response: Response): Promise<string> {
    const text = await response.text().catch(() => '');
    try {
        const parsed = JSON.parse(text) as { detail?: unknown };
        if (typeof parsed.detail === 'string') return parsed.detail;
        if (parsed.detail != null) return JSON.stringify(parsed.detail);
    } catch {
        /* not JSON */
    }
    return text || `HTTP ${response.status}`;
}

async function getBankTxsApi(accountId?: number | null): Promise<BankTxRow[]> {
    try {
        const qs = accountId != null ? `?account_id=${accountId}` : '';
        const r = await authFetch(`${BANK_TX_API}/${qs ? qs : ''}`);
        if (!r.ok) return [];
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch {
        return [];
    }
}

async function createBankTxApi(tx: Record<string, unknown>): Promise<ApiResult<BankTxRow>> {
    try {
        const r = await authFetch(`${BANK_TX_API}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });
        if (!r.ok) return { ok: false, detail: await readApiDetail(r) };
        return { ok: true, data: await r.json() };
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
}

async function updateBankTxApi(id: string, tx: Record<string, unknown>): Promise<ApiResult<BankTxRow>> {
    try {
        const r = await authFetch(`${BANK_TX_API}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });
        if (!r.ok) return { ok: false, detail: await readApiDetail(r) };
        return { ok: true, data: await r.json() };
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
}

async function deleteBankTxApi(id: string): Promise<ApiResult<void>> {
    try {
        const r = await authFetch(`${BANK_TX_API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) return { ok: false, detail: await readApiDetail(r) };
        return { ok: true };
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
}

async function getPDC(): Promise<PDCheque[]> {
    try {
        const r = await authFetch(`${PDC_API}/`);
        if (!r.ok) return [];
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch {
        return [];
    }
}

async function createPDCApi(payload: Record<string, unknown>): Promise<ApiResult<PDCheque>> {
    try {
        const r = await authFetch(`${PDC_API}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) return { ok: false, detail: await readApiDetail(r) };
        return { ok: true, data: await r.json() };
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
}

async function patchPDCApi(id: string, body: Record<string, unknown>): Promise<ApiResult<PDCheque>> {
    try {
        const r = await authFetch(`${PDC_API}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!r.ok) return { ok: false, detail: await readApiDetail(r) };
        return { ok: true, data: await r.json() };
    } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
}

async function fetchAccountLedger(accountId: number, startDate?: string, endDate?: string): Promise<AccountLedger | null> {
    try {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        const qs = params.toString();
        const r = await authFetch(`${BANKING_API}/accounts/${accountId}/ledger${qs ? `?${qs}` : ''}`);
        if (!r.ok) return null;
        return await r.json();
    } catch {
        return null;
    }
}

function CustomerPicker({
    customers,
    value,
    onChange,
    placeholder = 'Select customer…',
}: {
    customers: Customer[];
    value: number | null;
    onChange: (customer: Customer | null) => void;
    placeholder?: string;
}) {
    const [filter, setFilter] = useState('');
    const selected = customers.find(c => Number(c.id) === value) ?? null;
    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase())
        || (c.code || '').toLowerCase().includes(filter.toLowerCase()),
    );

    return (
        <div>
            {selected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{selected.name}</span>
                    <button type="button" onClick={() => onChange(null)} style={{ fontSize: 10, color: 'var(--color-brand-blue-tint)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Change</button>
                </div>
            ) : (
                <>
                    <input
                        type="search"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder={placeholder}
                        style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }}
                    />
                    {filter && (
                        <div style={{ marginTop: 4, maxHeight: 120, overflowY: 'auto', border: '1px solid var(--color-redwood-border)', borderRadius: 8 }}>
                            {filtered.slice(0, 8).map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => { onChange(c); setFilter(''); }}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-redwood-text-main)' }}
                                >
                                    {c.name}{c.code ? ` (${c.code})` : ''}
                                </button>
                            ))}
                            {filtered.length === 0 && (
                                <div style={{ padding: 8, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>No matches</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function Banking() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [arTotal, setArTotal] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pageMessage, setPageMessage] = useState<PageMessage | null>(null);
    const [search, setSearch] = useState('');
    const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
    const [ledgerOrder, setLedgerOrder] = useState<LedgerRowOrder>('newest');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activeTab, setActiveTab] = useState<'ledger' | 'pdc'>('ledger');
    const [showAddTx, setShowAddTx] = useState(false);
    const [txForm, setTxForm] = useState({
        date: localIsoDate(),
        description: '',
        type: 'Credit' as 'Credit' | 'Debit',
        amount: '',
        reference: '',
        contraAccountId: '' as string,
    });
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editingContraName, setEditingContraName] = useState<string | null>(null);
    const [manualTxs, setManualTxs] = useState<BankTxRow[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pdcList, setPdcList] = useState<PDCheque[]>([]);
    const [showPDCForm, setShowPDCForm] = useState(false);
    const [pdcForm, setPdcForm] = useState({
        date: '',
        chequeNo: '',
        bankName: '',
        payee: '',
        customerId: null as number | null,
        amount: '',
        type: 'Received' as PDCheque['type'],
        description: '',
    });
    const [voidingId, setVoidingId] = useState<string | null>(null);
    const [cashAccounts, setCashAccounts] = useState<BankAccountRow[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [closingByAccount, setClosingByAccount] = useState<Record<number, number | null>>({});
    const [accountLedger, setAccountLedger] = useState<AccountLedger | null>(null);
    const [accountLedgerLoading, setAccountLedgerLoading] = useState(false);
    const [ledgerLoadFailed, setLedgerLoadFailed] = useState(false);
    const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    const showMsg = useCallback((kind: PageMessage['kind'], text: string) => {
        setPageMessage({ kind, text });
    }, []);

    const clearMsg = useCallback(() => setPageMessage(null), []);

    const paymentsById = useMemo(() => {
        const map = new Map<string, Payment>();
        for (const p of payments) map.set(String(p.id), p);
        return map;
    }, [payments]);

    const loadClosingBalances = useCallback(async (accounts: BankAccountRow[]) => {
        const entries = await Promise.all(
            accounts.map(async (acct) => {
                const ledger = await fetchAccountLedger(acct.id);
                return [acct.id, ledger == null ? null : ledger.closing_balance] as const;
            }),
        );
        setClosingByAccount(Object.fromEntries(entries));
    }, []);

    const loadSelectedLedger = useCallback(async (accountId: number) => {
        setAccountLedgerLoading(true);
        setLedgerLoadFailed(false);
        try {
            const data = await fetchAccountLedger(accountId, dateFrom || undefined, dateTo || undefined);
            if (data == null) {
                setAccountLedger(null);
                setLedgerLoadFailed(true);
            } else {
                setAccountLedger(data);
                setLedgerLoadFailed(false);
            }
        } finally {
            setAccountLedgerLoading(false);
        }
    }, [dateFrom, dateTo]);

    const reloadAll = useCallback(async (isRefresh = false) => {
        clearMsg();
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const [p, ar, acctRes, gl, cust] = await Promise.all([
                getPayments().catch(() => []),
                getArSummary().catch(() => null),
                authFetch(`${BANKING_API}/accounts`).catch(() => null),
                getGLAccounts().catch(() => []),
                getCustomers().catch(() => []),
            ]);
            setPayments(p);
            setArTotal(ar ? ar.total_outstanding : null);
            setGlAccounts(Array.isArray(gl) ? gl.filter(a => a.is_active) : []);
            setCustomers(cust);

            let accounts: BankAccountRow[] = [];
            if (acctRes?.ok) {
                const rows = await acctRes.json();
                accounts = Array.isArray(rows) ? rows : [];
            }
            setCashAccounts(accounts);
            setSelectedAccountId((prev) => {
                if (prev != null && accounts.some((acct) => acct.id === prev)) return prev;
                return accounts.length > 0 ? Number(accounts[0].id) : null;
            });
            await loadClosingBalances(accounts);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
        const [pdc, txs] = await Promise.all([
            getPDC(),
            getBankTxsApi(),
        ]);
        setPdcList(pdc);
        setManualTxs(txs);
    }, [clearMsg, loadClosingBalances]);

    const refetchAfterAction = useCallback(async () => {
        const [p, pdc, txs, ar] = await Promise.all([
            getPayments().catch(() => payments),
            getPDC(),
            getBankTxsApi(),
            getArSummary().catch(() => null),
        ]);
        setPayments(p);
        setPdcList(pdc);
        setManualTxs(txs);
        if (ar != null) {
            setArTotal(ar.total_outstanding);
        }
        await loadClosingBalances(cashAccounts);
        if (selectedAccountId != null) {
            await loadSelectedLedger(selectedAccountId);
        }
    }, [cashAccounts, loadClosingBalances, loadSelectedLedger, payments, selectedAccountId]);

    useEffect(() => {
        void reloadAll();
    }, [reloadAll]);

    useEffect(() => {
        if (selectedAccountId == null) {
            setAccountLedger(null);
            setLedgerLoadFailed(false);
            return;
        }
        void loadSelectedLedger(selectedAccountId);
    }, [selectedAccountId, loadSelectedLedger]);

    const netCash = useMemo(() => {
        if (cashAccounts.length === 0) return null;
        const values = cashAccounts.map((acct) => closingByAccount[acct.id]);
        if (values.some((value) => value == null)) return null;
        return (values as number[]).reduce((sum, value) => sum + value, 0);
    }, [cashAccounts, closingByAccount]);

    const pendingPDC = useMemo(
        () => pdcList.filter(p => p.status === 'Pending'),
        [pdcList],
    );

    const pendingPdcTotal = useMemo(
        () => pendingPDC.reduce((s, p) => s + (p.amount || 0), 0),
        [pendingPDC],
    );

    const ledgerRows = useMemo(() => accountLedger?.rows ?? [], [accountLedger]);
    const filteredRows = useMemo(
        () => filterLedgerRows(ledgerRows, { search, direction: directionFilter }),
        [ledgerRows, search, directionFilter],
    );
    const displayedRows = useMemo(
        () => orderLedgerRows(filteredRows, ledgerOrder),
        [filteredRows, ledgerOrder],
    );

    const { moneyIn, moneyOut } = useMemo(() => periodTotals(ledgerRows), [ledgerRows]);

    const contraOptions = useMemo(() => {
        const base = contraAccountOptions(glAccounts, selectedAccountId);
        const storedId = txForm.contraAccountId ? Number(txForm.contraAccountId) : null;
        return contraOptionsWithCurrent(base, storedId, glAccounts, editingContraName);
    }, [glAccounts, selectedAccountId, txForm.contraAccountId, editingContraName]);

    const handleVoidPayment = async (paymentId: string) => {
        clearMsg();
        const original = payments.find(p => String(p.id) === String(paymentId));
        if (!original) {
            showMsg('error', 'Original payment not found — cannot void.');
            return;
        }
        if ((original.amount ?? 0) < 0) {
            showMsg('error', 'Negative-amount payments are reversal entries — cannot void.');
            return;
        }
        if (original.reference?.startsWith('VOID/')) {
            showMsg('error', 'This is already a reversal entry — cannot void a void.');
            return;
        }
        const reason = prompt(
            `Void payment of $${original.amount.toFixed(2)}?\n\n` +
            'A reversing entry will be created. The original record stays for audit. ' +
            'Customer balance and any linked invoice will adjust.\n\n' +
            'Enter a reason (optional):',
        );
        if (reason === null) return;
        setVoidingId(paymentId);
        try {
            await voidPayment({
                id: String(original.id),
                customer_id: original.customer_id,
                amount: original.amount,
                invoice_id: original.invoice_id,
                reason: reason || undefined,
            });
            await refetchAfterAction();
            showMsg('success', 'Payment voided. Reversal entry created.');
        } catch (e) {
            showMsg('error', e instanceof Error ? e.message : String(e));
        } finally {
            setVoidingId(null);
        }
    };

    const saveManualTx = async () => {
        clearMsg();
        if (selectedAccountId == null) {
            showMsg('error', 'Select a bank or cash account first.');
            return;
        }
        const amt = parseFloat(txForm.amount) || 0;
        if (!txForm.description?.trim() || amt <= 0) {
            showMsg('error', 'Description and a positive amount are required.');
            return;
        }
        const payload: Record<string, unknown> = {
            date: txForm.date || localIsoDate(),
            description: txForm.description.trim(),
            type: txForm.type,
            amount: amt,
            reference: editingId
                ? (txForm.reference || '')
                : (txForm.reference || `REF-${Date.now().toString().slice(-6)}`),
            category: editingId ? (editingCategory || 'General') : 'General',
            account_id: selectedAccountId,
            contra_account_id: txForm.contraAccountId ? Number(txForm.contraAccountId) : null,
        };

        const wasEditing = editingId;
        const result = wasEditing
            ? await updateBankTxApi(wasEditing, payload)
            : await createBankTxApi(payload);

        if (!result.ok) {
            showMsg('error', result.detail || 'Failed to save transaction');
            return;
        }

        setTxForm({
            date: localIsoDate(),
            description: '',
            type: 'Credit',
            amount: '',
            reference: '',
            contraAccountId: '',
        });
        setEditingCategory(null);
        setEditingContraName(null);
        setShowAddTx(false);
        setEditingId(null);
        await refetchAfterAction();
        showMsg(
            'success',
            `${moneyDirectionLabel(String(payload.type))} of ${formatUsd(amt)} ${wasEditing ? 'updated' : 'saved'}.`,
        );
    };

    const editManualTx = (row: LedgerRow) => {
        clearMsg();
        const txId = bankTxIdFromSourceId(row.source_id);
        if (txId == null) {
            showMsg('error', 'Could not resolve bank transaction id.');
            return;
        }
        const tx = manualTxs.find(t => String(t.id) === String(txId));
        if (!tx) {
            showMsg('error', 'Bank transaction not found in the manual list.');
            return;
        }
        setEditingId(String(tx.id));
        setEditingCategory(tx.category || 'General');
        setEditingContraName(tx.contraAccountName ?? null);
        setTxForm({
            date: tx.date || localIsoDate(),
            description: tx.description || '',
            type: tx.type === 'Debit' ? 'Debit' : 'Credit',
            amount: String(tx.amount || ''),
            reference: tx.reference || '',
            contraAccountId: tx.contraAccountId != null ? String(tx.contraAccountId) : '',
        });
        setShowAddTx(true);
    };

    const deleteManualTx = async (row: LedgerRow) => {
        clearMsg();
        const txId = bankTxIdFromSourceId(row.source_id);
        if (txId == null) return;
        const tx = manualTxs.find(t => String(t.id) === String(txId));
        if (!tx) return;
        if (!confirm(`Delete this transaction?\n\n${tx.description} · ${moneyDirectionLabel(tx.type)} ${formatUsd(tx.amount)}`)) return;
        const result = await deleteBankTxApi(String(tx.id));
        if (!result.ok) {
            showMsg('error', result.detail || 'Failed to delete transaction');
            return;
        }
        await refetchAfterAction();
        showMsg('success', `Deleted: ${tx.description}`);
    };

    const savePDCEntry = async () => {
        clearMsg();
        if (!pdcForm.chequeNo || !pdcForm.amount || !pdcForm.date) {
            showMsg('error', 'Cheque number, date and amount are required');
            return;
        }
        const payload: Record<string, unknown> = {
            date: pdcForm.date,
            chequeNo: pdcForm.chequeNo,
            bankName: pdcForm.bankName,
            payee: pdcForm.payee,
            amount: parseFloat(pdcForm.amount) || 0,
            type: pdcForm.type,
            description: pdcForm.description,
        };
        if (pdcForm.type === 'Received' && pdcForm.customerId != null) {
            payload.customerId = pdcForm.customerId;
        }
        const result = await createPDCApi(payload);
        if (!result.ok) {
            showMsg('error', result.detail || 'Failed to save PDC');
            return;
        }
        setPdcForm({ date: '', chequeNo: '', bankName: '', payee: '', customerId: null, amount: '', type: 'Received', description: '' });
        setShowPDCForm(false);
        await refetchAfterAction();
        showMsg('success', 'Cheque recorded.');
    };

    const confirmAndUpdatePDCStatus = (pdc: PDCheque, status: PDCheque['status']) => {
        const action = status === 'Cleared' ? 'clear' as const : status === 'Bounced' ? 'bounce' as const : 'cancel' as const;
        const text = chequeConfirmText(
            action,
            { chequeNo: pdc.chequeNo, amount: pdc.amount, type: pdc.type, glPosted: pdc.glPosted },
            formatUsd,
        );
        if (!confirm(text)) return;
        void updatePDCStatus(pdc.id, status);
    };

    const updatePDCStatus = async (id: string, status: PDCheque['status']) => {
        clearMsg();
        const result = await patchPDCApi(id, { status });
        if (!result.ok) {
            showMsg('error', result.detail || 'Failed to update cheque');
            return;
        }
        await refetchAfterAction();
        showMsg('success', `Cheque marked ${status}.`);
    };

    const linkPdcCustomer = async (pdcId: string, customer: Customer) => {
        clearMsg();
        const result = await patchPDCApi(pdcId, { customerId: Number(customer.id) });
        if (!result.ok) {
            showMsg('error', result.detail || 'Failed to link customer');
            return;
        }
        await refetchAfterAction();
        showMsg('success', `Linked to ${customer.name}.`);
    };

    const exportStatementPDF = () => {
        if (!accountLedger || !selectedAccountId) return;
        const acct = cashAccounts.find(a => a.id === selectedAccountId);
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Bank Statement', 14, 16);
        doc.setFontSize(10);
        const today = new Date().toLocaleDateString();
        const periodStr = (dateFrom || dateTo)
            ? `${dateFrom || 'earliest'} to ${dateTo || today}`
            : `Up to ${today}`;
        doc.text(`${getCompanyProfile().name || 'Company'} · ${acct?.name || 'Account'} · ${periodStr}`, 14, 22);
        doc.text(
            `Opening: ${formatUsd(accountLedger.opening_balance)} · In: ${formatUsd(moneyIn)} · Out: ${formatUsd(moneyOut)} · Closing: ${formatUsd(accountLedger.closing_balance)}`,
            14,
            28,
        );
        autoTable(doc, {
            startY: 34,
            head: [['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']],
            body: ledgerRows.map(row => [
                row.date ? formatDateOnly(row.date) : '—',
                ledgerTypeLabel(row.type),
                row.reference || '',
                row.description || '',
                row.debit ? formatUsd(row.debit) : '—',
                row.credit ? formatUsd(row.credit) : '—',
                formatUsd(row.running_balance),
            ]),
            foot: [[
                '', '', '', 'Closing balance',
                '', '',
                formatUsd(accountLedger.closing_balance),
            ]],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [33, 33, 33] },
            footStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: 'bold' },
        });
        doc.save(`BankStatement_${acct?.code || selectedAccountId}_${localIsoDate()}.pdf`);
    };

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
    };

    const thStyle: CSSProperties = {
        padding: '10px 12px',
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.4px',
        color: 'var(--color-redwood-text-muted)',
        whiteSpace: 'nowrap',
    };

    const tdStyle: CSSProperties = {
        padding: '11px 12px',
        fontSize: 12,
        color: 'var(--color-redwood-text-main)',
        verticalAlign: 'middle',
    };

    const today = localIsoDate();
    const dueTodayPDC = pendingPDC.filter(p => p.date <= today);

    if (loading) {
        return (
            <div style={{ paddingBottom: 40 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 16px', color: 'var(--color-redwood-text-muted)' }}>
                    <div className="w-12 h-12 border-2 rounded-full animate-spin mb-3" style={{ borderColor: '#4F8EF7', borderTopColor: 'transparent' }} />
                    <p style={{ fontSize: 12, fontWeight: 500 }}>Loading banking data…</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 40 }}>
            <div className="space-y-3 max-w-[1280px]">
                {pageMessage && (
                    <div style={{
                        ...panelStyle,
                        background: pageMessage.kind === 'success' ? 'var(--color-badge-green-bg)' : 'var(--color-badge-red-bg)',
                        borderColor: pageMessage.kind === 'success' ? 'rgba(34,197,94,.28)' : 'rgba(239,68,68,.28)',
                        color: pageMessage.kind === 'success' ? 'var(--color-brand-green-tint)' : 'var(--color-brand-red-tint)',
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                    >
                        {pageMessage.text}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-badge-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Landmark size={20} style={{ color: '#4F8EF7' }} />
                        </div>
                        <div>
                            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: '-.5px', color: 'var(--color-brand-blue)' }}>
                                Banking
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginTop: 2 }}>
                                General ledger cash and bank accounts · {getCompanyProfile().name}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button type="button" onClick={() => void reloadAll(true)} disabled={refreshing} style={ghostBtn}>
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button type="button" onClick={exportStatementPDF} disabled={!accountLedger || ledgerRows.length === 0} style={ghostBtn}>
                            <Download size={14} /> Export
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                clearMsg();
                                setEditingId(null);
                                setEditingCategory(null);
                                setEditingContraName(null);
                                setTxForm({ date: localIsoDate(), description: '', type: 'Credit', amount: '', reference: '', contraAccountId: '' });
                                setShowAddTx(true);
                            }}
                            disabled={selectedAccountId == null}
                            style={primaryBtn}
                        >
                            <Plus size={14} /> Add transaction
                        </button>
                    </div>
                </div>

                {pendingPDC.length > 0 && (
                    <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-badge-amber-bg)', borderColor: 'rgba(245,158,11,.35)' }}>
                        <AlertTriangle size={18} style={{ color: 'var(--color-brand-amber-tint)', flexShrink: 0 }} />
                        <div style={{ fontSize: 12, color: 'var(--color-brand-amber-tint)' }}>
                            Pending cheques: {pendingPDC.length} totalling {formatUsd(pendingPdcTotal)} (not in the books until cleared)
                        </div>
                    </div>
                )}

                {cashAccounts.length === 0 ? (
                    <div style={{ ...panelStyle, textAlign: 'center', padding: 48 }}>
                        <Landmark size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-muted)' }}>No bank or cash accounts configured</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 10 }}>
                            {cashAccounts.map(acct => {
                                const closing = closingByAccount[acct.id];
                                const isCash = acct.role === 'cash';
                                return (
                                    <div key={acct.id} style={{ ...panelStyle, position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: isCash ? 'linear-gradient(90deg,#22C55E,#86EFAC)' : 'linear-gradient(90deg,#4F8EF7,#93C5FD)' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', fontWeight: 500 }}>{acct.code} · {acct.name}</span>
                                            {isCash ? <DollarSign size={16} style={{ color: 'var(--color-brand-green)' }} /> : <Building2 size={16} style={{ color: 'var(--color-brand-blue)' }} />}
                                        </div>
                                        {closing == null ? (
                                            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, color: 'var(--color-redwood-text-muted)', letterSpacing: '-.5px' }}>Unavailable</div>
                                        ) : (
                                            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 600, color: isCash ? 'var(--color-brand-green)' : 'var(--color-brand-blue)', letterSpacing: '-.5px' }}>{formatUsd(closing)}</div>
                                        )}
                                        <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>GL closing balance</div>
                                    </div>
                                );
                            })}
                            <div style={{ ...panelStyle, position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4F8EF7,#93C5FD)' }} />
                                <div style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', fontWeight: 500, marginBottom: 8 }}>Net cash</div>
                                {netCash == null ? (
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--color-redwood-text-muted)', letterSpacing: '-.5px' }}>—</div>
                                ) : (
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 600, color: netCash >= 0 ? 'var(--color-brand-blue)' : 'var(--color-brand-red)', letterSpacing: '-.5px' }}>{formatUsd(netCash)}</div>
                                )}
                                <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>Sum of account closing balances</div>
                            </div>
                            {arTotal != null && (
                                <div style={{ ...panelStyle, position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#F59E0B,#FCD34D)' }} />
                                    <div style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', fontWeight: 500, marginBottom: 8 }}>Uncollected (AR)</div>
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--color-brand-amber)', letterSpacing: '-.5px' }}>{formatUsd(arTotal)}</div>
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>From customers/ar-summary</div>
                                </div>
                            )}
                        </div>

                        <div style={{ ...panelStyle }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 10 }}>Accounts</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 8 }}>
                                {cashAccounts.map(acct => (
                                    <button
                                        key={acct.id}
                                        type="button"
                                        onClick={() => setSelectedAccountId(acct.id)}
                                        style={{
                                            textAlign: 'left',
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            cursor: 'pointer',
                                            border: selectedAccountId === acct.id
                                                ? '1px solid rgba(79,142,247,.45)'
                                                : '1px solid var(--color-redwood-border)',
                                            background: selectedAccountId === acct.id
                                                ? 'var(--color-badge-blue-bg)'
                                                : 'var(--color-redwood-row-bg)',
                                        }}
                                    >
                                        <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{acct.code}</div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{acct.name}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ ...panelStyle, padding: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {[
                                { id: 'ledger' as const, label: 'Transaction ledger' },
                                { id: 'pdc' as const, label: `Post dated cheques${dueTodayPDC.length > 0 ? ` (${dueTodayPDC.length} due)` : ''}` },
                            ].map(tab => (
                                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{ padding: '7px 14px', fontSize: 11, fontWeight: 500, borderRadius: 8, cursor: 'pointer', background: activeTab === tab.id ? 'var(--color-badge-blue-bg)' : 'transparent', color: activeTab === tab.id ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)', border: activeTab === tab.id ? '1px solid rgba(79,142,247,.28)' : '1px solid transparent' }}>{tab.label}</button>
                            ))}
                        </div>

                        {activeTab === 'ledger' && (
                            <>
                                {showAddTx && (
                                    <div style={{ ...panelStyle, borderColor: 'rgba(251,146,60,.4)' }}>
                                        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.4px' }}>{editingId ? 'Edit transaction' : 'Add manual transaction'}</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 10 }}>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Date</label><input type="date" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Type</label><select value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value as 'Credit' | 'Debit' }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }}><option value="Credit">Money in</option><option value="Debit">Money out</option></select></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Amount ($)</label><input type="number" placeholder="0.00" value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Description</label><input value={txForm.description} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Reference</label><input value={txForm.reference} onChange={e => setTxForm(p => ({ ...p, reference: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div style={{ gridColumn: 'span 2' }}>
                                                <label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Other account</label>
                                                <select value={txForm.contraAccountId} onChange={e => setTxForm(p => ({ ...p, contraAccountId: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }}>
                                                    <option value="">— Suspense (default) —</option>
                                                    {contraOptions.map(a => (
                                                        <option key={a.id} value={String(a.id)}>
                                                            {a.isCurrent
                                                                ? (a.code ? `${a.code} · ${a.name} (current)` : `${a.name} (current)`)
                                                                : `${a.code} · ${a.name}`}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>Leave empty to post to Suspense. Pick the other Bank/Cash account to record a transfer.</div>
                                                <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>Customer and supplier money is recorded through payments, so Accounts Receivable and Accounts Payable are not offered here.</div>
                                                {editingContraName && !txForm.contraAccountId && (
                                                    <div style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', marginTop: 2 }}>Stored contra: {editingContraName}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                            <button type="button" onClick={saveManualTx} disabled={!txForm.description || !txForm.amount} style={primaryBtn}>{editingId ? 'Update' : 'Save'}</button>
                                            <button type="button" onClick={() => { setEditingId(null); setEditingCategory(null); setEditingContraName(null); setShowAddTx(false); }} style={ghostBtn}>Cancel</button>
                                        </div>
                                    </div>
                                )}

                                <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-redwood-border)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <RefreshCw size={14} style={{ color: '#4F8EF7' }} /> Transaction ledger
                                            {accountLedgerLoading && <span style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Loading…</span>}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)' }}>
                                                <Search size={14} style={{ color: 'var(--color-redwood-text-muted)' }} />
                                                <input type="search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-redwood-text-main)', fontSize: 11, width: 140 }} />
                                            </div>
                                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: 10, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)' }} />
                                            <span style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)' }}>to</span>
                                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: 10, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)' }} />
                                            {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ fontSize: 10, color: 'var(--color-brand-red-tint)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear</button>}
                                        </div>
                                    </div>
                                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-redwood-border)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                                        {(['all', 'in', 'out'] as const).map(f => (
                                            <button key={f} type="button" onClick={() => setDirectionFilter(f)} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: directionFilter === f ? '1px solid rgba(79,142,247,.28)' : '1px solid var(--color-redwood-border)', background: directionFilter === f ? 'var(--color-badge-blue-bg)' : 'transparent', color: directionFilter === f ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)' }}>{f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}</button>
                                        ))}
                                        {(['newest', 'oldest'] as const).map(o => (
                                            <button key={o} type="button" onClick={() => setLedgerOrder(o)} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: ledgerOrder === o ? '1px solid rgba(79,142,247,.28)' : '1px solid var(--color-redwood-border)', background: ledgerOrder === o ? 'var(--color-badge-blue-bg)' : 'transparent', color: ledgerOrder === o ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)' }}>{o === 'newest' ? 'Newest first' : 'Oldest first'}</button>
                                        ))}
                                        {accountLedger && (
                                            <span style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginLeft: 'auto' }}>
                                                In (period): {formatUsd(moneyIn)} · Out (period): {formatUsd(moneyOut)}
                                            </span>
                                        )}
                                    </div>

                                    {ledgerLoadFailed ? (
                                        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-redwood-text-muted)' }}>
                                            <p style={{ fontSize: 12, fontWeight: 600 }}>Could not load the ledger. Refresh to try again.</p>
                                        </div>
                                    ) : !accountLedger ? (
                                        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-redwood-text-muted)' }}>
                                            <p style={{ fontSize: 12, fontWeight: 600 }}>{accountLedgerLoading ? 'Loading ledger…' : 'Select an account to view its ledger'}</p>
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            {ledgerOrder === 'oldest' && (
                                                <div style={{ padding: '10px 14px', fontSize: 11, borderBottom: '1px solid var(--color-redwood-border)', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                                    <span>Opening: <strong>{formatUsd(accountLedger.opening_balance)}</strong></span>
                                                    <span>Closing: <strong style={{ color: 'var(--color-brand-blue-tint)' }}>{formatUsd(accountLedger.closing_balance)}</strong></span>
                                                </div>
                                            )}
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead><tr style={{ background: 'var(--color-redwood-row-bg)', borderBottom: '1px solid var(--color-redwood-border)' }}>{['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                                                <tbody>
                                                    {ledgerOrder === 'newest' && (
                                                        <tr style={{ background: 'var(--color-redwood-row-bg)', borderBottom: '1px solid var(--color-redwood-border)' }}>
                                                            <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)' }}>Closing balance</td>
                                                            <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'ui-monospace,monospace', color: 'var(--color-brand-blue-tint)' }}>{formatUsd(accountLedger.closing_balance)}</td>
                                                            <td />
                                                        </tr>
                                                    )}
                                                    {displayedRows.length === 0 ? (
                                                        <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-redwood-text-muted)' }}>No movements in this period</td></tr>
                                                    ) : displayedRows.map(row => {
                                                        const muted = row.is_reversed || row.is_reversal;
                                                        const action = ledgerRowAction(row, paymentsById);
                                                        const bankTxId = bankTxIdFromSourceId(row.source_id);
                                                        const bankTx = bankTxId != null
                                                            ? manualTxs.find(t => String(t.id) === String(bankTxId))
                                                            : undefined;
                                                        const bankTxHome = bankTx ? bankTxHomeState(bankTx, selectedAccountId) : null;
                                                        const homeAccount = bankTx?.accountId != null
                                                            ? cashAccounts.find(a => a.id === bankTx.accountId)
                                                            : undefined;
                                                        return (
                                                            <tr key={row.id} style={{ borderBottom: '1px solid var(--color-redwood-border)', opacity: muted ? 0.55 : 1 }}>
                                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>{row.date ? formatDateOnly(row.date) : '—'}</td>
                                                                <td style={tdStyle}>
                                                                    {ledgerTypeLabel(row.type)}
                                                                    {row.is_reversed && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 600, color: 'var(--color-redwood-text-subtle)' }}>Reversed</span>}
                                                                    {row.is_reversal && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 600, color: 'var(--color-brand-red-tint)' }}>Reversal</span>}
                                                                </td>
                                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 11 }}>{row.reference || '—'}</td>
                                                                <td style={{ ...tdStyle, fontWeight: 600 }}>{row.description || '—'}</td>
                                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace' }}>{row.debit ? formatUsd(row.debit) : '—'}</td>
                                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace' }}>{row.credit ? formatUsd(row.credit) : '—'}</td>
                                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>{formatUsd(row.running_balance)}</td>
                                                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                                    {action === 'edit-delete' && bankTxHome === 'here' && (
                                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                                                                            <button type="button" onClick={() => editManualTx(row)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-brand-blue-tint)', padding: 4 }} title="Edit"><Edit2 size={13} /></button>
                                                                            <button type="button" onClick={() => void deleteManualTx(row)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-brand-red-tint)', padding: 4 }} title="Delete"><Trash2 size={13} /></button>
                                                                        </div>
                                                                    )}
                                                                    {action === 'edit-delete' && bankTxHome === 'elsewhere' && homeAccount && (
                                                                        <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>
                                                                            Entered on {homeAccount.code} · {homeAccount.name}
                                                                        </span>
                                                                    )}
                                                                    {action === 'void' && (() => {
                                                                        const pid = paymentIdFromRow(row);
                                                                        if (pid == null) return null;
                                                                        return (
                                                                            <button type="button" onClick={() => void handleVoidPayment(String(pid))} disabled={voidingId === String(pid)} style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-brand-red-tint)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                                                                {voidingId === String(pid) ? 'Voiding…' : 'Void'}
                                                                            </button>
                                                                        );
                                                                    })()}
                                                                    {action === 'voided' && <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', fontWeight: 600 }}>Voided</span>}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {ledgerOrder === 'newest' && (
                                                        <tr style={{ background: 'var(--color-redwood-row-bg)', borderTop: '2px solid var(--color-redwood-border)' }}>
                                                            <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)' }}>Opening balance</td>
                                                            <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'ui-monospace,monospace' }}>{formatUsd(accountLedger.opening_balance)}</td>
                                                            <td />
                                                        </tr>
                                                    )}
                                                </tbody>
                                                {ledgerOrder === 'oldest' && (
                                                    <tfoot>
                                                        <tr style={{ background: 'var(--color-redwood-row-bg)', borderTop: '2px solid var(--color-redwood-border)' }}>
                                                            <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)' }}>Closing balance</td>
                                                            <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'ui-monospace,monospace', color: 'var(--color-brand-blue-tint)' }}>{formatUsd(accountLedger.closing_balance)}</td>
                                                            <td />
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {activeTab === 'pdc' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {dueTodayPDC.length > 0 && (
                                    <div style={{ ...panelStyle, background: 'var(--color-badge-amber-bg)', borderColor: 'rgba(245,158,11,.35)', fontSize: 12, color: 'var(--color-brand-amber-tint)' }}>
                                        {dueTodayPDC.length} cheque(s) due today or overdue
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>{pdcList.length} recorded</span>
                                    <button type="button" onClick={() => { clearMsg(); setShowPDCForm(!showPDCForm); }} style={primaryBtn}><Plus size={14} /> Record cheque</button>
                                </div>
                                {showPDCForm && (
                                    <div style={{ ...panelStyle, borderColor: 'rgba(251,146,60,.4)' }}>
                                        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 10 }}>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Cheque no.</label><input value={pdcForm.chequeNo} onChange={e => setPdcForm(p => ({ ...p, chequeNo: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Bank</label><input value={pdcForm.bankName} onChange={e => setPdcForm(p => ({ ...p, bankName: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            {pdcForm.type === 'Received' ? (
                                                <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Customer</label><CustomerPicker customers={customers} value={pdcForm.customerId} onChange={c => setPdcForm(p => ({ ...p, customerId: c ? Number(c.id) : null, payee: c?.name || p.payee }))} /></div>
                                            ) : (
                                                <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Payee</label><input value={pdcForm.payee} onChange={e => setPdcForm(p => ({ ...p, payee: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            )}
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Description</label><input value={pdcForm.description} onChange={e => setPdcForm(p => ({ ...p, description: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Date</label><input type="date" value={pdcForm.date} onChange={e => setPdcForm(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Amount ($)</label><input type="number" value={pdcForm.amount} onChange={e => setPdcForm(p => ({ ...p, amount: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Type</label><select value={pdcForm.type} onChange={e => setPdcForm(p => ({ ...p, type: e.target.value as PDCheque['type'], customerId: e.target.value === 'Issued' ? null : p.customerId }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }}><option value="Received">Received</option><option value="Issued">Issued</option></select></div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button type="button" onClick={savePDCEntry} style={primaryBtn}>Save</button><button type="button" onClick={() => setShowPDCForm(false)} style={ghostBtn}>Cancel</button></div>
                                    </div>
                                )}
                                <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                                    {pdcList.length === 0 ? (
                                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 12 }}>No post dated cheques</div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead><tr style={{ background: 'var(--color-redwood-row-bg)' }}>{['Cheque', 'Bank', 'Payee', 'Date', 'Amount', 'Type', 'Status', 'Dates', 'Books', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                                            <tbody>
                                                {pdcList.map(pdc => {
                                                    const isOverdue = pdc.date <= today && pdc.status === 'Pending';
                                                    const actions = chequeActions(pdc.status, pdc.type);
                                                    return (
                                                        <tr key={pdc.id} style={{ borderBottom: '1px solid var(--color-redwood-border)', background: isOverdue ? 'var(--color-badge-amber-bg)' : undefined }}>
                                                            <td style={{ ...tdStyle, fontWeight: 700 }}>{pdc.chequeNo}</td>
                                                            <td style={tdStyle}>{pdc.bankName || '—'}</td>
                                                            <td style={tdStyle}>
                                                                {pdc.payee || '—'}
                                                                {pdc.status === 'Pending' && pdc.type === 'Received' && !pdc.customerId && (
                                                                    <div style={{ marginTop: 6 }}>
                                                                        <div style={{ fontSize: 9, color: 'var(--color-brand-amber-tint)', marginBottom: 4 }}>Link customer</div>
                                                                        <CustomerPicker customers={customers} value={null} onChange={c => { if (c) void linkPdcCustomer(pdc.id, c); }} placeholder="Search customer…" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={tdStyle}>{pdc.date ? formatDateOnly(pdc.date) : '—'}{isOverdue && <span style={{ marginLeft: 4, fontSize: 8, color: 'var(--color-brand-red-tint)' }}> OVERDUE</span>}</td>
                                                            <td style={{ ...tdStyle, fontWeight: 700, color: pdc.type === 'Received' ? 'var(--color-brand-green-tint)' : 'var(--color-brand-red-tint)' }}>{pdc.type === 'Received' ? '+' : '-'}{formatUsd(pdc.amount)}</td>
                                                            <td style={tdStyle}>{pdc.type}</td>
                                                            <td style={tdStyle}>{pdc.status}</td>
                                                            <td style={{ ...tdStyle, fontSize: 10 }}>
                                                                {pdc.clearedDate && <div>Cleared: {formatDateOnly(pdc.clearedDate)}</div>}
                                                                {pdc.bouncedDate && <div>Bounced: {formatDateOnly(pdc.bouncedDate)}</div>}
                                                                {!pdc.clearedDate && !pdc.bouncedDate && '—'}
                                                            </td>
                                                            <td style={tdStyle}>
                                                                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: pdc.glPosted ? 'var(--color-badge-green-bg)' : 'var(--color-redwood-row-bg)', color: pdc.glPosted ? 'var(--color-brand-green-tint)' : 'var(--color-redwood-text-muted)', border: '1px solid var(--color-redwood-border)' }}>
                                                                    {pdc.glPosted ? 'In the books' : 'Status only'}
                                                                </span>
                                                            </td>
                                                            <td style={tdStyle}>
                                                                {actions.length > 0 && (
                                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                                        {actions.includes('clear') && <button type="button" onClick={() => confirmAndUpdatePDCStatus(pdc, 'Cleared')} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 6, border: 'none', background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)', cursor: 'pointer' }}>Clear</button>}
                                                                        {actions.includes('bounce') && <button type="button" onClick={() => confirmAndUpdatePDCStatus(pdc, 'Bounced')} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 6, border: 'none', background: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red-tint)', cursor: 'pointer' }}>Bounce</button>}
                                                                        {actions.includes('cancel') && <button type="button" onClick={() => confirmAndUpdatePDCStatus(pdc, 'Cancelled')} style={ghostBtn}>Cancel</button>}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
