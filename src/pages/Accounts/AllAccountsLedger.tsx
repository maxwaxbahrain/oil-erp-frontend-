// ITEM 11 — Central All-Accounts Ledger.
// Single page where the user picks ANY account from the Chart of Accounts
// and sees every posted journal voucher line that touches it, with a
// running balance computed using the account's nature ('Debit' or
// 'Credit'). Date-range filterable. Pulls journal vouchers via the
// existing getJournalVouchers() helper — no new backend surface.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen,
    Download,
    X,
    Calendar,
    Printer,
    Search,
    ChevronDown,
    Check,
    Sparkles,
    Bot,
    ChevronRight,
} from 'lucide-react';
import { getAccounts, type Account } from './ChartOfAccounts';
import { getJournalVouchers, type JournalVoucher, type JVLine } from './JournalVoucher';

interface LedgerRow {
    date: string;
    jvNumber: string;
    jvId: string;
    reference: string;
    description: string;
    contraAccount: string;
    source: string;
    jvType: JournalVoucher['type'];
    debit: number;
    credit: number;
    runningBalance: number;
}

const QUICK_ACCOUNTS: { code: string; label: string }[] = [
    { code: '1110', label: 'Cash on hand' },
    { code: '1120', label: 'Bank accounts' },
    { code: '1130', label: 'AR' },
    { code: '4100', label: 'Sales Revenue' },
    { code: '4120', label: 'Amazon Revenue' },
    { code: '5100', label: 'COGS' },
    { code: '5200', label: 'Operating Expenses' },
    { code: '2100', label: 'Current Liabilities' },
];

const AI_PROMPTS = [
    'What drove credit activity this period?',
    'Compare to last month',
    'Any unusual entries?',
    'Summarize net movement',
];

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

function formatUsdSigned(n: number): string {
    if (Math.abs(n) < 0.005) return formatUsd(0);
    const prefix = n > 0 ? '+' : '';
    return `${prefix}${formatUsd(n)}`;
}

function sourceLabel(jv: JournalVoucher): string {
    const ref = (jv.reference || '').toUpperCase();
    if (ref.startsWith('INV') || ref.includes('INVOICE')) return 'Sales';
    if (ref.startsWith('PAY') || ref.includes('PAYMENT')) return 'Payments';
    if (ref.startsWith('PO') || ref.includes('PURCHASE')) return 'Purchases';
    if (jv.type === 'Bad Debt') return 'Bad Debt';
    if (jv.type === 'Depreciation') return 'Depreciation';
    if (jv.type === 'Opening Balance') return 'Opening';
    if (jv.type === 'Adjustment') return 'Adjustment';
    return 'Manual JV';
}

function contraFromJv(jv: JournalVoucher, accountId: string): string {
    const others = (jv.lines || []).filter(l => String(l.accountId) !== String(accountId));
    if (others.length === 0) return '—';
    const primary = others.reduce((best, l) => {
        const amt = Math.max(Number(l.debit) || 0, Number(l.credit) || 0);
        const bestAmt = Math.max(Number(best.debit) || 0, Number(best.credit) || 0);
        return amt > bestAmt ? l : best;
    }, others[0]);
    return `${primary.accountCode} ${primary.accountName}`;
}

