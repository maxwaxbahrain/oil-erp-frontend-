import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    Check,
    RefreshCw,
    Search,
    RotateCcw,
    Bot,
    Sparkles,
    ChevronDown,
    FileText,
    Eye,
    ShieldCheck,
} from 'lucide-react';
import { getCustomers, getInvoices, type Customer, type Invoice } from '../../services/api';
import { getAccounts, DEFAULT_ACCOUNTS } from './ChartOfAccounts';

// Helper to generate JV number
const nextBDJVNumber = (): string => {
    const stored = JSON.parse(localStorage.getItem('journal_vouchers') || '[]');
    const last = stored[0]?.jvNumber;
    if (!last) return 'JV-0001';
    const num = parseInt(last.replace('JV-', ''), 10) + 1;
    return `JV-${String(num).padStart(4, '0')}`;
};

interface BadDebtCandidate {
    invoice: Invoice;
    customer: Customer | undefined;
    daysPastDue: number;
    amount: number;
}

type AgeBracket = '30-60' | '61-90' | '91-180' | '181-360' | '360+';
type RiskFilter = 'all' | 'high_risk' | '360+' | '180+';
type SortOption = 'days_desc' | 'days_asc' | 'amount_desc' | 'amount_asc' | 'customer_asc';

const CFO_THRESHOLD = 5000;

const AGE_BRACKETS: { key: AgeBracket; label: string; range: string }[] = [
    { key: '30-60', label: '30–60 days', range: '30–60' },
    { key: '61-90', label: '61–90 days', range: '61–90' },
    { key: '91-180', label: '91–180 days', range: '91–180' },
    { key: '181-360', label: '181–360 days', range: '181–360' },
    { key: '360+', label: '360+ days', range: '360+' },
];

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

function formatDate(raw: string): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

function inAgeBracket(days: number, bracket: AgeBracket): boolean {
    if (bracket === '30-60') return days >= 30 && days <= 60;
    if (bracket === '61-90') return days >= 61 && days <= 90;
    if (bracket === '91-180') return days >= 91 && days <= 180;
    if (bracket === '181-360') return days >= 181 && days <= 360;
    return days > 360;
}

function riskLabel(days: number): { label: string; color: string; dot: string } {
    if (days >= 180) return { label: 'High', color: 'var(--color-brand-red)', dot: '#EF4444' };
    if (days >= 91) return { label: 'Medium', color: 'var(--color-brand-amber)', dot: '#F59E0B' };
    return { label: 'Low', color: 'var(--color-brand-blue-tint)', dot: '#4F8EF7' };
}

