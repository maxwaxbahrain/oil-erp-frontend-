import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import {
    Landmark,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Download,
    DollarSign,
    Building2,
    Edit2,
    Trash2,
    Search,
    Bot,
    Brain,
    Sparkles,
    AlertTriangle,
    Upload,
    Link2,
    ShieldAlert,
    Wifi,
    FileSpreadsheet,
    FileText,
    Plus,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPayments, getInvoices, voidPayment, type Payment, type Invoice } from '../../services/api';
import { getSuppliers } from '../../services/purchasesService';
import { getCompanyProfile } from '../../services/settingsService';
import { getExpensesSnapshot, type Expense } from '../../services/expenseService';
import { calculateReceivables } from '../../utils/arMetrics';
import { getArSummary } from '../../services/customerService';
import { authFetch } from '../../api/axios';
import { formatDateOnly } from '../../utils/formatters';
import { getOilErpApiBase } from '../../config/apiBase';

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

function formatUsdSigned(n: number, type: 'Credit' | 'Debit'): string {
    return `${type === 'Credit' ? '+' : '-'}${formatUsd(n).replace(/^-/, '')}`;
}

interface PDCheque {
    id: string;
    date: string;           // cheque date (can be future)
    chequeNo: string;
    bankName: string;
    payee: string;
    amount: number;
    type: 'Received' | 'Issued';
    status: 'Pending' | 'Cleared' | 'Bounced' | 'Cancelled';
    description: string;
    createdAt: string;
}

// PDC persistence: backend via /api/pdc.
// Previously stored in localStorage so cheques only existed on the browser
// that recorded them. Now everyone sees the same PDC ledger.
const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim().replace(/\/+$/, '');
const PDC_API = `${API_HOST}/api/pdc`;
const BANK_TX_API = `${API_HOST}/api/bank-transactions`;
const BANKING_API = `${getOilErpApiBase()}/banking`;

// Manual bank transactions (rent, salary, deposit, etc.) — backend persisted.
async function getBankTxsApi(): Promise<any[]> {
    try {
        const r = await authFetch(`${BANK_TX_API}/`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rows = await r.json();
        const out = Array.isArray(rows) ? rows.map(t => ({ ...t, balance: 0, isManual: true })) : [];
        // eslint-disable-next-line no-console
        console.log(`[Banking] GET /api/bank-transactions/ → ${out.length} rows`);
        return out;
    } catch (e) {
        console.error('[Banking] Failed to fetch bank transactions:', e);
        return [];
    }
}

async function createBankTxApi(tx: {
    date: string; description: string; type: 'Credit' | 'Debit';
    amount: number; reference: string; category: string;
}): Promise<any | null> {
    try {
        const r = await authFetch(`${BANK_TX_API}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });
        if (!r.ok) {
            const text = await r.text().catch(() => '');
            throw new Error(`HTTP ${r.status} ${text}`);
        }
        return await r.json();
    } catch (e: any) {
        alert(`❌ ${e.message || 'Failed to save transaction'}`);
        return null;
    }
}

async function updateBankTxApi(id: string, tx: {
    date: string; description: string; type: 'Credit' | 'Debit';
    amount: number; reference: string; category: string;
}): Promise<any | null> {
    try {
        const r = await authFetch(`${BANK_TX_API}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });
        if (!r.ok) {
            const text = await r.text().catch(() => '');
            throw new Error(`HTTP ${r.status} ${text}`);
        }
        return await r.json();
    } catch (e: any) {
        alert(`❌ ${e.message || 'Failed to update transaction'}`);
        return null;
    }
}

async function deleteBankTxApi(id: string): Promise<boolean> {
    try {
        const r = await authFetch(`${BANK_TX_API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) {
            const text = await r.text().catch(() => '');
            throw new Error(`HTTP ${r.status} ${text}`);
        }
        return true;
    } catch (e: any) {
        alert(`❌ ${e.message || 'Failed to delete transaction'}`);
        return false;
    }
}

async function getPDC(): Promise<PDCheque[]> {
    try {
        const r = await authFetch(`${PDC_API}/`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        console.error('[Banking] Failed to fetch PDCs:', e);
        return [];
    }
}

async function createPDCApi(p: Omit<PDCheque, 'id' | 'status' | 'createdAt'>): Promise<PDCheque | null> {
    try {
        const r = await authFetch(`${PDC_API}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: p.date, chequeNo: p.chequeNo, bankName: p.bankName,
                payee: p.payee, amount: p.amount, type: p.type, description: p.description,
            }),
        });
        if (!r.ok) {
            const text = await r.text().catch(() => '');
            throw new Error(`HTTP ${r.status} ${text}`);
        }
        return await r.json();
    } catch (e: any) {
        alert(`❌ ${e.message || 'Failed to save PDC'}`);
        return null;
    }
}

