import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Check, RefreshCw, Search, RotateCcw } from 'lucide-react';
import { getCustomers, getInvoices, type Customer, type Invoice } from '../../services/api';
import { getAccounts, DEFAULT_ACCOUNTS } from './ChartOfAccounts';
import { formatCurrency } from '../../services/settingsService';

// Helper to generate JV number
const nextBDJVNumber = (): string => {
    const stored = JSON.parse(localStorage.getItem('journal_vouchers') || '[]');
    const last = stored[0]?.jvNumber;
    if (!last) return 'JV-0001';
    const num = parseInt(last.replace('JV-', '')) + 1;
    return `JV-${String(num).padStart(4, '0')}`;
};

interface BadDebtCandidate {
    invoice: Invoice;
    customer: Customer | undefined;
    daysPastDue: number;
    amount: number;
}

export default function BadDebtsJV() {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState<BadDebtCandidate[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [recentJVs, setRecentJVs] = useState<any[]>([]);
    const [reversingId, setReversingId] = useState<string | null>(null);

    const loadRecentJVs = () => {
        try {
            const stored = JSON.parse(localStorage.getItem('journal_vouchers') || '[]');
            // Only Bad Debt JVs, newest first, top 20
            const badDebts = stored.filter((j: any) => j?.type === 'Bad Debt').slice(0, 20);
            setRecentJVs(badDebts);
        } catch { setRecentJVs([]); }
    };
    useEffect(() => { loadRecentJVs(); }, []);

    const filteredCandidates = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return candidates;
        return candidates.filter(c =>
            (c.customer?.name || '').toLowerCase().includes(q) ||
            (c.customer?.phone || '').toLowerCase().includes(q) ||
            (c.invoice.invoiceNumber || '').toLowerCase().includes(q)
        );
    }, [candidates, searchTerm]);

    useEffect(() => {
        Promise.all([getInvoices(), getCustomers()]).then(([invoices, customers]) => {
            const today = new Date();
            const custMap: Record<string, Customer> = {};
            customers.forEach(c => { custMap[String(c.id)] = c; });

            // Find unpaid invoices that are overdue
            const overdue: BadDebtCandidate[] = invoices
                .filter(inv => inv.status === 'Unpaid' || inv.status === 'Overdue')
                .map(inv => {
                    const due = new Date(inv.dueDate);
                    const daysPastDue = Math.floor((today.getTime() - due.getTime()) / 86400000);
                    const remaining = inv.grandTotal - (inv.amount_paid || 0);
                    return {
                        invoice: inv,
                        customer: custMap[String(inv.customerId)],
                        daysPastDue,
                        amount: remaining
                    };
                })
                .filter(c => c.daysPastDue > 0 && c.amount > 0)
                .sort((a, b) => b.daysPastDue - a.daysPastDue);

            setCandidates(overdue);
            setLoading(false);
        });
    }, []);

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectedCandidates = candidates.filter(c => selected.has(c.invoice.id));
    const totalAmount = selectedCandidates.reduce((s, c) => s + c.amount, 0);

    const urgencyColor = (days: number) => {
        if (days > 90) return 'bg-red-100 text-red-700 border-red-200';
        if (days > 60) return 'bg-orange-100 text-orange-700 border-orange-200';
        return 'bg-amber-100 text-amber-700 border-amber-200';
    };

    const createBadDebtJV = async () => {
        if (selectedCandidates.length === 0) {
            alert('Select at least one invoice to write off.');
            return;
        }
        if (!notes.trim()) {
            alert('Please add a narration for this bad debt write-off.');
            return;
        }
        setSaving(true);
        try {
            // Initialize default accounts if none exist
            let accounts = getAccounts();
            if (accounts.length === 0) {
                localStorage.setItem('chart_of_accounts', JSON.stringify(DEFAULT_ACCOUNTS));
                accounts = DEFAULT_ACCOUNTS;
            }
            const badDebtAcc = accounts.find(a => a.code === '5250' || a.name.toLowerCase().includes('bad debt'));
            const arAcc = accounts.find(a => a.code === '1120' || a.name.toLowerCase().includes('receivable'));

            if (!badDebtAcc || !arAcc) {
                alert('Required accounts not found. Please ensure "Bad Debts" (5250) and "Accounts Receivable" (1120) exist in Chart of Accounts.');
                setSaving(false);
                return;
            }

            const jv = {
                id: Date.now().toString(),
                jvNumber: nextBDJVNumber(),
                date,
                reference: selectedCandidates.map(c => c.invoice.invoiceNumber).join(', '),
                narration: notes || `Bad debt write-off: ${selectedCandidates.map(c => c.customer?.name || 'Unknown').join(', ')}`,
                type: 'Bad Debt' as const,
                // Snapshot of the customers/invoices/amounts so the JV can be reversed
                // without having to re-derive them from the lines list.
                affectedCustomers: selectedCandidates.map(c => ({
                    customerId: c.invoice.customerId,
                    customerName: c.customer?.name || '',
                    invoiceId: c.invoice.id,
                    invoiceNumber: c.invoice.invoiceNumber,
                    amount: c.amount,
                })),
                lines: selectedCandidates.flatMap(c => [
                    {
                        id: `${Date.now()}-dr-${c.invoice.id}`,
                        accountId: badDebtAcc.id,
                        accountCode: badDebtAcc.code,
                        accountName: badDebtAcc.name,
                        description: `Bad debt: ${c.invoice.invoiceNumber} — ${c.customer?.name}`,
                        debit: c.amount,
                        credit: 0
                    },
                    {
                        id: `${Date.now()}-cr-${c.invoice.id}`,
                        accountId: arAcc.id,
                        accountCode: arAcc.code,
                        accountName: arAcc.name,
                        description: `Write off: ${c.invoice.invoiceNumber} — ${c.customer?.name}`,
                        debit: 0,
                        credit: c.amount
                    }
                ]),
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                isBalanced: true,
                createdAt: new Date().toISOString(),
                status: 'Posted' as const
            };

            // Save JV (local-only ledger of journal vouchers — unchanged).
            const existing = JSON.parse(localStorage.getItem('journal_vouchers') || '[]');
            localStorage.setItem('journal_vouchers', JSON.stringify([jv, ...existing]));

            // TC-65: also reduce each affected customer's accounts-receivable balance
            // on the server. POSTing a payment to /api/customers/{id}/payments is the
            // only path that decrements customer.balance, so we use that with a clearly
            // labeled payment_method/notes so it can be distinguished from real cash.
            // After posting, if the customer's balance went negative (e.g. because of
            // BETTANO orphan credits in the ledger), clamp it back to 0 with a PUT —
            // the user's accounting view is "a written-off customer owes nothing",
            // not "the customer now has a credit with us". Other customers' balances
            // are untouched.
            const base = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '') + '/api';
            let arOk = 0;
            const arFailures: string[] = [];
            const touchedCustomerIds = new Set<string>();
            for (const c of selectedCandidates) {
                const cid = c.invoice.customerId;
                if (!cid) { arFailures.push(c.invoice.invoiceNumber); continue; }
                const payload = {
                    customer_id: Number(cid) || cid,
                    amount: c.amount,
                    payment_date: date,
                    payment_method: 'Bad Debt Write-Off',
                    reference: `${jv.jvNumber} / ${c.invoice.invoiceNumber}`,
                    notes: `Bad debt write-off (${jv.jvNumber}) — ${notes || 'no narration'}`,
                };
                try {
                    const r = await fetch(`${base}/customers/${cid}/payments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    if (r.ok) { arOk += 1; touchedCustomerIds.add(String(cid)); }
                    else arFailures.push(c.invoice.invoiceNumber);
                } catch {
                    arFailures.push(c.invoice.invoiceNumber);
                }
            }

            // Clamp negative balances to 0 on any customer we just wrote off.
            for (const cid of touchedCustomerIds) {
                try {
                    const r = await fetch(`${base}/customers/${cid}`, { cache: 'no-store' });
                    if (!r.ok) continue;
                    const cust = await r.json();
                    if (Number(cust?.balance) < 0) {
                        await fetch(`${base}/customers/${cid}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ balance: 0 }),
                        });
                    }
                } catch { /* not fatal */ }
            }

            if (arFailures.length === 0) {
                setSuccess(`✅ Bad Debt JV ${jv.jvNumber} posted for ${formatCurrency(totalAmount)}. Customer balances reduced (${arOk}/${selectedCandidates.length}).`);
            } else {
                setSuccess(`⚠️ JV ${jv.jvNumber} posted, but ${arFailures.length} customer balance(s) could not be reduced: ${arFailures.join(', ')}.`);
            }
            setSelected(new Set());
            loadRecentJVs();
            setTimeout(() => setSuccess(''), 8000);
        } catch (e) {
            alert('Failed to create JV. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const reverseBadDebtJV = async (jv: any) => {
        if (jv?.status === 'Reversed') {
            alert('This JV has already been reversed.');
            return;
        }
        const affected = Array.isArray(jv?.affectedCustomers) ? jv.affectedCustomers : [];
        if (affected.length === 0) {
            alert('This JV does not have a customer snapshot — it cannot be auto-reversed. (Older JVs created before the reversal feature.)');
            return;
        }
        const total = affected.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
        if (!window.confirm(
            `Reverse JV ${jv.jvNumber}?\n\n` +
            `This will restore ${formatCurrency(total)} across ${affected.length} customer(s):\n` +
            affected.map((x: any) => `  • ${x.customerName || 'Customer ' + x.customerId}: +${formatCurrency(x.amount)}`).join('\n') +
            `\n\nA reversal JV will be posted and a debit entry will appear on each customer's ledger.`
        )) return;

        setReversingId(jv.id);
        try {
            const base = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '') + '/api';
            const failures: string[] = [];
            let ok = 0;
            for (const a of affected) {
                if (!a?.customerId) { failures.push(a?.invoiceNumber || 'unknown'); continue; }
                const payload = {
                    amount: Number(a.amount) || 0,
                    payment_date: new Date().toISOString().slice(0, 10),
                    payment_method: 'Bad Debt Reversal',
                    reference: `REV ${jv.jvNumber} / ${a.invoiceNumber}`,
                    notes: `Reversal of bad-debt write-off ${jv.jvNumber} — ${a.invoiceNumber}`,
                    type: 'debit',
                };
                try {
                    const r = await fetch(`${base}/customers/${a.customerId}/debits`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    if (r.ok) ok += 1;
                    else failures.push(a.invoiceNumber || a.customerName || 'unknown');
                } catch {
                    failures.push(a.invoiceNumber || a.customerName || 'unknown');
                }
            }

            // Mark original as Reversed and append a reversal JV (mirror entries).
            const stored = JSON.parse(localStorage.getItem('journal_vouchers') || '[]');
            const updated = stored.map((j: any) => j.id === jv.id ? { ...j, status: 'Reversed', reversedAt: new Date().toISOString() } : j);
            const reversal = {
                id: Date.now().toString(),
                jvNumber: nextBDJVNumber(),
                date: new Date().toISOString().slice(0, 10),
                reference: `Reversal of ${jv.jvNumber}`,
                narration: `Reversal of bad-debt write-off ${jv.jvNumber}`,
                type: 'Bad Debt Reversal' as const,
                lines: (jv.lines || []).map((l: any) => ({ ...l, debit: l.credit, credit: l.debit })),
                totalDebit: jv.totalCredit,
                totalCredit: jv.totalDebit,
                isBalanced: true,
                createdAt: new Date().toISOString(),
                status: 'Posted' as const,
                reverses: jv.jvNumber,
            };
            localStorage.setItem('journal_vouchers', JSON.stringify([reversal, ...updated]));

            if (failures.length === 0) {
                setSuccess(`✅ JV ${jv.jvNumber} reversed (${formatCurrency(total)}). Customer balances restored (${ok}/${affected.length}). Reversal JV: ${reversal.jvNumber}.`);
            } else {
                setSuccess(`⚠️ JV ${jv.jvNumber} marked reversed, but ${failures.length} customer balance(s) could not be restored: ${failures.join(', ')}.`);
            }
            loadRecentJVs();
            setTimeout(() => setSuccess(''), 8000);
        } finally {
            setReversingId(null);
        }
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">

            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                        <AlertTriangle size={22} className="text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Bad Debts Write-Off</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Write off uncollectable invoices — automatically creates balanced JV entry</p>
                    </div>
                </div>
            </div>

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                    <Check size={20} className="text-emerald-600 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-black text-emerald-700">{success}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">JV is now visible in Journal Vouchers. The accounts receivable has been reduced.</p>
                    </div>
                    <button onClick={() => navigate('/finance/journal-voucher')} className="ml-auto text-xs font-black text-emerald-600 underline hover:text-emerald-800">
                        View JV →
                    </button>
                </div>
            )}

            {/* JV Settings */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Journal Entry Settings</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Write-off Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Narration *</label>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="e.g. Bad debt write-off Q1 2026"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                </div>
                <div className="mt-4 bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
                    <p className="font-black text-gray-700">Auto-generated Journal Entry:</p>
                    <p>Dr 5250 Bad Debts Expense ············ <span className="font-black text-red-600">{formatCurrency(totalAmount)}</span></p>
                    <p>Cr 1120 Accounts Receivable ·········· <span className="font-black text-emerald-600">{formatCurrency(totalAmount)}</span></p>
                </div>
            </div>

            {/* Invoice List */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-sm font-black text-gray-900">Overdue Invoices</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {searchTerm.trim()
                                ? `${filteredCandidates.length} of ${candidates.length} match — select to write off`
                                : `${candidates.length} overdue invoices found — select to write off`}
                        </p>
                    </div>
                    <div className="flex-1 min-w-[240px] max-w-md">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by customer name, phone, or invoice #..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                            autoComplete="off"
                        />
                    </div>
                    {selectedCandidates.length > 0 && (
                        <button onClick={createBadDebtJV} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 disabled:opacity-50 transition-all">
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                            Write Off {selectedCandidates.length} Invoice{selectedCandidates.length !== 1 ? 's' : ''} ({formatCurrency(totalAmount)})
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-400 font-bold">Loading overdue invoices...</div>
                ) : candidates.length === 0 ? (
                    <div className="p-12 text-center">
                        <Check size={48} className="mx-auto text-emerald-200 mb-4" />
                        <p className="text-gray-400 font-bold">No overdue invoices</p>
                        <p className="text-gray-300 text-sm mt-1">All invoices are paid or not yet due</p>
                    </div>
                ) : filteredCandidates.length === 0 ? (
                    <div className="p-12 text-center">
                        <Search size={40} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-400 font-bold">No matches for &ldquo;{searchTerm}&rdquo;</p>
                        <p className="text-gray-300 text-sm mt-1">Try a different name, phone, or invoice number.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 w-10">
                                        <input type="checkbox"
                                            checked={filteredCandidates.length > 0 && filteredCandidates.every(c => selected.has(c.invoice.id))}
                                            onChange={e => {
                                                const next = new Set(selected);
                                                if (e.target.checked) filteredCandidates.forEach(c => next.add(c.invoice.id));
                                                else filteredCandidates.forEach(c => next.delete(c.invoice.id));
                                                setSelected(next);
                                            }}
                                            className="rounded" />
                                    </th>
                                    {['Customer', 'Invoice', 'Due Date', 'Days Overdue', 'Amount', 'Risk'].map(h => (
                                        <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredCandidates.map(c => (
                                    <tr key={c.invoice.id}
                                        className={`transition-all cursor-pointer ${selected.has(c.invoice.id) ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                                        onClick={() => toggleSelect(c.invoice.id)}>
                                        <td className="px-5 py-4">
                                            <input type="checkbox" checked={selected.has(c.invoice.id)}
                                                onChange={() => toggleSelect(c.invoice.id)} className="rounded"
                                                onClick={e => e.stopPropagation()} />
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-black text-gray-900">{c.customer?.name || `Customer ${c.invoice.customerId}`}</p>
                                            <p className="text-xs text-gray-400">{c.customer?.phone || ''}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-mono font-bold text-gray-700">{c.invoice.invoiceNumber}</p>
                                        </td>
                                        <td className="px-5 py-4 text-sm font-mono text-gray-500">{c.invoice.dueDate}</td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-black border ${urgencyColor(c.daysPastDue)}`}>
                                                {c.daysPastDue} days
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-sm font-black font-mono text-red-600">{formatCurrency(c.amount)}</td>
                                        <td className="px-5 py-4">
                                            <span className={`text-xs font-black ${c.daysPastDue > 90 ? 'text-red-600' : c.daysPastDue > 60 ? 'text-orange-600' : 'text-amber-600'}`}>
                                                {c.daysPastDue > 90 ? '🔴 High' : c.daysPastDue > 60 ? '🟠 Medium' : '🟡 Low'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {selectedCandidates.length > 0 && (
                                <tfoot>
                                    <tr className="bg-red-50 border-t-2 border-red-200">
                                        <td colSpan={5} className="px-5 py-3 text-sm font-black text-red-700">
                                            {selectedCandidates.length} invoice{selectedCandidates.length !== 1 ? 's' : ''} selected for write-off
                                        </td>
                                        <td className="px-5 py-3 text-sm font-black font-mono text-red-700">{formatCurrency(totalAmount)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-400 text-center">
                Writing off a bad debt creates: Dr Bad Debts Expense / Cr Accounts Receivable · This is permanent and posts immediately
            </p>

            {/* Recent write-offs with reverse buttons */}
            {recentJVs.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <p className="text-sm font-black text-gray-900">Recent Bad-Debt JVs</p>
                        <p className="text-xs text-gray-400 mt-0.5">Click <span className="font-bold text-amber-600">Reverse</span> to undo a write-off — customer balance and ledger will be restored.</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {recentJVs.map(jv => {
                            const total = Array.isArray(jv.affectedCustomers)
                                ? jv.affectedCustomers.reduce((s: number, x: any) => s + Number(x.amount || 0), 0)
                                : Number(jv.totalDebit || 0);
                            const isReversed = jv.status === 'Reversed';
                            return (
                                <div key={jv.id} className="px-5 py-4 flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-black text-gray-900 font-mono">{jv.jvNumber}</p>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isReversed ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600'}`}>
                                                {isReversed ? 'Reversed' : 'Posted'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 truncate">{jv.narration || '—'}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{jv.date} · {Array.isArray(jv.affectedCustomers) ? `${jv.affectedCustomers.length} customer(s)` : '—'}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-black font-mono text-red-600">{formatCurrency(total)}</p>
                                    </div>
                                    <button
                                        onClick={() => reverseBadDebtJV(jv)}
                                        disabled={isReversed || reversingId === jv.id || !Array.isArray(jv.affectedCustomers) || jv.affectedCustomers.length === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-xs font-black rounded-xl hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                                        title={isReversed ? 'Already reversed' : 'Reverse this write-off'}
                                    >
                                        {reversingId === jv.id ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                        {reversingId === jv.id ? 'Reversing…' : 'Reverse'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
