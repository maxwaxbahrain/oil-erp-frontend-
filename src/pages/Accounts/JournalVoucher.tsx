import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import {
    ArrowLeft,
    Plus,
    Trash2,
    Check,
    X,
    FileText,
    Download,
    Eye,
    Search,
    Calendar,
    AlertTriangle,
    Bot,
    ChevronRight,
    RotateCcw,
    ShieldAlert,
} from 'lucide-react';
import { getAccounts, DEFAULT_ACCOUNTS, type Account } from './ChartOfAccounts';

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

// ── Storage: backend-persisted via /api/journal-vouchers ──────────────────────

const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
const JV_API = `${API_HOST}/api/journal-vouchers`;

export const getJournalVouchers = async (): Promise<JournalVoucher[]> => {
    try {
        const r = await fetch(`${JV_API}/`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        console.error('[JournalVoucher] Failed to load vouchers:', e);
        return [];
    }
};

const createJV = async (jv: JournalVoucher): Promise<JournalVoucher> => {
    const r = await fetch(`${JV_API}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: jv.date,
            reference: jv.reference,
            narration: jv.narration,
            type: jv.type,
            status: jv.status,
            lines: jv.lines.map(l => ({
                accountId: l.accountId,
                accountCode: l.accountCode,
                accountName: l.accountName,
                description: l.description,
                debit: l.debit,
                credit: l.credit,
            })),
        }),
    });
    if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`Failed to save journal voucher: ${r.status} ${text}`);
    }
    return await r.json();
};

const deleteJVApi = async (id: string): Promise<void> => {
    const r = await fetch(`${JV_API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) {
        const text = await r.text().catch(() => '');
        throw new Error(`Failed to delete voucher: ${r.status} ${text}`);
    }
};

// ── UI tokens (dark redwood) ─────────────────────────────────────────────────

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

const primaryBtn: CSSProperties = {
    ...ghostBtn,
    border: 'none',
    background: '#4F8EF7',
    color: '#fff',
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

const inputStyle: CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--color-redwood-border)',
    background: 'var(--color-redwood-row-bg)',
    color: 'var(--color-redwood-text-main)',
    fontSize: 10,
    fontFamily: 'inherit',
    outline: 'none',
};

const selectStyle: CSSProperties = {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--color-redwood-border)',
    background: 'var(--color-redwood-row-bg)',
    color: 'var(--color-redwood-text-main)',
    fontSize: 10,
    fontFamily: 'inherit',
    cursor: 'pointer',
};