function aiWarningText(c: BadDebtCandidate): string | null {
    if (c.daysPastDue >= 360) {
        return 'Over 360 days overdue — collection attempts exhausted. Strong write-off candidate.';
    }
    if (c.daysPastDue >= 180) {
        return '180+ days overdue — escalate to collections or write off per policy.';
    }
    if (c.daysPastDue >= 91) {
        return 'Consider payment plan or final demand letter before write-off.';
    }
    return null;
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
    const [activeAgeBracket, setActiveAgeBracket] = useState<AgeBracket | null>('181-360');
    const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
    const [sortBy, setSortBy] = useState<SortOption>('days_desc');

    const loadRecentJVs = () => {
        try {
            const stored = JSON.parse(localStorage.getItem('journal_vouchers') || '[]');
            const badDebts = stored.filter((j: any) => j?.type === 'Bad Debt').slice(0, 20);
            setRecentJVs(badDebts);
        } catch { setRecentJVs([]); }
    };
    useEffect(() => { loadRecentJVs(); }, []);

    useEffect(() => {
        Promise.all([getInvoices(), getCustomers()]).then(([invoices, customers]) => {
            const today = new Date();
            const custMap: Record<string, Customer> = {};
            customers.forEach(c => { custMap[String(c.id)] = c; });

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
                        amount: remaining,
                    };
                })
                .filter(c => c.daysPastDue > 0 && c.amount > 0)
                .sort((a, b) => b.daysPastDue - a.daysPastDue);

            setCandidates(overdue);
            setLoading(false);
        });
    }, []);

    const totalExposure = useMemo(
        () => candidates.reduce((s, c) => s + c.amount, 0),
        [candidates],
    );

    const highRiskCandidates = useMemo(
        () => candidates.filter(c => c.daysPastDue >= 180),
        [candidates],
    );

    const bracketStats = useMemo(() => {
        const stats: Record<AgeBracket, { count: number; total: number }> = {
            '30-60': { count: 0, total: 0 },
            '61-90': { count: 0, total: 0 },
            '91-180': { count: 0, total: 0 },
            '181-360': { count: 0, total: 0 },
            '360+': { count: 0, total: 0 },
        };
        for (const c of candidates) {
            for (const b of AGE_BRACKETS) {
                if (inAgeBracket(c.daysPastDue, b.key)) {
                    stats[b.key].count += 1;
                    stats[b.key].total += c.amount;
                    break;
                }
            }
        }
        return stats;
    }, [candidates]);

    const filteredCandidates = useMemo(() => {
        let out = candidates;
        const q = searchTerm.trim().toLowerCase();
        if (q) {
            out = out.filter(c =>
                (c.customer?.name || '').toLowerCase().includes(q) ||
                (c.customer?.phone || '').toLowerCase().includes(q) ||
                (c.customer?.address || '').toLowerCase().includes(q) ||
                (c.invoice.invoiceNumber || '').toLowerCase().includes(q),
            );
        }
        if (activeAgeBracket) {
            out = out.filter(c => inAgeBracket(c.daysPastDue, activeAgeBracket));
        }
        if (riskFilter === 'high_risk' || riskFilter === '180+') {
            out = out.filter(c => c.daysPastDue >= 180);
        } else if (riskFilter === '360+') {
            out = out.filter(c => c.daysPastDue > 360);
        }
        return out;
    }, [candidates, searchTerm, activeAgeBracket, riskFilter]);

    const sortedCandidates = useMemo(() => {
        const list = [...filteredCandidates];
        switch (sortBy) {
            case 'days_asc': return list.sort((a, b) => a.daysPastDue - b.daysPastDue);
            case 'amount_desc': return list.sort((a, b) => b.amount - a.amount);
            case 'amount_asc': return list.sort((a, b) => a.amount - b.amount);
            case 'customer_asc': return list.sort((a, b) => (a.customer?.name || '').localeCompare(b.customer?.name || ''));
            default: return list.sort((a, b) => b.daysPastDue - a.daysPastDue);
        }
    }, [filteredCandidates, sortBy]);

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAllHighRisk = () => {
        setSelected(prev => {
            const next = new Set(prev);
            highRiskCandidates.forEach(c => next.add(c.invoice.id));
            return next;
        });
    };

    const selectBracket = (bracket: AgeBracket) => {
        setActiveAgeBracket(bracket);
        setSelected(prev => {
            const next = new Set(prev);
            candidates.filter(c => inAgeBracket(c.daysPastDue, bracket)).forEach(c => next.add(c.invoice.id));
            return next;
        });
    };

    const selectedCandidates = candidates.filter(c => selected.has(c.invoice.id));
    const totalAmount = selectedCandidates.reduce((s, c) => s + c.amount, 0);
    const belowCfoThreshold = totalAmount < CFO_THRESHOLD;

    const filterDescription = useMemo(() => {
        const parts: string[] = [];
        if (activeAgeBracket) parts.push(`${AGE_BRACKETS.find(b => b.key === activeAgeBracket)?.label} bracket`);
        if (riskFilter === 'high_risk') parts.push('high risk (180+ days)');
        else if (riskFilter === '360+') parts.push('360+ days overdue');
        else if (riskFilter === '180+') parts.push('180+ days overdue');
        if (searchTerm.trim()) parts.push(`matching "${searchTerm.trim()}"`);
        return parts.length ? parts.join(' · ') : 'All overdue invoices';
    }, [activeAgeBracket, riskFilter, searchTerm]);

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
                        credit: 0,
                    },
                    {
                        id: `${Date.now()}-cr-${c.invoice.id}`,
                        accountId: arAcc.id,
                        accountCode: arAcc.code,
                        accountName: arAcc.name,
                        description: `Write off: ${c.invoice.invoiceNumber} — ${c.customer?.name}`,
                        debit: 0,
                        credit: c.amount,
                    },
                ]),
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                isBalanced: true,
                createdAt: new Date().toISOString(),
                status: 'Posted' as const,
            };

            const existing = JSON.parse(localStorage.getItem('journal_vouchers') || '[]');
            localStorage.setItem('journal_vouchers', JSON.stringify([jv, ...existing]));

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
                setSuccess(`Bad Debt JV ${jv.jvNumber} posted for ${formatUsd(totalAmount)}. Customer balances reduced (${arOk}/${selectedCandidates.length}).`);
            } else {
                setSuccess(`JV ${jv.jvNumber} posted, but ${arFailures.length} customer balance(s) could not be reduced: ${arFailures.join(', ')}.`);
            }
            setSelected(new Set());
            loadRecentJVs();
            setTimeout(() => setSuccess(''), 8000);
        } catch {
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
            `This will restore ${formatUsd(total)} across ${affected.length} customer(s):\n` +
            affected.map((x: any) => `  • ${x.customerName || 'Customer ' + x.customerId}: +${formatUsd(x.amount)}`).join('\n') +
            `\n\nA reversal JV will be posted and a debit entry will appear on each customer's ledger.`,
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
                setSuccess(`JV ${jv.jvNumber} reversed (${formatUsd(total)}). Customer balances restored (${ok}/${affected.length}). Reversal JV: ${reversal.jvNumber}.`);
            } else {
                setSuccess(`JV ${jv.jvNumber} marked reversed, but ${failures.length} customer balance(s) could not be restored: ${failures.join(', ')}.`);
            }
            loadRecentJVs();
            setTimeout(() => setSuccess(''), 8000);
        } finally {
            setReversingId(null);
        }
    };

    const summaryCards: { label: string; value: string; sub: string; accent: string; bg: string }[] = [
        {
            label: 'Overdue Invoices',
            value: String(candidates.length),
            sub: 'awaiting action',
            accent: 'var(--color-brand-blue)',
            bg: 'var(--color-badge-blue-bg)',
        },
        {
            label: 'Total Exposure',
            value: formatUsd(totalExposure),
            sub: `all ${candidates.length} invoices`,
            accent: 'var(--color-brand-amber)',
            bg: 'var(--color-badge-amber-bg)',
        },
        {
            label: 'High Risk (180+ Days)',
            value: String(highRiskCandidates.length),
            sub: 'recommended write-off',
            accent: 'var(--color-brand-red)',
            bg: 'var(--color-badge-red-bg)',
        },
        {
            label: 'Selected to Write Off',
            value: `${selectedCandidates.length} invoice${selectedCandidates.length !== 1 ? 's' : ''}`,
            sub: `${formatUsd(totalAmount)} total`,
            accent: 'var(--color-brand-blue)',
            bg: 'var(--color-badge-blue-bg)',
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 100, animation: 'fadeIn .4s ease' }}>

            {/* 1. Page Header */}
            <div style={{ ...panel, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: 'var(--color-badge-red-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <AlertTriangle size={20} style={{ color: 'var(--color-brand-red)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-redwood-text-main)', margin: 0, letterSpacing: '-.02em' }}>
                            Bad debts write-off
                        </h1>
                        <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', margin: '4px 0 0' }}>
                            Write off uncollectable invoices · auto-creates balanced JV · Dr 5250 / Cr 1120
                        </p>
                    </div>
                </div>
            </div>

            {success && (
                <div style={{
                    ...panel,
                    background: 'rgba(34,197,94,.08)',
                    borderColor: 'rgba(34,197,94,.25)',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <Check size={18} style={{ color: 'var(--color-brand-green)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-brand-green-tint)', margin: 0 }}>{success}</p>
                        <p style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', margin: '2px 0 0' }}>
                            JV is now visible in Journal Vouchers. Accounts receivable has been reduced.
                        </p>
                    </div>
                    <button type="button" onClick={() => navigate('/finance/journal-voucher')} style={{ ...ghostBtn, color: 'var(--color-brand-green-tint)', border: 'none' }}>
                        View JV →
                    </button>
                </div>
            )}

            {/* 2. Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {summaryCards.map(card => (
                    <div key={card.label} style={{ ...panel, padding: '12px 14px', borderLeft: `3px solid ${card.accent}` }}>
                        <p style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--color-redwood-text-muted)', margin: 0 }}>
                            {card.label}
                        </p>
                        <p style={{ fontSize: 20, fontWeight: 700, color: card.accent, margin: '4px 0 2px', fontFamily: 'ui-monospace,monospace' }}>
                            {card.value}
                        </p>
                        <p style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', margin: 0 }}>{card.sub}</p>
                    </div>
                ))}
            </div>

            {/* 3. Quick Select by Age Bracket */}
            <div>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-redwood-text-muted)', margin: '0 0 8px' }}>
                    Quick select by age bracket
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {AGE_BRACKETS.map(b => {
                        const stats = bracketStats[b.key];
                        const isActive = activeAgeBracket === b.key;
                        return (
                            <button
                                key={b.key}
                                type="button"
                                onClick={() => selectBracket(b.key)}
                                style={{
                                    ...panel,
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    border: isActive ? '2px solid var(--color-brand-red)' : '1px solid var(--color-redwood-border)',
                                    background: isActive ? 'rgba(239,68,68,.06)' : 'var(--color-redwood-bg-surface)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                <p style={{ fontSize: 9, fontWeight: 700, color: isActive ? 'var(--color-brand-red)' : 'var(--color-redwood-text-muted)', margin: 0 }}>
                                    {b.label}
                                </p>
                                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-redwood-text-main)', margin: '4px 0 2px' }}>
                                    {stats.count}
                                </p>
                                <p style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', margin: 0, fontFamily: 'ui-monospace,monospace' }}>
                                    {formatUsd(stats.total)}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 4. Auto-Generated Journal Entry Preview */}
            <div style={{ ...panel, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-redwood-text-muted)', margin: 0 }}>
                        Auto-generated journal entry — updates as you select
                    </p>
                    <span style={{
                        fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
                        padding: '3px 8px', borderRadius: 4,
                        background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green)',
                    }}>
                        Live preview
                    </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 12 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 8.5, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
                            Write-off date
                        </label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 8.5, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
                            Narration *
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="e.g. Bad debt write-off Q1 2026 — high-risk AR cleanup"
                            style={inputStyle}
                        />
                    </div>
                </div>
                <div style={{
                    background: 'var(--color-redwood-row-bg)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    border: '1px solid var(--color-redwood-border)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--color-redwood-text-main)' }}>
                            Dr <span style={{ fontFamily: 'ui-monospace,monospace', color: 'var(--color-redwood-text-muted)' }}>5250</span> Bad Debts Expense
                        </span>
                        <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, fontSize: 11, color: 'var(--color-brand-green)' }}>
                            {formatUsd(totalAmount)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: 'var(--color-redwood-text-main)' }}>
                            Cr <span style={{ fontFamily: 'ui-monospace,monospace', color: 'var(--color-redwood-text-muted)' }}>1120</span> Accounts Receivable
                        </span>
                        <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, fontSize: 11, color: 'var(--color-brand-red)' }}>
                            {formatUsd(totalAmount)}
                        </span>
                    </div>
                    <div style={{
                        borderTop: '1px solid var(--color-redwood-border)',
                        paddingTop: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)' }}>Total</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, fontSize: 11, color: 'var(--color-redwood-text-main)' }}>
                                {formatUsd(totalAmount)}
                            </span>
                            {totalAmount > 0 && (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    fontSize: 8.5, fontWeight: 700, color: 'var(--color-brand-green)',
                                    background: 'var(--color-badge-green-bg)', padding: '2px 8px', borderRadius: 4,
                                }}>
                                    <Check size={10} /> Balanced
                                </span>
                            )}
                        </span>
                    </div>
                </div>
            </div>

            {/* 5. Informational Banners */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                    ...panel,
                    background: 'rgba(34,197,94,.06)',
                    borderColor: 'rgba(34,197,94,.2)',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <ShieldCheck size={16} style={{ color: 'var(--color-brand-green)', flexShrink: 0 }} />
                    <p style={{ fontSize: 10, color: 'var(--color-brand-green-tint)', margin: 0 }}>
                        CFO approval not required below {formatUsd(CFO_THRESHOLD)} threshold
                        {belowCfoThreshold && totalAmount > 0 ? ' — current selection qualifies' : totalAmount >= CFO_THRESHOLD ? ' — current selection exceeds threshold' : ''}
                    </p>
                </div>
                <div style={{
                    ...panel,
                    background: 'rgba(79,142,247,.06)',
                    borderColor: 'rgba(79,142,247,.2)',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                    <Bot size={16} style={{ color: 'var(--color-brand-blue)', flexShrink: 0, marginTop: 1 }} />
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-brand-blue-tint)', margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Sparkles size={11} /> AI collection insight
                        </p>
                        <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-muted)', margin: 0, lineHeight: 1.5 }}>
                            {highRiskCandidates.length > 0
                                ? `${highRiskCandidates.length} invoices are 180+ days overdue (${formatUsd(highRiskCandidates.reduce((s, c) => s + c.amount, 0))}). Prioritize final demand letters for 91–180 day accounts before write-off. Consider payment plans for amounts under ${formatUsd(500)}.`
                                : 'No high-risk accounts detected. Review overdue invoices regularly to prevent escalation.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* 6. Table Filters + 7. Invoices Table */}
            <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-redwood-border)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
                            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-subtle)' }} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Search customer, phone, invoice #..."
                                style={{ ...inputStyle, paddingLeft: 30 }}
                                autoComplete="off"
                            />
                        </div>
                        {(['all', 'high_risk', '360+', '180+'] as RiskFilter[]).map(f => {
                            const labels: Record<RiskFilter, string> = {
                                all: 'All',
                                high_risk: 'All high risk',
                                '360+': '360+ days',
                                '180+': '180+ days',
                            };
                            const active = riskFilter === f;
                            return (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setRiskFilter(f)}
                                    style={{
                                        ...ghostBtn,
                                        background: active ? 'rgba(79,142,247,.12)' : ghostBtn.background,
                                        color: active ? 'var(--color-brand-blue-tint)' : ghostBtn.color,
                                        borderColor: active ? 'rgba(79,142,247,.3)' : 'var(--color-redwood-border)',
                                    }}
                                >
                                    {labels[f]}
                                </button>
                            );
                        })}
                        <div style={{ position: 'relative' }}>
                            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} style={{ ...selectStyle, paddingRight: 28, appearance: 'none' }}>
                                <option value="days_desc">Days overdue ↓</option>
                                <option value="days_asc">Days overdue ↑</option>
                                <option value="amount_desc">Amount ↓</option>
                                <option value="amount_asc">Amount ↑</option>
                                <option value="customer_asc">Customer A–Z</option>
                            </select>
                            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-redwood-text-muted)' }} />
                        </div>
                        <button
                            type="button"
                            onClick={selectAllHighRisk}
                            style={{
                                ...ghostBtn,
                                background: 'rgba(239,68,68,.1)',
                                color: 'var(--color-brand-red-tint)',
                                borderColor: 'rgba(239,68,68,.25)',
                            }}
                        >
                            Select all {highRiskCandidates.length} high risk
                        </button>
                    </div>
                    <p style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', margin: 0 }}>
                        {candidates.length} overdue · {selectedCandidates.length} selected · {filterDescription}
                    </p>
                </div>

                {loading ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 11 }}>
                        Loading overdue invoices…
                    </div>
                ) : candidates.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                        <Check size={40} style={{ color: 'var(--color-brand-green)', opacity: 0.3, margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--color-redwood-text-muted)', fontWeight: 600, fontSize: 11, margin: 0 }}>No overdue invoices</p>
                        <p style={{ color: 'var(--color-redwood-text-subtle)', fontSize: 10, margin: '4px 0 0' }}>All invoices are paid or not yet due</p>
                    </div>
                ) : sortedCandidates.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                        <Search size={36} style={{ color: 'var(--color-redwood-text-subtle)', margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--color-redwood-text-muted)', fontWeight: 600, fontSize: 11, margin: 0 }}>No matches</p>
                        <p style={{ color: 'var(--color-redwood-text-subtle)', fontSize: 10, margin: '4px 0 0' }}>Try adjusting filters or search terms</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                    <th style={{ ...thStyle, width: 36 }}>
                                        <input
                                            type="checkbox"
                                            checked={sortedCandidates.length > 0 && sortedCandidates.every(c => selected.has(c.invoice.id))}
                                            onChange={e => {
                                                const next = new Set(selected);
                                                if (e.target.checked) sortedCandidates.forEach(c => next.add(c.invoice.id));
                                                else sortedCandidates.forEach(c => next.delete(c.invoice.id));
                                                setSelected(next);
                                            }}
                                        />
                                    </th>
                                    {['Customer', 'Invoice', 'Due date', 'Days ow', 'Amount', 'Risk', 'Salesperson', 'Actions'].map(h => (
                                        <th key={h} style={thStyle}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCandidates.map(c => {
                                    const isSelected = selected.has(c.invoice.id);
                                    const risk = riskLabel(c.daysPastDue);
                                    const aiWarn = aiWarningText(c);
                                    return (
                                        <tr
                                            key={c.invoice.id}
                                            onClick={() => toggleSelect(c.invoice.id)}
                                            style={{
                                                cursor: 'pointer',
                                                background: isSelected ? 'rgba(79,142,247,.08)' : 'transparent',
                                            }}
                                        >
                                            <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(c.invoice.id)}
                                                />
                                            </td>
                                            <td style={tdStyle}>
                                                <p style={{ fontWeight: 600, fontSize: 11, margin: 0 }}>{c.customer?.name || c.invoice.customerName || `Customer ${c.invoice.customerId}`}</p>
                                                <p style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', margin: '2px 0 0' }}>
                                                    {[c.customer?.address, c.customer?.phone].filter(Boolean).join(' · ') || '—'}
                                                </p>
                                                {aiWarn && (
                                                    <div style={{
                                                        marginTop: 6, padding: '5px 8px', borderRadius: 6,
                                                        background: 'rgba(79,142,247,.08)', border: '1px solid rgba(79,142,247,.15)',
                                                        display: 'flex', alignItems: 'flex-start', gap: 5,
                                                    }}>
                                                        <Bot size={11} style={{ color: 'var(--color-brand-blue)', flexShrink: 0, marginTop: 1 }} />
                                                        <span style={{ fontSize: 8.5, color: 'var(--color-brand-blue-tint)', lineHeight: 1.4 }}>{aiWarn}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10 }}>
                                                {c.invoice.invoiceNumber}
                                            </td>
                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                                {formatDate(c.invoice.dueDate)}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                                                    fontSize: 9, fontWeight: 700,
                                                    background: c.daysPastDue >= 180 ? 'var(--color-badge-red-bg)' : c.daysPastDue >= 91 ? 'var(--color-badge-amber-bg)' : 'rgba(245,158,11,.08)',
                                                    color: c.daysPastDue >= 180 ? 'var(--color-brand-red)' : c.daysPastDue >= 91 ? 'var(--color-brand-amber)' : 'var(--color-brand-amber-tint)',
                                                }}>
                                                    {c.daysPastDue}d
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--color-brand-red-tint)' }}>
                                                {formatUsd(c.amount)}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 600, color: risk.color }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: risk.dot, flexShrink: 0 }} />
                                                    {risk.label}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                                {c.invoice.salesman || '—'}
                                            </td>
                                            <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSelect(c.invoice.id)}
                                                    style={{ ...ghostBtn, padding: '4px 8px', fontSize: 9 }}
                                                    title={isSelected ? 'Deselect' : 'Select for write-off'}
                                                >
                                                    {isSelected ? <Check size={11} /> : <Eye size={11} />}
                                                    {isSelected ? 'Selected' : 'Select'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Recent write-offs */}
            {recentJVs.length > 0 && (
                <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-redwood-border)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-redwood-text-main)', margin: 0 }}>Recent bad-debt JVs</p>
                        <p style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', margin: '2px 0 0' }}>
                            Click Reverse to undo a write-off — customer balance and ledger will be restored.
                        </p>
                    </div>
                    <div>
                        {recentJVs.map(jv => {
                            const total = Array.isArray(jv.affectedCustomers)
                                ? jv.affectedCustomers.reduce((s: number, x: any) => s + Number(x.amount || 0), 0)
                                : Number(jv.totalDebit || 0);
                            const isReversed = jv.status === 'Reversed';
                            return (
                                <div key={jv.id} style={{
                                    padding: '10px 14px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                                    borderBottom: '1px solid rgba(255,255,255,.04)',
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <p style={{ fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace,monospace', margin: 0 }}>{jv.jvNumber}</p>
                                            <span style={{
                                                fontSize: 8, fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4,
                                                background: isReversed ? 'rgba(255,255,255,.06)' : 'var(--color-badge-red-bg)',
                                                color: isReversed ? 'var(--color-redwood-text-muted)' : 'var(--color-brand-red)',
                                            }}>
                                                {isReversed ? 'Reversed' : 'Posted'}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {jv.narration || '—'}
                                        </p>
                                        <p style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', margin: '2px 0 0' }}>
                                            {jv.date} · {Array.isArray(jv.affectedCustomers) ? `${jv.affectedCustomers.length} customer(s)` : '—'}
                                        </p>
                                    </div>
                                    <p style={{ fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace,monospace', color: 'var(--color-brand-red-tint)', margin: 0, flexShrink: 0 }}>
                                        {formatUsd(total)}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => reverseBadDebtJV(jv)}
                                        disabled={isReversed || reversingId === jv.id || !Array.isArray(jv.affectedCustomers) || jv.affectedCustomers.length === 0}
                                        style={{
                                            ...ghostBtn,
                                            background: 'rgba(245,158,11,.12)',
                                            color: 'var(--color-brand-amber-tint)',
                                            borderColor: 'rgba(245,158,11,.25)',
                                            opacity: (isReversed || reversingId === jv.id) ? 0.4 : 1,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {reversingId === jv.id ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                        {reversingId === jv.id ? 'Reversing…' : 'Reverse'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 8. Sticky Footer Action Bar */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 40,
                background: 'var(--color-redwood-midnight)',
                borderTop: '1px solid var(--color-redwood-border)',
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <div>
                        <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)', margin: 0 }}>Selected</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-redwood-text-main)', margin: '2px 0 0' }}>
                            {selectedCandidates.length} invoice{selectedCandidates.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div>
                        <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)', margin: 0 }}>Total to write off</p>
                        <p style={{ fontSize: 13, fontWeight: 700, fontFamily: 'ui-monospace,monospace', color: 'var(--color-brand-red)', margin: '2px 0 0' }}>
                            {formatUsd(totalAmount)}
                        </p>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--color-redwood-border)', paddingLeft: 16 }}>
                        <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)', margin: 0 }}>JV preview</p>
                        <p style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', margin: '2px 0 0' }}>
                            Dr 5250 {formatUsd(totalAmount)} · Cr 1120 {formatUsd(totalAmount)}
                        </p>
                    </div>
                    <div>
                        <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-redwood-text-muted)', margin: 0 }}>CFO threshold</p>
                        <p style={{
                            fontSize: 9, fontWeight: 600, margin: '2px 0 0',
                            color: belowCfoThreshold ? 'var(--color-brand-green-tint)' : 'var(--color-brand-amber-tint)',
                        }}>
                            {totalAmount === 0 ? '—' : belowCfoThreshold ? `Under ${formatUsd(CFO_THRESHOLD)} — no approval needed` : `Over ${formatUsd(CFO_THRESHOLD)} — CFO approval required`}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={createBadDebtJV}
                    disabled={saving || selectedCandidates.length === 0}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 20px', borderRadius: 8, border: 'none',
                        background: selectedCandidates.length === 0 ? 'rgba(255,255,255,.08)' : 'var(--color-brand-red)',
                        color: selectedCandidates.length === 0 ? 'var(--color-redwood-text-subtle)' : '#fff',
                        fontSize: 11, fontWeight: 700, cursor: selectedCandidates.length === 0 ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
                    }}
                >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                    {saving ? 'Posting…' : `Confirm & post write-off (${formatUsd(totalAmount)})`}
                </button>
            </div>
        </div>
    );
}
