import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Check, X, Search, FileText, Download, Eye } from 'lucide-react';
import { getAccounts, type Account } from './ChartOfAccounts';
import { formatCurrency } from '../../services/settingsService';

// ── Types ────────────────────────────────────────────────────────────────────

export interface JVLine {
    id: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
}

export interface JournalVoucher {
    id: string;
    jvNumber: string;
    date: string;
    reference: string;
    narration: string;
    lines: JVLine[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
    createdAt: string;
    status: 'Draft' | 'Posted';
    type: 'General' | 'Bad Debt' | 'Depreciation' | 'Opening Balance' | 'Adjustment';
}

// ── Storage ───────────────────────────────────────────────────────────────────

const JV_KEY = 'journal_vouchers';

export const getJournalVouchers = (): JournalVoucher[] => {
    try { return JSON.parse(localStorage.getItem(JV_KEY) || '[]'); } catch { return []; }
};

const saveJV = (jv: JournalVoucher) => {
    const list = getJournalVouchers();
    const idx = list.findIndex(j => j.id === jv.id);
    if (idx >= 0) list[idx] = jv; else list.unshift(jv);
    localStorage.setItem(JV_KEY, JSON.stringify(list));
};

const deleteJV = (id: string) => {
    const list = getJournalVouchers().filter(j => j.id !== id);
    localStorage.setItem(JV_KEY, JSON.stringify(list));
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptyLine = (): JVLine => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    accountId: '', accountCode: '', accountName: '',
    description: '', debit: 0, credit: 0
});

const nextJVNumber = (): string => {
    const list = getJournalVouchers();
    const last = list[0]?.jvNumber;
    if (!last) return 'JV-0001';
    const num = parseInt(last.replace('JV-', '')) + 1;
    return `JV-${String(num).padStart(4, '0')}`;
};

// ── JV Form Component ─────────────────────────────────────────────────────────

interface JVFormProps {
    accounts: Account[];
    editJV?: JournalVoucher;
    onSave: (jv: JournalVoucher, post: boolean) => void;
    onCancel: () => void;
}

