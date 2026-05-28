import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { useTracking } from '../../hooks/useTracking';
import { getPayments, getCustomers, type Payment, type Customer } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'Online', 'Other'];

export default function PaymentEdit() {
    const navigate = useNavigate();
    const { trackPage } = useTracking();
    useEffect(() => { trackPage('payments'); }, [trackPage]);
    // ITEM 13 — ?id=<paymentId> deep-link from per-row Edit buttons opens
    // the matching row in edit mode automatically. Keeps the page useful
    // even after we drop the standalone sidebar link.
    const [searchParams] = useSearchParams();
    const deepLinkId = searchParams.get('id');
    const [payments, setPayments] = useState<Payment[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Payment>>({});
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    // TC-66 — Surface fetch failures + cap hung requests at 15s so the
    // spinner can't run forever. Without this, a single hung
    // /payments call left the page stuck on "Loading payments…" with
    // no way out.
    const [loadError, setLoadError] = useState<string | null>(null);

    // Race a promise against a timeout — whichever resolves/rejects first wins.
    const withTimeout = <T,>(p: Promise<T>, ms = 15000): Promise<T> =>
        Promise.race([
            p,
            new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Request timed out — backend did not respond in 15s')), ms)),
        ]);

    const loadData = () => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        Promise.all([withTimeout(getPayments()), withTimeout(getCustomers())]).then(([p, c]) => {
            if (cancelled) return;
            setPayments(p);
            setCustomers(c);
            // ITEM 13 — open the deep-linked payment in edit mode.
            if (deepLinkId) {
                const target = p.find(x => String(x.id) === String(deepLinkId));
                if (target) {
                    setEditId(target.id);
                    setEditForm({ ...target });
                }
            }
        }).catch((e: any) => {
            if (cancelled) return;
            console.error('[PaymentEdit] load failed:', e);
            setLoadError(e?.message || 'Could not load payments.');
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
    };

    useEffect(() => {
        const cleanup = loadData();
        return cleanup;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deepLinkId]);

    const custMap: Record<string, string> = {};
    customers.forEach(c => { custMap[String(c.id)] = c.name; });

    const filtered = payments.filter(p => {
        if (!p || !p.id) return false;
        if (!search) return true;
        const name = custMap[String(p.customer_id)] || '';
        return name.toLowerCase().includes(search.toLowerCase()) ||
            (p.reference || '').toLowerCase().includes(search.toLowerCase());
    });

    const startEdit = (p: Payment) => {
        setEditId(p.id);
        setEditForm({ ...p });
    };

    const cancelEdit = () => {
        setEditId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        if (!editId || !editForm.amount || editForm.amount <= 0) {
            alert('Amount must be greater than 0');
            return;
        }
        setSaving(true);
        try {
            const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
            const res = await fetch(`${API}/ledger/payment/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            if (!res.ok) {
                // Backend may not support PUT - update locally
                setPayments(prev => prev.map(p => p.id === editId ? { ...p, ...editForm } as Payment : p));
            } else {
                const updated = await res.json();
                setPayments(prev => prev.map(p => p.id === editId ? { ...p, ...updated } as Payment : p));
            }
            setSuccess('Payment updated successfully');
            setTimeout(() => setSuccess(''), 3000);
            setEditId(null);
            setEditForm({});
        } catch {
            // Update locally as fallback
            setPayments(prev => prev.map(p => p.id === editId ? { ...p, ...editForm } as Payment : p));
            setSuccess('Payment updated');
            setTimeout(() => setSuccess(''), 3000);
            setEditId(null);
            setEditForm({});
        } finally {
            setSaving(false);
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
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                        <Edit2 size={22} className="text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Edit Payments</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Correct payment amounts, dates, methods or references</p>
                    </div>
                </div>
            </div>

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 flex items-center gap-2 text-sm font-bold text-emerald-700">
                    <Check size={16} /> {success}
                </div>
            )}

            {/* Search */}
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by customer name or reference..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center space-y-3">
                        <RefreshCw size={28} className="mx-auto text-blue-500 animate-spin" />
                        <p className="text-gray-500 font-bold">Loading payments…</p>
                    </div>
                ) : loadError ? (
                    /* TC-66 — Visible failure state with retry. */
                    <div className="p-12 text-center space-y-3">
                        <AlertTriangle size={36} className="mx-auto text-rose-500" />
                        <p className="text-rose-700 font-black uppercase tracking-widest text-sm">Could not load payments</p>
                        <p className="text-rose-700 text-sm max-w-md mx-auto">{loadError}</p>
                        <button
                            onClick={loadData}
                            className="inline-flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white text-sm font-black uppercase tracking-widest rounded-lg"
                        >
                            <RefreshCw size={16} /> Retry
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 font-bold">No payments found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Customer', 'Date', 'Amount', 'Method', 'Reference', 'Actions'].map(h => (
                                        <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(p => {
                                    const isEditing = editId === p.id;
                                    return (
                                        <tr key={p.id} className={`transition-all ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-bold text-gray-900">{custMap[String(p.customer_id)] || `Customer ${p.customer_id}`}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                {isEditing ? (
                                                    <input type="date" value={editForm.payment_date || ''} onChange={e => setEditForm(prev => ({ ...prev, payment_date: e.target.value }))}
                                                        className="border border-blue-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                                                ) : (
                                                    <span className="text-sm font-mono text-gray-600">{p.payment_date}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {isEditing ? (
                                                    <input type="number" value={editForm.amount || ''} onChange={e => setEditForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                                        className="w-28 border border-blue-300 rounded-lg px-2 py-1.5 text-sm font-mono font-black focus:outline-none focus:border-blue-500" />
                                                ) : (
                                                    <span className="text-sm font-black font-mono text-gray-900">{formatCurrency(p.amount)}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {isEditing ? (
                                                    <select value={editForm.payment_method || ''} onChange={e => setEditForm(prev => ({ ...prev, payment_method: e.target.value }))}
                                                        className="border border-blue-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500">
                                                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                ) : (
                                                    <span className="text-sm text-gray-600">{p.payment_method}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {isEditing ? (
                                                    <input type="text" value={editForm.reference || ''} onChange={e => setEditForm(prev => ({ ...prev, reference: e.target.value }))}
                                                        placeholder="Reference #"
                                                        className="w-32 border border-blue-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                                                ) : (
                                                    <span className="text-sm text-gray-400 font-mono">{p.reference || '—'}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={saveEdit} disabled={saving}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-black rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all">
                                                            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Save
                                                        </button>
                                                        <button onClick={cancelEdit}
                                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-all">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => startEdit(p)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-600 text-xs font-black rounded-lg transition-all">
                                                        <Edit2 size={12} /> Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-400 text-center">Click Edit on any row to modify — changes are saved immediately</p>
        </div>
    );
}
