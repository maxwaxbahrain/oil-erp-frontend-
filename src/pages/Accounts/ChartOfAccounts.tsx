import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RefreshCw,
    Search,
    BookOpen,
    CheckCircle2,
    XCircle,
    Scale,
    ExternalLink,
} from 'lucide-react';
import {
    getGLAccounts,
    getGLTrialBalance,
    todayISO,
    type GLAccount,
    type GLTrialBalance,
    type GLTrialBalanceRow,
} from '../../services/glService';

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
export type AccountNature = 'Debit' | 'Credit';

export interface Account {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    nature: AccountNature;
    parentId: string | null;
    description: string;
    isSystem: boolean;
    balance: number;
    openingBalance?: number;
    children?: Account[];
}

const COA_KEY = 'chart_of_accounts';

export const DEFAULT_ACCOUNTS: Account[] = [
    { id: '1000', code: '1000', name: 'Assets', type: 'Asset', nature: 'Debit', parentId: null, description: 'All assets', isSystem: true, balance: 0 },
    { id: '1100', code: '1100', name: 'Current Assets', type: 'Asset', nature: 'Debit', parentId: '1000', description: 'Short-term assets', isSystem: true, balance: 0 },
    { id: '1110', code: '1110', name: 'Cash & Bank', type: 'Asset', nature: 'Debit', parentId: '1100', description: 'Cash in hand and bank accounts', isSystem: true, balance: 0 },
    { id: '1120', code: '1120', name: 'Accounts Receivable', type: 'Asset', nature: 'Debit', parentId: '1100', description: 'Money owed by customers', isSystem: true, balance: 0 },
    { id: '1130', code: '1130', name: 'Inventory', type: 'Asset', nature: 'Debit', parentId: '1100', description: 'Stock of goods', isSystem: true, balance: 0 },
    { id: '1140', code: '1140', name: 'Advance Payments', type: 'Asset', nature: 'Debit', parentId: '1100', description: 'Prepaid expenses', isSystem: false, balance: 0 },
    { id: '1200', code: '1200', name: 'Fixed Assets', type: 'Asset', nature: 'Debit', parentId: '1000', description: 'Long-term assets', isSystem: true, balance: 0 },
    { id: '1210', code: '1210', name: 'Vehicles & Equipment', type: 'Asset', nature: 'Debit', parentId: '1200', description: 'Delivery vans, machinery', isSystem: false, balance: 0 },
    { id: '1220', code: '1220', name: 'Furniture & Fixtures', type: 'Asset', nature: 'Debit', parentId: '1200', description: 'Office furniture', isSystem: false, balance: 0 },
    { id: '2000', code: '2000', name: 'Liabilities', type: 'Liability', nature: 'Credit', parentId: null, description: 'All liabilities', isSystem: true, balance: 0 },
    { id: '2100', code: '2100', name: 'Current Liabilities', type: 'Liability', nature: 'Credit', parentId: '2000', description: 'Short-term liabilities', isSystem: true, balance: 0 },
    { id: '2110', code: '2110', name: 'Accounts Payable', type: 'Liability', nature: 'Credit', parentId: '2100', description: 'Money owed to suppliers', isSystem: true, balance: 0 },
    { id: '2120', code: '2120', name: 'Sales Tax Payable', type: 'Liability', nature: 'Credit', parentId: '2100', description: 'Tax collected from customers', isSystem: false, balance: 0 },
    { id: '2130', code: '2130', name: 'Accrued Expenses', type: 'Liability', nature: 'Credit', parentId: '2100', description: 'Expenses incurred but not yet paid', isSystem: false, balance: 0 },
    { id: '2200', code: '2200', name: 'Long-term Liabilities', type: 'Liability', nature: 'Credit', parentId: '2000', description: 'Long-term debts', isSystem: true, balance: 0 },
    { id: '2210', code: '2210', name: 'Bank Loans', type: 'Liability', nature: 'Credit', parentId: '2200', description: 'Long-term bank financing', isSystem: false, balance: 0 },
    { id: '3000', code: '3000', name: 'Equity', type: 'Equity', nature: 'Credit', parentId: null, description: "Owner's equity", isSystem: true, balance: 0 },
    { id: '3100', code: '3100', name: "Owner's Capital", type: 'Equity', nature: 'Credit', parentId: '3000', description: 'Capital invested by owner', isSystem: true, balance: 0 },
    { id: '3200', code: '3200', name: 'Retained Earnings', type: 'Equity', nature: 'Credit', parentId: '3000', description: 'Accumulated profits', isSystem: true, balance: 0 },
    { id: '3300', code: '3300', name: 'Drawings', type: 'Equity', nature: 'Debit', parentId: '3000', description: 'Owner withdrawals', isSystem: false, balance: 0 },
    { id: '4000', code: '4000', name: 'Income', type: 'Income', nature: 'Credit', parentId: null, description: 'All income', isSystem: true, balance: 0 },
    { id: '4100', code: '4100', name: 'Sales Revenue', type: 'Income', nature: 'Credit', parentId: '4000', description: 'Revenue from product sales', isSystem: true, balance: 0 },
    { id: '4110', code: '4110', name: 'Oil & Lubricant Sales', type: 'Income', nature: 'Credit', parentId: '4100', description: 'Revenue from oil products', isSystem: false, balance: 0 },
    { id: '4120', code: '4120', name: 'Service Revenue', type: 'Income', nature: 'Credit', parentId: '4100', description: 'Delivery and cargo charges', isSystem: false, balance: 0 },
    { id: '4200', code: '4200', name: 'Other Income', type: 'Income', nature: 'Credit', parentId: '4000', description: 'Non-operating income', isSystem: false, balance: 0 },
    { id: '5000', code: '5000', name: 'Expenses', type: 'Expense', nature: 'Debit', parentId: null, description: 'All expenses', isSystem: true, balance: 0 },
    { id: '5100', code: '5100', name: 'Cost of Goods Sold', type: 'Expense', nature: 'Debit', parentId: '5000', description: 'Direct cost of products sold', isSystem: true, balance: 0 },
    { id: '5110', code: '5110', name: 'Purchases', type: 'Expense', nature: 'Debit', parentId: '5100', description: 'Cost of inventory purchased', isSystem: true, balance: 0 },
    { id: '5200', code: '5200', name: 'Operating Expenses', type: 'Expense', nature: 'Debit', parentId: '5000', description: 'Day-to-day expenses', isSystem: true, balance: 0 },
    { id: '5210', code: '5210', name: 'Salaries & Wages', type: 'Expense', nature: 'Debit', parentId: '5200', description: 'Employee salaries', isSystem: false, balance: 0 },
    { id: '5220', code: '5220', name: 'Rent & Utilities', type: 'Expense', nature: 'Debit', parentId: '5200', description: 'Office and warehouse rent', isSystem: false, balance: 0 },
    { id: '5230', code: '5230', name: 'Fuel & Vehicle Expenses', type: 'Expense', nature: 'Debit', parentId: '5200', description: 'Van fuel and maintenance', isSystem: false, balance: 0 },
    { id: '5240', code: '5240', name: 'Marketing & Advertising', type: 'Expense', nature: 'Debit', parentId: '5200', description: 'Promotional expenses', isSystem: false, balance: 0 },
    { id: '5250', code: '5250', name: 'Bad Debts', type: 'Expense', nature: 'Debit', parentId: '5200', description: 'Uncollectible receivables written off', isSystem: false, balance: 0 },
    { id: '5260', code: '5260', name: 'Bank Charges', type: 'Expense', nature: 'Debit', parentId: '5200', description: 'Bank fees and charges', isSystem: false, balance: 0 },
    { id: '5270', code: '5270', name: 'Depreciation', type: 'Expense', nature: 'Debit', parentId: '5200', description: 'Asset depreciation', isSystem: false, balance: 0 },
];