function formatUsd(n: number): string {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatJvDate(raw: string): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

function periodLabel(dateFrom: string, dateTo: string): string {
    if (dateFrom && dateTo) {
        const from = new Date(`${dateFrom}T12:00:00`);
        const to = new Date(`${dateTo}T12:00:00`);
        if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
            const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
            if (sameMonth) return from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            return `${from.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} – ${to.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
        }
    }
    return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function defaultMonthRange(): { from: string; to: string } {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from, to };
}

type JVIssue =
    | 'test_data'
    | 'vague_narration'
    | 'large_draft'
    | 'possible_duplicate'
    | 'unknown_mapping'
    | 'needs_reversal';

function detectIssues(jv: JournalVoucher, all: JournalVoucher[], accountCodes: Set<string>): JVIssue[] {
    const issues: JVIssue[] = [];
    const narr = (jv.narration || '').toLowerCase();
    const ref = (jv.reference || '').toLowerCase();

    if (narr.includes('test') || ref.includes('test')) issues.push('test_data');
    if ((jv.narration || '').trim().length < 15 || /^(entry|adjustment|misc|n\/a|\.|—|-)$/i.test((jv.narration || '').trim())) {
        issues.push('vague_narration');
    }
    if (jv.status === 'Draft' && jv.totalDebit >= 10000) issues.push('large_draft');
    if ((jv.lines || []).some(l => l.accountCode && !accountCodes.has(l.accountCode))) {
        issues.push('unknown_mapping');
    }
    const dup = all.some(
        other =>
            other.id !== jv.id &&
            other.narration === jv.narration &&
            Math.abs(other.totalDebit - jv.totalDebit) < 0.01 &&
            other.date === jv.date,
    );
    if (dup) issues.push('possible_duplicate');
    if (jv.status === 'Posted' && (issues.includes('test_data') || issues.includes('unknown_mapping'))) {
        issues.push('needs_reversal');
    }
    return issues;
}

function primaryDebitLine(jv: JournalVoucher): JVLine | null {
    const lines = (jv.lines || []).filter(l => (l.debit || 0) > 0);
    if (lines.length === 0) return null;
    return lines.reduce((best, l) => ((l.debit || 0) > (best.debit || 0) ? l : best), lines[0]);
}

function primaryCreditLine(jv: JournalVoucher): JVLine | null {
    const lines = (jv.lines || []).filter(l => (l.credit || 0) > 0);
    if (lines.length === 0) return null;
    return lines.reduce((best, l) => ((l.credit || 0) > (best.credit || 0) ? l : best), lines[0]);
}

function jvMatchesSearch(jv: JournalVoucher, q: string): boolean {
    const hay = [
        jv.jvNumber,
        jv.narration,
        jv.reference,
        ...(jv.lines || []).flatMap(l => [l.accountCode, l.accountName, l.description]),
    ]
        .join(' ')
        .toLowerCase();
    return hay.includes(q);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptyLine = (): JVLine => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    accountId: '', accountCode: '', accountName: '',
    description: '', debit: 0, credit: 0
});

const PLACEHOLDER_JV_NUMBER = 'Auto-assigned on save';

// ── JV Form Component ─────────────────────────────────────────────────────────

interface JVFormProps {
    accounts: Account[];
    editJV?: JournalVoucher;
    onSave: (jv: JournalVoucher, post: boolean) => void;
    onCancel: () => void;
}

function JVForm({ accounts, editJV, onSave, onCancel }: JVFormProps) {
    const [jvNumber] = useState(editJV?.jvNumber || PLACEHOLDER_JV_NUMBER);
    const [date, setDate] = useState(editJV?.date || new Date().toISOString().slice(0, 10));
    const [reference, setReference] = useState(editJV?.reference || '');
    const [narration, setNarration] = useState(editJV?.narration || '');
    const [type, setType] = useState<JournalVoucher['type']>(editJV?.type || 'General');
    const [lines, setLines] = useState<JVLine[]>(editJV?.lines || [emptyLine(), emptyLine()]);
    const [acSearch, setAcSearch] = useState<Record<string, string>>({});
    const [showAcDrop, setShowAcDrop] = useState<string | null>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.ac-dropdown-container')) {
                setShowAcDrop(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;
    const difference = totalDebit - totalCredit;

    const updateLine = (id: string, field: keyof JVLine, value: any) => {
        setLines(prev => prev.map(l => {
            if (l.id !== id) return l;
            const updated = { ...l, [field]: value };
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
        setAcSearch(prev => {
            const { [lineId]: _omit, ...rest } = prev;
            return rest;
        });
    };

    const removeLine = (id: string) => {
        if (lines.length <= 2) return;
        setLines(prev => prev.filter(l => l.id !== id));
    };

    const handleSave = (post: boolean) => {
        if (!narration.trim()) { alert('Narration is required.'); return; }
        if (lines.some(l => !l.accountId)) { alert('All lines must have an account selected.'); return; }
        if (lines.some(l => l.debit === 0 && l.credit === 0)) { alert('All lines must have a debit or credit amount.'); return; }
        if (!isBalanced) { alert(`Journal is not balanced. Difference: ${formatUsd(Math.abs(difference))}`); return; }

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>JV Number</label>
                    <input value={jvNumber} readOnly style={{ ...inputStyle, fontFamily: 'ui-monospace,monospace', color: 'var(--color-brand-blue-tint)' }} />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Type</label>
                    <select value={type} onChange={e => setType(e.target.value as JournalVoucher['type'])} style={selectStyle}>
                        <option value="General">General</option>
                        <option value="Bad Debt">Bad Debt Write-off</option>
                        <option value="Depreciation">Depreciation</option>
                        <option value="Opening Balance">Opening Balance</option>
                        <option value="Adjustment">Adjustment</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Reference</label>
                    <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Invoice #, PO #, etc." style={inputStyle} />
                </div>
            </div>

            <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Narration / Description *</label>
                <input value={narration} onChange={e => setNarration(e.target.value)} placeholder="e.g. Bad debt write-off for GEORGE - GL Garage Freeport" style={inputStyle} />
            </div>

            <p style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', fontStyle: 'italic' }}>
                A line can be <strong>debit</strong> OR <strong>credit</strong> — clear one side to enter the other.
            </p>

            <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                            {['Account', 'Description', 'Debit', 'Credit', ''].map((h, i) => (
                                <th key={h || i} style={{ ...thStyle, textAlign: i >= 2 && i <= 3 ? 'right' : 'left', width: i === 4 ? 40 : undefined }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line) => (
                            <tr key={line.id}>
                                <td style={{ ...tdStyle, position: 'relative' }} className="ac-dropdown-container">
                                    <input
                                        value={
                                            acSearch[line.id] !== undefined
                                                ? acSearch[line.id]
                                                : (line.accountCode && line.accountName
                                                    ? `${line.accountCode} — ${line.accountName}`
                                                    : (line.accountName || line.accountCode || ''))
                                        }
                                        onChange={e => {
                                            setAcSearch(prev => ({ ...prev, [line.id]: e.target.value }));
                                            setShowAcDrop(line.id);
                                        }}
                                        onFocus={() => {
                                            setAcSearch(prev => ({ ...prev, [line.id]: '' }));
                                            setShowAcDrop(line.id);
                                        }}
                                        placeholder="Search account..."
                                        style={{ ...inputStyle, fontSize: 10 }}
                                    />
                                    {showAcDrop === line.id && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                            background: 'var(--color-redwood-bg-surface)', border: '1px solid var(--color-redwood-border)',
                                            borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,.45)', maxHeight: 192, overflowY: 'auto',
                                        }}>
                                            {getFilteredAccounts(acSearch[line.id] || '').map(ac => (
                                                <button key={ac.id} type="button" onClick={() => selectAccount(line.id, ac)}
                                                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 10, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer', color: 'var(--color-redwood-text-main)', fontFamily: 'inherit' }}>
                                                    <span style={{ fontFamily: 'ui-monospace,monospace', color: 'var(--color-redwood-text-muted)', marginRight: 6 }}>{ac.code}</span>
                                                    {ac.name}
                                                </button>
                                            ))}
                                            {getFilteredAccounts(acSearch[line.id] || '').length === 0 && (
                                                <div style={{ padding: 12, fontSize: 10, color: 'var(--color-redwood-text-subtle)' }}>No accounts found</div>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td style={tdStyle}>
                                    <input value={line.description} onChange={e => updateLine(line.id, 'description', e.target.value)} placeholder="Line description..." style={{ ...inputStyle, fontSize: 10 }} />
                                </td>
                                <td style={tdStyle}>
                                    <input type="number" min={0} step="0.01" value={line.debit || ''} onChange={e => updateLine(line.id, 'debit', parseFloat(e.target.value) || 0)} disabled={line.credit > 0} placeholder="0.00" style={{ ...inputStyle, fontSize: 10, textAlign: 'right', fontFamily: 'ui-monospace,monospace' }} />
                                </td>
                                <td style={tdStyle}>
                                    <input type="number" min={0} step="0.01" value={line.credit || ''} onChange={e => updateLine(line.id, 'credit', parseFloat(e.target.value) || 0)} disabled={line.debit > 0} placeholder="0.00" style={{ ...inputStyle, fontSize: 10, textAlign: 'right', fontFamily: 'ui-monospace,monospace' }} />
                                </td>
                                <td style={tdStyle}>
                                    <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length <= 2} style={{ ...ghostBtn, padding: 4, color: 'var(--color-brand-red-tint)', opacity: lines.length <= 2 ? 0.3 : 1 }}>
                                        <Trash2 size={13} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: isBalanced ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)' }}>
                            <td colSpan={2} style={tdStyle}>
                                <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])} style={{ ...ghostBtn, color: 'var(--color-brand-blue-tint)', border: 'none', background: 'transparent', padding: 0 }}>
                                    <Plus size={13} /> Add Line
                                </button>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <p style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', marginBottom: 2 }}>Total Debit</p>
                                <p style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--color-brand-blue-tint)' }}>{formatUsd(totalDebit)}</p>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <p style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', marginBottom: 2 }}>Total Credit</p>
                                <p style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--color-brand-green-tint)' }}>{formatUsd(totalCredit)}</p>
                            </td>
                            <td style={tdStyle} />
                        </tr>
                        {!isBalanced && totalDebit > 0 && (
                            <tr style={{ background: 'rgba(239,68,68,.12)' }}>
                                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-brand-red-tint)', fontWeight: 600, fontSize: 10 }}>
                                    Out of balance by {formatUsd(Math.abs(difference))}
                                </td>
                            </tr>
                        )}
                        {isBalanced && (
                            <tr style={{ background: 'rgba(34,197,94,.12)' }}>
                                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-brand-green-tint)', fontWeight: 600, fontSize: 10 }}>
                                    Balanced — Debit = Credit = {formatUsd(totalDebit)}
                                </td>
                            </tr>
                        )}
                    </tfoot>
                </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleSave(false)} style={ghostBtn}>
                    <FileText size={14} /> Save as Draft
                </button>
                <button type="button" onClick={() => handleSave(true)} disabled={!isBalanced} style={{ ...primaryBtn, opacity: isBalanced ? 1 : 0.45 }}>
                    <Check size={14} /> Post Journal Entry
                </button>
                <button type="button" onClick={onCancel} style={{ ...ghostBtn, border: 'none', background: 'transparent' }}>Cancel</button>
            </div>
        </div>
    );
}

// ── JV Detail / View Component ────────────────────────────────────────────────

function JVDetail({ jv, onClose }: { jv: JournalVoucher; onClose: () => void }) {
    const printJV = () => {
        const html = `<!DOCTYPE html><html><head><title>${jv.jvNumber}</title>
<style>body{font-family:Arial;margin:30px;color:#1a1a1a}h1{color:#4F8EF7;font-size:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#1a1a1a;color:white;padding:8px 12px;text-align:left;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}.total{font-weight:bold;background:#f9f9f9}.right{text-align:right}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;font-size:13px}.label{color:#666;font-size:11px;text-transform:uppercase;margin-bottom:2px}</style></head>
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
        <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-redwood-border)', background: 'rgba(255,255,255,.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, fontFamily: 'ui-monospace,monospace', color: 'var(--color-brand-blue-tint)' }}>{jv.jvNumber}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: jv.status === 'Posted' ? 'var(--color-badge-green-bg)' : 'var(--color-badge-amber-bg)', color: jv.status === 'Posted' ? 'var(--color-brand-green-tint)' : 'var(--color-brand-amber-tint)' }}>{jv.status}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{jv.type}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={printJV} style={ghostBtn}><Download size={12} /> Print / PDF</button>
                    <button type="button" onClick={onClose} style={{ ...ghostBtn, padding: 4 }}><X size={14} /></button>
                </div>
            </div>
            <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                    {[
                        { label: 'Date', value: jv.date },
                        { label: 'Reference', value: jv.reference || '—' },
                        { label: 'Narration', value: jv.narration },
                        { label: 'Created', value: new Date(jv.createdAt).toLocaleDateString() },
                    ].map((f) => (
                        <div key={f.label}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</p>
                            <p style={{ fontSize: 11, fontWeight: 600 }}>{f.value}</p>
                        </div>
                    ))}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                            {['Code', 'Account', 'Description', 'Debit', 'Credit'].map((h, i) => (
                                <th key={h} style={{ ...thStyle, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {jv.lines.map(line => (
                            <tr key={line.id}>
                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{line.accountCode}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>{line.accountName}</td>
                                <td style={{ ...tdStyle, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{line.description || '—'}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: 'var(--color-brand-blue-tint)' }}>{line.debit > 0 ? formatUsd(line.debit) : '—'}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: 'var(--color-brand-green-tint)' }}>{line.credit > 0 ? formatUsd(line.credit) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                            <td colSpan={3} style={{ ...tdStyle, fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Total</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>{formatUsd(jv.totalDebit)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>{formatUsd(jv.totalCredit)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

function IssueTag({ label, tone }: { label: string; tone: 'red' | 'amber' | 'yellow' }) {
    const cfg = {
        red: { bg: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red-tint)', border: 'rgba(239,68,68,.28)' },
        amber: { bg: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)', border: 'rgba(245,158,11,.28)' },
        yellow: { bg: 'rgba(245,158,11,.15)', color: 'var(--color-brand-amber-tint)', border: 'rgba(245,158,11,.35)' },
    }[tone];
    return (
        <span style={{ fontSize: 8.5, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {tone === 'red' && <AlertTriangle size={9} />}
            {label}
        </span>
    );
}

// ── Main Journal Voucher Page ─────────────────────────────────────────────────

export default function JournalVoucher() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [vouchers, setVouchers] = useState<JournalVoucher[]>([]);
    const [mode, setMode] = useState<'list' | 'new' | 'view'>('list');
    const [viewJV, setViewJV] = useState<JournalVoucher | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Posted'>('All');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [reversalPrefill, setReversalPrefill] = useState<JournalVoucher | undefined>(undefined);
    const monthDefault = defaultMonthRange();
    const [dateFrom, setDateFrom] = useState(monthDefault.from);
    const [dateTo, setDateTo] = useState(monthDefault.to);

    useEffect(() => {
        let accs = getAccounts();
        if (accs.length === 0) {
            localStorage.setItem('chart_of_accounts', JSON.stringify(DEFAULT_ACCOUNTS));
            accs = DEFAULT_ACCOUNTS;
        }
        setAccounts(accs);
        getJournalVouchers().then(setVouchers);
    }, []);

    const accountCodes = useMemo(() => new Set(accounts.map(a => a.code)), [accounts]);

    const issueMap = useMemo(() => {
        const map = new Map<string, JVIssue[]>();
        for (const jv of vouchers) {
            map.set(jv.id, detectIssues(jv, vouchers, accountCodes));
        }
        return map;
    }, [vouchers, accountCodes]);

    const handleSave = async (jv: JournalVoucher, post: boolean) => {
        try {
            const saved = await createJV(jv);
            const fresh = await getJournalVouchers();
            setVouchers(fresh);
            setMode('list');
            setReversalPrefill(undefined);
            alert(`✅ ${saved.jvNumber} ${post ? 'posted' : 'saved as draft'} successfully!`);
        } catch (e: any) {
            alert(`❌ ${e.message || 'Failed to save voucher'}`);
        }
    };

    const handleDelete = async (id: string) => {
        const jv = vouchers.find(j => j.id === id);
        if (jv?.status === 'Posted') { alert('Cannot delete a posted journal entry. Create a reversing entry instead.'); return; }
        const label = jv?.jvNumber || `voucher ${id}`;
        if (!confirm(`Delete journal voucher ${label}? This cannot be undone.`)) return;
        try {
            await deleteJVApi(id);
            const fresh = await getJournalVouchers();
            setVouchers(fresh);
        } catch (e: any) {
            alert(`❌ ${e.message || 'Failed to delete voucher'}`);
        }
    };

    const periodVouchers = useMemo(
        () => vouchers.filter(j => {
            if (dateFrom && (j.date || '') < dateFrom) return false;
            if (dateTo && (j.date || '') > dateTo) return false;
            return true;
        }),
        [vouchers, dateFrom, dateTo],
    );

    const flaggedCount = useMemo(
        () => periodVouchers.filter(j => (issueMap.get(j.id) || []).length > 0).length,
        [periodVouchers, issueMap],
    );

    const criticalIssues = useMemo(
        () => periodVouchers.filter(j => {
            const issues = issueMap.get(j.id) || [];
            return issues.includes('test_data') || issues.includes('unknown_mapping') || issues.includes('needs_reversal');
        }),
        [periodVouchers, issueMap],
    );

    const largeDrafts = useMemo(
        () => periodVouchers.filter(j => j.status === 'Draft' && j.totalDebit >= 10000),
        [periodVouchers],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return periodVouchers
            .filter(j => statusFilter === 'All' || j.status === statusFilter)
            .filter(j => typeFilter === 'all' || j.type === typeFilter)
            .filter(j => !flaggedOnly || (issueMap.get(j.id) || []).length > 0)
            .filter(j => !q || jvMatchesSearch(j, q));
    }, [periodVouchers, statusFilter, typeFilter, flaggedOnly, search, issueMap]);

    const postedInPeriod = useMemo(() => periodVouchers.filter(j => j.status === 'Posted'), [periodVouchers]);
    const draftsInPeriod = useMemo(() => periodVouchers.filter(j => j.status === 'Draft'), [periodVouchers]);
    const totalPosted = useMemo(() => postedInPeriod.reduce((s, j) => s + j.totalDebit, 0), [postedInPeriod]);
    const flaggedInPeriod = useMemo(
        () => periodVouchers.filter(j => (issueMap.get(j.id) || []).length > 0).length,
        [periodVouchers, issueMap],
    );
    const needsReversalCount = useMemo(
        () => periodVouchers.filter(j => (issueMap.get(j.id) || []).includes('needs_reversal')).length,
        [periodVouchers, issueMap],
    );

    const typeOptions = useMemo(() => {
        const set = new Set(periodVouchers.map(j => j.type));
        return Array.from(set).sort();
    }, [periodVouchers]);

    const aiSummary = useMemo(() => {
        const parts: string[] = [];
        if (criticalIssues.length > 0) parts.push(`${criticalIssues.length} critical issue${criticalIssues.length !== 1 ? 's' : ''} (test data, unknown mapping, or posted errors)`);
        if (largeDrafts.length > 0) parts.push(`${largeDrafts.length} draft${largeDrafts.length !== 1 ? 's' : ''} above $10,000 pending CFO approval`);
        const dupes = periodVouchers.filter(j => (issueMap.get(j.id) || []).includes('possible_duplicate'));
        if (dupes.length > 0) parts.push(`${dupes.length} possible duplicate${dupes.length !== 1 ? 's' : ''}`);
        const vague = periodVouchers.filter(j => (issueMap.get(j.id) || []).includes('vague_narration'));
        if (vague.length > 0) parts.push(`${vague.length} vague narration${vague.length !== 1 ? 's' : ''}`);
        return parts.length > 0 ? parts.join(' · ') : 'All journal entries look clean for this period.';
    }, [criticalIssues, largeDrafts, periodVouchers, issueMap]);

    const handleCreateReversal = (jv: JournalVoucher) => {
        const reversedLines = (jv.lines || []).map(l => ({
            ...l,
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            debit: l.credit,
            credit: l.debit,
        }));
        setReversalPrefill({
            ...jv,
            id: '',
            jvNumber: PLACEHOLDER_JV_NUMBER,
            narration: `Reversal of ${jv.jvNumber} — ${jv.narration}`,
            reference: `REV-${jv.jvNumber}`,
            lines: reversedLines,
            totalDebit: jv.totalCredit,
            totalCredit: jv.totalDebit,
            status: 'Draft',
            createdAt: new Date().toISOString(),
        });
        setMode('new');
    };

    if (mode === 'new') {
        return (
            <div style={{ padding: '12px', maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
                <div style={{ ...panel, marginBottom: 12 }}>
                    <button type="button" onClick={() => { setMode('list'); setReversalPrefill(undefined); }} style={{ ...ghostBtn, border: 'none', background: 'transparent', padding: '0 0 8px', marginBottom: 8 }}>
                        <ArrowLeft size={14} /> Back to Vouchers
                    </button>
                    <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, fontFamily: "'Syne',sans-serif" }}>New Journal Voucher</h1>
                    <p style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>Double-entry bookkeeping — total debits must equal total credits</p>
                </div>
                <div style={panel}>
                    <JVForm accounts={accounts} editJV={reversalPrefill} onSave={handleSave} onCancel={() => { setMode('list'); setReversalPrefill(undefined); }} />
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 120, maxWidth: 1280, margin: '0 auto' }}>
            {/* 1. Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(79,142,247,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={18} style={{ color: '#4F8EF7' }} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>
                            Journal vouchers
                        </h1>
                        <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            Double-entry bookkeeping · {periodVouchers.length} voucher{periodVouchers.length !== 1 ? 's' : ''} · {periodLabel(dateFrom, dateTo)}
                        </p>
                    </div>
                </div>
                <button type="button" onClick={() => setMode('new')} style={primaryBtn}>
                    <Plus size={14} /> New Journal Voucher
                </button>
            </div>

            {/* 2. Alert Banners */}
            {criticalIssues.length > 0 && (
                <div style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--color-badge-red-bg)', borderColor: 'rgba(239,68,68,.35)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                        <ShieldAlert size={18} style={{ color: 'var(--color-brand-red-tint)', flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-brand-red-tint)' }}>
                                AI found {criticalIssues.length} issue{criticalIssues.length !== 1 ? 's' : ''} requiring immediate action
                            </div>
                            <div style={{ fontSize: 9.5, color: 'var(--color-redwood-text-muted)', marginTop: 3 }}>
                                {criticalIssues.slice(0, 3).map(j => j.jvNumber).join(', ')}
                                {criticalIssues.some(j => (issueMap.get(j.id) || []).includes('large_draft')) ? ' · large drafts pending review' : ''}
                            </div>
                        </div>
                    </div>
                    <button type="button" onClick={() => { setFlaggedOnly(true); setStatusFilter('All'); }} style={{ ...ghostBtn, background: 'rgba(239,68,68,.15)', borderColor: 'rgba(239,68,68,.35)', color: 'var(--color-brand-red-tint)' }}>
                        Review Issues <ChevronRight size={12} />
                    </button>
                </div>
            )}

            {largeDrafts.length > 0 && (
                <div style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--color-badge-amber-bg)', borderColor: 'rgba(245,158,11,.35)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                        <AlertTriangle size={18} style={{ color: 'var(--color-brand-amber-tint)', flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-brand-amber-tint)' }}>
                                {largeDrafts.length} large draft entr{largeDrafts.length !== 1 ? 'ies' : 'y'} pending approval
                            </div>
                            <div style={{ fontSize: 9.5, color: 'var(--color-redwood-text-muted)', marginTop: 3 }}>
                                CFO approval required before posting entries above $10,000.
                            </div>
                        </div>
                    </div>
                    <button type="button" onClick={() => { setStatusFilter('Draft'); setFlaggedOnly(false); }} style={{ ...ghostBtn, background: 'rgba(245,158,11,.12)', borderColor: 'rgba(245,158,11,.35)', color: 'var(--color-brand-amber-tint)' }}>
                        Request approval
                    </button>
                </div>
            )}

            {/* 3. Summary Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {[
                    { label: 'Total Vouchers', value: String(periodVouchers.length), sub: periodLabel(dateFrom, dateTo), stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)', color: 'var(--color-brand-blue)' },
                    { label: 'Posted', value: String(postedInPeriod.length), sub: 'locked in ledger', stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)', color: 'var(--color-brand-green)' },
                    { label: 'Drafts', value: String(draftsInPeriod.length), sub: flaggedInPeriod > 0 ? `${Math.min(flaggedInPeriod, draftsInPeriod.length)} flagged` : 'none flagged', stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)', color: 'var(--color-brand-amber)' },
                    { label: 'Total Posted Value', value: formatUsd(totalPosted), sub: 'verified', stripe: 'linear-gradient(90deg,#38BDF8,#7DD3FC)', color: '#38BDF8' },
                ].map(card => (
                    <div key={card.label} style={{ ...panel, position: 'relative', overflow: 'hidden', padding: '10px 12px' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: card.stripe }} />
                        <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--color-redwood-text-muted)', letterSpacing: '.4px', marginBottom: 4 }}>{card.label.toUpperCase()}</div>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 600, color: card.color }}>{card.value}</div>
                        <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginTop: 2 }}>{card.sub}</div>
                    </div>
                ))}
            </div>

            {viewJV && <JVDetail jv={viewJV} onClose={() => setViewJV(null)} />}

            {/* 4. Filters Row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search by JV number, narration, reference, account code..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ ...inputStyle, paddingLeft: 30 }}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, minWidth: 220 }}>
                    <div style={{ position: 'relative' }}>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, paddingRight: 28 }} />
                        <Calendar size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)', pointerEvents: 'none' }} />
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, paddingRight: 28 }} />
                        <Calendar size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)', pointerEvents: 'none' }} />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {([
                    { key: 'All' as const, label: `All ${periodVouchers.length}` },
                    { key: 'Posted' as const, label: `Posted ${postedInPeriod.length}` },
                    { key: 'Draft' as const, label: `Draft ${draftsInPeriod.length}` },
                ]).map(pill => (
                    <button
                        key={pill.key}
                        type="button"
                        onClick={() => { setStatusFilter(pill.key); setFlaggedOnly(false); }}
                        style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 9,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: statusFilter === pill.key && !flaggedOnly ? '1px solid #4F8EF7' : '1px solid var(--color-redwood-border)',
                            background: statusFilter === pill.key && !flaggedOnly ? 'rgba(79,142,247,.15)' : 'rgba(255,255,255,.04)',
                            color: statusFilter === pill.key && !flaggedOnly ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                            fontFamily: 'inherit',
                        }}
                    >
                        {pill.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setFlaggedOnly(v => !v)}
                    style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 9,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: flaggedOnly ? '1px solid rgba(239,68,68,.45)' : '1px solid rgba(239,68,68,.28)',
                        background: flaggedOnly ? 'rgba(239,68,68,.18)' : 'rgba(239,68,68,.1)',
                        color: 'var(--color-brand-red-tint)',
                        fontFamily: 'inherit',
                    }}
                >
                    Flagged {flaggedCount}
                </button>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
                    <option value="all">All types</option>
                    {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            {/* 5. Journal Entries Table */}
            <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--color-redwood-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Journal entries</span>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--color-badge-blue-bg)', color: 'var(--color-brand-blue-tint)' }}>{filtered.length} total</span>
                        {flaggedCount > 0 && (
                            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red-tint)' }}>{flaggedCount} issues</span>
                        )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-brand-green-tint)' }}>
                        Total posted: {formatUsd(totalPosted)}
                    </span>
                </div>

                {filtered.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                        <FileText size={40} style={{ color: 'var(--color-redwood-text-subtle)', margin: '0 auto 12px' }} />
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-muted)' }}>No journal vouchers match your filters</p>
                        <p style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>Try widening the date range or clearing filters</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                    {['JV #', 'Date', 'Narration', 'Debit account', 'Credit account', 'Reference', 'Amount USD', 'Status', 'Actions'].map((h, i) => (
                                        <th key={h} style={{ ...thStyle, textAlign: i === 6 ? 'right' : 'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(jv => {
                                    const issues = issueMap.get(jv.id) || [];
                                    const isCritical = issues.includes('test_data') || issues.includes('unknown_mapping') || issues.includes('needs_reversal');
                                    const isLarge = jv.totalDebit >= 100000;
                                    const debitLine = primaryDebitLine(jv);
                                    const creditLine = primaryCreditLine(jv);
                                    const rowBg = isCritical
                                        ? 'rgba(239,68,68,.08)'
                                        : issues.includes('possible_duplicate')
                                            ? 'rgba(245,158,11,.06)'
                                            : 'transparent';

                                    return (
                                        <tr key={jv.id} style={{ background: rowBg }}>
                                            <td style={tdStyle}>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewJV(viewJV?.id === jv.id ? null : jv)}
                                                    style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'ui-monospace,monospace', fontSize: 10, fontWeight: 700, color: 'var(--color-brand-blue)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                                                >
                                                    {jv.jvNumber}
                                                </button>
                                            </td>
                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{formatJvDate(jv.date)}</td>
                                            <td style={{ ...tdStyle, maxWidth: 220 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <span>{jv.narration}</span>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                        {issues.includes('possible_duplicate') && <IssueTag label="Possible duplicate" tone="yellow" />}
                                                        {issues.includes('vague_narration') && <IssueTag label="Vague narration" tone="red" />}
                                                        {issues.includes('unknown_mapping') && <IssueTag label="Unknown mapping" tone="red" />}
                                                        {issues.includes('test_data') && <IssueTag label="Test data" tone="red" />}
                                                        {jv.status === 'Draft' && issues.length === 0 && <IssueTag label="Delete" tone="amber" />}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                {debitLine ? (
                                                    <div>
                                                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-brand-green-tint)' }}>{debitLine.accountName}</div>
                                                        <div style={{ fontSize: 9, fontFamily: 'ui-monospace,monospace', color: 'var(--color-redwood-text-muted)' }}>{debitLine.accountCode}</div>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td style={tdStyle}>
                                                {creditLine ? (
                                                    <div>
                                                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-brand-red-tint)' }}>{creditLine.accountName}</div>
                                                        <div style={{ fontSize: 9, fontFamily: 'ui-monospace,monospace', color: 'var(--color-redwood-text-muted)' }}>{creditLine.accountCode}</div>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{jv.reference || '—'}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: isLarge ? 'var(--color-brand-red-tint)' : 'var(--color-redwood-text-main)' }}>
                                                {formatUsd(jv.totalDebit)}
                                                {isLarge && <div style={{ fontSize: 8, color: 'var(--color-brand-red-tint)', marginTop: 2 }}>$100K+</div>}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    fontSize: 9,
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: 999,
                                                    background: jv.status === 'Posted' ? 'var(--color-badge-green-bg)' : 'var(--color-badge-amber-bg)',
                                                    color: jv.status === 'Posted' ? 'var(--color-brand-green-tint)' : 'var(--color-brand-amber-tint)',
                                                    border: `1px solid ${jv.status === 'Posted' ? 'rgba(34,197,94,.28)' : 'rgba(245,158,11,.28)'}`,
                                                }}>
                                                    {jv.status}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <button type="button" onClick={() => setViewJV(viewJV?.id === jv.id ? null : jv)} style={{ ...ghostBtn, padding: 4 }} title="View">
                                                        <Eye size={13} />
                                                    </button>
                                                    {issues.includes('needs_reversal') && (
                                                        <button type="button" onClick={() => handleCreateReversal(jv)} style={{ ...ghostBtn, padding: '3px 6px', fontSize: 8.5, color: 'var(--color-brand-red-tint)', borderColor: 'rgba(239,68,68,.28)', background: 'var(--color-badge-red-bg)' }} title="Create reversal">
                                                            <RotateCcw size={10} /> Create reversal
                                                        </button>
                                                    )}
                                                    {jv.status === 'Draft' && (
                                                        <button type="button" onClick={() => handleDelete(jv.id)} style={{ ...ghostBtn, padding: 4, color: 'var(--color-brand-red-tint)' }} title="Delete draft">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 6. Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 9.5, color: 'var(--color-redwood-text-subtle)' }}>
                <span>
                    {postedInPeriod.length} posted · {draftsInPeriod.length} draft{draftsInPeriod.length !== 1 ? 's' : ''} · {flaggedInPeriod} flagged · {needsReversalCount} need{needsReversalCount !== 1 ? '' : 's'} reversal
                </span>
                <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: 'var(--color-brand-green-tint)' }}>
                    {formatUsd(totalPosted)} posted total
                </span>
            </div>

            <div style={{
                ...panel,
                background: 'linear-gradient(135deg, rgba(15,31,51,.95) 0%, rgba(30,58,95,.85) 100%)',
                borderColor: 'rgba(79,142,247,.35)',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Bot size={14} style={{ color: '#4F8EF7' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>AI Audit Check</span>
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', margin: 0, lineHeight: 1.5 }}>{aiSummary}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => alert(`AI Audit Report (preview)\n\n${aiSummary}\n\nPeriod: ${periodLabel(dateFrom, dateTo)}\nPosted total: ${formatUsd(totalPosted)}\n\nConnect the AI CFO endpoint for a full journal audit.`)}
                        style={{ ...ghostBtn, background: 'rgba(79,142,247,.15)', borderColor: 'rgba(79,142,247,.35)', color: '#93C5FD', padding: '6px 12px' }}
                    >
                        Full AI report <ChevronRight size={12} />
                    </button>
                </div>
            </div>

            <p style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', textAlign: 'center', lineHeight: 1.5 }}>
                Posted entries cannot be deleted — create a reversing entry to correct them · Drafts can be deleted ·
                Entries above $10,000 require CFO approval before posting
            </p>
        </div>
    );
}
