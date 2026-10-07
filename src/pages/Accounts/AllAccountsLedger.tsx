// All-accounts ledger against the general ledger.
// Account list: GET /api/accounts/ via getGLAccounts.
// Lines: GET /api/gl/accounts/{id}/ledger via getGLAccountLedger.
// Both use glService's apiRequest — the same helper as the trial-balance page.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
    BookOpen,
    Download,
    Calendar,
    Printer,
    Search,
    Check,
    Sparkles,
    Bot,
    ChevronRight,
} from 'lucide-react';
import {
    getGLAccountLedger,
    getGLAccounts,
    monthStartISO,
    type GLAccount,
    type GLAccountLedger,
    type GLLedgerContra,
    type GLLedgerRow,
} from '../../services/glService';

const CHIP_SYSTEM_KEYS = [
    'cash_on_hand',
    'bank',
    'accounts_receivable',
    'accounts_payable',
    'sales_revenue',
    'cogs',
    'operating_expenses',
    'tax_payable',
] as const;

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

function localTodayISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Could not load ledger data.';
}

function contraLabel(contra: GLLedgerContra[]): string {
    if (!contra.length) return '—';
    const shown = contra.slice(0, 3).map(item => `${item.code} ${item.name}`);
    const extra = contra.length - shown.length;
    return extra > 0 ? `${shown.join(' · ')} +${extra}` : shown.join(' · ');
}

function moneyCell(amount: number, color: string): { text: string; color: string } {
    if (amount <= 0) return { text: '', color: 'transparent' };
    return { text: formatUsd(amount), color };
}