const saveAccounts = (accounts: Account[]) => {
    localStorage.setItem(COA_KEY, JSON.stringify(accounts));
};

export const getAccounts = (): Account[] => {
    try {
        const stored = localStorage.getItem(COA_KEY);
        if (stored) return JSON.parse(stored);
        saveAccounts(DEFAULT_ACCOUNTS);
        return DEFAULT_ACCOUNTS;
    } catch { return DEFAULT_ACCOUNTS; }
};

// ─── UI tokens (dark redwood — match AccountsDashboard / Banking) ───
const panel: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '10px',
    padding: '10px 12px',
};

const ghostBtn: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    borderRadius: '6px',
    fontSize: '9.5px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--color-redwood-border)',
    background: 'rgba(255,255,255,.04)',
    color: 'var(--color-redwood-text-muted)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
};

const thStyle: CSSProperties = {
    padding: '8px 10px',
    fontSize: 8.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: 'var(--color-redwood-text-muted)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--color-redwood-border)',
    textAlign: 'left',
};

const tdStyle: CSSProperties = {
    padding: '8px 10px',
    fontSize: 11,
    color: 'var(--color-redwood-text-main)',
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

const selectStyle: CSSProperties = {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--color-redwood-border)',
    background: 'rgba(255,255,255,.04)',
    color: 'var(--color-redwood-text-main)',
    fontSize: 10,
    fontFamily: 'inherit',
    cursor: 'pointer',
};

