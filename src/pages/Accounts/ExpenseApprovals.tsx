// ─── STEP 7 — Expense Approval Queue ────────────────────────────────
// New route: /finance/expenses/approvals
//
// Shows all expenses with status Submitted or Under Review.  Manager
// can Approve (green) or Reject (red, with a required reason).  Both
// actions write back via saveExpense() — status flip is persisted to
// localStorage and immediately reflected in the rest of the app.
//
// Rejection reason is appended to description as
//   "[Rejected: <reason>]"
// so the spec's "rejection reason" surfaces in the existing field
// without churning the data model.

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    ShieldAlert,
    AlertTriangle,
    Loader2,
    Eye,
    Paperclip,
    Bot,
    RefreshCw,
    Plus,
} from 'lucide-react';
import { getExpenses, saveExpense, pushExpenseToAccounting, getExpenseSettings, type Expense } from '../../services/expenseService';
import { getCurrentUser } from '../../store/authStore';
import { useAuth } from '../../contexts/AuthContext';

const panelStyle: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '14px',
    padding: '14px 16px',
};

const PENDING_STATUSES = new Set(['Submitted', 'Under Review', 'Pending Approval']);

function formatMoney(n: number) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(raw: string | undefined): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

function timeAgo(iso: string | undefined): string {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        const diffMs = Date.now() - d.getTime();
        const hrs = Math.floor(diffMs / 3600000);
        if (hrs < 1) return 'just now';
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    } catch {
        return '—';
    }
}

function categoryInitials(category: string): string {
    const parts = (category || 'EX').split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (category || 'EX').slice(0, 2).toUpperCase();
}

function avatarColor(category: string): { bg: string; color: string } {
    const palette = [
        { bg: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)' },
        { bg: 'var(--color-badge-blue-bg)', color: 'var(--color-brand-blue-tint)' },
        { bg: 'rgba(124,58,237,.12)', color: '#C4B5FD' },
        { bg: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)' },
    ];
    let h = 0;
    for (let i = 0; i < category.length; i++) h = (h + category.charCodeAt(i)) % palette.length;
    return palette[h];
}

function statusBadgeStyle(status: string): CSSProperties {
    if (status === 'Approved') {
        return {
            background: 'var(--color-badge-green-bg)',
            color: 'var(--color-brand-green-tint)',
            border: '1px solid rgba(34,197,94,.28)',
        };
    }
    if (status === 'Rejected') {
        return {
            background: 'var(--color-badge-red-bg)',
            color: 'var(--color-brand-red-tint)',
            border: '1px solid rgba(239,68,68,.2)',
        };
    }
    return {
        background: 'var(--color-badge-amber-bg)',
        color: 'var(--color-brand-amber-tint)',
        border: '1px solid rgba(245,158,11,.28)',
    };
}

function StatusBadge({ status }: { status: string }) {
    return (
        <span
            style={{
                fontSize: 9,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 20,
                textTransform: 'capitalize',
                ...statusBadgeStyle(status),
            }}
        >
            {status}
        </span>
    );
}

