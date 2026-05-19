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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle2, XCircle, ShieldAlert, AlertTriangle,
    User as UserIcon, Calendar, Receipt as ReceiptIcon, Loader2,
} from 'lucide-react';
import { getExpenses, saveExpense, pushExpenseToAccounting, type Expense } from '../../services/expenseService';
// FIX W7-5 — Real approver name from the auth store.
import { getCurrentUser } from '../../store/authStore';

export default function ExpenseApprovals() {
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actioningId, setActioningId] = useState<string | null>(null);

    const reload = async () => {
        setLoading(true);
        setError(null);
        try {
            const all = await getExpenses();
            // Submitted + Under Review + the legacy "Pending Approval" status
            // so existing rows from before STEP 1 still appear here.
            const queue = all.filter(e =>
                e.status === 'Submitted' ||
                e.status === 'Under Review' ||
                e.status === 'Pending Approval' ||
                // STEP 11A — keep Approved-not-yet-pushed rows visible
                // so the manager can click "Push to Accounting".
                (e.status === 'Approved' && !e.journal_voucher_number)
            );
            // Oldest first so genuinely-stale claims surface at top.
            queue.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setExpenses(queue);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load approval queue.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void reload(); }, []);

    // STEP 11A — push to Accounting (creates a balanced JV)
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

    // FIX W7-4 — Atomic Approve + Push to Accounting. Previously these
    // were two separate buttons and approvers commonly forgot step 2,
    // leaving expenses approved but never on the books. Now the push
    // happens immediately after approval succeeds. If the push fails,
    // we revert the status back so the row stays in the queue and the
    // approver can retry via the recovery button (kept for edge cases:
    // old data where status='Approved' arrived without a JV, or a
    // rare race where saveExpense ran but rollback failed).
    const handleApprove = async (exp: Expense) => {
        setActioningId(exp.id);
        setError(null);
        const priorStatus = exp.status;
        try {
            const approved = await saveExpense({
                id: exp.id,
                status: 'Approved',
                // FIX W7-5 — real approver name, not the literal "Current User".
                approvedBy: getCurrentUser().name,
                approvedAt: new Date().toISOString(),
            });
            try {
                await pushExpenseToAccounting(approved);
                await reload();
            } catch (pushErr) {
                // Push failed → roll the status back so the expense
                // re-appears in the queue cleanly for retry. Clearing
                // approvedBy/At avoids the awkward "approved but
                // actually not approved" half-state in the audit trail.
                try {
                    await saveExpense({
                        id: exp.id,
                        status: priorStatus,
                        approvedBy: undefined,
                        approvedAt: undefined,
                    });
                } catch { /* swallow rollback errors; surface push error */ }
                await reload();
                setError(
                    `Approved but failed to push to Accounting: ${pushErr instanceof Error ? pushErr.message : String(pushErr)}. ` +
                    `Status rolled back — try Approve again.`
                );
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not approve expense.');
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
                // FIX W7-5 — real rejecter name, not the literal "Current User".
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

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10 animate-in fade-in duration-300">
            {/* Back link */}
            <div>
                <button
                    onClick={() => navigate('/finance/expenses')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 transition-all"
                >
                    <ArrowLeft size={14} /> Back to Expenses
                </button>
            </div>

            {/* Header */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <CheckCircle2 size={24} />
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Approval Queue</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Review expenses submitted by team members.  Approve to release for payment, or reject with a reason.
                    </p>
                </div>
                <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full uppercase tracking-widest">
                    {expenses.length} pending
                </span>
            </div>

            {/* Status */}
            {loading && (
                <div className="bg-white p-10 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center gap-3 text-gray-500">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm font-bold uppercase tracking-widest">Loading queue…</span>
                </div>
            )}
            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <AlertTriangle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700">{error}</p>
                </div>
            )}

            {/* Empty state */}
            {!loading && expenses.length === 0 && (
                <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
                    <p className="text-sm font-black text-gray-900 uppercase tracking-widest">No expenses awaiting approval</p>
                    <p className="text-xs text-gray-500 mt-2">All caught up.  New submissions will appear here.</p>
                </div>
            )}

            {/* Cards */}
            {!loading && expenses.length > 0 && (
                <div className="space-y-3">
                    {expenses.map(exp => {
                        const isRejecting = rejectingId === exp.id;
                        const busy = actioningId === exp.id;
                        const flagsCount = (exp.policy_flags?.length || 0) + (exp.is_duplicate_flag ? 1 : 0);
                        return (
                            <div key={exp.id} className={`bg-white p-5 rounded-2xl border shadow-sm ${flagsCount > 0 ? 'border-amber-200' : 'border-gray-100'}`}>
                                <div className="flex items-start gap-4">
                                    {/* Receipt thumbnail / placeholder */}
                                    <div className="w-16 h-16 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 shrink-0">
                                        <ReceiptIcon size={22} />
                                    </div>

                                    {/* Main fields */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div>
                                                <p className="text-sm font-black text-gray-900">{exp.vendor || 'Unknown vendor'}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{exp.description || '—'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-gray-900 font-mono">{exp.currency} ${exp.amount.toFixed(2)}</p>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{exp.category}</p>
                                            </div>
                                        </div>

                                        {/* Meta row */}
                                        <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
                                            <span className="flex items-center gap-1"><UserIcon size={12} /> {exp.createdBy}</span>
                                            <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(exp.date).toLocaleDateString()}</span>
                                        </div>

                                        {/* Flag chips */}
                                        {flagsCount > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {exp.is_duplicate_flag && (
                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded uppercase tracking-widest flex items-center gap-1">
                                                        <ShieldAlert size={11} /> Possible duplicate
                                                    </span>
                                                )}
                                                {exp.policy_flags?.map((f, i) => (
                                                    <span key={i} className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded uppercase tracking-widest" title={f.message}>
                                                        ⚠ {f.message}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Reject reason input */}
                                        {isRejecting && (
                                            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                                                <label className="text-[10px] font-black text-rose-700 uppercase tracking-widest block mb-2">Rejection reason (required)</label>
                                                <input
                                                    type="text"
                                                    value={rejectReason}
                                                    onChange={e => setRejectReason(e.target.value)}
                                                    autoFocus
                                                    placeholder="e.g. Missing receipt, exceeds budget…"
                                                    className="w-full px-3 py-2 text-sm border border-rose-200 rounded-lg focus:outline-none focus:border-rose-500"
                                                />
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => void confirmReject(exp)}
                                                        disabled={busy}
                                                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
                                                    >
                                                        {busy ? 'Rejecting…' : 'Confirm reject'}
                                                    </button>
                                                    <button
                                                        onClick={cancelReject}
                                                        disabled={busy}
                                                        className="flex-1 py-2 bg-white border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* FIX W7-4 — Recovery button. Approval now auto-pushes, so
                                            these "Approved-but-no-JV" rows shouldn't normally appear.
                                            They survive only as recovery for edge cases (legacy data,
                                            failed rollback). Indigo accent + explicit "retry" label
                                            so users know this isn't the primary flow. */}
                                        {!isRejecting && exp.status === 'Approved' && !exp.journal_voucher_number && (
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    onClick={() => void handlePushToAccounting(exp)}
                                                    disabled={busy}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-xl disabled:opacity-50 transition-all"
                                                    title="Auto-push failed earlier or this is legacy data — retry the JV post"
                                                >
                                                    {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                                    Retry Push to Accounting
                                                </button>
                                            </div>
                                        )}

                                        {/* Action buttons (Approve / Reject for pending) */}
                                        {!isRejecting && exp.status !== 'Approved' && (
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    onClick={() => void handleApprove(exp)}
                                                    disabled={busy}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-xl disabled:opacity-50 transition-all"
                                                >
                                                    {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => openReject(exp.id)}
                                                    disabled={busy}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-black uppercase tracking-widest rounded-xl disabled:opacity-50 transition-all"
                                                >
                                                    <XCircle size={14} /> Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
