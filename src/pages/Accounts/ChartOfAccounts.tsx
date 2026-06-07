import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Edit2,
    Trash2,
    ChevronRight,
    ChevronDown,
    Check,
    X,
    RefreshCw,
    Search,
    Bot,
    Link2,
    Sparkles,
    BookOpen,
    CheckCircle2,
    ChevronRight as ChevRight,
} from 'lucide-react';
import { getCustomers, getInvoices, getPayments } from '../../services/api';
import { getSuppliers, getSupplierBalance, getSupplierPurchases } from '../../services/purchasesService';
import { authFetch } from '../../api/axios';
import { getJournalVouchers } from './JournalVoucher';
import { useEscape } from '../../hooks/useEscape';

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

export const getAccounts = (): Account[] => {
    try {
        const stored = localStorage.getItem(COA_KEY);
        if (stored) return JSON.parse(stored);
        localStorage.setItem(COA_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
        return DEFAULT_ACCOUNTS;
    } catch { return DEFAULT_ACCOUNTS; }
};

const saveAccounts = (accounts: Account[]) => {
    localStorage.setItem(COA_KEY, JSON.stringify(accounts));
};

function buildTree(accounts: Account[]): Account[] {
    const map: Record<string, Account> = {};
    accounts.forEach(a => map[a.id] = { ...a, children: [] });
    const roots: Account[] = [];
    accounts.forEach(a => {
        if (a.parentId && map[a.parentId]) {
            map[a.parentId].children!.push(map[a.id]);
        } else if (!a.parentId) {
            roots.push(map[a.id]);
        }
    });
    return roots;
}

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
};