export default function AllAccountsLedger() {
    const [accounts, setAccounts] = useState<GLAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [dateFrom, setDateFrom] = useState<string>(monthStartISO);
    const [dateTo, setDateTo] = useState<string>(localTodayISO);
    const [ledger, setLedger] = useState<GLAccountLedger | null>(null);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tableSearch, setTableSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [showInsights, setShowInsights] = useState(false);
    const [aiQuestion, setAiQuestion] = useState('');

    const datesInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
    const loading = accountsLoading || ledgerLoading;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setAccountsLoading(true);
                setError(null);
                const rows = await getGLAccounts();
                if (cancelled) return;
                const active = rows.filter(account => account.is_active);
                setAccounts(active);
                setSelectedAccountId(prev => {
                    if (prev != null && active.some(account => account.id === prev)) return prev;
                    const receivable = active.find(account => account.system_key === 'accounts_receivable');
                    return receivable?.id ?? active[0]?.id ?? null;
                });
            } catch (err) {
                if (cancelled) return;
                setAccounts([]);
                setLedger(null);
                setError(errorMessage(err));
            } finally {
                if (!cancelled) setAccountsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (selectedAccountId == null || datesInvalid) {
            setLedger(null);
            setLedgerLoading(false);
            return;
        }
        let cancelled = false;
        setLedgerLoading(true);
        setError(null);
        getGLAccountLedger(selectedAccountId, dateFrom, dateTo)
            .then(data => {
                if (cancelled) return;
                setLedger(data);
                setLedgerLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                setLedger(null);
                setError(errorMessage(err));
                setLedgerLoading(false);
            });
        return () => { cancelled = true; };
    }, [selectedAccountId, dateFrom, dateTo, datesInvalid]);

    const selectedAccount = accounts.find(account => account.id === selectedAccountId) || null;
    const chips = CHIP_SYSTEM_KEYS
        .map(key => accounts.find(account => account.system_key === key))
        .filter((account): account is GLAccount => Boolean(account));

    const rows: GLLedgerRow[] = ledger?.rows ?? [];

    const sourceOptions = useMemo(() => {
        const set = new Set(rows.map(row => row.source_type || '').filter(Boolean));
        return Array.from(set).sort();
    }, [rows]);

    const typeOptions = useMemo(() => {
        const set = new Set(rows.map(row => row.status || '').filter(Boolean));
        return Array.from(set).sort();
    }, [rows]);

    const filteredRows = useMemo(() => {
        let out = rows;
        if (tableSearch.trim()) {
            const q = tableSearch.toLowerCase();
            out = out.filter(row =>
                (row.memo || '').toLowerCase().includes(q) ||
                (row.entry_number || '').toLowerCase().includes(q) ||
                (row.source_type || '').toLowerCase().includes(q) ||
                (row.source_id || '').toLowerCase().includes(q) ||
                contraLabel(row.contra).toLowerCase().includes(q),
            );
        }
        if (typeFilter !== 'all') out = out.filter(row => row.status === typeFilter);
        if (sourceFilter !== 'all') out = out.filter(row => row.source_type === sourceFilter);
        return out;
    }, [rows, tableSearch, typeFilter, sourceFilter]);

    const exportCSV = () => {
        if (!selectedAccount || !ledger || rows.length === 0) {
            alert('Pick an account with at least one ledger entry first.');
            return;
        }
        const lines: string[] = [];
        lines.push(`"Account","${selectedAccount.code} — ${selectedAccount.name}"`);
        lines.push(`"Opening Balance","${ledger.opening_balance.toFixed(2)}"`);
        lines.push('');
        lines.push('"Date","JE","Description","Contra Account","Source","Debit","Credit","Balance"');
        for (const row of rows) {
            lines.push([
                row.entry_date || '',
                row.entry_number,
                (row.memo || '').replace(/"/g, '""'),
                contraLabel(row.contra).replace(/"/g, '""'),
                row.source_type || '',
                row.debit.toFixed(2),
                row.credit.toFixed(2),
                row.running_balance.toFixed(2),
            ].map(value => `"${value}"`).join(','));
        }
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
            `Account ${selectedAccount?.code || '—'} · Opening ${formatUsd(ledger?.opening_balance ?? 0)} · ` +
            `Closing ${formatUsd(ledger?.closing_balance ?? 0)} · ${ledger?.rows.length ?? 0} entries.\n\n` +
            'Connect the AI CFO endpoint for live ledger analysis.',
        );
    };

    const aiInsightText = ledger
        ? `Opening ${formatUsd(ledger.opening_balance)}, debits ${formatUsd(ledger.total_debit)}, credits ${formatUsd(ledger.total_credit)}. ` +
          `Net movement ${formatUsdSigned(ledger.net_movement)}. Closing balance ${formatUsd(ledger.closing_balance)}. ` +
          `${ledger.rows.length} entries.`
        : 'Ledger insight will appear after the account loads.';

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

    const showLedger = !loading && !error && !datesInvalid && ledger != null;

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24, maxWidth: 1280, margin: '0 auto' }}>
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
                        disabled={!showLedger || rows.length === 0}
                        style={{ ...ghostBtn, opacity: !showLedger || rows.length === 0 ? 0.45 : 1 }}
                        title="Export"
                    >
                        <Download size={12} /> Export
                    </button>
                </div>
            </div>

            <div style={{ ...panel, padding: '14px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                            Account:
                        </label>
                        <div style={{
                            border: '1px solid var(--color-redwood-border)',
                            borderRadius: 8,
                            padding: '10px 12px',
                            background: 'var(--color-redwood-row-bg)',
                        }}>
                            {selectedAccount && showLedger ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                                        {selectedAccount.type} | {selectedAccount.code} | {selectedAccount.name}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 13, fontWeight: 700, color: 'var(--color-brand-green-tint)' }}>
                                            {formatUsd(ledger.all_time_balance)}
                                        </div>
                                        <div style={{ fontSize: 8, color: 'var(--color-redwood-text-subtle)', letterSpacing: '.3px' }}>all-time</div>
                                    </div>
                                </div>
                            ) : (
                                <span style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)' }}>
                                    {selectedAccount ? `${selectedAccount.type} | ${selectedAccount.code} | ${selectedAccount.name}` : '— Choose an account —'}
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 220 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>From</label>
                            <div style={{ position: 'relative' }}>
                                <input type="date" aria-label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={dateInputStyle} />
                                <Calendar size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)', pointerEvents: 'none' }} />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>To</label>
                            <div style={{ position: 'relative' }}>
                                <input type="date" aria-label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={dateInputStyle} />
                                <Calendar size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)', pointerEvents: 'none' }} />
                            </div>
                        </div>
                    </div>
                </div>
                {datesInvalid && (
                    <p role="alert" style={{ fontSize: 10, color: 'var(--color-brand-red-tint)', margin: '8px 0 0', fontWeight: 600 }}>
                        From must be on or before To.
                    </p>
                )}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {chips.map(account => {
                    const active = selectedAccountId === account.id;
                    return (
                        <button
                            key={account.system_key || account.id}
                            type="button"
                            onClick={() => setSelectedAccountId(account.id)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: 999,
                                fontSize: 9,
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: active ? '1px solid #4F8EF7' : '1px solid var(--color-redwood-border)',
                                background: active ? 'rgba(79,142,247,.15)' : 'rgba(255,255,255,.04)',
                                color: active ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            {account.code} {account.name}
                            {active && <Check size={10} style={{ color: '#4F8EF7' }} />}
                        </button>
                    );
                })}
                <select
                    aria-label="All accounts"
                    value={selectedAccountId ?? ''}
                    onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                    style={selectStyle}
                >
                    {accounts.map(account => (
                        <option key={account.id} value={account.id}>{account.code} — {account.name}</option>
                    ))}
                </select>
            </div>

            {loading && !error && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                    <div style={{ width: 32, height: 32, border: '3px solid rgba(79,142,247,.25)', borderTopColor: '#4F8EF7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
            )}
            {error && !loading && (
                <div style={{ ...panel, borderColor: 'rgba(239,68,68,.35)', background: 'rgba(239,68,68,.08)', color: 'var(--color-brand-red-tint)', fontSize: 11, fontWeight: 600 }}>
                    {error}
                </div>
            )}

            {showLedger && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                        {[
                            { label: 'OPENING BALANCE', value: formatUsd(ledger.opening_balance), color: 'var(--color-redwood-text-main)' },
                            { label: 'TOTAL CREDITS', value: formatUsd(ledger.total_credit), color: 'var(--color-brand-green-tint)' },
                            { label: 'TOTAL DEBITS', value: formatUsd(ledger.total_debit), color: 'var(--color-brand-red-tint)' },
                            { label: 'NET MOVEMENT', value: formatUsdSigned(ledger.net_movement), color: 'var(--color-brand-blue-tint)' },
                            { label: 'CLOSING BALANCE', value: formatUsd(ledger.closing_balance), color: 'var(--color-brand-green-tint)' },
                        ].map(card => (
                            <div key={card.label} style={{ ...panel, padding: '10px 12px' }}>
                                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--color-redwood-text-muted)', letterSpacing: '.4px', marginBottom: 4 }}>{card.label}</div>
                                <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 14, fontWeight: 700, color: card.color }}>{card.value}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
                            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)' }} />
                            <input
                                type="text"
                                aria-label="Search ledger"
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
                        <select aria-label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
                            <option value="all">All types</option>
                            {typeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                        <select aria-label="Source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={selectStyle}>
                            <option value="all">All sources</option>
                            {sourceOptions.map(source => <option key={source} value={source}>{source}</option>)}
                        </select>
                    </div>

                    <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                        {['Date', 'JE #', 'Description', 'Contra account', 'Source', 'Debit', 'Credit', 'Running balance'].map((heading, index) => (
                                            <th key={heading} style={{ ...thStyle, textAlign: index >= 5 ? 'right' : 'left' }}>{heading}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '32px 10px', color: 'var(--color-redwood-text-subtle)' }}>
                                                No posted journal entries for this account in the selected range.
                                            </td>
                                        </tr>
                                    ) : filteredRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '32px 10px', color: 'var(--color-redwood-text-subtle)' }}>
                                                No entries match your search.
                                            </td>
                                        </tr>
                                    ) : filteredRows.map((row, index) => {
                                        const debit = moneyCell(row.debit, 'var(--color-brand-red-tint)');
                                        const credit = moneyCell(row.credit, 'var(--color-brand-green-tint)');
                                        return (
                                            <tr key={`${row.entry_id}-${index}`}>
                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                                    {row.entry_date ? new Date(row.entry_date.includes('T') ? row.entry_date : `${row.entry_date}T12:00:00`).toLocaleDateString() : '—'}
                                                </td>
                                                <td style={tdStyle}>
                                                    <span
                                                        style={{
                                                            fontFamily: 'ui-monospace,monospace',
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color: 'var(--color-redwood-text-main)',
                                                        }}
                                                    >
                                                        {row.entry_number}
                                                    </span>
                                                    {row.status === 'reversed' && (
                                                        <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--color-redwood-text-subtle)' }}>
                                                            reversed
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ ...tdStyle, maxWidth: 200 }}>{row.memo || '—'}</td>
                                                <td style={{ ...tdStyle, fontSize: 10, color: '#C4B5FD', fontWeight: 500 }}>{contraLabel(row.contra)}</td>
                                                <td title={row.source_id || undefined} style={{ ...tdStyle, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                                    {row.source_type || '—'}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: debit.color }}>
                                                    {debit.text}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: credit.color }}>
                                                    {credit.text}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>
                                                    {formatUsd(row.running_balance)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)' }}>
                        Showing {filteredRows.length} of {rows.length} entries · {dateFrom} – {dateTo} · {selectedAccount?.code} {selectedAccount?.name}
                    </div>
                </>
            )}

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
                            {showInsights || !ledger ? aiInsightText : `${aiInsightText.slice(0, 180)}…`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowInsights(value => !value)}
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

            <div
                style={{
                    ...panel,
                    background: 'linear-gradient(135deg, rgba(124,58,237,.12) 0%, var(--color-redwood-bg-surface) 60%)',
                    borderColor: 'rgba(124,58,237,.28)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Bot size={14} style={{ color: '#A78BFA' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Ask AI</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {AI_PROMPTS.map(prompt => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => setAiQuestion(prompt)}
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
                            {prompt}
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