export default function ExpenseApprovals() {
    const navigate = useNavigate();
    const { hasRole } = useAuth();
    const canApproveExpenses = hasRole('admin', 'accountant');
    const receiptThreshold = getExpenseSettings().policyRules.receiptRequiredThreshold ?? 50;
    const receiptRequiredButMissing = (exp: Expense): boolean => {
        const amt = Number(exp.amount) || 0;
        const hasReceipt = !!(exp.receiptUrl && String(exp.receiptUrl).trim());
        return amt >= receiptThreshold && !hasReceipt;
    };
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actioningId, setActioningId] = useState<string | null>(null);
    const [viewingId, setViewingId] = useState<string | null>(null);

    const reload = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const all = await getExpenses();
            setAllExpenses(all);
            const queue = all.filter(
                (e) =>
                    e.status === 'Submitted' ||
                    e.status === 'Under Review' ||
                    e.status === 'Pending Approval' ||
                    (e.status === 'Approved' && !e.journal_voucher_number),
            );
            queue.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setExpenses(queue);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load approval queue.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        void reload();
    }, []);

    const pendingOnly = useMemo(
        () => allExpenses.filter((e) => PENDING_STATUSES.has(e.status)),
        [allExpenses],
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const approvedThisMonth = useMemo(
        () =>
            allExpenses.filter((e) => {
                if (e.status !== 'Approved') return false;
                const d = new Date(e.approvedAt || e.date);
                return d >= monthStart;
            }),
        [allExpenses, monthStart],
    );

    const rejectedThisMonth = useMemo(
        () =>
            allExpenses.filter((e) => {
                if (e.status !== 'Rejected') return false;
                const d = new Date(e.approvedAt || e.date);
                return d >= monthStart;
            }),
        [allExpenses, monthStart],
    );

    const approvedThisMonthTotal = useMemo(
        () => approvedThisMonth.reduce((s, e) => s + e.amount, 0),
        [approvedThisMonth],
    );

    const avgApprovalHours = useMemo(() => {
        const withTimes = approvedThisMonth.filter((e) => e.approvedAt && e.createdAt);
        if (withTimes.length === 0) return null;
        const totalHrs = withTimes.reduce((s, e) => {
            const created = new Date(e.createdAt!).getTime();
            const approved = new Date(e.approvedAt!).getTime();
            return s + Math.max(0, (approved - created) / 3600000);
        }, 0);
        return Math.round(totalHrs / withTimes.length);
    }, [approvedThisMonth]);

    const recentlyApproved = useMemo(
        () =>
            [...allExpenses]
                .filter((e) => e.status === 'Approved')
                .sort(
                    (a, b) =>
                        new Date(b.approvedAt || b.date).getTime() -
                        new Date(a.approvedAt || a.date).getTime(),
                )
                .slice(0, 4),
        [allExpenses],
    );

    const handlePushToAccounting = async (exp: Expense) => {
        setActioningId(exp.id);
        setError(null);
        try {
            const { jvNumber } = await pushExpenseToAccounting(exp);
            await reload();
            alert('✓ Posted to Accounting as ' + jvNumber);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not push to Accounting.');
        } finally {
            setActioningId(null);
        }
    };

    const handleApprove = async (exp: Expense) => {
        if (!canApproveExpenses) return;
        if (receiptRequiredButMissing(exp)) {
            setError(
                `Receipt required: expenses of $${receiptThreshold.toFixed(2)} or more must have a receipt attached before approval.`,
            );
            return;
        }
        setActioningId(exp.id);
        setError(null);
        try {
            const approved = await saveExpense({
                id: exp.id,
                status: 'Approved',
                approvedBy: getCurrentUser().name,
                approvedAt: new Date().toISOString(),
            });
            if (!approved.journal_voucher_number) {
                setError(
                    'Expense was approved but accounting was not posted — use Retry Push to Accounting or check chart of accounts.',
                );
            }
            await reload();
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : 'Could not approve expense.');
        } finally {
            setActioningId(null);
        }
    };

    const openReject = (id: string) => {
        setRejectingId(id);
        setRejectReason('');
    };

    const cancelReject = () => {
        setRejectingId(null);
        setRejectReason('');
    };

    const confirmReject = async (exp: Expense) => {
        const reason = rejectReason.trim();
        if (!reason) {
            setError('Reject reason is required.');
            return;
        }
        setActioningId(exp.id);
        setError(null);
        try {
            const newDescription = exp.description
                ? `${exp.description}\n\n[Rejected: ${reason}]`
                : `[Rejected: ${reason}]`;
            await saveExpense({
                id: exp.id,
                status: 'Rejected',
                description: newDescription,
                approvedBy: getCurrentUser().name,
                approvedAt: new Date().toISOString(),
            });
            cancelReject();
            await reload();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not reject expense.');
        } finally {
            setActioningId(null);
        }
    };

    function renderApprovedRow(exp: Expense, key: string) {
        const av = avatarColor(exp.category);
        const viewing = viewingId === exp.id;
        return (
            <div
                key={key}
                style={{
                    ...panelStyle,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                }}
            >
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: av.bg,
                        color: av.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                    }}
                >
                    {categoryInitials(exp.category)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                            {exp.category}
                        </span>
                        <StatusBadge status="Approved" />
                        {exp.aiExtracted && (
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 600,
                                    padding: '2px 7px',
                                    borderRadius: 20,
                                    background: 'rgba(124,58,237,.12)',
                                    color: '#C4B5FD',
                                    border: '1px solid rgba(124,58,237,.28)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                }}
                            >
                                <Bot size={10} /> AI
                            </span>
                        )}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', margin: 0, lineHeight: 1.5 }}>
                        {exp.vendor || '—'} · {formatDate(exp.date)} · {exp.paymentMethod} · Approved by{' '}
                        {exp.approvedBy || getCurrentUser().name} · {timeAgo(exp.approvedAt)}
                    </p>
                    {viewing && (
                        <p style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginTop: 8 }}>
                            {exp.description || 'No description'}
                        </p>
                    )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-redwood-text-main)' }}>
                        ${formatMoney(exp.amount)}
                    </div>
                    {exp.taxAmount != null && exp.taxAmount > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginTop: 2 }}>
                            Tax: ${formatMoney(exp.taxAmount)}
                        </div>
                    )}
                    <div
                        style={{
                            fontSize: 10,
                            color: 'var(--color-redwood-text-muted)',
                            marginTop: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 4,
                        }}
                    >
                        {exp.receiptUrl ? (
                            <>
                                <Paperclip size={11} /> 1 receipt
                            </>
                        ) : (
                            '— no receipt'
                        )}
                    </div>
                </div>
            </div>
        );
    }

    function renderQueueCard(exp: Expense) {
        const isRejecting = rejectingId === exp.id;
        const busy = actioningId === exp.id;
        const flagsCount = (exp.policy_flags?.length || 0) + (exp.is_duplicate_flag ? 1 : 0);
        const av = avatarColor(exp.category);
        const viewing = viewingId === exp.id;

        return (
            <div
                key={exp.id}
                style={{
                    ...panelStyle,
                    padding: '14px 16px',
                    borderColor: flagsCount > 0 ? 'rgba(245,158,11,.35)' : 'var(--color-redwood-border)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: av.bg,
                            color: av.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 700,
                            flexShrink: 0,
                        }}
                    >
                        {categoryInitials(exp.category)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                                {exp.vendor || exp.category}
                            </span>
                            <StatusBadge status={exp.status} />
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', margin: '0 0 4px' }}>
                            {exp.category} · {formatDate(exp.date)} · {exp.paymentMethod}
                        </p>
                        {viewing && (
                            <p style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginBottom: 8 }}>
                                {exp.description || '—'}
                            </p>
                        )}
                        {flagsCount > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                {exp.is_duplicate_flag && (
                                    <span
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: 20,
                                            background: 'var(--color-badge-amber-bg)',
                                            color: 'var(--color-brand-amber-tint)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <ShieldAlert size={10} /> Possible duplicate
                                    </span>
                                )}
                                {exp.policy_flags?.map((f, i) => (
                                    <span
                                        key={i}
                                        title={f.message}
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: 20,
                                            background: 'var(--color-badge-red-bg)',
                                            color: 'var(--color-brand-red-tint)',
                                        }}
                                    >
                                        ⚠ {f.message}
                                    </span>
                                ))}
                            </div>
                        )}
                        {isRejecting && (
                            <div
                                style={{
                                    marginTop: 8,
                                    padding: 12,
                                    borderRadius: 10,
                                    background: 'var(--color-badge-red-bg)',
                                    border: '1px solid rgba(239,68,68,.25)',
                                }}
                            >
                                <label
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: 'var(--color-brand-red-tint)',
                                        display: 'block',
                                        marginBottom: 6,
                                    }}
                                >
                                    Rejection reason (required)
                                </label>
                                <input
                                    type="text"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    autoFocus
                                    placeholder="e.g. Missing receipt, exceeds budget…"
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: 8,
                                        border: '1px solid rgba(239,68,68,.3)',
                                        background: 'var(--color-redwood-row-bg)',
                                        color: 'var(--color-redwood-text-main)',
                                        fontSize: 12,
                                        outline: 'none',
                                    }}
                                />
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    <button
                                        type="button"
                                        onClick={() => void confirmReject(exp)}
                                        disabled={busy}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: '#EF4444',
                                            color: '#fff',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            cursor: busy ? 'not-allowed' : 'pointer',
                                            opacity: busy ? 0.6 : 1,
                                        }}
                                    >
                                        {busy ? 'Rejecting…' : 'Confirm reject'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelReject}
                                        disabled={busy}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--color-redwood-border)',
                                            background: 'transparent',
                                            color: 'var(--color-redwood-text-muted)',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                        {!isRejecting && exp.status === 'Approved' && !exp.journal_voucher_number && canApproveExpenses && (
                            <button
                                type="button"
                                onClick={() => void handlePushToAccounting(exp)}
                                disabled={busy}
                                style={{
                                    marginTop: 8,
                                    width: '100%',
                                    padding: '9px 14px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#6366F1',
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: busy ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
                                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                Retry Push to Accounting
                            </button>
                        )}
                        {!isRejecting && exp.status !== 'Approved' && canApproveExpenses && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => setViewingId(viewing ? null : exp.id)}
                                    style={{
                                        height: 28,
                                        padding: '0 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-redwood-border)',
                                        background: 'rgba(255,255,255,.04)',
                                        color: 'var(--color-redwood-text-muted)',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    <Eye size={12} /> View
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleApprove(exp)}
                                    disabled={busy || receiptRequiredButMissing(exp)}
                                    style={{
                                        height: 28,
                                        padding: '0 12px',
                                        borderRadius: 8,
                                        border: '1px solid rgba(34,197,94,.28)',
                                        background: 'var(--color-badge-green-bg)',
                                        color: 'var(--color-brand-green-tint)',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        cursor: busy || receiptRequiredButMissing(exp) ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        opacity: busy || receiptRequiredButMissing(exp) ? 0.6 : 1,
                                    }}
                                >
                                    {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                    Approve
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openReject(exp.id)}
                                    disabled={busy}
                                    style={{
                                        height: 28,
                                        padding: '0 12px',
                                        borderRadius: 8,
                                        border: '1px solid rgba(239,68,68,.25)',
                                        background: 'var(--color-badge-red-bg)',
                                        color: 'var(--color-brand-red-tint)',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        cursor: busy ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    <XCircle size={12} /> Reject
                                </button>
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-redwood-text-main)' }}>
                            ${formatMoney(exp.amount)}
                        </div>
                        <div
                            style={{
                                fontSize: 10,
                                color: 'var(--color-redwood-text-muted)',
                                marginTop: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 4,
                            }}
                        >
                            {exp.receiptUrl ? (
                                <>
                                    <Paperclip size={11} /> 1 receipt
                                </>
                            ) : receiptRequiredButMissing(exp) ? (
                                <span style={{ color: 'var(--color-brand-amber-tint)', fontWeight: 600 }}>
                                    — no receipt · Receipt required to approve
                                </span>
                            ) : (
                                '— no receipt'
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ paddingBottom: 40 }}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '80px 16px',
                        color: 'var(--color-redwood-text-muted)',
                    }}
                >
                    <Loader2 size={32} className="animate-spin" style={{ color: '#4F8EF7', marginBottom: 12 }} />
                    <p style={{ fontSize: 12, fontWeight: 500 }}>Loading approval queue…</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 40 }}>
            <div className="space-y-3 max-w-[1100px]">
                {/* Back link */}
                <button
                    type="button"
                    onClick={() => navigate('/finance/expenses')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--color-redwood-text-muted)',
                        padding: 0,
                    }}
                >
                    <ArrowLeft size={14} /> Back to Expenses
                </button>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <h1
                            style={{
                                fontFamily: "'Syne',sans-serif",
                                fontSize: 22,
                                fontWeight: 600,
                                color: 'var(--color-redwood-text-main)',
                                margin: 0,
                                letterSpacing: '-.3px',
                            }}
                        >
                            Approval queue
                        </h1>
                        <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', margin: '6px 0 0', maxWidth: 480 }}>
                            Review expense submissions · approve to release payment · reject with reason
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                            style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '4px 12px',
                                borderRadius: 20,
                                background: 'var(--color-badge-green-bg)',
                                color: 'var(--color-brand-green-tint)',
                                border: '1px solid rgba(34,197,94,.28)',
                            }}
                        >
                            {pendingOnly.length} pending
                        </span>
                        <button
                            type="button"
                            onClick={() => void reload(true)}
                            disabled={refreshing}
                            style={{
                                padding: '6px 11px',
                                borderRadius: 8,
                                border: '1px solid var(--color-redwood-border)',
                                background: 'rgba(255,255,255,.04)',
                                color: 'var(--color-redwood-text-muted)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 10 }}>
                    {[
                        {
                            label: 'Pending Approvals',
                            value: String(pendingOnly.length),
                            sub: pendingOnly.length === 0 ? 'all caught up' : 'awaiting review',
                            stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                            valueColor: 'var(--color-brand-green)',
                        },
                        {
                            label: 'Approved This Month',
                            value: String(approvedThisMonth.length),
                            sub: `$${formatMoney(approvedThisMonthTotal)} total released`,
                            stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                            valueColor: 'var(--color-brand-blue)',
                        },
                        {
                            label: 'Rejected This Month',
                            value: String(rejectedThisMonth.length),
                            sub: rejectedThisMonth.length === 0 ? 'no rejections' : 'this month',
                            stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)',
                            valueColor: 'var(--color-brand-red)',
                        },
                        {
                            label: 'Avg Approval Time',
                            value: avgApprovalHours != null ? `${avgApprovalHours}h` : '—',
                            sub: 'since submission',
                            stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
                            valueColor: 'var(--color-brand-amber)',
                        },
                    ].map((k) => (
                        <div
                            key={k.label}
                            style={{
                                background: 'var(--color-redwood-bg-surface)',
                                border: '1px solid var(--color-redwood-border)',
                                borderRadius: 14,
                                padding: '13px 14px',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 2,
                                    background: k.stripe,
                                }}
                            />
                            <div style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', fontWeight: 500, marginBottom: 6 }}>
                                {k.label}
                            </div>
                            <div
                                style={{
                                    fontFamily: "'Syne',sans-serif",
                                    fontSize: 22,
                                    fontWeight: 600,
                                    color: k.valueColor,
                                    lineHeight: 1.1,
                                    marginBottom: 3,
                                }}
                            >
                                {k.value}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)' }}>{k.sub}</div>
                        </div>
                    ))}
                </div>

                {error && (
                    <div
                        style={{
                            ...panelStyle,
                            background: 'var(--color-badge-red-bg)',
                            borderColor: 'rgba(239,68,68,.25)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                        }}
                    >
                        <AlertTriangle size={18} style={{ color: 'var(--color-brand-red-tint)', flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 12, color: 'var(--color-brand-red-tint)', margin: 0 }}>{error}</p>
                    </div>
                )}

                {/* Queue / empty state */}
                {expenses.length === 0 ? (
                    <div style={{ ...panelStyle, padding: '48px 24px', textAlign: 'center' }}>
                        <CheckCircle2 size={48} style={{ color: 'var(--color-brand-green)', margin: '0 auto 14px' }} />
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-redwood-text-main)', margin: '0 0 6px' }}>
                            No expenses awaiting approval
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)', margin: '0 0 20px' }}>
                            All caught up. New submissions will appear here for your review.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/finance/expenses')}
                            style={{
                                padding: '10px 18px',
                                borderRadius: 10,
                                border: '1px solid var(--color-redwood-border)',
                                background: 'rgba(255,255,255,.04)',
                                color: 'var(--color-redwood-text-muted)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <Plus size={14} /> Submit new expense
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{expenses.map(renderQueueCard)}</div>
                )}

                {/* Recently approved */}
                <div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 10,
                            padding: '4px 0',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                                Recently approved
                            </span>
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: 20,
                                    background: 'var(--color-badge-blue-bg)',
                                    color: 'var(--color-brand-blue-tint)',
                                }}
                            >
                                {recentlyApproved.length}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/finance/expenses')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'var(--color-brand-blue)',
                                padding: 0,
                            }}
                        >
                            View all →
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {recentlyApproved.length === 0 ? (
                            <div style={{ ...panelStyle, textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 12 }}>
                                No approved expenses yet
                            </div>
                        ) : (
                            recentlyApproved.map((exp) => renderApprovedRow(exp, exp.id))
                        )}
                    </div>
                </div>

                {/* Pending example guide */}
                <div style={{ ...panelStyle, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                            How pending expenses look
                        </span>
                        <span
                            style={{
                                fontSize: 9,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 20,
                                background: 'var(--color-badge-blue-bg)',
                                color: 'var(--color-brand-blue-tint)',
                            }}
                        >
                            Example
                        </span>
                    </div>
                    <div
                        style={{
                            ...panelStyle,
                            padding: '12px 14px',
                            background: 'var(--color-redwood-row-bg)',
                            opacity: 0.85,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    background: 'var(--color-badge-amber-bg)',
                                    color: 'var(--color-brand-amber-tint)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                }}
                            >
                                TR
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                                        Travel & Meals
                                    </span>
                                    <StatusBadge status="Pending" />
                                </div>
                                <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', margin: '0 0 10px' }}>
                                    Vendor Co · Client lunch · 20 May 2026 · Card
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, opacity: 0.55 }}>
                                    <span
                                        style={{
                                            height: 28,
                                            padding: '0 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--color-redwood-border)',
                                            fontSize: 10,
                                            fontWeight: 600,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            color: 'var(--color-redwood-text-muted)',
                                        }}
                                    >
                                        <Eye size={12} /> View
                                    </span>
                                    <span
                                        style={{
                                            height: 28,
                                            padding: '0 12px',
                                            borderRadius: 8,
                                            border: '1px solid rgba(34,197,94,.28)',
                                            fontSize: 10,
                                            fontWeight: 600,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            color: 'var(--color-brand-green-tint)',
                                        }}
                                    >
                                        <CheckCircle2 size={12} /> Approve
                                    </span>
                                    <span
                                        style={{
                                            height: 28,
                                            padding: '0 12px',
                                            borderRadius: 8,
                                            border: '1px solid rgba(239,68,68,.25)',
                                            fontSize: 10,
                                            fontWeight: 600,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            color: 'var(--color-brand-red-tint)',
                                        }}
                                    >
                                        <XCircle size={12} /> Reject
                                    </span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, opacity: 0.55 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-redwood-text-main)' }}>
                                    $85.00
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginTop: 4 }}>
                                    — no receipt
                                </div>
                            </div>
                        </div>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)', margin: '10px 0 0' }}>
                        Pending rows show View · Approve · Reject inline — one-click processing
                    </p>
                </div>
            </div>
        </div>
    );
}
