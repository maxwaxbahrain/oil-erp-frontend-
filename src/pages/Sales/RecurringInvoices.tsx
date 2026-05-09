import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Trash2, Play, ToggleLeft, ToggleRight, Calendar } from 'lucide-react';
import { getCustomers, getProducts, type Customer, type Product } from '../../services/api';
import {
    getRecurringInvoices, saveRecurringInvoice, deleteRecurringInvoice,
    runDueRecurringInvoices, type RecurringInvoice
} from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

const EMPTY_ITEM = () => ({ product: '', description: '', quantity: 1, rate: 0, amount: 0 });

export default function RecurringInvoices() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [recurring, setRecurring] = useState<RecurringInvoice[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [running, setRunning] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [form, setForm] = useState({
        customerId: '', frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly',
        nextRunDate: new Date().toISOString().slice(0, 10),
        notes: '', items: [EMPTY_ITEM()]
    });

    useEffect(() => {
        Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
            setCustomers(c); setProducts(p);
            setRecurring(getRecurringInvoices());
        });
    }, []);

    const grandTotal = form.items.reduce((s, i) => s + i.amount, 0);

    const updateItem = (idx: number, field: string, value: any) => {
        const items = [...form.items];
        items[idx] = { ...items[idx], [field]: value };
        if (field === 'product') {
            const p = products.find(p => p.name === value);
            if (p) { items[idx].rate = p.unit_price; items[idx].description = p.name; }
        }
        if (field === 'quantity' || field === 'rate') {
            items[idx].amount = items[idx].quantity * items[idx].rate;
        }
        setForm({ ...form, items });
    };

    const saveForm = () => {
        const customer = customers.find(c => c.id === form.customerId);
        if (!customer || form.items.every(i => !i.product)) {
            alert('Select a customer and at least one product.'); return;
        }
        const rec: RecurringInvoice = {
            id: `REC-${Date.now()}`,
            customerId: customer.id,
            customerName: customer.name,
            frequency: form.frequency,
            nextRunDate: form.nextRunDate,
            lineItems: form.items.filter(i => i.product),
            subtotal: grandTotal,
            taxRate: 0, discount: 0,
            grandTotal,
            notes: form.notes,
            active: true,
            createdAt: new Date().toISOString()
        };
        saveRecurringInvoice(rec);
        setRecurring(getRecurringInvoices());
        setShowForm(false);
        setForm({ customerId: '', frequency: 'monthly', nextRunDate: new Date().toISOString().slice(0, 10), notes: '', items: [EMPTY_ITEM()] });
        setSuccessMsg('Recurring invoice created!');
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const toggleActive = (id: string) => {
        const rec = recurring.find(r => r.id === id);
        if (!rec) return;
        saveRecurringInvoice({ ...rec, active: !rec.active });
        setRecurring(getRecurringInvoices());
    };

    const deleteRec = (id: string) => {
        if (!confirm('Delete this recurring invoice?')) return;
        deleteRecurringInvoice(id);
        setRecurring(getRecurringInvoices());
    };

    const runNow = async () => {
        setRunning(true);
        const count = await runDueRecurringInvoices();
        setRecurring(getRecurringInvoices());
        setRunning(false);
        setSuccessMsg(count > 0 ? `✅ ${count} invoice${count !== 1 ? 's' : ''} generated!` : 'No invoices due today.');
        setTimeout(() => setSuccessMsg(''), 4000);
    };

    const freqColor = (f: string) => {
        if (f === 'weekly') return 'bg-purple-100 text-purple-700';
        if (f === 'monthly') return 'bg-blue-100 text-blue-700';
        return 'bg-orange-100 text-orange-700';
    };

    const today = new Date().toISOString().slice(0, 10);
    const dueCount = recurring.filter(r => r.active && r.nextRunDate <= today).length;

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                        <RefreshCw size={24} className="text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Recurring Invoices</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Auto-generate invoices on a schedule for regular customers</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {dueCount > 0 && (
                        <button onClick={runNow} disabled={running}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 transition-all disabled:opacity-50">
                            <Play size={14} /> Run {dueCount} Due Now
                        </button>
                    )}
                    <button onClick={runNow} disabled={running}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-xs font-black uppercase hover:bg-gray-50 transition-all">
                        <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> Check Due
                    </button>
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-black uppercase hover:bg-purple-700 transition-all">
                        <Plus size={14} /> New Recurring
                    </button>
                </div>
            </div>

            {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-bold text-emerald-700">{successMsg}</div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total recurring', value: recurring.length, color: 'text-gray-900' },
                    { label: 'Active', value: recurring.filter(r => r.active).length, color: 'text-emerald-600' },
                    { label: 'Due today', value: dueCount, color: dueCount > 0 ? 'text-red-600' : 'text-gray-400' },
                    { label: 'Monthly value', value: formatCurrency(recurring.filter(r => r.active && r.frequency === 'monthly').reduce((s, r) => s + r.grandTotal, 0)), color: 'text-blue-600' },
                ].map((s, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                        <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* New Recurring Form */}
            {showForm && (
                <div className="bg-white border-2 border-purple-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">New Recurring Invoice</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Customer</label>
                            <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400">
                                <option value="">Select customer...</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Frequency</label>
                            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as any })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400">
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">First Run Date</label>
                            <input type="date" value={form.nextRunDate}
                                onChange={e => setForm({ ...form, nextRunDate: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Line Items</label>
                        <div className="space-y-2">
                            {form.items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-4">
                                        <select value={item.product}
                                            onChange={e => updateItem(idx, 'product', e.target.value)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
                                            <option value="">Select product...</option>
                                            {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" placeholder="Qty" value={item.quantity}
                                            onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
                                    </div>
                                    <div className="col-span-3">
                                        <input type="number" placeholder="Rate" value={item.rate}
                                            onChange={e => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-400" />
                                    </div>
                                    <div className="col-span-2 text-sm font-black font-mono text-gray-900 text-right">
                                        {formatCurrency(item.amount)}
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        {form.items.length > 1 && (
                                            <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                                                className="p-1 hover:bg-red-50 rounded text-red-400">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setForm({ ...form, items: [...form.items, EMPTY_ITEM()] })}
                            className="mt-2 flex items-center gap-1 text-xs font-black text-purple-600 hover:text-purple-800">
                            <Plus size={12} /> Add line
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="text-sm font-black text-gray-900">Total: {formatCurrency(grandTotal)}</div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowForm(false)}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-black hover:bg-gray-50">Cancel</button>
                            <button onClick={saveForm}
                                className="px-5 py-2 bg-purple-600 text-white rounded-xl text-sm font-black hover:bg-purple-700">
                                Save Recurring Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            {recurring.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
                    <RefreshCw size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-bold">No recurring invoices yet</p>
                    <p className="text-gray-300 text-sm mt-1">Create one for regular monthly customers to save time</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {['Customer', 'Frequency', 'Next Run', 'Last Run', 'Amount', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {recurring.map(rec => {
                                const isDue = rec.active && rec.nextRunDate <= today;
                                return (
                                    <tr key={rec.id} className={`hover:bg-gray-50 transition-all ${isDue ? 'bg-yellow-50/50' : ''}`}>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-black text-gray-900">{rec.customerName}</p>
                                            <p className="text-xs text-gray-400">{rec.lineItems.length} item{rec.lineItems.length !== 1 ? 's' : ''}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${freqColor(rec.frequency)}`}>
                                                <Calendar size={10} className="inline mr-1" />{rec.frequency}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className={`text-sm font-mono font-bold ${isDue ? 'text-red-600' : 'text-gray-700'}`}>
                                                {rec.nextRunDate}
                                            </p>
                                            {isDue && <p className="text-[10px] text-red-500 font-black">Due now!</p>}
                                        </td>
                                        <td className="px-5 py-4 text-sm font-mono text-gray-400">
                                            {rec.lastRunDate || '—'}
                                        </td>
                                        <td className="px-5 py-4 text-sm font-black font-mono text-gray-900">
                                            {formatCurrency(rec.grandTotal)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <button onClick={() => toggleActive(rec.id)} className="flex items-center gap-1">
                                                {rec.active
                                                    ? <><ToggleRight size={20} className="text-emerald-600" /><span className="text-xs font-black text-emerald-600">Active</span></>
                                                    : <><ToggleLeft size={20} className="text-gray-400" /><span className="text-xs font-black text-gray-400">Paused</span></>
                                                }
                                            </button>
                                        </td>
                                        <td className="px-5 py-4">
                                            <button onClick={() => deleteRec(rec.id)}
                                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-xs text-gray-400 text-center">Click "Check Due" daily or "Run Due Now" to generate invoices automatically · Toggle to pause/resume any recurring schedule</p>
        </div>
    );
}