function glTypeToCategory(type: string): string {
    switch ((type || '').toLowerCase()) {
        case 'asset': return 'Assets';
        case 'liability': return 'Liabilities';
        case 'equity': return 'Equity';
        case 'revenue': return 'Income';
        case 'expense': return 'Expenses';
        default: return type || 'Other';
    }
}

const CATEGORY_ORDER = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses', 'Other'] as const;

const GROUP_CFG: Record<string, { label: string; stripe: string; color: string; badgeBg: string }> = {
    Assets: { label: 'ASSETS', stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)', color: '#4F8EF7', badgeBg: 'var(--color-badge-blue-bg)' },
    Liabilities: { label: 'LIABILITIES', stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)', color: '#EF4444', badgeBg: 'var(--color-badge-red-bg)' },
    Equity: { label: 'EQUITY', stripe: 'linear-gradient(90deg,#7C3AED,#C4B5FD)', color: '#A78BFA', badgeBg: 'rgba(124,58,237,.12)' },
    Income: { label: 'INCOME', stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)', color: '#22C55E', badgeBg: 'var(--color-badge-green-bg)' },
    Expenses: { label: 'EXPENSES', stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)', color: '#F59E0B', badgeBg: 'var(--color-badge-amber-bg)' },
    Other: { label: 'OTHER', stripe: 'linear-gradient(90deg,#6B7280,#9CA3AF)', color: '#9CA3AF', badgeBg: 'rgba(107,114,128,.12)' },
};