function periodLabel(dateFrom: string, dateTo: string): string {
    if (dateFrom && dateTo) {
        const from = new Date(`${dateFrom}T12:00:00`);
        const to = new Date(`${dateTo}T12:00:00`);
        if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
            const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
            if (sameMonth) {
                return from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            }
            return `${from.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} – ${to.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
        }
    }
    if (dateFrom) {
        const d = new Date(`${dateFrom}T12:00:00`);
        if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function AllAccountsLedger() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [vouchers, setVouchers] = useState<JournalVoucher[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('4100');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [tableSearch, setTableSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [showAccountPicker, setShowAccountPicker] = useState(false);
    const [showInsights, setShowInsights] = useState(false);
    const [aiQuestion, setAiQuestion] = useState('');

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

    const rows: LedgerRow[] = useMemo(() => {
        if (!selectedAccount) return [];
        const out: Omit<LedgerRow, 'runningBalance'>[] = [];
        for (const jv of vouchers) {
            if (jv.status !== 'Posted') continue;
            if (dateFrom && (jv.date || '') < dateFrom) continue;
            if (dateTo && (jv.date || '') > dateTo) continue;
            for (const l of (jv.lines || []) as JVLine[]) {
                if (String(l.accountId) !== String(selectedAccount.id)) continue;
                out.push({
                    date: jv.date,
                    jvNumber: jv.jvNumber,
                    jvId: jv.id,
                    reference: jv.reference || '',
                    description: l.description || jv.narration || '',
                    contraAccount: contraFromJv(jv, selectedAccount.id),
                    source: sourceLabel(jv),
                    jvType: jv.type,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                });
            }
        }
        out.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.jvNumber.localeCompare(b.jvNumber));

        const sign = selectedAccount.nature === 'Debit' ? 1 : -1;
        let running = Number(selectedAccount.openingBalance) || 0;
        return out.map(r => {
            running += (r.debit - r.credit) * sign;
            return { ...r, runningBalance: Math.round(running * 100) / 100 };
        });
    }, [selectedAccount, vouchers, dateFrom, dateTo]);

    const sourceOptions = useMemo(() => {
        const set = new Set(rows.map(r => r.source));
        return Array.from(set).sort();
    }, [rows]);

    const typeOptions = useMemo(() => {
        const set = new Set(rows.map(r => r.jvType));
        return Array.from(set).sort();
    }, [rows]);

    const filteredRows = useMemo(() => {
        let out = rows;
        if (tableSearch.trim()) {
            const q = tableSearch.toLowerCase();
            out = out.filter(r =>
                r.description.toLowerCase().includes(q) ||
                r.reference.toLowerCase().includes(q) ||
                r.jvNumber.toLowerCase().includes(q),
            );
        }
        if (typeFilter !== 'all') {
            out = out.filter(r => r.jvType === typeFilter);
        }
        if (sourceFilter !== 'all') {
            out = out.filter(r => r.source === sourceFilter);
        }
        return out;
    }, [rows, tableSearch, typeFilter, sourceFilter]);

    const totals = useMemo(() => rows.reduce(
        (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
        { debit: 0, credit: 0 },
    ), [rows]);

    const openingBalance = Number(selectedAccount?.openingBalance) || 0;
    const closingBalance = rows.length > 0 ? rows[rows.length - 1].runningBalance : openingBalance;
    const netMovement = selectedAccount?.nature === 'Debit'
        ? totals.debit - totals.credit
        : totals.credit - totals.debit;

    const filteredAccounts = useMemo(() => {
        if (!search) return accounts;
        const q = search.toLowerCase();
        return accounts.filter(a =>
            a.code.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.type.toLowerCase().includes(q),
        );
    }, [accounts, search]);

    const exportCSV = () => {
        if (!selectedAccount || rows.length === 0) {
            alert('Pick an account with at least one ledger entry first.');
            return;
        }
        const lines: string[] = [];
        lines.push(`"Account","${selectedAccount.code} — ${selectedAccount.name}"`);
        lines.push(`"Opening Balance","${openingBalance.toFixed(2)}"`);
        lines.push('');
        lines.push('"Date","JV","Reference","Description","Contra Account","Source","Debit","Credit","Balance"');
        for (const r of rows) {
            lines.push([
                r.date,
                r.jvNumber,
                r.reference.replace(/"/g, '""'),
                r.description.replace(/"/g, '""'),
                r.contraAccount.replace(/"/g, '""'),
                r.source,
                r.debit.toFixed(2),
                r.credit.toFixed(2),
                r.runningBalance.toFixed(2),
            ].map(v => `"${v}"`).join(','));
        }
        lines.push('');
        lines.push(`"Totals","","","","","","${totals.debit.toFixed(2)}","${totals.credit.toFixed(2)}","${closingBalance.toFixed(2)}"`);
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ledger-${selectedAccount.code}-${selectedAccount.name.replace(/[^A-Za-z0-9-]/g, '_')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => window.print();

    const handleAskAi = () => {
        const q = aiQuestion.trim() || 'Summarize this account ledger';
        alert(
            `AI Ledger insight (preview)\n\nQuestion: ${q}\n\n` +
            `Account ${selectedAccount?.code || '—'} · Opening ${formatUsd(openingBalance)} · ` +
            `Closing ${formatUsd(closingBalance)} · ${rows.length} entries.\n\n` +
            'Connect the AI CFO endpoint for live ledger analysis.',
        );
    };

    const aiInsightText = selectedAccount
        ? `${selectedAccount.name} (${selectedAccount.code}) shows ${formatUsd(totals.credit)} in credits and ${formatUsd(totals.debit)} in debits ` +
          `this period. Net movement is ${formatUsdSigned(netMovement)} with a closing balance of ${formatUsd(closingBalance)}. ` +
          `${rows.length === 0 ? 'No posted entries in the selected range — try widening the date filter.' : `${rows.length} journal entries recorded.`}`
        : 'Select an account to see AI-powered ledger insights.';

    const accountChipLabel = selectedAccount
        ? `Account ${selectedAccount.code} ${selectedAccount.name.split(' ')[0]}`
        : 'No account selected';

    const dateInputStyle: CSSProperties = {
        width: '100%',
        padding: '8px 32px 8px 10px',
        borderRadius: 8,
        border: '1px solid var(--color-redwood-border)',
        background: 'var(--color-redwood-row-bg)',
        color: 'var(--color-redwood-text-main)',
        fontSize: 10,
        fontFamily: 'inherit',
        outline: 'none',
    };

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 120, maxWidth: 1280, margin: '0 auto' }}>
            {/* 1. Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(79,142,247,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={18} style={{ color: '#4F8EF7' }} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>
                            Account ledger
                        </h1>
                        <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            Select any account · view every journal entry · opening &amp; closing balance
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={handlePrint} style={ghostBtn} title="Print">
                        <Printer size={12} /> Print
                    </button>
                    <button
                        type="button"
                        onClick={exportCSV}
                        disabled={!selectedAccount || rows.length === 0}
                        style={{ ...ghostBtn, opacity: !selectedAccount || rows.length === 0 ? 0.45 : 1 }}
                        title="Export"
                    >
                        <Download size={12} /> Export
                    </button>
                </div>
            </div>

            {/* 2. Account Selector Box */}
            <div style={{ ...panel, padding: '14px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                    <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                            Account:
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowAccountPicker(s => !s)}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                border: '1px solid var(--color-redwood-border)',
                                borderRadius: 8,
                                padding: '10px 12px',
                                background: 'var(--color-redwood-row-bg)',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                            }}
                        >
                            {selectedAccount ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                                            {selectedAccount.type} | {selectedAccount.code} | {selectedAccount.name}
                                        </div>
                                        <div style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)', marginTop: 3 }}>
                                            {selectedAccount.description || '—'}
                                        </div>
                                    </div>
                                    <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 13, fontWeight: 700, color: 'var(--color-brand-green-tint)', flexShrink: 0 }}>
                                        {formatUsd(closingBalance)}
                                    </div>
                                </div>
                            ) : (
                                <span style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)' }}>— Choose an account from the chart —</span>
                            )}
                            <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: 38, color: 'var(--color-redwood-text-muted)' }} />
                        </button>
                        {showAccountPicker && (
                            <div style={{
                                position: 'absolute',
                                zIndex: 30,
                                left: 0,
                                right: 0,
                                marginTop: 6,
                                background: 'var(--color-redwood-bg-surface)',
                                border: '1px solid var(--color-redwood-border)',
                                borderRadius: 10,
                                boxShadow: '0 8px 32px rgba(0,0,0,.45)',
                                maxHeight: 320,
                                overflowY: 'auto',
                            }}>
                                <div style={{ position: 'sticky', top: 0, padding: 8, borderBottom: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-bg-surface)' }}>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search by code, name, or type…"
                                            style={{
                                                width: '100%',
                                                border: '1px solid var(--color-redwood-border)',
                                                borderRadius: 6,
                                                padding: '6px 28px 6px 10px',
                                                fontSize: 10,
                                                background: 'var(--color-redwood-row-bg)',
                                                color: 'var(--color-redwood-text-main)',
                                                fontFamily: 'inherit',
                                                outline: 'none',
                                            }}
                                            autoFocus
                                        />
                                        {search && (
                                            <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-redwood-text-muted)' }}>
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {filteredAccounts.length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', fontSize: 10, color: 'var(--color-redwood-text-subtle)' }}>No accounts match your search.</div>
                                ) : filteredAccounts.map(a => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => { setSelectedAccountId(a.id); setShowAccountPicker(false); setSearch(''); }}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            fontSize: 10,
                                            background: a.id === selectedAccountId ? 'rgba(79,142,247,.12)' : 'transparent',
                                            border: 'none',
                                            borderLeft: a.id === selectedAccountId ? '3px solid #4F8EF7' : '3px solid transparent',
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            color: 'var(--color-redwood-text-main)',
                                        }}
                                    >
                                        <span style={{ fontFamily: 'ui-monospace,monospace', color: 'var(--color-redwood-text-muted)', marginRight: 6 }}>{a.code}</span>
                                        <span style={{ fontWeight: 600 }}>{a.name}</span>
                                        <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--color-redwood-text-subtle)', textTransform: 'uppercase' }}>{a.type}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 220 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>From</label>
                            <div style={{ position: 'relative' }}>
                                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={dateInputStyle} />
                                <Calendar size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)', pointerEvents: 'none' }} />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>To</label>
                            <div style={{ position: 'relative' }}>
                                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={dateInputStyle} />
                                <Calendar size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)', pointerEvents: 'none' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Quick Access Bar */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {QUICK_ACCOUNTS.map(({ code, label }) => {
                    const acc = accounts.find(a => a.code === code);
                    const active = selectedAccountId === acc?.id;
                    return (
                        <button
                            key={code}
                            type="button"
                            onClick={() => acc && setSelectedAccountId(acc.id)}
                            disabled={!acc}
                            style={{
                                padding: '4px 10px',
                                borderRadius: 999,
                                fontSize: 9,
                                fontWeight: 600,
                                cursor: acc ? 'pointer' : 'not-allowed',
                                border: active ? '1px solid #4F8EF7' : '1px solid var(--color-redwood-border)',
                                background: active ? 'rgba(79,142,247,.15)' : 'rgba(255,255,255,.04)',
                                color: active ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                opacity: acc ? 1 : 0.4,
                            }}
                        >
                            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 8.5 }}>{code}</span>
                            {label}
                            {active && <Check size={10} style={{ color: '#4F8EF7' }} />}
                        </button>
                    );
                })}
            </div>

            {/* Loading / Error */}
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                    <div style={{ width: 32, height: 32, border: '3px solid rgba(79,142,247,.25)', borderTopColor: '#4F8EF7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
            )}
            {error && !loading && (
                <div style={{ ...panel, borderColor: 'rgba(239,68,68,.35)', background: 'rgba(239,68,68,.08)', color: 'var(--color-brand-red-tint)', fontSize: 11, fontWeight: 600 }}>
                    {error}
                </div>
            )}

            {!loading && !error && !selectedAccount && (
                <div style={{ ...panel, padding: 48, textAlign: 'center', borderStyle: 'dashed' }}>
                    <BookOpen size={40} style={{ color: 'var(--color-redwood-text-subtle)', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-redwood-text-main)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Choose an account to begin</p>
                    <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)', marginTop: 6 }}>Pick from the Chart of Accounts above to see its full transaction history.</p>
                </div>
            )}

            {!loading && !error && selectedAccount && (
                <>
                    {/* 4. Financial Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                        {[
                            { label: 'OPENING BALANCE', value: formatUsd(openingBalance), color: 'var(--color-redwood-text-main)' },
                            { label: 'TOTAL CREDITS', value: formatUsd(totals.credit), color: 'var(--color-brand-green-tint)' },
                            { label: 'TOTAL DEBITS', value: formatUsd(totals.debit), color: 'var(--color-brand-red-tint)' },
                            { label: 'NET MOVEMENT', value: formatUsdSigned(netMovement), color: 'var(--color-brand-blue-tint)' },
                            { label: 'CLOSING BALANCE', value: formatUsd(closingBalance), color: 'var(--color-brand-green-tint)' },
                        ].map(card => (
                            <div key={card.label} style={{ ...panel, padding: '10px 12px' }}>
                                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--color-redwood-text-muted)', letterSpacing: '.4px', marginBottom: 4 }}>{card.label}</div>
                                <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 14, fontWeight: 700, color: card.color }}>{card.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* 5. Search & Filters */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
                            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)' }} />
                            <input
                                type="text"
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                placeholder="Search description, reference, JE number..."
                                style={{
                                    width: '100%',
                                    padding: '8px 10px 8px 30px',
                                    borderRadius: 8,
                                    border: '1px solid var(--color-redwood-border)',
                                    background: 'var(--color-redwood-row-bg)',
                                    color: 'var(--color-redwood-text-main)',
                                    fontSize: 10,
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
                            <option value="all">All types</option>
                            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={selectStyle}>
                            <option value="all">All sources</option>
                            {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* 6. Ledger Table */}
                    <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                        {['Date', 'JE #', 'Description', 'Reference', 'Contra account', 'Source', 'Debit', 'Credit'].map((h, i) => (
                                            <th key={h} style={{ ...thStyle, textAlign: i >= 6 ? 'right' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Opening balance row */}
                                    <tr style={{ background: 'rgba(79,142,247,.1)' }}>
                                        <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, fontSize: 10, color: 'var(--color-brand-blue-tint)' }}>
                                            Opening balance
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--color-brand-blue-tint)' }}>
                                            {selectedAccount.nature === 'Debit' && openingBalance !== 0 ? formatUsd(Math.abs(openingBalance)) : ''}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--color-brand-blue-tint)' }}>
                                            {selectedAccount.nature === 'Credit' || openingBalance === 0 ? formatUsd(Math.abs(openingBalance)) : ''}
                                        </td>
                                    </tr>

                                    {filteredRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '32px 10px', color: 'var(--color-redwood-text-subtle)' }}>
                                                No posted journal entries for this account in the selected range.
                                            </td>
                                        </tr>
                                    ) : filteredRows.map((r, idx) => (
                                        <tr key={`${r.jvNumber}-${idx}`} style={{ background: 'transparent' }}>
                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                                {r.date ? new Date(r.date.includes('T') ? r.date : `${r.date}T12:00:00`).toLocaleDateString() : '—'}
                                            </td>
                                            <td style={tdStyle}>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/finance/journal-voucher')}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: 0,
                                                        fontFamily: 'ui-monospace,monospace',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: 'var(--color-brand-blue)',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline',
                                                        textUnderlineOffset: 2,
                                                    }}
                                                >
                                                    {r.jvNumber}
                                                </button>
                                            </td>
                                            <td style={{ ...tdStyle, maxWidth: 200 }}>{r.description || '—'}</td>
                                            <td style={{ ...tdStyle, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{r.reference || '—'}</td>
                                            <td style={{ ...tdStyle, fontSize: 10, color: '#C4B5FD', fontWeight: 500 }}>{r.contraAccount}</td>
                                            <td style={{ ...tdStyle, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{r.source}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: r.debit > 0 ? 'var(--color-brand-red-tint)' : 'transparent' }}>
                                                {r.debit > 0 ? formatUsd(r.debit) : ''}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: r.credit > 0 ? 'var(--color-brand-green-tint)' : 'transparent' }}>
                                                {r.credit > 0 ? formatUsd(r.credit) : ''}
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Closing balance row */}
                                    {(rows.length > 0 || openingBalance !== 0) && (
                                        <tr style={{ background: 'rgba(34,197,94,.1)' }}>
                                            <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, fontSize: 10, color: 'var(--color-brand-green-tint)' }}>
                                                Closing balance
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--color-brand-green-tint)' }}>
                                                {selectedAccount.nature === 'Debit' && closingBalance !== 0 ? formatUsd(Math.abs(closingBalance)) : ''}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--color-brand-green-tint)' }}>
                                                {selectedAccount.nature === 'Credit' || closingBalance === 0 ? formatUsd(Math.abs(closingBalance)) : ''}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 7. Footer — pagination info */}
                    <div style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)' }}>
                        Showing {filteredRows.length} of {rows.length} entries · {periodLabel(dateFrom, dateTo)} · {accountChipLabel}
                    </div>
                </>
            )}

            {/* AI Insight box */}
            <div
                style={{
                    ...panel,
                    background: 'linear-gradient(135deg, rgba(124,58,237,.12) 0%, rgba(79,142,247,.08) 50%, var(--color-redwood-bg-surface) 80%)',
                    borderColor: 'rgba(124,58,237,.28)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Sparkles size={14} style={{ color: '#A78BFA' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>AI Insight</span>
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', margin: 0, lineHeight: 1.5 }}>
                            {showInsights ? aiInsightText : `${aiInsightText.slice(0, 180)}…`}
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
                        More Insights <ChevronRight size={12} />
                    </button>
                </div>
            </div>

            {/* Ask AI bar */}
            <div
                style={{
                    ...panel,
                    position: 'sticky',
                    bottom: 8,
                    background: 'linear-gradient(135deg, rgba(124,58,237,.12) 0%, var(--color-redwood-bg-surface) 60%)',
                    borderColor: 'rgba(124,58,237,.28)',
                    zIndex: 10,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Bot size={14} style={{ color: '#A78BFA' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Ask AI</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {AI_PROMPTS.map(p => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setAiQuestion(p)}
                            style={{
                                padding: '3px 8px',
                                borderRadius: 999,
                                fontSize: 8.5,
                                border: '1px solid rgba(124,58,237,.25)',
                                background: 'rgba(124,58,237,.1)',
                                color: '#C4B5FD',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="text"
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                        placeholder="Ask about this account ledger…"
                        style={{
                            flex: 1,
                            minWidth: 200,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--color-redwood-border)',
                            background: 'rgba(255,255,255,.04)',
                            color: 'var(--color-redwood-text-main)',
                            fontSize: 11,
                            fontFamily: 'inherit',
                            outline: 'none',
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleAskAi}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'linear-gradient(90deg,#7C3AED,#9333EA)',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Ask →
                    </button>
                </div>
            </div>
        </div>
    );
}