async function patchPDCApi(id: string, status: PDCheque['status']): Promise<boolean> {
    try {
        const r = await authFetch(`${PDC_API}/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        if (!r.ok) {
            const text = await r.text().catch(() => '');
            throw new Error(`HTTP ${r.status} ${text}`);
        }
        return true;
    } catch (e: any) {
        alert(`❌ ${e.message || 'Failed to update PDC'}`);
        return false;
    }
}

interface Transaction {
    id: string;
    date: string;
    description: string;
    type: 'Credit' | 'Debit';
    amount: number;
    balance: number;
    reference: string;
    category: string;
    isManual?: boolean;
    // ITEM 14 — Cash vs Bank channel. 'Cash' = physical cash (Cash, Petty
    // Cash). 'Bank' = everything that actually moves through a bank
    // account (Bank Transfer, Cheque, Card, Wire, Zelle, etc.). Lets
    // users see what's sitting in the safe vs in the account.
    channel: 'Cash' | 'Bank';
}

// ITEM 14 — Classify a payment by its method (and category for manual
// bank-tx entries). Whitelist 'Cash' / 'Petty Cash'; default everything
// else to Bank so we never under-count the bank balance.
function classifyChannel(paymentMethod?: string | null, category?: string | null): 'Cash' | 'Bank' {
    const m = (paymentMethod || '').toLowerCase().trim();
    const c = (category || '').toLowerCase().trim();
    if (m === 'cash' || m === 'petty cash' || c === 'cash' || c.includes('cash in hand') || c.includes('petty cash')) return 'Cash';
    return 'Bank';
}

type FlowDirection = 'in' | 'out' | 'unknown';

const RECON_AMOUNT_TOLERANCE = 0.01;
const RECON_MAX_DATE_DAYS = 3;
const RECON_MAX_MATCHES = 4;

/** Derive money flow from ledger row — Credit = in, Debit = out. */
function getTransactionFlowDirection(tx: Transaction): FlowDirection {
    const amt = Number(tx.amount);
    if (!Number.isFinite(amt) || amt <= RECON_AMOUNT_TOLERANCE) return 'unknown';
    if (tx.type === 'Credit') return 'in';
    if (tx.type === 'Debit') return 'out';
    return 'unknown';
}

function parseTransactionDate(dateStr: string): Date | null {
    if (!dateStr || !String(dateStr).trim()) return null;
    const raw = String(dateStr).trim();
    const d = new Date(raw.includes('T') ? raw : `${raw.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function daysApart(a: Date, b: Date): number {
    return Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

type ReconciliationMatchRow = {
    id: string;
    book: string;
    bank: string;
    amount: number;
    pct: number;
};

/**
 * Pair ledger rows only when direction matches (both in or both out), amount
 * aligns, and dates are within a few days. Prefer manual bank-tx vs system rows.
 */
function findReconciliationMatches(transactions: Transaction[]): ReconciliationMatchRow[] {
    type ScoredPair = { a: Transaction; b: Transaction; score: number };
    const candidates: ScoredPair[] = [];

    for (let i = 0; i < transactions.length; i++) {
        for (let j = i + 1; j < transactions.length; j++) {
            const a = transactions[i];
            const b = transactions[j];
            if (a.id === b.id) continue;

            const dirA = getTransactionFlowDirection(a);
            const dirB = getTransactionFlowDirection(b);
            if (dirA === 'unknown' || dirB === 'unknown' || dirA !== dirB) continue;

            const amountDiff = Math.abs(Number(a.amount) - Number(b.amount));
            if (amountDiff >= RECON_AMOUNT_TOLERANCE) continue;

            const dateA = parseTransactionDate(a.date);
            const dateB = parseTransactionDate(b.date);
            if (dateA && dateB && daysApart(dateA, dateB) > RECON_MAX_DATE_DAYS) continue;

            let score = 100;
            const baseAmt = Math.max(Number(a.amount), Number(b.amount), 1);
            score -= Math.min(15, (amountDiff / baseAmt) * 100);
            if (dateA && dateB) {
                score -= Math.min(35, Math.round(daysApart(dateA, dateB) * 12));
            }

            candidates.push({ a, b, score: Math.max(0, Math.round(score)) });
        }
    }

    candidates.sort((x, y) => y.score - x.score);

    const used = new Set<string>();
    const out: ReconciliationMatchRow[] = [];

    for (const { a, b, score } of candidates) {
        if (used.has(a.id) || used.has(b.id)) continue;
        used.add(a.id);
        used.add(b.id);

        const aManual = Boolean(a.isManual);
        const bManual = Boolean(b.isManual);
        const bookTx = aManual && !bManual ? b : !aManual && bManual ? a : a;
        const bankTx = bookTx.id === a.id ? b : a;

        out.push({
            id: `${bookTx.id}::${bankTx.id}`,
            book: bookTx.description,
            bank: bankTx.description,
            amount: bookTx.amount,
            pct: score,
        });
        if (out.length >= RECON_MAX_MATCHES) break;
    }

    return out;
}

// Supplier payment shape on /api/suppliers/{id}/payments.
interface SupplierPaymentRow {
    id: string;
    supplierId: string;
    amount: number;
    date: string;
    paymentMethod?: string;
    reference?: string;
    notes?: string;
}

export default function Banking() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    // DASH-3b — authoritative Outstanding AR from GET /customers/ar-summary
    // (null until loaded / if unavailable → falls back to client-side calc).
    const [arTotal, setArTotal] = useState<number | null>(null);
    // Supplier payments (cash going OUT). Fetched per-supplier and aggregated.
    const [supplierPayments, setSupplierPayments] = useState<{ row: SupplierPaymentRow; supplierName: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'Credit' | 'Debit'>('all');
    // ITEM 14 — Channel filter so users can drill into Cash-only or Bank-only.
    const [channelFilter, setChannelFilter] = useState<'all' | 'Cash' | 'Bank'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [activeTab, setActiveTab] = useState<'ledger' | 'pdc'>('ledger');
    const [showAddTx, setShowAddTx] = useState(false);
    const [txForm, setTxForm] = useState({ date: new Date().toISOString().slice(0,10), description: '', type: 'Credit' as 'Credit'|'Debit', amount: '', reference: '', category: 'General' });
    // Manual transactions now load from /api/bank-transactions on mount
    // (see the useEffect below). Empty array as the starting placeholder.
    const [manualTxs, setManualTxs] = useState<any[]>([]);
    const [savedFlash, setSavedFlash] = useState<string | null>(null);
    // If set, the form is in EDIT mode for that manual-tx id; Save Transaction
    // PATCHes instead of POSTing.
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pdcList, setPdcList] = useState<PDCheque[]>([]);
    const [showPDCForm, setShowPDCForm] = useState(false);
    const [pdcForm, setPdcForm] = useState({ date: '', chequeNo: '', bankName: '', payee: '', amount: '', type: 'Received' as PDCheque['type'], description: '' });
    const [dateTo, setDateTo] = useState('');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expenseDataUnavailable, setExpenseDataUnavailable] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    // FIX W6-1 — track which payment row is being voided (disables button).
    const [voidingId, setVoidingId] = useState<string | null>(null);
    const [bottomSectionTab, setBottomSectionTab] = useState<'ask-ai' | 'connect'>('ask-ai');
    const [aiQuestion, setAiQuestion] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [aiThinking, setAiThinking] = useState(false);
    // Root C — per-bank-account ledger from API
    const [bankAccounts, setBankAccounts] = useState<Array<{ id: number; code: string; name: string; role?: string }>>([]);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
    const [accountLedger, setAccountLedger] = useState<{
        opening_balance: number;
        closing_balance: number;
        rows: Array<{ id: string; date: string | null; type: string; reference: string | null; description: string; debit: number; credit: number; running_balance: number }>;
    } | null>(null);
    const [accountLedgerLoading, setAccountLedgerLoading] = useState(false);

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

    const reloadAll = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const [p, i, suppliers, exp, ar] = await Promise.all([
                getPayments().catch(() => []),
                getInvoices().catch(() => []),
                getSuppliers().catch(() => []),
                getExpensesSnapshot().catch(() => ({ expenses: [], stale: true })),
                getArSummary().catch(() => null), // non-fatal: fall back to client-side calc
            ]);
            setPayments(p);
            setInvoices(i);
            setArTotal(ar ? ar.total_outstanding : null);
            setExpenseDataUnavailable(exp.stale);
            setExpenses(exp.stale ? [] : exp.expenses);
            const supPayLists = await Promise.all(
                suppliers.map(async s => {
                    try {
                        const r = await authFetch(`${API_HOST}/api/suppliers/${s.id}/payments`);
                        if (!r.ok) return [];
                        const rows: SupplierPaymentRow[] = await r.json();
                        return Array.isArray(rows) ? rows.map(row => ({ row, supplierName: s.name })) : [];
                    } catch { return []; }
                }),
            );
            setSupplierPayments(supPayLists.flat());
            try {
                const br = await authFetch(`${BANKING_API}/accounts?role=bank`);
                if (br.ok) {
                    const rows = await br.json();
                    const list = Array.isArray(rows) ? rows : [];
                    setBankAccounts(list);
                    if (!selectedBankAccountId && list.length > 0) {
                        setSelectedBankAccountId(Number(list[0].id));
                    }
                }
            } catch { /* bank accounts optional */ }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
        getPDC().then(setPdcList);
        getBankTxsApi().then(setManualTxs);
    }, [selectedBankAccountId]);

    useEffect(() => {
        if (!selectedBankAccountId) {
            setAccountLedger(null);
            return;
        }
        let cancelled = false;
        (async () => {
            setAccountLedgerLoading(true);
            try {
                const params = new URLSearchParams();
                if (dateFrom) params.set('start_date', dateFrom);
                if (dateTo) params.set('end_date', dateTo);
                const qs = params.toString();
                const r = await authFetch(`${BANKING_API}/accounts/${selectedBankAccountId}/ledger${qs ? `?${qs}` : ''}`);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const data = await r.json();
                if (!cancelled) setAccountLedger(data);
            } catch {
                if (!cancelled) setAccountLedger(null);
            } finally {
                if (!cancelled) setAccountLedgerLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedBankAccountId, dateFrom, dateTo]);

    // FIX W6-1 — Void a customer payment by posting a reversing contra-
    // entry through the same /ledger/payment endpoint. Original stays
    // for audit; backend recomputes customer/invoice balances. Guards
    // against double-void (reversal rows + negative amounts).
    const handleVoidPayment = async (paymentId: string) => {
        const original = payments.find(p => String(p.id) === String(paymentId));
        if (!original) {
            alert('Original payment not found — cannot void.');
            return;
        }
        if ((original.amount ?? 0) < 0) {
            alert('Negative-amount payments are reversal entries — cannot void.');
            return;
        }
        if (original.reference?.startsWith('VOID/')) {
            alert('This is already a reversal entry — cannot void a void.');
            return;
        }
        const reason = prompt(
            `Void payment of $${original.amount.toFixed(2)}?\n\n` +
            `A reversing entry will be created. The original record stays for audit. ` +
            `Customer balance and any linked invoice will adjust.\n\n` +
            `Enter a reason (optional):`
        );
        if (reason === null) return; // user cancelled the prompt
        setVoidingId(paymentId);
        try {
            await voidPayment({
                id: String(original.id),
                customer_id: original.customer_id,
                amount: original.amount,
                invoice_id: original.invoice_id,
                reason: reason || undefined,
            });
            // Refetch payments so the new reversal row shows up.
            const fresh = await getPayments().catch(() => payments);
            setPayments(fresh);
            alert('✅ Payment voided. Reversal entry created.');
        } catch (e) {
            alert('Could not void payment: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setVoidingId(null);
        }
    };

    useEffect(() => {
        void reloadAll();
    }, [reloadAll]);

    // ─────────────────────────────────────────────────────────────────────
    // Bank ledger = REAL CASH MOVEMENT only.
    //
    // Previously this page listed unpaid invoices as "Debits" — but those
    // aren't cash going out, they're accounts receivable (money customers
    // owe us). Mixing them with cash receipts made the Net Balance number
    // meaningless. Now the ledger contains:
    //   - Customer payments  → Credit (cash in)
    //   - Supplier payments  → Debit  (cash out)
    //   - Manual entries     → user-chosen Credit/Debit
    // AR (unpaid invoice total) is kept as a SEPARATE "Outstanding" KPI
    // so it's still visible but doesn't contaminate the bank balance.
    // ─────────────────────────────────────────────────────────────────────
    const systemTx: Transaction[] = [
        // Cash IN from customers
        ...payments.map((p, idx) => {
            const isExpense = p.transaction_type === 'expense';
            return {
                id: `PAY-${p.id || idx}`,
                date: p.payment_date || new Date().toISOString().split('T')[0],
                description: isExpense ? 'Expense payment' : 'Payment received from customer',
                type: isExpense ? ('Debit' as const) : ('Credit' as const),
                amount: p.amount || 0,
                balance: 0,
                reference: `PAY-${String(p.id || idx).slice(0, 6).toUpperCase()}`,
                category: isExpense ? 'Expense' : 'Customer Payment',
                // ITEM 14 — derive Cash vs Bank from the payment_method.
                channel: classifyChannel(p.payment_method),
            };
        }),
        // Cash OUT to suppliers
        ...supplierPayments.map(({ row, supplierName }, idx) => ({
            id: `SPAY-${row.id || idx}`,
            date: row.date || new Date().toISOString().split('T')[0],
            description: `Payment to ${supplierName || 'supplier'}`,
            type: 'Debit' as const,
            amount: row.amount || 0,
            balance: 0,
            reference: row.reference || `SPAY-${String(row.id || idx).slice(0, 6).toUpperCase()}`,
            category: 'Supplier Payment',
            // ITEM 14 — derive channel from supplier paymentMethod.
            channel: classifyChannel(row.paymentMethod),
        })),
        // ITEM 15 — Post-Dated Cheques only hit the bank ledger AFTER
        // they're cleared. Pending / Bounced / Cancelled / future-dated
        // cheques stay in the PDC register and don't affect cash balances.
        // Type='Received' = money IN (Credit); type='Issued' = money OUT
        // (Debit). Channel is always 'Bank' because cheques settle through
        // the bank account, regardless of the original payment context.
        ...pdcList
            .filter(p => p.status === 'Cleared')
            .map((p, idx) => ({
                id: `PDC-${p.id || idx}`,
                date: p.date || new Date().toISOString().split('T')[0],
                description: `Cheque ${p.chequeNo}${p.payee ? ' — ' + p.payee : ''}${p.bankName ? ' (' + p.bankName + ')' : ''}`,
                type: (p.type === 'Received' ? 'Credit' : 'Debit') as 'Credit' | 'Debit',
                amount: p.amount || 0,
                balance: 0,
                reference: p.chequeNo ? `CHQ-${p.chequeNo}` : `PDC-${String(p.id || idx).slice(0, 6).toUpperCase()}`,
                category: p.type === 'Received' ? 'Cheque Received' : 'Cheque Issued',
                channel: 'Bank' as const,
            })),
    ];

    // ITEM 14 — Tag manual entries with a channel (category-based).
    const manualTxsTagged: Transaction[] = (manualTxs as Transaction[]).map(t => ({
        ...t,
        channel: t.channel || classifyChannel(undefined, t.category),
    }));

    // Merge system + manual BEFORE sorting so the user's just-added entry
    // (likely dated today) ends up at the top of the ledger.
    const allTransactions: Transaction[] = [...systemTx, ...manualTxsTagged]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Running balance: working backwards from the newest entry. Each row's
    // displayed balance is the cash position AFTER that transaction.
    const ledgerWithBalance = allTransactions.map((tx, idx, arr) => {
        const balanceAfterRow = arr.slice(idx).reduce(
            (sum, t) => sum + (t.type === 'Credit' ? t.amount : -t.amount), 0,
        );
        return { ...tx, balance: balanceAfterRow };
    });

    const totalCredits = allTransactions.filter(t => t.type === 'Credit').reduce((s, t) => s + t.amount, 0);
    const totalDebits = allTransactions.filter(t => t.type === 'Debit').reduce((s, t) => s + t.amount, 0);
    const netBalance = totalCredits - totalDebits;

    // ITEM 14 — Per-channel balances. Cash = currency on hand (Cash /
    // Petty Cash methods); Bank = balance in the bank account (everything
    // else). These sum to netBalance.
    const cashCredits = allTransactions.filter(t => t.channel === 'Cash' && t.type === 'Credit').reduce((s, t) => s + t.amount, 0);
    const cashDebits = allTransactions.filter(t => t.channel === 'Cash' && t.type === 'Debit').reduce((s, t) => s + t.amount, 0);
    const cashBalance = cashCredits - cashDebits;
    const bankCredits = allTransactions.filter(t => t.channel === 'Bank' && t.type === 'Credit').reduce((s, t) => s + t.amount, 0);
    const bankDebits = allTransactions.filter(t => t.channel === 'Bank' && t.type === 'Debit').reduce((s, t) => s + t.amount, 0);
    const bankBalance = bankCredits - bankDebits;

    // DASH-3b — authoritative endpoint total; falls back to the client-side
    // calc when the ar-summary endpoint is unavailable.
    const outstandingAR = arTotal ?? calculateReceivables(invoices, payments).total;

    const filtered = ledgerWithBalance.filter(t => {
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        // ITEM 14 — Apply channel filter alongside the existing type filter.
        if (channelFilter !== 'all' && t.channel !== channelFilter) return false;
        const matchFilter = filter === 'all' || t.type === filter;
        const matchSearch = !search || (t.description || '').toLowerCase().includes(search.toLowerCase()) || (t.reference || '').toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
    });

    const closingBalance = filtered.length > 0 ? filtered[0].balance : netBalance;

    const unreconciledVariance = useMemo(
        () => pdcList.filter(p => p.status === 'Pending').reduce((s, p) => s + (p.amount || 0), 0),
        [pdcList],
    );

    const reconciliationMatches = useMemo(
        () => findReconciliationMatches(allTransactions),
        [allTransactions],
    );

    const anomalies = useMemo(() => {
        const found: { id: string; title: string; detail: string; severity: 'high' | 'medium' }[] = [];
        const avg = allTransactions.length
            ? allTransactions.reduce((s, t) => s + t.amount, 0) / allTransactions.length
            : 0;
        for (const tx of allTransactions.slice(0, 30)) {
            if (tx.amount > avg * 3 && tx.amount > 500) {
                found.push({
                    id: tx.id,
                    title: `Unusual ${tx.type.toLowerCase()} — ${formatUsd(tx.amount)}`,
                    detail: `${tx.description} on ${tx.date}`,
                    severity: 'high',
                });
            }
        }
        const refs = new Map<string, number>();
        for (const tx of allTransactions) {
            const key = `${tx.amount}-${tx.type}`;
            refs.set(key, (refs.get(key) || 0) + 1);
        }
        for (const tx of allTransactions) {
            const key = `${tx.amount}-${tx.type}`;
            if ((refs.get(key) || 0) > 1 && !found.some(f => f.id === tx.id)) {
                found.push({
                    id: `dup-${tx.id}`,
                    title: 'Possible duplicate amount',
                    detail: `${formatUsd(tx.amount)} ${tx.type} — ${tx.reference || tx.description}`,
                    severity: 'medium',
                });
            }
            if (found.length >= 4) break;
        }
        return found.slice(0, 4);
    }, [allTransactions]);

    const monthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1), []);

    const expenseByCategory = useMemo(() => {
        const map = new Map<string, number>();
        for (const e of expenses) {
            const d = new Date(e.date.includes('T') ? e.date : `${e.date}T12:00:00`);
            if (d < monthStart) continue;
            map.set(e.category || 'Other', (map.get(e.category || 'Other') || 0) + e.amount);
        }
        return [...map.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [expenses, monthStart]);

    const expenseHealthScore = useMemo(() => {
        const monthExp = expenses.filter(e => {
            const d = new Date(e.date.includes('T') ? e.date : `${e.date}T12:00:00`);
            return d >= monthStart;
        });
        if (expenseDataUnavailable || monthExp.length === 0) return null;
        const approved = monthExp.filter(e => e.status === 'Approved' || e.status === 'Paid').length;
        return Math.round((approved / monthExp.length) * 100);
    }, [expenses, monthStart, expenseDataUnavailable]);

    const handleAiAnalysis = () => {
        alert(
            `AI Reconciliation Analysis\n\n` +
            `Unreconciled variance: ${formatUsd(unreconciledVariance)}\n` +
            `Net cash position: ${formatUsd(netBalance)}\n` +
            `Outstanding AR (uncollected): ${formatUsd(outstandingAR)}\n` +
            `${reconciliationMatches.length} suggested matches · ${anomalies.length} anomalies flagged`,
        );
    };
    const askBankingAI = async (question: string) => {
        const q = question.trim();
        if (!q) return;
        setAiThinking(true);
        await new Promise(r => setTimeout(r, 700));
        const lower = q.toLowerCase();
        let answer = '';
        if (lower.includes('variance') || lower.includes('unreconciled')) {
            answer =
                `Unreconciled variance is ${formatUsd(unreconciledVariance)}.\n\n` +
                `Bank balance: ${formatUsd(bankBalance)} · Cash on hand: ${formatUsd(cashBalance)} · Net cash: ${formatUsd(netBalance)}.\n` +
                `${pendingPDC.length} pending cheque${pendingPDC.length !== 1 ? 's' : ''} may explain part of the gap until cleared.`;
        } else if (lower.includes('cash') || lower.includes('position')) {
            answer =
                `Current cash position:\n` +
                `• Cash on hand: ${formatUsd(cashBalance)}\n` +
                `• Bank balance: ${formatUsd(bankBalance)}\n` +
                `• Net cash: ${formatUsd(netBalance)}\n` +
                `• Uncollected AR: ${formatUsd(outstandingAR)}\n\n` +
                `Total in this period: ${formatUsd(totalCredits)} · Total out: ${formatUsd(totalDebits)}.`;
        } else if (lower.includes('duplicate') || lower.includes('anomal')) {
            answer = anomalies.length === 0
                ? 'No anomalies flagged right now. Ledger looks clean.'
                : anomalies.map(a => `• ${a.title}: ${a.detail}`).join('\n');
        } else if (lower.includes('match') || lower.includes('reconcil')) {
            answer = reconciliationMatches.length === 0
                ? 'No suggested matches pending review.'
                : `${reconciliationMatches.length} suggested matches:\n` +
                  reconciliationMatches.slice(0, 4).map(m => `• ${formatUsd(m.amount)} — ${m.book}`).join('\n');
        } else {
            answer =
                `Based on your ledger:\n` +
                `• ${filtered.length} visible transactions · Closing balance ${formatUsd(filtered[0]?.balance ?? netBalance)}\n` +
                `• ${reconciliationMatches.length} AI matches · ${anomalies.length} anomalies\n` +
                `• Expense health ${expenseHealthScore == null ? '—' : `${expenseHealthScore}%`} this month\n\n` +
                `Try asking about variance, cash position, duplicates, or reconciliation matches.`;
        }
        setAiResponse(answer);
        setAiThinking(false);
    };


    const savePDCEntry = async () => {
        if (!pdcForm.chequeNo || !pdcForm.amount || !pdcForm.date) {
            alert('Cheque number, date and amount are required');
            return;
        }
        const created = await createPDCApi({
            date: pdcForm.date,
            chequeNo: pdcForm.chequeNo,
            bankName: pdcForm.bankName,
            payee: pdcForm.payee,
            amount: parseFloat(pdcForm.amount) || 0,
            type: pdcForm.type,
            description: pdcForm.description,
        });
        if (!created) return; // error alert was shown by createPDCApi
        // Re-fetch from server so the list reflects whatever the backend
        // actually has (handles concurrent edits from other browsers too).
        const fresh = await getPDC();
        setPdcList(fresh);
        setPdcForm({ date: '', chequeNo: '', bankName: '', payee: '', amount: '', type: 'Received', description: '' });
        setShowPDCForm(false);
    };

    const updatePDCStatus = async (id: string, status: PDCheque['status']) => {
        const ok = await patchPDCApi(id, status);
        if (!ok) return;
        const fresh = await getPDC();
        setPdcList(fresh);
    };

    const today = new Date().toISOString().slice(0, 10);
    const pendingPDC = pdcList.filter(p => p.status === 'Pending');
    const dueTodayPDC = pendingPDC.filter(p => p.date <= today);

    const saveManualTx = async () => {
        const amt = parseFloat(txForm.amount) || 0;
        if (!txForm.description?.trim() || amt <= 0) {
            alert('Description and a positive amount are required.');
            return;
        }
        const payload = {
            date: txForm.date || new Date().toISOString().slice(0, 10),
            description: txForm.description.trim(),
            type: txForm.type,
            amount: amt,
            // On CREATE, auto-generate a REF if blank so every row has a
            // reference for the ledger / export PDF. On EDIT, never
            // auto-generate — a user who CLEARS the reference field
            // expects empty to be saved as empty.
            reference: editingId
                ? (txForm.reference || '')
                : (txForm.reference || `REF-${Date.now().toString().slice(-6)}`),
            category: txForm.category,
        };

        let saved: any;
        if (editingId) {
            // Edit-mode: PATCH instead of POST so we update the existing row.
            saved = await updateBankTxApi(editingId, payload);
        } else {
            saved = await createBankTxApi(payload);
        }
        if (!saved) return; // error alert already shown by the helper

        // Optimistic state update — the just-saved row replaces any
        // existing copy with the same id, then re-fetch in the background.
        const newRow = { ...saved, balance: 0, isManual: true };
        setManualTxs(prev => [newRow, ...prev.filter(t => String(t.id) !== String(saved.id))]);
        getBankTxsApi().then(fresh => {
            if (fresh.length > 0) setManualTxs(fresh);
        }).catch(() => { /* keep optimistic state */ });

        setTxForm({ date: new Date().toISOString().slice(0, 10), description: '', type: 'Credit', amount: '', reference: '', category: 'General' });
        setShowAddTx(false);
        const action = editingId ? 'updated' : 'saved';
        setEditingId(null);
        setSavedFlash(`✅ ${saved.type} of ${saved.amount} ${action} — ${saved.description}`);
        setTimeout(() => setSavedFlash(null), 4000);
    };

    // Click the pencil icon on a manual row → load it into the form for edit.
    const editManualTx = (tx: any) => {
        setEditingId(String(tx.id));
        setTxForm({
            date: tx.date || new Date().toISOString().slice(0, 10),
            description: tx.description || '',
            type: (tx.type === 'Debit' ? 'Debit' : 'Credit'),
            amount: String(tx.amount || ''),
            reference: tx.reference || '',
            category: tx.category || 'General',
        });
        setShowAddTx(true);
        // Scroll the form into view so the user knows it's open.
        setTimeout(() => window.scrollTo({ top: 200, behavior: 'smooth' }), 0);
    };

    // Click the trash icon on a manual row → confirm + DELETE.
    const deleteManualTx = async (tx: any) => {
        if (!confirm(`Delete this transaction?\n\n${tx.description} · ${tx.type} ${tx.amount}`)) return;
        const ok = await deleteBankTxApi(String(tx.id));
        if (!ok) return;
        setManualTxs(prev => prev.filter(t => String(t.id) !== String(tx.id)));
        // Reconcile in background.
        getBankTxsApi().then(fresh => {
            if (fresh.length > 0 || prevHadNothingButThis(tx)) setManualTxs(fresh);
        }).catch(() => { /* keep local */ });
        setSavedFlash(`🗑 Deleted: ${tx.description}`);
        setTimeout(() => setSavedFlash(null), 4000);
    };
    // Helper just to make the line above readable — true when the deleted row
    // was the only manual entry, so re-fetching empty is the right answer.
    const prevHadNothingButThis = (tx: any) => manualTxs.length === 1 && String(manualTxs[0].id) === String(tx.id);

    // Export Statement → PDF of currently-visible (filtered) transactions.
    const exportStatementPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Bank Statement', 14, 16);
        doc.setFontSize(10);
        const today = new Date().toLocaleDateString();
        const periodStr = (dateFrom || dateTo)
            ? `${dateFrom || 'earliest'} to ${dateTo || today}`
            : `Up to ${today}`;
        doc.text(`${getCompanyProfile().name || 'Company'}  ·  ${periodStr}`, 14, 22);
        doc.text(
            `Cash In: ${formatUsd(totalCredits)}   ·   Cash Out: ${formatUsd(totalDebits)}   ·   Net: ${formatUsd(netBalance)}`,
            14, 28,
        );
        autoTable(doc, {
            startY: 34,
            head: [['Date', 'Description', 'Reference', 'Category', 'Type', 'Amount', 'Balance']],
            body: filtered.map(tx => [
                tx.date,
                tx.description,
                tx.reference || '',
                tx.category || '',
                tx.type,
                formatUsdSigned(tx.amount, tx.type),
                formatUsd(tx.balance),
            ]),
            foot: [[
                '', '', '', '',
                'TOTAL',
                `+${formatUsd(totalCredits).replace('$', '')} / -${formatUsd(totalDebits).replace('$', '')}`,
                formatUsd(netBalance),
            ]],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [33, 33, 33] },
            footStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: 'bold' },
        });
        doc.save(`BankStatement_${new Date().toISOString().slice(0, 10)}.pdf`);
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
                {savedFlash && (
                    <div style={{ ...panelStyle, background: 'var(--color-badge-green-bg)', borderColor: 'rgba(34,197,94,.28)', color: 'var(--color-brand-green-tint)', fontSize: 12, fontWeight: 600 }}>
                        {savedFlash}
                    </div>
                )}

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-badge-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Landmark size={20} style={{ color: '#4F8EF7' }} />
                        </div>
                        <div>
                            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: '-.5px', color: 'var(--color-brand-blue)' }}>
                                Banking & Reconciliation
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginTop: 2 }}>
                                Real-time cash ledger · bank feeds · AI reconciliation · {getCompanyProfile().name}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button type="button" onClick={() => void reloadAll(true)} disabled={refreshing} style={ghostBtn}>
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button type="button" onClick={exportStatementPDF} disabled={filtered.length === 0} style={ghostBtn}>
                            <Download size={14} /> Export
                        </button>
                        <button type="button" onClick={() => { setEditingId(null); setTxForm({ date: new Date().toISOString().slice(0, 10), description: '', type: 'Credit', amount: '', reference: '', category: 'General' }); setShowAddTx(true); }} style={primaryBtn}>
                            <Plus size={14} /> Add transaction
                        </button>
                    </div>
                </div>

                {/* Unreconciled variance banner */}
                {unreconciledVariance > 0 && (
                    <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--color-badge-amber-bg)', borderColor: 'rgba(245,158,11,.35)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                            <AlertTriangle size={18} style={{ color: 'var(--color-brand-amber-tint)', flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand-amber-tint)' }}>
                                    Unreconciled variance · {formatUsd(unreconciledVariance)}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginTop: 2 }}>
                                    {pendingPDC.length} pending cheque{pendingPDC.length !== 1 ? 's' : ''} not yet cleared in the bank ledger
                                </div>
                            </div>
                        </div>
                        <button type="button" onClick={handleAiAnalysis} style={{ ...primaryBtn, background: 'linear-gradient(90deg,#7C3AED,#4F8EF7)' }}>
                            <Sparkles size={14} /> AI Analysis
                        </button>
                    </div>
                )}

                {/* Cash on Hand + Bank Balance */}
                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 10 }}>
                    {[
                        { label: 'Cash on Hand', value: cashBalance, in: cashCredits, out: cashDebits, stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)', color: 'var(--color-brand-green)', icon: DollarSign },
                        { label: 'Bank Balance', value: bankBalance, in: bankCredits, out: bankDebits, stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)', color: 'var(--color-brand-blue)', icon: Building2 },
                    ].map((c) => (
                        <div key={c.label} style={{ ...panelStyle, position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: c.stripe }} />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', fontWeight: 500 }}>{c.label}</span>
                                <c.icon size={16} style={{ color: c.color }} />
                            </div>
                            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 600, color: c.color, letterSpacing: '-.5px' }}>{formatUsd(c.value)}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>In {formatUsd(c.in)} · Out {formatUsd(c.out)}</div>
                        </div>
                    ))}
                </div>

                {/* Mini metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 10 }}>
                    {[
                        { label: 'Net Cash', value: formatUsd(netBalance), sub: 'credits minus debits', stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)', color: netBalance >= 0 ? 'var(--color-brand-blue)' : 'var(--color-brand-red)' },
                        { label: 'Total In', value: formatUsd(totalCredits), sub: `${payments.length} receipts`, stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)', color: 'var(--color-brand-green)' },
                        { label: 'Total Out', value: formatUsd(totalDebits), sub: `${supplierPayments.length} payouts`, stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)', color: 'var(--color-brand-red)' },
                        { label: 'Uncollected', value: formatUsd(outstandingAR), sub: 'outstanding AR', stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)', color: 'var(--color-brand-amber)' },
                    ].map((k) => (
                        <div key={k.label} style={{ ...panelStyle, position: 'relative', overflow: 'hidden', padding: '12px 14px' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: k.stripe }} />
                            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginBottom: 4 }}>{k.label}</div>
                            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 600, color: k.color }}>{k.value}</div>
                            <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginTop: 2 }}>{k.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Root C — Bank accounts list */}
                {bankAccounts.length > 0 && (
                    <div style={{ ...panelStyle }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 10 }}>Bank accounts</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 8 }}>
                            {bankAccounts.map(acct => (
                                <button
                                    key={acct.id}
                                    type="button"
                                    onClick={() => setSelectedBankAccountId(acct.id)}
                                    style={{
                                        textAlign: 'left',
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        cursor: 'pointer',
                                        border: selectedBankAccountId === acct.id
                                            ? '1px solid rgba(79,142,247,.45)'
                                            : '1px solid var(--color-redwood-border)',
                                        background: selectedBankAccountId === acct.id
                                            ? 'var(--color-badge-blue-bg)'
                                            : 'var(--color-redwood-row-bg)',
                                    }}
                                >
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{acct.code}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{acct.name}</div>
                                </button>
                            ))}
                        </div>
                        {selectedBankAccountId && accountLedger && (
                            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', fontSize: 11 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                    <span>Opening: <strong>{formatUsd(accountLedger.opening_balance)}</strong></span>
                                    <span>Closing: <strong style={{ color: 'var(--color-brand-blue-tint)' }}>{formatUsd(accountLedger.closing_balance)}</strong></span>
                                    {accountLedgerLoading && <span style={{ color: 'var(--color-redwood-text-muted)' }}>Loading…</span>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Main Operating Account */}
                <div style={{ ...panelStyle, background: 'linear-gradient(135deg, rgba(251,146,60,.18) 0%, rgba(245,158,11,.08) 100%)', borderColor: 'rgba(251,146,60,.35)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Building2 size={18} style={{ color: '#FB923C' }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Main Operating Account</span>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)', border: '1px solid rgba(34,197,94,.28)' }}>ACTIVE</span>
                    </div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 600, color: '#FB923C', letterSpacing: '-.5px' }}>{formatUsd(bankBalance)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', marginTop: 2 }}>Available bank balance</div>
                    <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 12, marginTop: 14 }}>
                        {[
                            { label: 'Customer receipts', value: String(payments.length) },
                            { label: 'Supplier payouts', value: String(supplierPayments.length) },
                            { label: 'Manual entries', value: String(manualTxs.length) },
                            { label: 'Ledger net', value: formatUsd(netBalance) },
                        ].map((s) => (
                            <div key={s.label} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)' }}>
                                <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginBottom: 2 }}>{s.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{s.value}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Wifi size={12} style={{ color: 'var(--color-brand-green-tint)' }} /> Synced · just now</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={12} style={{ color: 'var(--color-brand-blue-tint)' }} /> Bank feed · connected</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3" style={{ gap: 12 }}>
                    <div className="xl:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ ...panelStyle, padding: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {[{ id: 'ledger' as const, label: 'Transaction ledger' }, { id: 'pdc' as const, label: `Post dated cheques${dueTodayPDC.length > 0 ? ` (${dueTodayPDC.length} due)` : ''}` }].map((tab) => (
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
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Type</label><select value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value as 'Credit' | 'Debit' }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }}><option value="Credit">Credit</option><option value="Debit">Debit</option></select></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Amount ($)</label><input type="number" placeholder="0.00" value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Description</label><input value={txForm.description} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Reference</label><input value={txForm.reference} onChange={e => setTxForm(p => ({ ...p, reference: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Category</label><select value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }}>{(() => { const standard = ['General', 'Sales', 'Purchase', 'Salary', 'Utility', 'Rent', 'Other']; const options = txForm.category && !standard.includes(txForm.category) ? [txForm.category, ...standard] : standard; return options.map(cat => <option key={cat} value={cat}>{cat}</option>); })()}</select></div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                            <button type="button" onClick={saveManualTx} disabled={!txForm.description || !txForm.amount} style={primaryBtn}>{editingId ? 'Update' : 'Save'}</button>
                                            <button type="button" onClick={() => { setEditingId(null); setShowAddTx(false); }} style={ghostBtn}>Cancel</button>
                                        </div>
                                    </div>
                                )}

                                <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-redwood-border)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} style={{ color: '#4F8EF7' }} /> Transaction ledger</div>
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
                                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-redwood-border)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {(['all', 'Credit', 'Debit'] as const).map(f => (
                                            <button key={f} type="button" onClick={() => setFilter(f)} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: filter === f ? '1px solid rgba(79,142,247,.28)' : '1px solid var(--color-redwood-border)', background: filter === f ? 'var(--color-badge-blue-bg)' : 'transparent', color: filter === f ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)' }}>{f === 'all' ? 'All' : f}</button>
                                        ))}
                                        <span style={{ width: 1, background: 'var(--color-redwood-border)', margin: '0 4px' }} />
                                        {(['all', 'Cash', 'Bank'] as const).map(f => (
                                            <button key={`ch-${f}`} type="button" onClick={() => setChannelFilter(f)} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: channelFilter === f ? '1px solid rgba(79,142,247,.28)' : '1px solid var(--color-redwood-border)', background: channelFilter === f ? 'var(--color-badge-blue-bg)' : 'transparent', color: channelFilter === f ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)' }}>{f === 'all' ? 'All channels' : f}</button>
                                        ))}
                                    </div>
                                    {selectedBankAccountId && accountLedger ? (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead><tr style={{ background: 'var(--color-redwood-row-bg)', borderBottom: '1px solid var(--color-redwood-border)' }}>{['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                                                <tbody>
                                                    {accountLedger.rows.length === 0 ? (
                                                        <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-redwood-text-muted)' }}>No movements in this period</td></tr>
                                                    ) : accountLedger.rows.map(row => (
                                                        <tr key={row.id} style={{ borderBottom: '1px solid var(--color-redwood-border)' }}>
                                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>{row.date ? formatDateOnly(row.date) : '—'}</td>
                                                            <td style={tdStyle}>{row.type}</td>
                                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 11 }}>{row.reference || '—'}</td>
                                                            <td style={{ ...tdStyle, fontWeight: 600 }}>{row.description || '—'}</td>
                                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace' }}>{row.debit ? formatUsd(row.debit) : '—'}</td>
                                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace' }}>{row.credit ? formatUsd(row.credit) : '—'}</td>
                                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>{formatUsd(row.running_balance)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ background: 'var(--color-redwood-row-bg)', borderTop: '2px solid var(--color-redwood-border)' }}>
                                                        <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)' }}>Closing balance (API)</td>
                                                        <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'ui-monospace,monospace', color: 'var(--color-brand-blue-tint)' }}>{formatUsd(accountLedger.closing_balance)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    ) : filtered.length === 0 ? (
                                        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-redwood-text-muted)' }}>
                                            <Landmark size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                            <p style={{ fontSize: 12, fontWeight: 600 }}>No transactions found</p>
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead><tr style={{ background: 'var(--color-redwood-row-bg)', borderBottom: '1px solid var(--color-redwood-border)' }}>{['Date', 'Description', 'Reference', 'Category', 'Channel', 'Type', 'Amount', 'Balance', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                                                <tbody>
                                                    {filtered.slice(0, 50).map(tx => (
                                                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-redwood-border)' }}>
                                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>{tx.date}</td>
                                                            <td style={{ ...tdStyle, fontWeight: 600 }}>{tx.description}</td>
                                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 11, color: 'var(--color-brand-blue-tint)' }}>{tx.reference}</td>
                                                            <td style={tdStyle}><span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)' }}>{tx.category}</span></td>
                                                            <td style={tdStyle}><span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: tx.channel === 'Cash' ? 'var(--color-badge-green-bg)' : 'var(--color-badge-blue-bg)', color: tx.channel === 'Cash' ? 'var(--color-brand-green-tint)' : 'var(--color-brand-blue-tint)' }}>{tx.channel}</span></td>
                                                            <td style={tdStyle}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: tx.type === 'Credit' ? 'var(--color-brand-green-tint)' : 'var(--color-brand-red-tint)' }}>{tx.type === 'Credit' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{tx.type}</span></td>
                                                            <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'ui-monospace,monospace', color: tx.type === 'Credit' ? 'var(--color-brand-green-tint)' : 'var(--color-brand-red-tint)' }}>{formatUsdSigned(tx.amount, tx.type)}</td>
                                                            <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'ui-monospace,monospace' }}>{formatUsd(tx.balance)}</td>
                                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                                {(tx as { isManual?: boolean }).isManual ? (
                                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                                                                        <button type="button" onClick={() => editManualTx(tx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-brand-blue-tint)', padding: 4 }} title="Edit"><Edit2 size={13} /></button>
                                                                        <button type="button" onClick={() => deleteManualTx(tx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-brand-red-tint)', padding: 4 }} title="Delete"><Trash2 size={13} /></button>
                                                                    </div>
                                                                ) : tx.id.startsWith('PAY-') ? (() => {
                                                                    const paymentId = tx.id.replace(/^PAY-/, '');
                                                                    const original = payments.find(p => String(p.id) === paymentId);
                                                                    if (original?.transaction_type === 'expense') {
                                                                        return <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>auto</span>;
                                                                    }
                                                                    const isReversal = original?.reference?.startsWith('VOID/') || (original?.amount ?? 0) < 0;
                                                                    if (isReversal) return <span style={{ fontSize: 9, color: 'var(--color-brand-red-tint)', fontWeight: 600 }}>Reversal</span>;
                                                                    return <button type="button" onClick={() => handleVoidPayment(paymentId)} disabled={voidingId === paymentId} style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-brand-red-tint)', background: 'transparent', border: 'none', cursor: 'pointer' }}>{voidingId === paymentId ? 'Voiding…' : 'Void'}</button>;
                                                                })() : <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>auto</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ background: 'var(--color-redwood-row-bg)', borderTop: '2px solid var(--color-redwood-border)' }}>
                                                        <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)' }}>Closing balance</td>
                                                        <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'ui-monospace,monospace' }}>{formatUsd(totalCredits)} in / {formatUsd(totalDebits)} out</td>
                                                        <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'ui-monospace,monospace', color: 'var(--color-brand-blue-tint)' }}>{formatUsd(closingBalance)}</td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            </table>
                                            {filtered.length > 50 && <div style={{ padding: 12, textAlign: 'center', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Showing 50 of {filtered.length}</div>}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {activeTab === 'pdc' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {dueTodayPDC.length > 0 && <div style={{ ...panelStyle, background: 'var(--color-badge-amber-bg)', borderColor: 'rgba(245,158,11,.35)', fontSize: 12, color: 'var(--color-brand-amber-tint)' }}>⚠ {dueTodayPDC.length} cheque(s) due today or overdue</div>}
                                <div style={{ ...panelStyle, fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>PDC cheques affect balances only when status is <strong style={{ color: 'var(--color-redwood-text-main)' }}>Cleared</strong>.</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>{pdcList.length} recorded</span><button type="button" onClick={() => setShowPDCForm(!showPDCForm)} style={primaryBtn}><Plus size={14} /> Record cheque</button></div>
                                {showPDCForm && (
                                    <div style={{ ...panelStyle, borderColor: 'rgba(251,146,60,.4)' }}>
                                        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 10 }}>
                                            {[{ key: 'chequeNo', label: 'Cheque no.' }, { key: 'bankName', label: 'Bank' }, { key: 'payee', label: 'Payee' }, { key: 'description', label: 'Description' }].map(field => (
                                                <div key={field.key}><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>{field.label}</label><input value={(pdcForm as Record<string, string>)[field.key]} onChange={e => setPdcForm(p => ({ ...p, [field.key]: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            ))}
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Date</label><input type="date" value={pdcForm.date} onChange={e => setPdcForm(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Amount ($)</label><input type="number" value={pdcForm.amount} onChange={e => setPdcForm(p => ({ ...p, amount: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }} /></div>
                                            <div><label style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Type</label><select value={pdcForm.type} onChange={e => setPdcForm(p => ({ ...p, type: e.target.value as PDCheque['type'] }))} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }}><option value="Received">Received</option><option value="Issued">Issued</option></select></div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button type="button" onClick={savePDCEntry} style={primaryBtn}>Save</button><button type="button" onClick={() => setShowPDCForm(false)} style={ghostBtn}>Cancel</button></div>
                                    </div>
                                )}
                                <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                                    {pdcList.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 12 }}>No post dated cheques</div> : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead><tr style={{ background: 'var(--color-redwood-row-bg)' }}>{['Cheque', 'Bank', 'Payee', 'Date', 'Amount', 'Type', 'Status', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                                            <tbody>{pdcList.map(pdc => { const isOverdue = pdc.date <= today && pdc.status === 'Pending'; const isFuture = pdc.date > today; return (
                                                <tr key={pdc.id} style={{ borderBottom: '1px solid var(--color-redwood-border)', background: isOverdue ? 'var(--color-badge-amber-bg)' : undefined }}>
                                                    <td style={{ ...tdStyle, fontWeight: 700 }}>{pdc.chequeNo}</td><td style={tdStyle}>{pdc.bankName || '—'}</td><td style={tdStyle}>{pdc.payee || '—'}</td>
                                                    <td style={tdStyle}>{pdc.date}{isOverdue && <span style={{ marginLeft: 4, fontSize: 8, color: 'var(--color-brand-red-tint)' }}> OVERDUE</span>}{isFuture && <span style={{ marginLeft: 4, fontSize: 8, color: 'var(--color-brand-blue-tint)' }}> FUTURE</span>}</td>
                                                    <td style={{ ...tdStyle, fontWeight: 700, color: pdc.type === 'Received' ? 'var(--color-brand-green-tint)' : 'var(--color-brand-red-tint)' }}>{pdc.type === 'Received' ? '+' : '-'}{formatUsd(pdc.amount)}</td>
                                                    <td style={tdStyle}>{pdc.type}</td><td style={tdStyle}>{pdc.status}</td>
                                                    <td style={tdStyle}>{pdc.status === 'Pending' && <div style={{ display: 'flex', gap: 4 }}><button type="button" onClick={() => updatePDCStatus(pdc.id, 'Cleared')} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 6, border: 'none', background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)', cursor: 'pointer' }}>Clear</button><button type="button" onClick={() => updatePDCStatus(pdc.id, 'Bounced')} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 6, border: 'none', background: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red-tint)', cursor: 'pointer' }}>Bounce</button><button type="button" onClick={() => updatePDCStatus(pdc.id, 'Cancelled')} style={ghostBtn}>Cancel</button></div>}</td>
                                                </tr>); })}</tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ ...panelStyle, background: 'rgba(124,58,237,.08)', borderColor: 'rgba(124,58,237,.28)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ fontSize: 12, fontWeight: 600, color: '#C4B5FD', display: 'flex', alignItems: 'center', gap: 6 }}><Bot size={16} /> Reconciliation</span></div>
                            {reconciliationMatches.length === 0 ? <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>No matches to review</p> : reconciliationMatches.map(m => (
                                <div key={m.id} style={{ padding: 10, borderRadius: 8, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{formatUsd(m.amount)}</span><span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-redwood-text-muted)' }}>Match score {m.pct}%</span></div>
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Book: {m.book}</div>
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)' }}>Bank: {m.bank}</div>
                                </div>
                            ))}
                        </div>
                        <div style={panelStyle}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><ShieldAlert size={16} style={{ color: 'var(--color-brand-amber-tint)' }} /> AI Anomaly Detector</div>
                            {anomalies.length === 0 ? <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>No anomalies detected</p> : anomalies.map(a => (
                                <div key={a.id} style={{ padding: 10, borderRadius: 8, marginBottom: 8, border: `1px solid ${a.severity === 'high' ? 'rgba(239,68,68,.25)' : 'rgba(245,158,11,.28)'}`, background: a.severity === 'high' ? 'var(--color-badge-red-bg)' : 'var(--color-badge-amber-bg)' }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: a.severity === 'high' ? 'var(--color-brand-red-tint)' : 'var(--color-brand-amber-tint)' }}>{a.title}</div>
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginTop: 2 }}>{a.detail}</div>
                                </div>
                            ))}
                        </div>
                        <div style={panelStyle}>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--color-redwood-text-main)' }}>Expense Monitor</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', background: `conic-gradient(var(--color-brand-green) ${(expenseHealthScore ?? 0) * 3.6}deg, var(--color-redwood-row-bg) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-redwood-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: expenseHealthScore == null ? 'var(--color-redwood-text-muted)' : expenseHealthScore >= 75 ? 'var(--color-brand-green-tint)' : 'var(--color-brand-amber-tint)' }}>{expenseHealthScore == null ? '—' : `${expenseHealthScore}%`}</div>
                                </div>
                                <div><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Approval rate</div><div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{expenseDataUnavailable ? 'Data unavailable' : 'This month · USD'}</div></div>
                            </div>
                            {expenseByCategory.length === 0 ? <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>No expenses this month</p> : expenseByCategory.map(([cat, amt]) => {
                                const max = expenseByCategory[0]?.[1] || 1;
                                return (<div key={cat} style={{ marginBottom: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}><span style={{ color: 'var(--color-redwood-text-muted)' }}>{cat}</span><span style={{ fontWeight: 600 }}>{formatUsd(amt)}</span></div><div style={{ height: 4, borderRadius: 4, background: 'var(--color-redwood-row-bg)' }}><div style={{ height: 4, borderRadius: 4, width: `${Math.round((amt / max) * 100)}%`, background: 'linear-gradient(90deg,#4F8EF7,#93C5FD)' }} /></div></div>);
                            })}
                        </div>
                    </div>
                </div>

                <div style={{ ...panelStyle, padding: 6 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10, padding: '0 4px' }}>
                        {[
                            { id: 'ask-ai' as const, label: 'Ask AI', icon: Sparkles },
                            { id: 'connect' as const, label: 'Connect your bank', icon: Link2 },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setBottomSectionTab(tab.id)}
                                style={{
                                    padding: '7px 14px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: bottomSectionTab === tab.id ? 'var(--color-badge-blue-bg)' : 'transparent',
                                    color: bottomSectionTab === tab.id ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)',
                                    border: bottomSectionTab === tab.id ? '1px solid rgba(79,142,247,.28)' : '1px solid transparent',
                                }}
                            >
                                <tab.icon size={13} /> {tab.label}
                            </button>
                        ))}
                    </div>

                    {bottomSectionTab === 'ask-ai' && (
                        <div style={{ padding: '8px 10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7C3AED,#4F8EF7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Brain size={16} style={{ color: '#fff' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Ask AI about your banking</div>
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Reconciliation, variance, cash position, and anomalies</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                {[
                                    'Why is there an unreconciled variance?',
                                    'Explain my cash position',
                                    'Which transactions need review?',
                                    'Show reconciliation matches',
                                ].map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        onClick={() => { setAiQuestion(prompt); void askBankingAI(prompt); }}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: 20,
                                            fontSize: 10,
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            border: '1px solid rgba(124,58,237,.28)',
                                            background: 'rgba(124,58,237,.08)',
                                            color: '#C4B5FD',
                                        }}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginBottom: aiResponse ? 12 : 0 }}>
                                <input
                                    type="text"
                                    value={aiQuestion}
                                    onChange={(e) => setAiQuestion(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') void askBankingAI(aiQuestion); }}
                                    placeholder="Ask about variance, cash flow, duplicates, or reconciliation…"
                                    style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid var(--color-redwood-border)',
                                        background: 'var(--color-redwood-row-bg)',
                                        color: 'var(--color-redwood-text-main)',
                                        fontSize: 12,
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => void askBankingAI(aiQuestion)}
                                    disabled={aiThinking || !aiQuestion.trim()}
                                    style={{
                                        ...primaryBtn,
                                        padding: '10px 16px',
                                        background: 'linear-gradient(90deg,#7C3AED,#4F8EF7)',
                                        opacity: aiThinking || !aiQuestion.trim() ? 0.5 : 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}
                                >
                                    {aiThinking ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    {aiThinking ? 'Thinking…' : 'Ask AI'}
                                </button>
                            </div>

                            {aiResponse && (
                                <div style={{
                                    padding: '14px 16px',
                                    borderRadius: 12,
                                    border: '1px solid rgba(124,58,237,.28)',
                                    background: 'rgba(124,58,237,.08)',
                                }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: '#C4B5FD', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Bot size={14} /> AI Response
                                    </div>
                                    <p style={{ fontSize: 12, color: 'var(--color-redwood-text-main)', lineHeight: 1.55, whiteSpace: 'pre-line', margin: 0 }}>{aiResponse}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {bottomSectionTab === 'connect' && (
                        <div style={{ padding: '8px 10px 12px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Link2 size={16} style={{ color: '#4F8EF7' }} /> Connect your bank account
                            </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {[{ name: 'Chase', color: '#117ACA' }, { name: 'Bank of America', color: '#E31837' }, { name: 'Wells Fargo', color: '#FFCD00' }, { name: 'Citi', color: '#056DAE' }].map(b => (
                            <div key={b.name} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>{b.name.slice(0, 2).toUpperCase()}</div>
                                <span style={{ fontSize: 11, fontWeight: 600 }}>{b.name}</span>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 10 }}>
                        {[{ label: 'Import CSV statement', icon: FileSpreadsheet, ext: '.csv' }, { label: 'Import QFX / OFX / QBO', icon: FileText, ext: 'bank feeds' }, { label: 'Import PDF bank statement', icon: FileText, ext: '.pdf' }, { label: 'Connect bank', icon: Link2, ext: 'OAuth' }].map(card => (
                            <button key={card.label} type="button" onClick={() => alert(`${card.label} — connect your bank feed or drop a ${card.ext} file.`)} style={{ ...panelStyle, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', background: 'var(--color-redwood-row-bg)' }}>
                                <card.icon size={20} style={{ color: '#4F8EF7', marginBottom: 8 }} />
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{card.label}</div>
                                <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>{card.ext}</div>
                                <div style={{ fontSize: 9, color: 'var(--color-brand-blue-tint)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Upload size={10} /> Import</div>
                            </button>
                        ))}
                    </div>
                            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-redwood-border)' }}>
                                <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', lineHeight: 1.6 }}>
                                    1. Bank transactions imported automatically · 2. Matched / marked / flagged for your review · 3. Approve matches to reconcile your ledger
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
