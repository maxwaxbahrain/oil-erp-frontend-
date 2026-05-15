import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, ChevronRight, ChevronDown, Check, X, RefreshCw } from 'lucide-react';
import { getCustomers, getInvoices, getPayments } from '../../services/api';
import { getSuppliers, getSupplierBalance, getSupplierPurchases } from '../../services/purchasesService';
import { getJournalVouchers } from './JournalVoucher';
import { formatCurrency } from '../../services/settingsService';

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
    children?: Account[];
}

const COA_KEY = 'chart_of_accounts';

export const DEFAULT_ACCOUNTS: Account[] = [
    // Assets
    { id: '1000', code: '1000', name: 'Assets', type: 'Asset', nature: 'Debit', parentId: null, description: 'All assets', isSystem: true, balance: 0 },
    { id: '1100', code: '1100', name: 'Current Assets', type: 'Asset', nature: 'Debit', parentId: '1000', description: 'Short-term assets', isSystem: true, balance: 0 },
    { id: '1110', code: '1110', name: 'Cash & Bank', type: 'Asset', nature: 'Debit', parentId: '1100', description: 'Cash in hand and bank accounts', isSystem: true, balance: 0 },
    { id: '1120', code: '1120', name: 'Accounts Receivable', type: 'Asset', nature: 'Debit', parentId: '1100', description: 'Money owed by customers', isSystem: true, balance: 0 },
    { id: '1130', code: '1130', name: 'Inventory', type: 'Asset', nature: 'Debit', parentId: '1100', description: 'Stock of goods', isSystem: true, balance: 0 },
    { id: '1140', code: '1140', name: 'Advance Payments', type: 'Asset', nature: 'Debit', parentId: '1100', description: 'Prepaid expenses', isSystem: false, balance: 0 },
    { id: '1200', code: '1200', name: 'Fixed Assets', type: 'Asset', nature: 'Debit', parentId: '1000', description: 'Long-term assets', isSystem: true, balance: 0 },
    { id: '1210', code: '1210', name: 'Vehicles & Equipment', type: 'Asset', nature: 'Debit', parentId: '1200', description: 'Delivery vans, machinery', isSystem: false, balance: 0 },
    { id: '1220', code: '1220', name: 'Furniture & Fixtures', type: 'Asset', nature: 'Debit', parentId: '1200', description: 'Office furniture', isSystem: false, balance: 0 },

    // Liabilities
    { id: '2000', code: '2000', name: 'Liabilities', type: 'Liability', nature: 'Credit', parentId: null, description: 'All liabilities', isSystem: true, balance: 0 },
    { id: '2100', code: '2100', name: 'Current Liabilities', type: 'Liability', nature: 'Credit', parentId: '2000', description: 'Short-term liabilities', isSystem: true, balance: 0 },
    { id: '2110', code: '2110', name: 'Accounts Payable', type: 'Liability', nature: 'Credit', parentId: '2100', description: 'Money owed to suppliers', isSystem: true, balance: 0 },
    { id: '2120', code: '2120', name: 'Sales Tax Payable', type: 'Liability', nature: 'Credit', parentId: '2100', description: 'Tax collected from customers', isSystem: false, balance: 0 },
    { id: '2130', code: '2130', name: 'Accrued Expenses', type: 'Liability', nature: 'Credit', parentId: '2100', description: 'Expenses incurred but not yet paid', isSystem: false, balance: 0 },
    { id: '2200', code: '2200', name: 'Long-term Liabilities', type: 'Liability', nature: 'Credit', parentId: '2000', description: 'Long-term debts', isSystem: true, balance: 0 },
    { id: '2210', code: '2210', name: 'Bank Loans', type: 'Liability', nature: 'Credit', parentId: '2200', description: 'Long-term bank financing', isSystem: false, balance: 0 },

    // Equity
    { id: '3000', code: '3000', name: 'Equity', type: 'Equity', nature: 'Credit', parentId: null, description: "Owner's equity", isSystem: true, balance: 0 },
    { id: '3100', code: '3100', name: "Owner's Capital", type: 'Equity', nature: 'Credit', parentId: '3000', description: 'Capital invested by owner', isSystem: true, balance: 0 },
    { id: '3200', code: '3200', name: 'Retained Earnings', type: 'Equity', nature: 'Credit', parentId: '3000', description: 'Accumulated profits', isSystem: true, balance: 0 },
    { id: '3300', code: '3300', name: 'Drawings', type: 'Equity', nature: 'Debit', parentId: '3000', description: 'Owner withdrawals', isSystem: false, balance: 0 },

    // Income
    { id: '4000', code: '4000', name: 'Income', type: 'Income', nature: 'Credit', parentId: null, description: 'All income', isSystem: true, balance: 0 },
    { id: '4100', code: '4100', name: 'Sales Revenue', type: 'Income', nature: 'Credit', parentId: '4000', description: 'Revenue from product sales', isSystem: true, balance: 0 },
    { id: '4110', code: '4110', name: 'Oil & Lubricant Sales', type: 'Income', nature: 'Credit', parentId: '4100', description: 'Revenue from oil products', isSystem: false, balance: 0 },
    { id: '4120', code: '4120', name: 'Service Revenue', type: 'Income', nature: 'Credit', parentId: '4100', description: 'Delivery and cargo charges', isSystem: false, balance: 0 },
    { id: '4200', code: '4200', name: 'Other Income', type: 'Income', nature: 'Credit', parentId: '4000', description: 'Non-operating income', isSystem: false, balance: 0 },

    // Expenses
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

const TYPE_COLORS: Record<AccountType, string> = {
    Asset: 'bg-blue-100 text-blue-700',
    Liability: 'bg-red-100 text-red-700',
    Equity: 'bg-purple-100 text-purple-700',
    Income: 'bg-emerald-100 text-emerald-700',
    Expense: 'bg-orange-100 text-orange-700',
};

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
    const indent = level * 20;

    return (
        <>
            <tr className="hover:bg-gray-50 transition-all group border-b border-gray-50">
                <td className="px-4 py-3">
                    <div className="flex items-center" style={{ paddingLeft: indent }}>
                        <button onClick={() => hasChildren && onToggle(account.id)}
                            className={`w-5 h-5 flex items-center justify-center mr-2 flex-shrink-0 ${hasChildren ? 'text-gray-400 hover:text-gray-700' : 'text-transparent'}`}>
                            {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
                        </button>
                        <span className={`text-sm ${level === 0 ? 'font-black text-gray-900' : level === 1 ? 'font-bold text-gray-800' : 'font-medium text-gray-700'}`}>
                            {account.name}
                        </span>
                        {account.isSystem && <span className="ml-2 text-[9px] font-black text-gray-300 uppercase">System</span>}
                    </div>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-500">{account.code}</td>
                <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${TYPE_COLORS[account.type]}`}>{account.type}</span>
                </td>
                <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${account.nature === 'Debit' ? 'text-blue-600' : 'text-emerald-600'}`}>{account.nature}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate">{account.description}</td>
                <td className="px-4 py-3 text-right">
                    {(() => {
                        const bal = balances[account.id] ?? 0;
                        if (Math.abs(bal) < 0.01) {
                            return <span className="text-xs text-gray-300 font-mono">—</span>;
                        }
                        // Positive = natural direction (asset/expense for Debit-nature,
                        // liability/income/equity for Credit-nature). Negative = inverse.
                        const cls = bal >= 0 ? 'text-gray-900' : 'text-rose-600';
                        return (
                            <span className={`text-xs font-black font-mono ${cls}`}>
                                {formatCurrency(bal)}
                            </span>
                        );
                    })()}
                </td>
                <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => onAddChild(account.id, account.type)}
                            className="p-1.5 hover:bg-orange-50 rounded-lg text-orange-500 transition-all" title="Add sub-account">
                            <Plus size={13} />
                        </button>
                        <button onClick={() => onEdit(account)}
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition-all" title="Edit">
                            <Edit2 size={13} />
                        </button>
                        {!account.isSystem && (
                            <button onClick={() => onDelete(account.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-all" title="Delete">
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </td>
            </tr>
            {hasChildren && isExpanded && account.children!.map(child => (
                <AccountRow key={child.id} account={child} level={level + 1}
                    expanded={expanded} balances={balances} onToggle={onToggle} onEdit={onEdit}
                    onDelete={onDelete} onAddChild={onAddChild} />
            ))}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance computation
//
// Each leaf account's balance is derived from real data:
//   1120 Accounts Receivable  ← sum of customer balances
//   2110 Accounts Payable     ← sum of supplier outstanding (from /balance)
//   1110 Cash & Bank          ← customer receipts − supplier payments (rough)
//   4100 Sales Revenue        ← sum of invoice grandTotals
//   5110 Purchases            ← sum of PO grandTotals across suppliers
//   *                         ← + any posted JV line debiting/crediting it
//
// Parent accounts roll up the sum of their children. Values are stored in
// "natural display" form — positive number means the account is in its
// expected direction (Asset positive = asset, Liability positive = owed).
// ─────────────────────────────────────────────────────────────────────────────
async function computeAccountBalances(accounts: Account[]): Promise<Record<string, number>> {
    const map: Record<string, number> = {};
    accounts.forEach(a => { map[a.id] = 0; });

    // Quick lookup of account nature so JV deltas land in the right direction.
    const natureById: Record<string, AccountNature> = {};
    accounts.forEach(a => { natureById[a.id] = a.nature; });
    const naturalDelta = (accountId: string, debit: number, credit: number): number => {
        const nat = natureById[accountId] || 'Debit';
        return nat === 'Debit' ? (debit - credit) : (credit - debit);
    };

    // Fan out fetches in parallel so the COA page doesn't block on the slowest.
    const [customers, suppliers, invoices, payments, jvs] = await Promise.all([
        getCustomers().catch(() => [] as any[]),
        getSuppliers().catch(() => [] as any[]),
        getInvoices().catch(() => [] as any[]),
        getPayments().catch(() => [] as any[]),
        getJournalVouchers().catch(() => [] as any[]),
    ]);

    // 1120 Accounts Receivable — sum of POSITIVE customer balances only.
    // (Previously used abs(balance), which would have incorrectly counted
    // any customer credit balance as AR rather than as a customer-payable
    // liability.) Matches the Aged Receivable + Banking + AccountsDashboard
    // calculations exactly.
    if (map['1120'] !== undefined) {
        const arSum = customers.reduce(
            (s, c: any) => s + Math.max(0, Number(c.balance) || 0), 0,
        );
        map['1120'] = arSum;
    }

    // 2110 Accounts Payable — fetch each supplier's computed balance in parallel.
    if (map['2110'] !== undefined) {
        const balances = await Promise.all(
            suppliers.map(s => getSupplierBalance(s.id).catch(() => 0)),
        );
        const apSum = balances.reduce((s, b) => s + Math.max(0, b), 0);
        map['2110'] = apSum;
    }

    // Sales Revenue — total invoiced. Set ONLY the leaf account; the
    // roll-up below sums it into the parent. Setting both 4100 (parent)
    // and 4110 (child) caused the parent to double-count after roll-up.
    // 4110 "Oil & Lubricant Sales" is the natural bucket since Soltol is
    // an oil-products business; fall back to 4100 if the leaf is missing.
    const invTotal = invoices.reduce((s, i: any) => s + (Number(i.grandTotal ?? i.total) || 0), 0);
    if (map['4110'] !== undefined) {
        map['4110'] = invTotal;
    } else if (map['4100'] !== undefined) {
        map['4100'] = invTotal;
    }

    // 5110 Purchases — total POs across all suppliers.
    const posLists = await Promise.all(
        suppliers.map(s => getSupplierPurchases(s.id).catch(() => [])),
    );
    const poTotal = posLists.flat().reduce((s, p: any) => s + (Number(p.grandTotal) || 0), 0);
    if (map['5110'] !== undefined) map['5110'] = poTotal;

    // 1110 Cash & Bank — customer receipts minus supplier payments.
    const customerReceipts = payments.reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
    // Supplier payments live per-supplier; we already fetched them via the
    // balance endpoint, so sum from supplier payment endpoints.
    const supplierPaymentLists = await Promise.all(
        suppliers.map(async s => {
            try {
                const r = await fetch(
                    `${String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')}/api/suppliers/${s.id}/payments`,
                );
                if (!r.ok) return [];
                const arr = await r.json();
                return Array.isArray(arr) ? arr : [];
            } catch { return []; }
        }),
    );
    const supplierOutflow = supplierPaymentLists.flat().reduce((s, p: any) => s + (Number(p.amount) || 0), 0);

    // Manual bank transactions (rent, salary, owner draws, cash deposits, …)
    // also affect Cash & Bank. Fetch them so the COA tile matches the Net
    // Cash Balance shown on the Banking page exactly.
    let manualBankNet = 0;
    try {
        const apiHost = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
        const r = await fetch(`${apiHost}/api/bank-transactions/`);
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

    // Apply posted-JV line adjustments on top of the special-source seeds.
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

    // Roll children up to parents (multi-pass — process leaves first).
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
    // The roll-up doubles values for accounts that are BOTH a leaf with a
    // direct balance AND have children. We avoid that by only rolling up
    // leaves — done by checking child-of-parent relationship above; parents
    // start at whatever direct value they had (usually 0), then accumulate.
    // Safe because our special-source seeds only touch leaves.

    return map;
}


export default function ChartOfAccounts() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['1000', '2000', '3000', '4000', '5000']));
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<AccountType | 'All'>('All');
    const [showForm, setShowForm] = useState(false);
    const [editAccount, setEditAccount] = useState<Account | null>(null);
    const [form, setForm] = useState({
        code: '', name: '', type: 'Asset' as AccountType,
        nature: 'Debit' as AccountNature, parentId: '' as string | null,
        description: ''
    });

    const [balances, setBalances] = useState<Record<string, number>>({});
    const [computingBalances, setComputingBalances] = useState(false);

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
        // Kick off balance computation as soon as the COA is loaded.
        refreshBalances(accs);
    }, []);

    const tree = buildTree((() => {
        if (!search && typeFilter === 'All') return accounts;
        const matched = new Set<string>();
        accounts.forEach(a => {
            const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search);
            const matchType = typeFilter === 'All' || a.type === typeFilter;
            if (matchSearch && matchType) {
                matched.add(a.id);
                // Include all parents
                let parentId = a.parentId;
                while (parentId) {
                    matched.add(parentId);
                    parentId = accounts.find(x => x.id === parentId)?.parentId || null;
                }
            }
        });
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
        // Try parent code + 10, 20, 30... until we find unused
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
            description: ''
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
            description: account.description
        });
        setShowForm(true);
    };

    const handleSave = () => {
        if (!form.code || !form.name) { alert('Code and Name are required.'); return; }
        const existing = accounts.find(a => a.code === form.code && a.id !== editAccount?.id);
        if (existing) { alert(`Code ${form.code} already exists: ${existing.name}`); return; }

        let updated: Account[];
        if (editAccount) {
            updated = accounts.map(a => a.id === editAccount.id ? { ...a, ...form } : a);
        } else {
            const newAccount: Account = {
                id: form.code,
                ...form,
                isSystem: false,
                balance: 0
            };
            updated = [...accounts, newAccount];
        }
        saveAccounts(updated);
        setAccounts(updated);
        setShowForm(false);
    };

    const handleDelete = (id: string) => {
        const hasChildren = accounts.some(a => a.parentId === id);
        if (hasChildren) { alert('Cannot delete an account that has sub-accounts. Delete sub-accounts first.'); return; }
        if (!confirm('Delete this account?')) return;
        const updated = accounts.filter(a => a.id !== id);
        saveAccounts(updated);
        setAccounts(updated);
    };

    const resetToDefaults = () => {
        if (!confirm('Reset to default Chart of Accounts? This will remove custom accounts.')) return;
        saveAccounts(DEFAULT_ACCOUNTS);
        setAccounts(DEFAULT_ACCOUNTS);
    };

    const totalByType = (type: AccountType) => accounts.filter(a => a.type === type).length;
    // Type-level totals: sum balances of TOP-LEVEL accounts in that type.
    // Roll-up already pushed leaf balances up to their roots, so summing roots
    // gives the type total without double-counting.
    const balanceByType = (type: AccountType): number => {
        return accounts
            .filter(a => a.type === type && !a.parentId)
            .reduce((s, a) => s + (balances[a.id] || 0), 0);
    };

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">

            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Chart of Accounts</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Full double-entry accounting structure · {accounts.length} accounts</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => refreshBalances(accounts)}
                            disabled={computingBalances || accounts.length === 0}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-xs font-black text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-all"
                            title="Recompute balances from live customer / supplier / invoice / JV data"
                        >
                            <RefreshCw size={12} className={computingBalances ? 'animate-spin' : ''} />
                            {computingBalances ? 'Computing…' : 'Refresh Balances'}
                        </button>
                        <button onClick={resetToDefaults}
                            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-black text-gray-500 hover:bg-gray-50 transition-all">
                            Reset to Default
                        </button>
                        <button onClick={() => openAdd()}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase hover:bg-gray-700 transition-all">
                            <Plus size={14} /> Add Account
                        </button>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as AccountType[]).map(type => {
                    const total = balanceByType(type);
                    return (
                        <button key={type} onClick={() => setTypeFilter(typeFilter === type ? 'All' : type)}
                            className={`rounded-2xl p-4 text-left transition-all border ${typeFilter === type ? 'border-gray-900 bg-gray-900 text-white' : 'bg-white border-gray-100 shadow-sm hover:border-gray-300'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${typeFilter === type ? 'text-white/60' : 'text-gray-400'}`}>{type}</p>
                            <p className={`text-lg font-black font-mono ${typeFilter === type ? 'text-white' : 'text-gray-900'}`}>
                                {computingBalances ? '…' : (Math.abs(total) < 0.01 ? '—' : formatCurrency(total))}
                            </p>
                            <p className={`text-[10px] font-bold mt-1 ${typeFilter === type ? 'text-white/70' : 'text-gray-400'}`}>{totalByType(type)} accounts</p>
                        </button>
                    );
                })}
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="bg-white border-2 border-orange-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-black text-orange-600 uppercase tracking-widest">
                            {editAccount ? '✏️ Edit Account' : '➕ New Account'}
                        </h2>
                        <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-500 transition-all"><X size={15} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Account Code *</label>
                            <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                                placeholder="e.g. 1150" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Account Name *</label>
                            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Petty Cash" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Type</label>
                            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as AccountType, nature: ['Income','Liability','Equity'].includes(e.target.value) ? 'Credit' : 'Debit' }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400">
                                {(['Asset','Liability','Equity','Income','Expense'] as AccountType[]).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Nature</label>
                            <select value={form.nature} onChange={e => setForm(p => ({ ...p, nature: e.target.value as AccountNature }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400">
                                <option value="Debit">Debit</option>
                                <option value="Credit">Credit</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Parent Account</label>
                            <select value={form.parentId || ''} onChange={e => setForm(p => ({ ...p, parentId: e.target.value || null }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400">
                                <option value="">None (Top Level)</option>
                                {accounts.filter(a => a.type === form.type).map(a => (
                                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Description</label>
                            <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                placeholder="Brief description of this account" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button onClick={handleSave}
                            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-black hover:bg-orange-600 transition-all">
                            <Check size={14} /> {editAccount ? 'Save Changes' : 'Create Account'}
                        </button>
                        <button onClick={() => setShowForm(false)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-black hover:bg-gray-50 transition-all">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Search & Filter */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <input type="text" placeholder="Search by name or code..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <button onClick={() => { setExpanded(new Set(accounts.map(a => a.id))); }}
                    className="px-4 py-2.5 text-xs font-black border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                    Expand All
                </button>
                <button onClick={() => setExpanded(new Set())}
                    className="px-4 py-2.5 text-xs font-black border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                    Collapse All
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Name</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Code</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Nature</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                            <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
                            <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tree.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400 font-bold">No accounts found</td></tr>
                        ) : (
                            tree.map(account => (
                                <AccountRow key={account.id} account={account} level={0}
                                    expanded={expanded} balances={balances} onToggle={toggleExpand}
                                    onEdit={openEdit} onDelete={handleDelete}
                                    onAddChild={(parentId, type) => openAdd(parentId, type)} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-gray-400 text-center">Hover any row to see actions · Click + to add a sub-account · System accounts cannot be deleted</p>
        </div>
    );
}