function JVForm({ accounts, editJV, onSave, onCancel }: JVFormProps) {
    const [jvNumber] = useState(editJV?.jvNumber || nextJVNumber());
    const [date, setDate] = useState(editJV?.date || new Date().toISOString().slice(0, 10));
    const [reference, setReference] = useState(editJV?.reference || '');
    const [narration, setNarration] = useState(editJV?.narration || '');
    const [type, setType] = useState<JournalVoucher['type']>(editJV?.type || 'General');
    const [lines, setLines] = useState<JVLine[]>(editJV?.lines || [emptyLine(), emptyLine()]);
    const [acSearch, setAcSearch] = useState<Record<string, string>>({});
    const [showAcDrop, setShowAcDrop] = useState<string | null>(null);

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;
    const difference = totalDebit - totalCredit;

    const updateLine = (id: string, field: keyof JVLine, value: any) => {
        setLines(prev => prev.map(l => {
            if (l.id !== id) return l;
            const updated = { ...l, [field]: value };
            // If debit is set, clear credit and vice versa
            if (field === 'debit' && value > 0) updated.credit = 0;
            if (field === 'credit' && value > 0) updated.debit = 0;
            return updated;
        }));
    };

    const selectAccount = (lineId: string, account: Account) => {
        setLines(prev => prev.map(l => l.id !== lineId ? l : {
            ...l, accountId: account.id,
            accountCode: account.code, accountName: account.name
        }));
        setShowAcDrop(null);
        setAcSearch(prev => ({ ...prev, [lineId]: '' }));
    };

    const removeLine = (id: string) => {
        if (lines.length <= 2) return;
        setLines(prev => prev.filter(l => l.id !== id));
    };

    const handleSave = (post: boolean) => {
        if (!narration.trim()) { alert('Narration is required.'); return; }
        if (lines.some(l => !l.accountId)) { alert('All lines must have an account selected.'); return; }
        if (lines.some(l => l.debit === 0 && l.credit === 0)) { alert('All lines must have a debit or credit amount.'); return; }
        if (!isBalanced) { alert(`Journal is not balanced. Difference: ${formatCurrency(Math.abs(difference))}`); return; }

        const jv: JournalVoucher = {
            id: editJV?.id || Date.now().toString(),
            jvNumber, date, reference, narration, type, lines,
            totalDebit, totalCredit, isBalanced,
            createdAt: editJV?.createdAt || new Date().toISOString(),
            status: post ? 'Posted' : 'Draft'
        };
        onSave(jv, post);
    };

    const getFilteredAccounts = (search: string) => {
        const q = search.toLowerCase();
        return accounts.filter(a =>
            a.name.toLowerCase().includes(q) || a.code.includes(q)
        ).slice(0, 15);
    };

    return (
        <div className="space-y-5">
            {/* JV Header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">JV Number</label>
                    <input value={jvNumber} readOnly
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono font-black bg-gray-50 text-orange-600" />
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Type</label>
                    <select value={type} onChange={e => setType(e.target.value as any)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400">
                        <option value="General">General</option>
                        <option value="Bad Debt">Bad Debt Write-off</option>
                        <option value="Depreciation">Depreciation</option>
                        <option value="Opening Balance">Opening Balance</option>
                        <option value="Adjustment">Adjustment</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Reference</label>
                    <input value={reference} onChange={e => setReference(e.target.value)}
                        placeholder="Invoice #, PO #, etc."
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                </div>
            </div>

            <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Narration / Description *</label>
                <input value={narration} onChange={e => setNarration(e.target.value)}
                    placeholder="e.g. Bad debt write-off for GEORGE - GL Garage Freeport"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
            </div>

            {/* Lines Table */}
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full text-left">
                    <thead className="bg-gray-900 text-white">
                        <tr>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest w-[35%]">Account</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Description</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right w-32">Debit</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right w-32">Credit</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {lines.map((line) => (
                            <tr key={line.id} className="hover:bg-gray-50">
                                {/* Account selector */}
                                <td className="px-3 py-2 relative">
                                    <div className="relative">
                                        <input
                                            value={acSearch[line.id] !== undefined ? acSearch[line.id] : line.accountName}
                                            onChange={e => {
                                                setAcSearch(prev => ({ ...prev, [line.id]: e.target.value }));
                                                setShowAcDrop(line.id);
                                            }}
                                            onFocus={() => {
                                                setAcSearch(prev => ({ ...prev, [line.id]: '' }));
                                                setShowAcDrop(line.id);
                                            }}
                                            placeholder="Search account..."
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400"
                                        />
                                        {showAcDrop === line.id && (
                                            <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                                                {getFilteredAccounts(acSearch[line.id] || '').map(ac => (
                                                    <button key={ac.id} type="button"
                                                        onClick={() => selectAccount(line.id, ac)}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-orange-50 text-xs transition-all border-b border-gray-50 flex items-center justify-between">
                                                        <span><span className="font-mono text-gray-400 mr-2">{ac.code}</span>{ac.name}</span>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${ac.nature === 'Debit' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{ac.nature}</span>
                                                    </button>
                                                ))}
                                                {getFilteredAccounts(acSearch[line.id] || '').length === 0 && (
                                                    <div className="px-4 py-3 text-xs text-gray-400">No accounts found</div>
                                                )}
                                                <button type="button" onClick={() => { setShowAcDrop(null); setAcSearch(prev => ({ ...prev, [line.id]: line.accountName })); }}
                                                    className="w-full text-center px-4 py-2 text-xs text-gray-400 hover:bg-gray-50 border-t border-gray-100">
                                                    Close
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {line.accountCode && (
                                        <p className="text-[10px] text-gray-400 mt-0.5 pl-1 font-mono">{line.accountCode}</p>
                                    )}
                                </td>
                                {/* Description */}
                                <td className="px-3 py-2">
                                    <input value={line.description} onChange={e => updateLine(line.id, 'description', e.target.value)}
                                        placeholder="Line description..."
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                                </td>
                                {/* Debit */}
                                <td className="px-3 py-2">
                                    <input type="number" min={0} step="0.01"
                                        value={line.debit || ''}
                                        onChange={e => updateLine(line.id, 'debit', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-right font-mono font-black focus:outline-none focus:border-blue-400 focus:bg-blue-50" />
                                </td>
                                {/* Credit */}
                                <td className="px-3 py-2">
                                    <input type="number" min={0} step="0.01"
                                        value={line.credit || ''}
                                        onChange={e => updateLine(line.id, 'credit', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-right font-mono font-black focus:outline-none focus:border-emerald-400 focus:bg-emerald-50" />
                                </td>
                                {/* Delete */}
                                <td className="px-2 py-2">
                                    <button onClick={() => removeLine(line.id)} disabled={lines.length <= 2}
                                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-300 hover:text-red-500 disabled:opacity-20 transition-all">
                                        <Trash2 size={13} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {/* Totals row */}
                    <tfoot>
                        <tr className={`${isBalanced ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <td colSpan={2} className="px-4 py-3">
                                <button onClick={() => setLines(prev => [...prev, emptyLine()])}
                                    className="flex items-center gap-1.5 text-xs font-black text-orange-600 hover:text-orange-800 transition-all">
                                    <Plus size={13} /> Add Line
                                </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                                <p className="text-[10px] font-black text-gray-500 uppercase mb-0.5">Total Debit</p>
                                <p className="text-sm font-black font-mono text-blue-700">{formatCurrency(totalDebit)}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                                <p className="text-[10px] font-black text-gray-500 uppercase mb-0.5">Total Credit</p>
                                <p className="text-sm font-black font-mono text-emerald-700">{formatCurrency(totalCredit)}</p>
                            </td>
                            <td className="px-2 py-3"></td>
                        </tr>
                        {!isBalanced && totalDebit > 0 && (
                            <tr className="bg-red-100">
                                <td colSpan={5} className="px-4 py-2 text-xs font-black text-red-700 text-center">
                                    ⚠️ Out of balance by {formatCurrency(Math.abs(difference))} — {difference > 0 ? 'Credit side needs ' + formatCurrency(Math.abs(difference)) : 'Debit side needs ' + formatCurrency(Math.abs(difference))}
                                </td>
                            </tr>
                        )}
                        {isBalanced && (
                            <tr className="bg-emerald-100">
                                <td colSpan={5} className="px-4 py-2 text-xs font-black text-emerald-700 text-center">
                                    ✅ Balanced — Debit = Credit = {formatCurrency(totalDebit)}
                                </td>
                        </tr>
                        )}
                    </tfoot>
                </table>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => handleSave(false)}
                    className="flex items-center gap-2 px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-black hover:bg-gray-50 transition-all">
                    <FileText size={14} /> Save as Draft
                </button>
                <button onClick={() => handleSave(true)} disabled={!isBalanced}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 disabled:opacity-40 transition-all">
                    <Check size={14} /> Post Journal Entry
                </button>
                <button onClick={onCancel}
                    className="px-4 py-2.5 text-sm font-black text-gray-400 hover:text-gray-700 transition-all">
                    Cancel
                </button>
                {!isBalanced && totalDebit > 0 && (
                    <p className="text-xs text-red-500 font-bold ml-2">Cannot post — journal must be balanced</p>
                )}
            </div>
        </div>
    );
}

// ── JV Detail / View Component ────────────────────────────────────────────────

function JVDetail({ jv, onClose }: { jv: JournalVoucher; onClose: () => void }) {
    const printJV = () => {
        const html = `<!DOCTYPE html><html><head><title>${jv.jvNumber}</title>
<style>body{font-family:Arial;margin:30px;color:#1a1a1a}h1{color:#f97316;font-size:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#1a1a1a;color:white;padding:8px 12px;text-align:left;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}.total{font-weight:bold;background:#f9f9f9}.right{text-align:right}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;font-size:13px}.label{color:#666;font-size:11px;text-transform:uppercase;margin-bottom:2px}</style></head>
<body><h1>Journal Voucher</h1>
<div class="meta">
<div><div class="label">JV Number</div><strong>${jv.jvNumber}</strong></div>
<div><div class="label">Date</div>${jv.date}</div>
<div><div class="label">Type</div>${jv.type}</div>
<div><div class="label">Reference</div>${jv.reference || '—'}</div>
<div><div class="label">Status</div>${jv.status}</div>
<div><div class="label">Narration</div>${jv.narration}</div>
</div>
<table>
<thead><tr><th>Account Code</th><th>Account Name</th><th>Description</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
<tbody>
${jv.lines.map(l => `<tr><td>${l.accountCode}</td><td>${l.accountName}</td><td>${l.description || ''}</td><td class="right">${l.debit > 0 ? l.debit.toFixed(2) : ''}</td><td class="right">${l.credit > 0 ? l.credit.toFixed(2) : ''}</td></tr>`).join('')}
<tr class="total"><td colspan="3">Total</td><td class="right">${jv.totalDebit.toFixed(2)}</td><td class="right">${jv.totalCredit.toFixed(2)}</td></tr>
</tbody></table>
</body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gray-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <p className="text-white font-black text-sm">{jv.jvNumber}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${jv.status === 'Posted' ? 'bg-emerald-500 text-white' : 'bg-yellow-500 text-white'}`}>{jv.status}</span>
                    <span className="text-gray-400 text-xs">{jv.type}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={printJV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all">
                        <Download size={12} /> Print / PDF
                    </button>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-red-500 text-white rounded-lg transition-all"><X size={14} /></button>
                </div>
            </div>
            <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {[
                        { label: 'Date', value: jv.date },
                        { label: 'Reference', value: jv.reference || '—' },
                        { label: 'Narration', value: jv.narration },
                        { label: 'Created', value: new Date(jv.createdAt).toLocaleDateString() },
                    ].map((f, i) => (
                        <div key={i}>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{f.label}</p>
                            <p className="text-sm font-bold text-gray-900">{f.value}</p>
                        </div>
                    ))}
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50">
                        <tr>
                            {['Code', 'Account', 'Description', 'Debit', 'Credit'].map(h => (
                                <th key={h} className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {jv.lines.map(line => (
                            <tr key={line.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-xs font-mono text-gray-400">{line.accountCode}</td>
                                <td className="px-4 py-3 text-sm font-bold text-gray-900">{line.accountName}</td>
                                <td className="px-4 py-3 text-xs text-gray-500">{line.description || '—'}</td>
                                <td className="px-4 py-3 text-sm font-black font-mono text-blue-700 text-right">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                                <td className="px-4 py-3 text-sm font-black font-mono text-emerald-700 text-right">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-900 text-white">
                            <td colSpan={3} className="px-4 py-3 text-xs font-black uppercase">Total</td>
                            <td className="px-4 py-3 text-sm font-black font-mono text-right">{formatCurrency(jv.totalDebit)}</td>
                            <td className="px-4 py-3 text-sm font-black font-mono text-right">{formatCurrency(jv.totalCredit)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

// ── Main Journal Voucher Page ─────────────────────────────────────────────────

export default function JournalVoucher() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [vouchers, setVouchers] = useState<JournalVoucher[]>([]);
    const [mode, setMode] = useState<'list' | 'new' | 'view'>('list');
    const [viewJV, setViewJV] = useState<JournalVoucher | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Posted'>('All');

    useEffect(() => {
        setAccounts(getAccounts());
        setVouchers(getJournalVouchers());
    }, []);

    const handleSave = (jv: JournalVoucher, post: boolean) => {
        saveJV(jv);
        setVouchers(getJournalVouchers());
        setMode('list');
        alert(`✅ ${jv.jvNumber} ${post ? 'posted' : 'saved as draft'} successfully!`);
    };

    const handleDelete = (id: string) => {
        const jv = vouchers.find(j => j.id === id);
        if (jv?.status === 'Posted') { alert('Cannot delete a posted journal entry. Create a reversing entry instead.'); return; }
        if (!confirm('Delete this draft journal voucher?')) return;
        deleteJV(id);
        setVouchers(getJournalVouchers());
    };

    const filtered = vouchers
        .filter(j => statusFilter === 'All' || j.status === statusFilter)
        .filter(j => !search ||
            j.jvNumber.toLowerCase().includes(search.toLowerCase()) ||
            j.narration.toLowerCase().includes(search.toLowerCase()) ||
            j.reference.toLowerCase().includes(search.toLowerCase())
        );

    const totalPosted = vouchers.filter(j => j.status === 'Posted').reduce((s, j) => s + j.totalDebit, 0);
    const drafts = vouchers.filter(j => j.status === 'Draft').length;

    if (mode === 'new') {
        return (
            <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <button onClick={() => setMode('list')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all">
                        <ArrowLeft size={14} /> Back to Vouchers
                    </button>
                    <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">New Journal Voucher</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Double-entry bookkeeping — total debits must equal total credits</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <JVForm accounts={accounts} onSave={handleSave} onCancel={() => setMode('list')} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Journal Vouchers</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Double-entry bookkeeping · {vouchers.length} vouchers total</p>
                    </div>
                    <button onClick={() => setMode('new')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 transition-all">
                        <Plus size={16} /> New Journal Voucher
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Vouchers', value: vouchers.length, color: 'text-gray-900' },
                    { label: 'Posted', value: vouchers.filter(j => j.status === 'Posted').length, color: 'text-emerald-600' },
                    { label: 'Drafts', value: drafts, color: drafts > 0 ? 'text-amber-600' : 'text-gray-400' },
                    { label: 'Total Posted Value', value: formatCurrency(totalPosted), color: 'text-blue-600' },
                ].map((k, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{k.label}</p>
                        <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* View JV */}
            {viewJV && <JVDetail jv={viewJV} onClose={() => setViewJV(null)} />}

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search by JV number, narration, reference..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                </div>
                {(['All', 'Draft', 'Posted'] as const).map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                        className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {s}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="p-16 text-center">
                        <FileText size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-bold">No journal vouchers yet</p>
                        <p className="text-gray-300 text-sm mt-1">Click "New Journal Voucher" to create your first entry</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {['JV Number', 'Date', 'Type', 'Narration', 'Reference', 'Amount', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(jv => (
                                <tr key={jv.id} className="hover:bg-gray-50 transition-all">
                                    <td className="px-5 py-4">
                                        <p className="text-sm font-black text-orange-600 font-mono">{jv.jvNumber}</p>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-500 font-mono">{jv.date}</td>
                                    <td className="px-5 py-4">
                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{jv.type}</span>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-700 max-w-[200px] truncate">{jv.narration}</td>
                                    <td className="px-5 py-4 text-xs font-mono text-gray-400">{jv.reference || '—'}</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono text-gray-900">{formatCurrency(jv.totalDebit)}</td>
                                    <td className="px-5 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black ${jv.status === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {jv.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setViewJV(viewJV?.id === jv.id ? null : jv)}
                                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400 hover:text-blue-600 transition-all" title="View">
                                                <Eye size={14} />
                                            </button>
                                            {jv.status === 'Draft' && (
                                                <button onClick={() => handleDelete(jv.id)}
                                                    className="p-1.5 hover:bg-red-50 rounded-lg text-red-300 hover:text-red-500 transition-all" title="Delete draft">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <p className="text-xs text-gray-400 text-center">Posted entries cannot be deleted — create a reversing entry to correct them · Drafts can be deleted</p>
        </div>
    );
}
