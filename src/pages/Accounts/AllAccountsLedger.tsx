// ITEM 11 — Central All-Accounts Ledger.
// Single page where the user picks ANY account from the Chart of Accounts
// and sees every posted journal voucher line that touches it, with a
// running balance computed using the account's nature ('Debit' or
// 'Credit'). Date-range filterable. Pulls journal vouchers via the
// existing getJournalVouchers() helper — no new backend surface.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Filter, Download, X, Calendar } from 'lucide-react';
import { getAccounts, type Account } from './ChartOfAccounts';
import { getJournalVouchers, type JournalVoucher, type JVLine } from './JournalVoucher';
import { formatCurrency } from '../../services/settingsService';

interface LedgerRow {
    date: string;
    jvNumber: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
}

export default function AllAccountsLedger() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [vouchers, setVouchers] = useState<JournalVoucher[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [showAccountPicker, setShowAccountPicker] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const accs = getAccounts();
                if (!cancelled) setAccounts(accs);
                const jvs = await getJournalVouchers();
                if (!cancelled) setVouchers(jvs);
            } catch (e: any) {
                if (!cancelled) setError(e?.message || 'Could not load ledger data.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const selectedAccount = accounts.find(a => a.id === selectedAccountId) || null;

    // Build the ledger rows for the selected account. Only Posted vouchers
    // count (Drafts shouldn't show up — they haven't been recorded yet).
    const rows: LedgerRow[] = useMemo(() => {
        if (!selectedAccount) return [];
        const out: { date: string; jvNumber: string; reference: string; description: string; debit: number; credit: number; }[] = [];
        for (const jv of vouchers) {
            if (jv.status !== 'Posted') continue;
            if (dateFrom && (jv.date || '') < dateFrom) continue;
            if (dateTo && (jv.date || '') > dateTo) continue;
            for (const l of (jv.lines || []) as JVLine[]) {
                if (String(l.accountId) !== String(selectedAccount.id)) continue;
                out.push({
                    date: jv.date,
                    jvNumber: jv.jvNumber,
                    reference: jv.reference || '',
                    description: l.description || jv.narration || '',
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                });
            }
        }
        // Sort by date ascending so the running balance accumulates correctly.
        out.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.jvNumber.localeCompare(b.jvNumber));

        // Running balance: Debit-natured accounts (Asset/Expense) grow on
        // debits and shrink on credits; Credit-natured accounts
        // (Liability/Equity/Income) do the opposite. Opening balance from
        // the COA record seeds the running total.
        const sign = selectedAccount.nature === 'Debit' ? 1 : -1;
        let running = Number(selectedAccount.openingBalance) || 0;
        return out.map(r => {
            running += (r.debit - r.credit) * sign;
            return { ...r, runningBalance: Math.round(running * 100) / 100 };
        });
    }, [selectedAccount, vouchers, dateFrom, dateTo]);

    const totals = useMemo(() => rows.reduce(
        (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
        { debit: 0, credit: 0 },
    ), [rows]);

    const closingBalance = rows.length > 0 ? rows[rows.length - 1].runningBalance : (Number(selectedAccount?.openingBalance) || 0);

    const filteredAccounts = useMemo(() => {
        if (!search) return accounts;
        const q = search.toLowerCase();
        return accounts.filter(a =>
            a.code.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.type.toLowerCase().includes(q)
        );
    }, [accounts, search]);

    const exportCSV = () => {
        if (!selectedAccount || rows.length === 0) {
            alert('Pick an account with at least one ledger entry first.');
            return;
        }
        const lines: string[] = [];
        lines.push(`"Account","${selectedAccount.code} — ${selectedAccount.name}"`);
        lines.push(`"Opening Balance","${(Number(selectedAccount.openingBalance) || 0).toFixed(2)}"`);
        lines.push('');
        lines.push('"Date","JV","Reference","Description","Debit","Credit","Balance"');
        for (const r of rows) {
            lines.push([
                r.date,
                r.jvNumber,
                r.reference.replace(/"/g, '""'),
                r.description.replace(/"/g, '""'),
                r.debit.toFixed(2),
                r.credit.toFixed(2),
                r.runningBalance.toFixed(2),
            ].map(v => `"${v}"`).join(','));
        }
        lines.push('');
        lines.push(`"Totals","","","","${totals.debit.toFixed(2)}","${totals.credit.toFixed(2)}","${closingBalance.toFixed(2)}"`);
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ledger-${selectedAccount.code}-${selectedAccount.name.replace(/[^A-Za-z0-9-]/g, '_')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-[#800020] p-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ArrowLeft size={20} className="text-gray-500" />
                        </button>
                        <div className="w-14 h-14 bg-[#800020] rounded-xl flex items-center justify-center shadow-lg">
                            <BookOpen size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase">All-Accounts Ledger</h1>
                            <p className="text-xs text-gray-500 font-semibold mt-1">
                                Pick any account from the chart and see every journal entry that touched it.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={exportCSV}
                        disabled={!selectedAccount || rows.length === 0}
                        className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-black hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40"
                    >
                        <Download size={16} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Account picker */}
                    <div className="md:col-span-2 relative">
                        <label className="block text-xs font-black text-gray-600 uppercase mb-2">Account</label>
                        <button
                            onClick={() => setShowAccountPicker(s => !s)}
                            className="w-full text-left border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold hover:bg-gray-50 flex items-center justify-between"
                        >
                            {selectedAccount ? (
                                <span>
                                    <span className="text-gray-500 font-mono mr-2">{selectedAccount.code}</span>
                                    <span className="text-gray-900">{selectedAccount.name}</span>
                                    <span className="ml-2 px-2 py-0.5 text-[10px] font-black rounded-full bg-gray-100 text-gray-600 uppercase">{selectedAccount.type}</span>
                                </span>
                            ) : (
                                <span className="text-gray-400">— Choose an account from the chart —</span>
                            )}
                            <Filter size={14} className="text-gray-400" />
                        </button>
                        {showAccountPicker && (
                            <div className="absolute z-30 left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
                                <div className="sticky top-0 bg-white p-3 border-b">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search by code, name, or type…"
                                            className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:border-[#800020]"
                                            autoFocus
                                        />
                                        {search && (
                                            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14}/></button>
                                        )}
                                    </div>
                                </div>
                                {filteredAccounts.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-gray-400 font-bold">No accounts match your search.</div>
                                ) : filteredAccounts.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => { setSelectedAccountId(a.id); setShowAccountPicker(false); setSearch(''); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-l-4 ${a.id === selectedAccountId ? 'border-[#800020] bg-gray-50' : 'border-transparent'}`}
                                    >
                                        <span className="font-mono text-xs text-gray-500 mr-2">{a.code}</span>
                                        <span className="font-bold text-gray-900">{a.name}</span>
                                        <span className="ml-2 text-[10px] text-gray-400 uppercase">{a.type} · {a.nature}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">From</label>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full border-2 border-gray-300 rounded-lg pl-9 pr-3 py-3 text-sm font-bold outline-none focus:border-[#800020]"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">To</label>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full border-2 border-gray-300 rounded-lg pl-9 pr-3 py-3 text-sm font-bold outline-none focus:border-[#800020]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ledger body */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-[#800020] border-t-transparent rounded-full animate-spin" />
                </div>
            )}
            {error && !loading && (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 text-sm font-bold text-rose-700">{error}</div>
            )}
            {!loading && !error && !selectedAccount && (
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-16 text-center">
                    <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-sm font-black text-gray-700 uppercase tracking-widest">Choose an account to begin</p>
                    <p className="text-xs text-gray-400 mt-2">Pick from the Chart of Accounts above to see its full transaction history.</p>
                </div>
            )}
            {!loading && !error && selectedAccount && (
                <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md overflow-hidden">
                    {/* Opening / closing summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 border-b-2 border-gray-200">
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Opening Balance</p>
                            <p className="text-2xl font-mono font-black text-gray-900 mt-1">{formatCurrency(Number(selectedAccount.openingBalance) || 0)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Period Activity</p>
                            <p className="text-sm font-mono font-black text-gray-700 mt-1">
                                Dr <span className="text-emerald-700">{formatCurrency(totals.debit)}</span>
                                <span className="mx-2 text-gray-300">·</span>
                                Cr <span className="text-rose-700">{formatCurrency(totals.credit)}</span>
                            </p>
                            <p className="text-[10px] text-gray-400 font-bold mt-1">{rows.length} posted entries</p>
                        </div>
                        <div className="bg-[#800020] text-white p-4 rounded-lg">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Closing Balance</p>
                            <p className="text-2xl font-mono font-black mt-1">{formatCurrency(closingBalance)}</p>
                            <p className="text-[10px] font-bold opacity-80 mt-1">{selectedAccount.nature}-natured account</p>
                        </div>
                    </div>

                    {/* Ledger table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest">Date</th>
                                    <th className="text-left px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest">JV</th>
                                    <th className="text-left px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest">Reference</th>
                                    <th className="text-left px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest">Description</th>
                                    <th className="text-right px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest">Debit</th>
                                    <th className="text-right px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest">Credit</th>
                                    <th className="text-right px-4 py-3 text-xs font-black text-gray-700 uppercase tracking-widest">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400 font-bold">
                                            No posted journal entries for this account in the selected range.
                                        </td>
                                    </tr>
                                ) : rows.map((r, idx) => (
                                    <tr key={`${r.jvNumber}-${idx}`} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-xs font-mono text-gray-700">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
                                        <td className="px-4 py-3 text-xs font-mono font-black text-gray-900">{r.jvNumber}</td>
                                        <td className="px-4 py-3 text-xs text-gray-600">{r.reference || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{r.description || '—'}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-emerald-700">{r.debit > 0 ? formatCurrency(r.debit) : ''}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-rose-700">{r.credit > 0 ? formatCurrency(r.credit) : ''}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm font-black text-gray-900">{formatCurrency(r.runningBalance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {rows.length > 0 && (
                                <tfoot className="bg-gray-900 text-white">
                                    <tr>
                                        <td colSpan={4} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Totals</td>
                                        <td className="px-4 py-3 text-right font-mono font-black text-emerald-300">{formatCurrency(totals.debit)}</td>
                                        <td className="px-4 py-3 text-right font-mono font-black text-rose-300">{formatCurrency(totals.credit)}</td>
                                        <td className="px-4 py-3 text-right font-mono font-black">{formatCurrency(closingBalance)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