const tdStyle: CSSProperties = {
    padding: '8px 10px',
    fontSize: 11,
    color: 'var(--color-redwood-text-main)',
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

type PeriodKey = 'mtd' | 'qtd' | 'ytd' | 'fy2023' | 'all' | 'custom';

const PERIOD_PILLS: { key: PeriodKey; label: string }[] = [
    { key: 'mtd', label: 'MTD May 2024' },
    { key: 'qtd', label: 'QTD Q2 2024' },
    { key: 'ytd', label: 'YTD 2024' },
    { key: 'fy2023', label: 'FY 2023' },
    { key: 'all', label: 'All time' },
    { key: 'custom', label: 'Custom' },
];

const PERIOD_RANGE: Record<PeriodKey, string> = {
    mtd: 'May 1 – May 31, 2024',
    qtd: 'Apr 1 – Jun 30, 2024',
    ytd: 'Jan 1 – Dec 31, 2024',
    fy2023: 'Jan 1 – Dec 31, 2023',
    all: 'All periods',
    custom: 'May 1 – May 31, 2024',
};

const TYPE_CFG: Record<AccountType, { label: string; stripe: string; color: string; badgeBg: string }> = {
    Asset: { label: 'ASSET', stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)', color: '#4F8EF7', badgeBg: 'var(--color-badge-blue-bg)' },
    Liability: { label: 'LIABILITY', stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)', color: '#EF4444', badgeBg: 'var(--color-badge-red-bg)' },
    Equity: { label: 'EQUITY', stripe: 'linear-gradient(90deg,#7C3AED,#C4B5FD)', color: '#A78BFA', badgeBg: 'rgba(124,58,237,.12)' },
    Income: { label: 'INCOME', stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)', color: '#22C55E', badgeBg: 'var(--color-badge-green-bg)' },
    Expense: { label: 'EXPENSE', stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)', color: '#F59E0B', badgeBg: 'var(--color-badge-amber-bg)' },
};

function formatUsd(n: number, decimals = 2): string {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatUsdWhole(n: number): string {
    return formatUsd(n, 0);
}

function sparkPoints(accountId: string, balance: number): number[] {
    let seed = 0;
    for (let i = 0; i < accountId.length; i++) seed = (seed + accountId.charCodeAt(i) * (i + 1)) % 997;
    const base = Math.max(Math.abs(balance), 100);
    return Array.from({ length: 8 }, (_, i) => {
        const wave = Math.sin((seed + i * 17) * 0.31) * 0.35 + 0.65;
        const trend = 0.55 + (i / 7) * 0.45;
        return base * wave * trend;
    });
}

function ActivitySparkline({ accountId, balance }: { accountId: string; balance: number }) {
    const pts = sparkPoints(accountId, balance);
    const max = Math.max(...pts, 1);
    const min = Math.min(...pts, 0);
    const range = max - min || 1;
    const w = 64;
    const h = 22;
    const path = pts
        .map((v, i) => {
            const x = (i / (pts.length - 1)) * w;
            const y = h - ((v - min) / range) * (h - 4) - 2;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    const trend = pts[pts.length - 1] >= pts[0];
    const stroke = trend ? '#22C55E' : '#EF4444';
    return (
        <svg width={w} height={h} style={{ display: 'block' }}>
            <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        </svg>
    );
}

interface AccountRowProps {
    account: Account;
    level: number;
    expanded: Set<string>;
    balances: Record<string, number>;
    onToggle: (id: string) => void;
    onEdit: (a: Account) => void;
    onDelete: (id: string) => void;
    onAddChild: (parentId: string, type: AccountType) => void;
}

function AccountRow({ account, level, expanded, balances, onToggle, onEdit, onDelete, onAddChild }: AccountRowProps) {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expanded.has(account.id);
    const indent = level * 16;
    const cfg = TYPE_CFG[account.type];
    const bal = balances[account.id] ?? 0;

    return (
        <>
            <tr
                style={{ transition: 'background .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-redwood-row-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                className="coa-row"
            >
                <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: indent }}>
                        <button
                            type="button"
                            onClick={() => hasChildren && onToggle(account.id)}
                            style={{
                                width: 18,
                                height: 18,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 6,
                                flexShrink: 0,
                                background: 'none',
                                border: 'none',
                                cursor: hasChildren ? 'pointer' : 'default',
                                color: hasChildren ? 'var(--color-redwood-text-muted)' : 'transparent',
                                padding: 0,
                            }}
                        >
                            {hasChildren ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span
                                    style={{
                                        fontSize: level === 0 ? 12 : 11,
                                        fontWeight: level === 0 ? 700 : level === 1 ? 600 : 500,
                                        color: 'var(--color-redwood-text-main)',
                                    }}
                                >
                                    {account.name}
                                </span>
                                {account.isSystem && (
                                    <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--color-redwood-text-subtle)', textTransform: 'uppercase' }}>
                                        System
                                    </span>
                                )}
                                <div className="coa-row-actions" style={{ display: 'flex', gap: 2, marginLeft: 'auto', opacity: 0, transition: 'opacity .15s' }}>
                                    <button type="button" onClick={() => onAddChild(account.id, account.type)} title="Add sub-account" style={{ ...ghostBtn, padding: '2px 4px' }}>
                                        <Plus size={11} />
                                    </button>
                                    <button type="button" onClick={() => onEdit(account)} title="Edit" style={{ ...ghostBtn, padding: '2px 4px' }}>
                                        <Edit2 size={11} />
                                    </button>
                                    {!account.isSystem && (
                                        <button type="button" onClick={() => onDelete(account.id)} title="Delete" style={{ ...ghostBtn, padding: '2px 4px', color: 'var(--color-brand-red-tint)' }}>
                                            <Trash2 size={11} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {Number(account.openingBalance) > 0 && (
                                <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginTop: 2, display: 'block' }}>
                                    Opening: {formatUsd(Number(account.openingBalance))}
                                </span>
                            )}
                        </div>
                    </div>
                </td>
                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                    {account.code}
                </td>
                <td style={tdStyle}>
                    <span
                        style={{
                            fontSize: 8,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: cfg.badgeBg,
                            color: cfg.color,
                            textTransform: 'uppercase',
                        }}
                    >
                        {account.type}
                    </span>
                </td>
                <td style={{ ...tdStyle, fontSize: 10, fontWeight: 600, color: account.nature === 'Debit' ? '#93C5FD' : '#86EFAC' }}>
                    {account.nature}
                </td>
                <td style={{ ...tdStyle, fontSize: 10, color: 'var(--color-redwood-text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {account.description}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 600, color: bal >= 0 ? 'var(--color-redwood-text-main)' : '#FCA5A5' }}>
                    {Math.abs(bal) < 0.01 ? '—' : formatUsd(bal)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <ActivitySparkline accountId={account.id} balance={bal} />
                </td>
            </tr>
            {hasChildren && isExpanded && account.children!.map(child => (
                <AccountRow
                    key={child.id}
                    account={child}
                    level={level + 1}
                    expanded={expanded}
                    balances={balances}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onAddChild={onAddChild}
                />
            ))}
        </>
    );
}

async function computeAccountBalances(accounts: Account[]): Promise<Record<string, number>> {
    const map: Record<string, number> = {};
    accounts.forEach(a => { map[a.id] = 0; });

    const natureById: Record<string, AccountNature> = {};
    accounts.forEach(a => { natureById[a.id] = a.nature; });
    const naturalDelta = (accountId: string, debit: number, credit: number): number => {
        const nat = natureById[accountId] || 'Debit';
        return nat === 'Debit' ? (debit - credit) : (credit - debit);
    };

    const [customers, suppliers, invoices, payments, jvs] = await Promise.all([
        getCustomers().catch(() => [] as any[]),
        getSuppliers().catch(() => [] as any[]),
        getInvoices().catch(() => [] as any[]),
        getPayments().catch(() => [] as any[]),
        getJournalVouchers().catch(() => [] as any[]),
    ]);

    if (map['1120'] !== undefined) {
        const arSum = customers.reduce(
            (s, c: any) => s + Math.max(0, Number(c.balance) || 0), 0,
        );
        map['1120'] = arSum;
    }

    if (map['2110'] !== undefined) {
        const balances = await Promise.all(
            suppliers.map(s => getSupplierBalance(s.id).catch(() => 0)),
        );
        const apSum = balances.reduce((s, b) => s + Math.max(0, b), 0);
        map['2110'] = apSum;
    }

    const invTotal = invoices.reduce((s, i: any) => s + (Number(i.grandTotal ?? i.total) || 0), 0);
    if (map['4110'] !== undefined) {
        map['4110'] = invTotal;
    } else if (map['4100'] !== undefined) {
        map['4100'] = invTotal;
    }

    const posLists = await Promise.all(
        suppliers.map(s => getSupplierPurchases(s.id).catch(() => [])),
    );
    const poTotal = posLists.flat().reduce((s, p: any) => s + (Number(p.grandTotal) || 0), 0);
    if (map['5110'] !== undefined) map['5110'] = poTotal;

    const customerReceipts = payments.reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
    const supplierPaymentLists = await Promise.all(
        suppliers.map(async s => {
            try {
                const r = await authFetch(
                    `${String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')}/api/suppliers/${s.id}/payments`,
                );
                if (!r.ok) return [];
                const arr = await r.json();
                return Array.isArray(arr) ? arr : [];
            } catch { return []; }
        }),
    );
    const supplierOutflow = supplierPaymentLists.flat().reduce((s, p: any) => s + (Number(p.amount) || 0), 0);

    let manualBankNet = 0;
    try {
        const apiHost = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
        const r = await authFetch(`${apiHost}/api/bank-transactions/`);
        if (r.ok) {
            const rows: any[] = await r.json();
            if (Array.isArray(rows)) {
                manualBankNet = rows.reduce(
                    (s, t) => s + (t.type === 'Credit' ? (Number(t.amount) || 0) : -(Number(t.amount) || 0)),
                    0,
                );
            }
        }
    } catch { /* keep manualBankNet=0 on failure */ }

    if (map['1110'] !== undefined) map['1110'] = customerReceipts - supplierOutflow + manualBankNet;

    for (const jv of jvs) {
        if (jv.status !== 'Posted') continue;
        for (const line of (jv.lines || [])) {
            if (!line.accountId || map[line.accountId] === undefined) continue;
            map[line.accountId] += naturalDelta(
                line.accountId,
                Number(line.debit) || 0,
                Number(line.credit) || 0,
            );
        }
    }

    const byDepth: Record<number, Account[]> = {};
    const depthOf = (a: Account): number => {
        let d = 0, cur: Account | undefined = a;
        while (cur && cur.parentId) {
            d++;
            cur = accounts.find(x => x.id === cur!.parentId);
        }
        return d;
    };
    accounts.forEach(a => {
        const d = depthOf(a);
        (byDepth[d] = byDepth[d] || []).push(a);
    });
    const depths = Object.keys(byDepth).map(Number).sort((a, b) => b - a);
    for (const d of depths) {
        for (const a of byDepth[d]) {
            if (!a.parentId) continue;
            map[a.parentId] = (map[a.parentId] || 0) + (map[a.id] || 0);
        }
    }

    return map;
}

export default function ChartOfAccounts() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['1000', '1100', '2000', '2100', '3000', '4000', '4100', '5000', '5100', '5200']));
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<AccountType | 'All'>('All');
    const [statusFilter, setStatusFilter] = useState<'All' | 'System' | 'Custom'>('All');
    const [period, setPeriod] = useState<PeriodKey>('mtd');
    const [showForm, setShowForm] = useState(false);
    const [editAccount, setEditAccount] = useState<Account | null>(null);
    const [form, setForm] = useState({
        code: '', name: '', type: 'Asset' as AccountType,
        nature: 'Debit' as AccountNature, parentId: '' as string | null,
        description: '',
        openingBalance: 0,
    });
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [computingBalances, setComputingBalances] = useState(false);
    const [showInsights, setShowInsights] = useState(false);

    useEscape(() => setShowForm(false), showForm);

    const refreshBalances = async (accs: Account[]) => {
        setComputingBalances(true);
        try {
            const map = await computeAccountBalances(accs);
            setBalances(map);
        } finally {
            setComputingBalances(false);
        }
    };

    useEffect(() => {
        const accs = getAccounts();
        setAccounts(accs);
        refreshBalances(accs);
    }, []);

    const balanceByType = (type: AccountType): number =>
        accounts
            .filter(a => a.type === type && !a.parentId)
            .reduce((s, a) => s + (balances[a.id] || 0), 0);

    const summary = useMemo(() => {
        const assets = balanceByType('Asset');
        const liabilities = balanceByType('Liability');
        const equity = balanceByType('Equity');
        const income = balanceByType('Income');
        const expense = balanceByType('Expense');
        const netProfit = income - expense;
        const equationBalanced = Math.abs(assets - (liabilities + equity)) < 0.01;
        return { assets, liabilities, equity, income, expense, netProfit, equationBalanced };
    }, [accounts, balances]);

    const trialRows = useMemo(() => {
        const types: AccountType[] = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
        return types.map(type => {
            const total = balanceByType(type);
            if (type === 'Asset' || type === 'Expense') {
                return { type, debit: Math.max(0, total), credit: Math.max(0, -total) };
            }
            return { type, debit: Math.max(0, -total), credit: Math.max(0, total) };
        });
    }, [accounts, balances]);

    const totalDebits = trialRows.reduce((s, r) => s + r.debit, 0);
    const totalCredits = trialRows.reduce((s, r) => s + r.credit, 0);
    const trialBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    const tree = buildTree((() => {
        const matched = new Set<string>();
        accounts.forEach(a => {
            const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search);
            const matchType = typeFilter === 'All' || a.type === typeFilter;
            const matchStatus =
                statusFilter === 'All' ||
                (statusFilter === 'System' && a.isSystem) ||
                (statusFilter === 'Custom' && !a.isSystem);
            if (matchSearch && matchType && matchStatus) {
                matched.add(a.id);
                let parentId = a.parentId;
                while (parentId) {
                    matched.add(parentId);
                    parentId = accounts.find(x => x.id === parentId)?.parentId || null;
                }
            }
        });
        if (!search && typeFilter === 'All' && statusFilter === 'All') return accounts;
        return accounts.filter(a => matched.has(a.id));
    })());

    const toggleExpand = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const nextAvailableCode = (parentCode: string): string => {
        const existing = new Set(accounts.map(a => a.code));
        const base = parseInt(parentCode);
        for (let i = 10; i <= 90; i += 10) {
            const candidate = String(base + i);
            if (!existing.has(candidate)) return candidate;
        }
        return String(Date.now()).slice(-4);
    };

    const openAdd = (parentId?: string, type?: AccountType) => {
        const parent = parentId ? accounts.find(a => a.id === parentId) : null;
        const suggestedCode = parent ? nextAvailableCode(parent.code) : '';
        setEditAccount(null);
        setForm({
            code: suggestedCode,
            name: '',
            type: type || parent?.type || 'Asset',
            nature: type === 'Income' || type === 'Liability' || type === 'Equity' ? 'Credit' : 'Debit',
            parentId: parentId || null,
            description: '',
            openingBalance: 0,
        });
        setShowForm(true);
    };

    const openEdit = (account: Account) => {
        setEditAccount(account);
        setForm({
            code: account.code,
            name: account.name,
            type: account.type,
            nature: account.nature,
            parentId: account.parentId,
            description: account.description,
            openingBalance: Number(account.openingBalance) || 0,
        });
        setShowForm(true);
    };

    const handleSave = () => {
        if (!form.code || !form.name) { alert('Code and Name are required.'); return; }
        const existing = accounts.find(a => a.code === form.code && a.id !== editAccount?.id);
        if (existing) { alert(`Code ${form.code} already exists: ${existing.name}`); return; }

        const cleanOpening = Number.isFinite(form.openingBalance) ? Number(form.openingBalance) : 0;

        let updated: Account[];
        if (editAccount) {
            updated = accounts.map(a => a.id === editAccount.id
                ? { ...a, ...form, openingBalance: cleanOpening }
                : a);
        } else {
            const newAccount: Account = {
                id: form.code,
                ...form,
                openingBalance: cleanOpening,
                isSystem: false,
                balance: 0,
            };
            updated = [...accounts, newAccount];
        }
        saveAccounts(updated);
        setAccounts(updated);
        setShowForm(false);
    };

    const handleDelete = async (id: string) => {
        const target = accounts.find(a => a.id === id);
        if (!target) return;
        const hasChildren = accounts.some(a => a.parentId === id);
        if (hasChildren) {
            alert('Cannot delete an account that has sub-accounts. Delete sub-accounts first.');
            return;
        }
        try {
            const jvs = await getJournalVouchers();
            const txnCount = jvs.reduce((n, jv) => n + (jv.lines || []).filter(l => l.accountId === id).length, 0);
            if (txnCount > 0) {
                alert(
                    `Cannot delete — this account has ${txnCount} existing transaction${txnCount === 1 ? '' : 's'}. ` +
                    'You can deactivate it instead.',
                );
                return;
            }
        } catch {
            alert('Could not verify transaction history. Please try again.');
            return;
        }
        if (!confirm(`Delete account ${target.code} — ${target.name}? This cannot be undone.`)) return;
        const updated = accounts.filter(a => a.id !== id);
        saveAccounts(updated);
        setAccounts(updated);
    };

    const resetToDefaults = () => {
        if (!confirm('Reset to default Chart of Accounts? This will remove custom accounts.')) return;
        saveAccounts(DEFAULT_ACCOUNTS);
        setAccounts(DEFAULT_ACCOUNTS);
    };

    const handleAskAi = () => {
        alert(
            'AI Chart of Accounts (preview)\n\n' +
            `Assets ${formatUsdWhole(summary.assets)} · Liabilities ${formatUsdWhole(summary.liabilities)} · ` +
            `Equity ${formatUsdWhole(summary.equity)} · Net profit ${formatUsd(summary.netProfit)}.\n\n` +
            'Connect the AI CFO endpoint for live ledger analysis.',
        );
    };

    const aiInsightText =
        `Your chart of accounts shows ${formatUsdWhole(summary.assets)} in total assets against ` +
        `${formatUsdWhole(summary.liabilities)} liabilities. Net profit for the selected period is ` +
        `${formatUsd(summary.netProfit)} with ${accounts.length} active accounts across five type categories. ` +
        `${summary.equationBalanced ? 'The accounting equation is balanced.' : 'Review equity adjustments — assets ≠ liabilities + equity.'}`;

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

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 100, maxWidth: 1280, margin: '0 auto' }}>
            <style>{`.coa-row:hover .coa-row-actions { opacity: 1 !important; }`}</style>

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
                            General ledger double-entry 1000-6000 coding · trial balance
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button type="button" onClick={handleAskAi} style={ghostBtn}>
                        <Bot size={12} /> Ask AI
                    </button>
                    <button type="button" onClick={() => navigate('/finance/banking')} style={ghostBtn}>
                        <Link2 size={12} /> Connect your bank
                    </button>
                    <button type="button" onClick={() => refreshBalances(accounts)} disabled={computingBalances} style={ghostBtn}>
                        <RefreshCw size={12} className={computingBalances ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button type="button" onClick={() => openAdd()} style={{ ...ghostBtn, background: '#4F8EF7', color: '#fff', border: 'none' }}>
                        <Plus size={12} /> Add account
                    </button>
                </div>
            </div>

            {/* Period pills */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {PERIOD_PILLS.map(p => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setPeriod(p.key)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: 999,
                                fontSize: 9,
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: period === p.key ? '1px solid #4F8EF7' : '1px solid var(--color-redwood-border)',
                                background: period === p.key ? 'rgba(79,142,247,.15)' : 'rgba(255,255,255,.04)',
                                color: period === p.key ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                                fontFamily: 'inherit',
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <span style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)' }}>
                    {PERIOD_RANGE[period]}
                </span>
            </div>

            {/* Summary type cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {(['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as AccountType[]).map(type => {
                    const cfg = TYPE_CFG[type];
                    const total = balanceByType(type);
                    const active = typeFilter === type;
                    return (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setTypeFilter(active ? 'All' : type)}
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
                                {computingBalances ? '…' : formatUsdWhole(total).replace('$', '')}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Accounting equation + balanced status */}
            <div style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                    Assets{' '}
                    <span style={{ fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: 'ui-monospace,monospace' }}>
                        {computingBalances ? '…' : formatUsdWhole(summary.assets).replace('$', '')}
                    </span>
                    {' = '}
                    Liabilities{' '}
                    <span style={{ fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: 'ui-monospace,monospace' }}>
                        {computingBalances ? '…' : formatUsdWhole(summary.liabilities).replace('$', '')}
                    </span>
                    {' + '}
                    Equity{' '}
                    <span style={{ fontWeight: 700, color: 'var(--color-redwood-text-main)', fontFamily: 'ui-monospace,monospace' }}>
                        {computingBalances ? '…' : formatUsdWhole(summary.equity).replace('$', '')}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {summary.equationBalanced && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#86EFAC' }}>
                            <CheckCircle2 size={14} /> Balanced
                        </span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                        Net profit:{' '}
                        <span style={{ fontWeight: 700, color: summary.netProfit >= 0 ? '#86EFAC' : '#FCA5A5', fontFamily: 'ui-monospace,monospace' }}>
                            {computingBalances ? '…' : formatUsd(summary.netProfit)}
                        </span>
                    </span>
                </div>
            </div>

            {/* Add/Edit Form modal */}
            {showForm && (
                <div style={{ ...panel, borderColor: 'rgba(245,158,11,.35)', background: 'rgba(245,158,11,.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '.5px', margin: 0 }}>
                            {editAccount ? 'Edit account' : 'New account'}
                        </h2>
                        <button type="button" onClick={() => setShowForm(false)} style={{ ...ghostBtn, padding: '4px 6px' }}>
                            <X size={14} />
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Account code *</label>
                            <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                                placeholder="e.g. 1150" style={{ ...selectStyle, width: '100%', fontFamily: 'ui-monospace,monospace' }} />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Account name *</label>
                            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Petty Cash" style={{ ...selectStyle, width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Type</label>
                            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as AccountType, nature: ['Income', 'Liability', 'Equity'].includes(e.target.value) ? 'Credit' : 'Debit' }))}
                                style={{ ...selectStyle, width: '100%' }}>
                                {(['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as AccountType[]).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Nature</label>
                            <select value={form.nature} onChange={e => setForm(p => ({ ...p, nature: e.target.value as AccountNature }))}
                                style={{ ...selectStyle, width: '100%' }}>
                                <option value="Debit">Debit</option>
                                <option value="Credit">Credit</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Parent account</label>
                            <select value={form.parentId || ''} onChange={e => setForm(p => ({ ...p, parentId: e.target.value || null }))}
                                style={{ ...selectStyle, width: '100%' }}>
                                <option value="">None (top level)</option>
                                {accounts.filter(a => a.type === form.type).map(a => (
                                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Opening balance</label>
                            <input type="number" step="0.01" value={form.openingBalance}
                                onChange={e => setForm(p => ({ ...p, openingBalance: parseFloat(e.target.value) || 0 }))}
                                placeholder="0.00" style={{ ...selectStyle, width: '100%', fontFamily: 'ui-monospace,monospace' }} />
                        </div>
                        <div style={{ gridColumn: 'span 3' }}>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Description</label>
                            <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                placeholder="Brief description" style={{ ...selectStyle, width: '100%' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button type="button" onClick={handleSave} style={{ ...ghostBtn, background: '#F59E0B', color: '#fff', border: 'none', padding: '6px 14px' }}>
                            <Check size={12} /> {editAccount ? 'Save changes' : 'Create account'}
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
                        <button type="button" onClick={resetToDefaults} style={{ ...ghostBtn, marginLeft: 'auto', color: 'var(--color-brand-red-tint)' }}>
                            Reset to default
                        </button>
                    </div>
                </div>
            )}

            {/* Search & filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-subtle)' }} />
                    <input
                        type="text"
                        placeholder="Search by name or code..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ ...selectStyle, width: '100%', paddingLeft: 32, fontSize: 11 }}
                    />
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as AccountType | 'All')} style={selectStyle}>
                    <option value="All">All types</option>
                    {(['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as AccountType[]).map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'All' | 'System' | 'Custom')} style={selectStyle}>
                    <option value="All">All</option>
                    <option value="System">System</option>
                    <option value="Custom">Custom</option>
                </select>
                <button type="button" onClick={() => setExpanded(new Set(accounts.map(a => a.id)))} style={ghostBtn}>Expand all</button>
                <button type="button" onClick={() => setExpanded(new Set())} style={ghostBtn}>Collapse all</button>
            </div>

            {/* Main table */}
            <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                {['Account name', 'Code', 'Type', 'Nature', 'Description', 'Balance (USD)', 'Activity'].map(h => (
                                    <th key={h} style={{ ...thStyle, textAlign: h.startsWith('Balance') || h === 'Activity' ? 'right' : 'left' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tree.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '40px 16px', color: 'var(--color-redwood-text-muted)' }}>
                                        No accounts found
                                    </td>
                                </tr>
                            ) : (
                                tree.map(account => (
                                    <AccountRow
                                        key={account.id}
                                        account={account}
                                        level={0}
                                        expanded={expanded}
                                        balances={balances}
                                        onToggle={toggleExpand}
                                        onEdit={openEdit}
                                        onDelete={handleDelete}
                                        onAddChild={(parentId, type) => openAdd(parentId, type)}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Trial Balance Check */}
            <div style={panel}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
                    Trial Balance Check
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['ACCOUNT', 'DEBIT', 'CREDIT'].map(h => (
                                    <th key={h} style={{ ...thStyle, textAlign: h === 'ACCOUNT' ? 'left' : 'right' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {trialRows.map(row => {
                                const cfg = TYPE_CFG[row.type];
                                return (
                                    <tr key={row.type}>
                                        <td style={tdStyle}>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, marginRight: 6 }}>{cfg.label}</span>
                                            <span style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{row.type}</span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 600 }}>
                                            {row.debit > 0 ? formatUsd(row.debit) : '—'}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 600 }}>
                                            {row.credit > 0 ? formatUsd(row.credit) : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                                <td style={{ ...tdStyle, fontWeight: 700, fontSize: 10 }}>TOTAL</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, fontSize: 11 }}>
                                    {formatUsd(totalDebits)}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, fontSize: 11 }}>
                                    {formatUsd(totalCredits)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: 8, fontSize: 9.5, color: trialBalanced ? '#86EFAC' : '#FCA5A5', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {trialBalanced && <CheckCircle2 size={12} />}
                    Total Debits = Total Credits · Trial balance {trialBalanced ? 'balanced' : 'imbalanced'}
                </div>
            </div>

            {/* AI Insights footer */}
            <div
                style={{
                    ...panel,
                    background: 'linear-gradient(135deg, rgba(124,58,237,.12) 0%, var(--color-redwood-bg-surface) 60%)',
                    borderColor: 'rgba(124,58,237,.28)',
                    position: 'sticky',
                    bottom: 8,
                    zIndex: 10,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Sparkles size={14} style={{ color: '#A78BFA' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>AI Insights</span>
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', margin: 0, lineHeight: 1.5 }}>
                            {showInsights ? aiInsightText : aiInsightText.slice(0, 160) + '…'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowInsights(v => !v)}
                        style={{
                            ...ghostBtn,
                            background: 'rgba(124,58,237,.15)',
                            borderColor: 'rgba(124,58,237,.28)',
                            color: '#C4B5FD',
                            padding: '6px 12px',
                            flexShrink: 0,
                        }}
                    >
                        View insights <ChevRight size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}