function formatUsd(n: number, decimals = 2): string {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

interface CoaRow {
    account: GLAccount;
    debit: number;
    credit: number;
    balance: number;
    category: string;
}

function joinAccountsWithTb(accounts: GLAccount[], tbRows: GLTrialBalanceRow[]): CoaRow[] {
    const tbMap = new Map<number, GLTrialBalanceRow>();
    tbRows.forEach(row => tbMap.set(row.account_id, row));

    return accounts.map(account => {
        const tb = tbMap.get(account.id);
        return {
            account,
            debit: tb?.debit ?? 0,
            credit: tb?.credit ?? 0,
            balance: tb?.balance ?? 0,
            category: glTypeToCategory(account.type),
        };
    });
}

export default function ChartOfAccounts() {
    const navigate = useNavigate();
    const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
    const [trialBalance, setTrialBalance] = useState<GLTrialBalance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('All');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

    const loadGl = useCallback(async () => {
        setLoading(true);
        setError(null);
        const asOf = todayISO();
        try {
            const [accounts, tb] = await Promise.all([
                getGLAccounts(),
                getGLTrialBalance(asOf),
            ]);
            setGlAccounts(accounts);
            setTrialBalance(tb);
        } catch (err) {
            setGlAccounts([]);
            setTrialBalance(null);
            setError(err instanceof Error ? err.message : 'Failed to load chart of accounts from the general ledger.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadGl();
    }, [loadGl]);

    const joinedRows = useMemo(
        () => joinAccountsWithTb(glAccounts, trialBalance?.accounts ?? []),
        [glAccounts, trialBalance],
    );

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return joinedRows.filter(row => {
            const matchSearch = !q
                || row.account.name.toLowerCase().includes(q)
                || row.account.code.toLowerCase().includes(q)
                || (row.account.system_key || '').toLowerCase().includes(q);
            const matchCategory = categoryFilter === 'All' || row.category === categoryFilter;
            const matchStatus =
                statusFilter === 'All'
                || (statusFilter === 'Active' && row.account.is_active)
                || (statusFilter === 'Inactive' && !row.account.is_active);
            return matchSearch && matchCategory && matchStatus;
        });
    }, [joinedRows, search, categoryFilter, statusFilter]);

    const groupedRows = useMemo(() => {
        const groups = new Map<string, CoaRow[]>();
        filteredRows.forEach(row => {
            const list = groups.get(row.category) || [];
            list.push(row);
            groups.set(row.category, list);
        });
        for (const list of groups.values()) {
            list.sort((a, b) => a.account.code.localeCompare(b.account.code));
        }
        const ordered: { category: string; rows: CoaRow[] }[] = [];
        for (const cat of CATEGORY_ORDER) {
            const rows = groups.get(cat);
            if (rows && rows.length > 0) ordered.push({ category: cat, rows });
        }
        for (const [cat, rows] of groups) {
            if (!CATEGORY_ORDER.includes(cat as typeof CATEGORY_ORDER[number])) {
                ordered.push({ category: cat, rows });
            }
        }
        return ordered;
    }, [filteredRows]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        joinedRows.forEach(row => {
            counts[row.category] = (counts[row.category] || 0) + 1;
        });
        return counts;
    }, [joinedRows]);

    const totalDebit = trialBalance?.total_debit ?? 0;
    const totalCredit = trialBalance?.total_credit ?? 0;
    const isBalanced = trialBalance?.is_balanced ?? false;
    const asOfLabel = trialBalance?.as_of ?? todayISO();

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 40, maxWidth: 1280, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(79,142,247,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={18} style={{ color: '#4F8EF7' }} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>
                            Chart of accounts
                        </h1>
                        <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            General ledger accounts · trial balance as of {asOfLabel}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => navigate('/reports/trial-balance')} style={ghostBtn}>
                        <Scale size={12} /> Trial balance
                    </button>
                    <button type="button" onClick={() => void loadGl()} disabled={loading} style={ghostBtn}>
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{ ...panel, background: 'rgba(239,68,68,.08)', borderColor: 'rgba(239,68,68,.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <XCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#FCA5A5', margin: 0 }}>{error}</p>
                </div>
            )}

            {/* Balance status */}
            {!loading && !error && trialBalance && (
                <div style={{
                    ...panel,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: isBalanced ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)',
                    borderColor: isBalanced ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)',
                }}>
                    {isBalanced
                        ? <CheckCircle2 size={16} style={{ color: '#86EFAC' }} />
                        : <XCircle size={16} style={{ color: '#FCA5A5' }} />}
                    <p style={{ fontSize: 10, fontWeight: 600, color: isBalanced ? '#86EFAC' : '#FCA5A5', margin: 0 }}>
                        {isBalanced
                            ? `Trial balance balanced — Total Debits = Total Credits (${formatUsd(totalDebit)})`
                            : `Trial balance imbalanced — Difference: ${formatUsd(Math.abs(totalDebit - totalCredit))}`}
                    </p>
                </div>
            )}

            {/* Category summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
                {CATEGORY_ORDER.map(cat => {
                    const cfg = GROUP_CFG[cat];
                    const count = categoryCounts[cat] || 0;
                    const active = categoryFilter === cat;
                    if (count === 0 && categoryFilter !== cat) return null;
                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setCategoryFilter(active ? 'All' : cat)}
                            style={{
                                background: 'var(--color-redwood-bg-surface)',
                                border: active ? `1px solid ${cfg.color}` : '1px solid var(--color-redwood-border)',
                                borderRadius: 10,
                                padding: '10px 12px',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontFamily: 'inherit',
                            }}
                        >
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: cfg.stripe, borderRadius: '10px 10px 0 0' }} />
                            <div style={{ fontSize: 8, fontWeight: 700, color: cfg.color, letterSpacing: '.5px', marginBottom: 4 }}>
                                {cfg.label}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>
                                {loading ? '…' : count}
                            </div>
                            <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginTop: 2 }}>
                                {count === 1 ? 'account' : 'accounts'}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Search & filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-subtle)' }} />
                    <input
                        type="text"
                        placeholder="Search by name, code, or system key..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ ...selectStyle, width: '100%', paddingLeft: 32, fontSize: 11 }}
                    />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={selectStyle}>
                    <option value="All">All categories</option>
                    {CATEGORY_ORDER.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')} style={selectStyle}>
                    <option value="All">All statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </select>
            </div>

            {/* Main table — grouped by category */}
            <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 11 }}>
                        Loading general ledger chart of accounts…
                    </div>
                ) : error ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#FCA5A5', fontSize: 11 }}>
                        Could not load chart of accounts.
                    </div>
                ) : groupedRows.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 11 }}>
                        No accounts match your filters
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        {groupedRows.map(({ category, rows }) => {
                            const cfg = GROUP_CFG[category] || GROUP_CFG.Other;
                            return (
                                <div key={category}>
                                    <div style={{
                                        padding: '8px 12px',
                                        background: 'rgba(255,255,255,.03)',
                                        borderBottom: '1px solid var(--color-redwood-border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}>
                                        <span style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: 999,
                                            background: cfg.badgeBg,
                                            color: cfg.color,
                                            textTransform: 'uppercase',
                                        }}>
                                            {category}
                                        </span>
                                        <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>
                                            {rows.length} account{rows.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                                                {['Code', 'Name', 'Type', 'Normal balance', 'Debit', 'Credit', 'Balance'].map((h, i) => (
                                                    <th
                                                        key={h}
                                                        style={{
                                                            ...thStyle,
                                                            textAlign: i >= 4 ? 'right' : 'left',
                                                        }}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map(row => (
                                                <tr
                                                    key={row.account.id}
                                                    style={{ transition: 'background .15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-redwood-row-hover)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                                        {row.account.code}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span style={{ fontWeight: 600, fontSize: 11 }}>{row.account.name}</span>
                                                        {row.account.system_key && (
                                                            <span style={{ display: 'block', fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginTop: 2, fontFamily: 'ui-monospace,monospace' }}>
                                                                {row.account.system_key}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                                        {row.account.type}
                                                    </td>
                                                    <td style={{ ...tdStyle, fontSize: 10, fontWeight: 600, color: row.account.normal_balance?.toLowerCase() === 'debit' ? '#93C5FD' : '#86EFAC' }}>
                                                        {row.account.normal_balance}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 600 }}>
                                                        {(row.debit || 0) > 0 ? formatUsd(row.debit) : '—'}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 600 }}>
                                                        {(row.credit || 0) > 0 ? formatUsd(row.credit) : '—'}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 600, color: row.balance >= 0 ? 'var(--color-redwood-text-main)' : '#FCA5A5' }}>
                                                        {Math.abs(row.balance) < 0.01 ? '—' : formatUsd(row.balance)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Trial Balance footer — verbatim GL totals */}
            <div style={panel}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                        Trial balance totals — as of {asOfLabel}
                    </div>
                    <button type="button" onClick={() => navigate('/reports/trial-balance')} style={{ ...ghostBtn, fontSize: 9 }}>
                        <ExternalLink size={11} /> Full trial balance report
                    </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['', 'Debit', 'Credit'].map((h, i) => (
                                    <th key={h || 'label'} style={{ ...thStyle, textAlign: i === 0 ? 'left' : 'right' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                                <td style={{ ...tdStyle, fontWeight: 700, fontSize: 10 }}>GRAND TOTAL</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, fontSize: 11 }}>
                                    {loading ? '…' : formatUsd(totalDebit)}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, fontSize: 11 }}>
                                    {loading ? '…' : formatUsd(totalCredit)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: 8, fontSize: 9.5, color: isBalanced ? '#86EFAC' : '#FCA5A5', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isBalanced && <CheckCircle2 size={12} />}
                    Total Debits = Total Credits · Trial balance {isBalanced ? 'balanced' : 'imbalanced'}
                </div>
            </div>
        </div>
    );
}
