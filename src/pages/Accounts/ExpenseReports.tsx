// ─── STEP 9 — Expense Reports + Natural Language Query ──────────────
// New route: /finance/expenses/reports
//
// Top: large search bar that sends the question + recent expenses to
// Claude.  Renders number / table / chart based on AI response.
// Bottom: 5 standard aggregated reports + Print button per section.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Sparkles, Loader2, AlertTriangle, BarChart3,
    PieChart as PieIcon, Printer, FileText,
} from 'lucide-react';
import {
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    getExpensesSnapshot,
    getExpenseStats,
    queryExpensesNaturalLanguage,
    type Expense,
    type NlQueryResult,
} from '../../services/expenseService';

const EXAMPLE_QUESTIONS = [
    'How much did we spend on software this year?',
    'Which employee submitted the most expenses last month?',
    'Show me all travel expenses over $500',
    'Are there any expenses without a category?',
];

const PIE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];

export default function ExpenseReports() {
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [byAccount, setByAccount] = useState<Array<{ account: string; total: number }>>([]);
    const [loading, setLoading] = useState(true);
    const [dataUnavailable, setDataUnavailable] = useState(false);

    const [question, setQuestion] = useState('');
    const [askLoading, setAskLoading] = useState(false);
    const [askError, setAskError] = useState<string | null>(null);
    const [result, setResult] = useState<NlQueryResult | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const [snapshot, stats] = await Promise.all([
                    getExpensesSnapshot(),
                    getExpenseStats().catch(() => null),
                ]);
                setDataUnavailable(snapshot.stale);
                setExpenses(snapshot.stale ? [] : snapshot.expenses);
                if (stats?.by_account) {
                    setByAccount(
                        Object.entries(stats.by_account)
                            .map(([account, total]) => ({ account, total }))
                            .sort((a, b) => b.total - a.total),
                    );
                }
            } catch {
                setDataUnavailable(true);
                setExpenses([]);
            } finally { setLoading(false); }
        })();
    }, []);

    const ask = async (q: string) => {
        const text = q.trim();
        if (!text) return;
        if (dataUnavailable) {
            setAskError('Expense data unavailable. Cached data is not shown as live.');
            return;
        }
        setAskLoading(true);
        setAskError(null);
        setResult(null);
        try {
            const r = await queryExpensesNaturalLanguage(text);
            setResult(r);
        } catch (e) {
            setAskError(e instanceof Error ? e.message : 'Question failed.');
        } finally {
            setAskLoading(false);
        }
    };

    // ── Standard report aggregates (pure local, no AI) ──────────────
    const byCategory = useMemo(() => {
        const m = new Map<string, number>();
        for (const e of expenses) m.set(e.category, (m.get(e.category) || 0) + e.amount);
        return [...m.entries()].map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total);
    }, [expenses]);

    const byEmployee = useMemo(() => {
        const m = new Map<string, { count: number; total: number }>();
        for (const e of expenses) {
            const k = e.createdBy || 'Unknown';
            const cur = m.get(k) || { count: 0, total: 0 };
            cur.count += 1; cur.total += e.amount;
            m.set(k, cur);
        }
        return [...m.entries()].map(([employee, v]) => ({ employee, ...v }))
            .sort((a, b) => b.total - a.total);
    }, [expenses]);

    const reimbursable = useMemo(() =>
        expenses.filter(e => e.paymentMethod === 'Cash' || e.paymentMethod === 'Petty Cash'),
    [expenses]);

    const billable = useMemo(() => expenses.filter(e => e.is_billable), [expenses]);

    // Render the NL chart based on the AI's chart_type pick
    const chart = useMemo(() => {
        if (!result || result.chartType === 'none' || result.filteredExpenses.length === 0) return null;
        // Bucket by category for the chart data — sensible default.
        const buckets = new Map<string, number>();
        for (const e of result.filteredExpenses) {
            buckets.set(e.category, (buckets.get(e.category) || 0) + e.amount);
        }
        const data = [...buckets.entries()].map(([name, value]) => ({ name, value }));
        if (data.length === 0) return null;
        if (result.chartType === 'pie') {
            return (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            );
        }
        if (result.chartType === 'line') {
            return (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#6366F1" />
                    </LineChart>
                </ResponsiveContainer>
            );
        }
        // bar (default)
        return (
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366F1" />
                </BarChart>
            </ResponsiveContainer>
        );
    }, [result]);

    return (
        <div className="space-y-5 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-300">
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
                <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <BarChart3 size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Expense Reports</h1>
                    <p className="text-sm text-gray-500 mt-1">Ask anything in plain English, or open one of the standard reports below.</p>
                </div>
            </div>

            {/* NL search */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-indigo-700">
                    <Sparkles size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">Ask the AI</span>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void ask(question); }}
                        placeholder="e.g. How much did we spend on travel last month?"
                        disabled={askLoading}
                        className="flex-1 px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                    <button
                        onClick={() => void ask(question)}
                        disabled={askLoading || !question.trim()}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-40"
                    >
                        {askLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {askLoading ? 'Thinking…' : 'Ask'}
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {EXAMPLE_QUESTIONS.map(q => (
                        <button
                            key={q}
                            onClick={() => { setQuestion(q); void ask(q); }}
                            disabled={askLoading}
                            className="text-[11px] font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                        >
                            {q}
                        </button>
                    ))}
                </div>
            </div>

            {askError && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <AlertTriangle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700">{askError}</p>
                </div>
            )}

            {/* NL Result */}
            {result && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    {result.answerType === 'number' && (
                        <div className="text-center">
                            <p className="text-4xl font-black text-indigo-600 font-mono">{result.value != null ? `$${result.value.toLocaleString()}` : '—'}</p>
                            <p className="text-sm text-gray-600 mt-2">{result.answer}</p>
                        </div>
                    )}
                    {result.answerType === 'text' && (
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{result.answer}</p>
                    )}
                    {(result.answerType === 'table' || result.filteredExpenses.length > 0) && (
                        <>
                            {result.answer && <p className="text-sm text-gray-800 mb-3">{result.answer}</p>}
                            {result.filteredExpenses.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                <th className="px-3 py-2 text-left">Date</th>
                                                <th className="px-3 py-2 text-left">Vendor</th>
                                                <th className="px-3 py-2 text-left">Category</th>
                                                <th className="px-3 py-2 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {result.filteredExpenses.map(e => (
                                                <tr key={e.id}>
                                                    <td className="px-3 py-2">{new Date(e.date).toLocaleDateString()}</td>
                                                    <td className="px-3 py-2 font-bold">{e.vendor}</td>
                                                    <td className="px-3 py-2">{e.category}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{e.currency} ${e.amount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                    {chart && (
                        <div className="mt-4">{chart}</div>
                    )}
                </div>
            )}

            {/* Standard reports */}
            {dataUnavailable && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">Expense data unavailable. Cached data is not shown as live.</p>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Expenses by Category */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2"><PieIcon size={14} className="text-indigo-600" /> By Category</h3>
                        <button onClick={() => window.print()} aria-label="Print" className="text-gray-400 hover:text-gray-900"><Printer size={14} /></button>
                    </div>
                    {loading ? <p className="text-xs text-gray-400">Loading…</p> :
                        byCategory.length === 0 ? <p className="text-xs text-gray-400">No expenses yet.</p> : (
                        <ul className="space-y-1 max-h-56 overflow-y-auto pr-2">
                            {byCategory.map(r => (
                                <li key={r.category} className="flex justify-between text-xs">
                                    <span className="text-gray-700">{r.category}</span>
                                    <span className="font-black font-mono text-gray-900">${r.total.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Expenses by Employee */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2"><FileText size={14} className="text-emerald-600" /> By Employee</h3>
                        <button onClick={() => window.print()} aria-label="Print" className="text-gray-400 hover:text-gray-900"><Printer size={14} /></button>
                    </div>
                    {loading ? <p className="text-xs text-gray-400">Loading…</p> :
                        byEmployee.length === 0 ? <p className="text-xs text-gray-400">No expenses yet.</p> : (
                        <ul className="space-y-1 max-h-56 overflow-y-auto pr-2">
                            {byEmployee.map(r => (
                                <li key={r.employee} className="flex justify-between text-xs">
                                    <span className="text-gray-700">{r.employee} <span className="text-gray-400">· {r.count} item{r.count === 1 ? '' : 's'}</span></span>
                                    <span className="font-black font-mono text-gray-900">${r.total.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Reimbursable */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2"><FileText size={14} className="text-amber-600" /> Reimbursable</h3>
                        <button onClick={() => window.print()} aria-label="Print" className="text-gray-400 hover:text-gray-900"><Printer size={14} /></button>
                    </div>
                    <p className="text-2xl font-black text-amber-700 font-mono">${reimbursable.reduce((s, e) => s + e.amount, 0).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">{reimbursable.length} cash / petty-cash expense{reimbursable.length === 1 ? '' : 's'}</p>
                </div>

                {/* Billable */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2"><FileText size={14} className="text-blue-600" /> Billable to Clients</h3>
                        <button onClick={() => window.print()} aria-label="Print" className="text-gray-400 hover:text-gray-900"><Printer size={14} /></button>
                    </div>
                    <p className="text-2xl font-black text-blue-700 font-mono">${billable.reduce((s, e) => s + e.amount, 0).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">{billable.length} expense{billable.length === 1 ? '' : 's'} marked billable</p>
                </div>

                {/* By GL Account (server stats) */}
                {byAccount.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm md:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2"><PieIcon size={14} className="text-violet-600" /> By GL Account</h3>
                            <button onClick={() => window.print()} aria-label="Print" className="text-gray-400 hover:text-gray-900"><Printer size={14} /></button>
                        </div>
                        <ul className="space-y-1 max-h-56 overflow-y-auto pr-2">
                            {byAccount.map(r => (
                                <li key={r.account} className="flex justify-between text-xs">
                                    <span className="text-gray-700">{r.account}</span>
                                    <span className="font-black font-mono text-gray-900">${r.total.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
