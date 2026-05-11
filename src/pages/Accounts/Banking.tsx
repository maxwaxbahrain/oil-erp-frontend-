import { useState, useEffect } from 'react';
import { Landmark, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, RefreshCw, Download, DollarSign, CreditCard, Building2 } from 'lucide-react';
import { getPayments, getInvoices, type Payment, type Invoice } from '../../services/api';
import { getCompanyProfile } from '../../services/settingsService';
import { formatCurrency } from '../../services/settingsService';

interface PDCheque {
    id: string;
    date: string;           // cheque date (can be future)
    chequeNo: string;
    bankName: string;
    payee: string;
    amount: number;
    type: 'Received' | 'Issued';
    status: 'Pending' | 'Cleared' | 'Bounced' | 'Cancelled';
    description: string;
    createdAt: string;
}

const PDC_KEY = 'bettano_pdc_cheques';
function getPDC(): PDCheque[] {
    try { return JSON.parse(localStorage.getItem(PDC_KEY) || '[]'); } catch { return []; }
}
function savePDC(list: PDCheque[]) { localStorage.setItem(PDC_KEY, JSON.stringify(list)); }

interface Transaction {
    id: string;
    date: string;
    description: string;
    type: 'Credit' | 'Debit';
    amount: number;
    balance: number;
    reference: string;
    category: string;
}

export default function Banking() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'Credit' | 'Debit'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [activeTab, setActiveTab] = useState<'ledger' | 'pdc'>('ledger');
    const [pdcList, setPdcList] = useState<PDCheque[]>([]);
    const [showPDCForm, setShowPDCForm] = useState(false);
    const [pdcForm, setPdcForm] = useState({ date: '', chequeNo: '', bankName: '', payee: '', amount: '', type: 'Received' as PDCheque['type'], description: '' });
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        Promise.all([getPayments(), getInvoices()])
            .then(([p, i]) => {
                setPayments(p);
                setInvoices(i);
            })
            .finally(() => setLoading(false));
        setPdcList(getPDC());
    }, []);

    // Build transaction ledger from real payments + invoices
    const transactions: Transaction[] = [
        // Payments received from customers (Credits)
        ...payments.map((p, idx) => ({
            id: `PAY-${p.id || idx}`,
            date: p.payment_date || new Date().toISOString().split('T')[0],
            description: `Payment received`,
            type: 'Credit' as const,
            amount: p.amount || 0,
            balance: 0,
            reference: `PAY-${String(p.id || idx).slice(0, 6).toUpperCase()}`,
            category: 'Customer Payment'
        })),
        // Unpaid invoices (outstanding receivables as Debits)
        ...invoices
            .filter(i => ['Unpaid', 'Partial', 'Overdue'].includes(i.status || ''))
            .map((inv, idx) => ({
                id: `INV-${inv.id || idx}`,
                date: inv.invoiceDate || inv.createdAt?.slice(0, 10) || new Date().toISOString().split('T')[0],
                description: `Invoice ${inv.invoiceNumber || ''} — ${inv.customerName || 'Customer'}`,
                type: 'Debit' as const,
                amount: inv.grandTotal || inv.subtotal || 0,
                balance: 0,
                reference: inv.invoiceNumber || `INV-${idx}`,
                category: 'Sales Invoice'
            }))
    ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((tx, idx, arr) => {
            // Calculate running balance
            const bal = arr.slice(idx).reduce((sum, t) => sum + (t.type === 'Credit' ? t.amount : -t.amount), 0);
            return { ...tx, balance: bal };
        });

    const totalCredits = transactions.filter(t => t.type === 'Credit').reduce((s, t) => s + t.amount, 0);
    const totalDebits = transactions.filter(t => t.type === 'Debit').reduce((s, t) => s + t.amount, 0);
    const netBalance = totalCredits - totalDebits;

    const filtered = transactions.filter(t => {
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        const matchFilter = filter === 'all' || t.type === filter;
        const matchSearch = !search || t.description.toLowerCase().includes(search.toLowerCase()) || t.reference.toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
    });

    const savePDCEntry = () => {
        if (!pdcForm.chequeNo || !pdcForm.amount || !pdcForm.date) {
            alert('Cheque number, date and amount are required');
            return;
        }
        const entry: PDCheque = {
            id: Date.now().toString(),
            date: pdcForm.date, chequeNo: pdcForm.chequeNo, bankName: pdcForm.bankName,
            payee: pdcForm.payee, amount: parseFloat(pdcForm.amount) || 0,
            type: pdcForm.type, status: 'Pending', description: pdcForm.description,
            createdAt: new Date().toISOString()
        };
        const updated = [entry, ...pdcList];
        savePDC(updated); setPdcList(updated);
        setPdcForm({ date: '', chequeNo: '', bankName: '', payee: '', amount: '', type: 'Received', description: '' });
        setShowPDCForm(false);
    };

    const updatePDCStatus = (id: string, status: PDCheque['status']) => {
        const updated = pdcList.map(p => p.id === id ? { ...p, status } : p);
        savePDC(updated); setPdcList(updated);
    };

    const today = new Date().toISOString().slice(0, 10);
    const pendingPDC = pdcList.filter(p => p.status === 'Pending');
    const dueTodayPDC = pendingPDC.filter(p => p.date <= today);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-10">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 rounded-2xl text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                        <Landmark size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight uppercase">Banking & Reconciliation</h1>
                        <p className="text-gray-400 text-sm mt-1">Real-time transaction ledger • {getCompanyProfile().name}</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all">
                    <Download size={16} /> Export Statement
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {[{id:'ledger',label:'📊 Transaction Ledger'},{id:'pdc',label:`📋 Post Dated Cheques ${dueTodayPDC.length > 0 ? `(${dueTodayPDC.length} due today)` : ''}`}].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Net Balance', value: formatCurrency(netBalance), icon: DollarSign, color: netBalance >= 0 ? 'text-emerald-600' : 'text-red-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { label: 'Total Receipts', value: formatCurrency(totalCredits), icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { label: 'Outstanding', value: formatCurrency(totalDebits), icon: ArrowUpRight, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
                    { label: 'Transactions', value: String(transactions.length), icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                ].map((kpi, i) => (
                    <div key={i} className={`bg-white rounded-2xl border ${kpi.border} p-5 shadow-sm`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">{kpi.label}</span>
                            <div className={`w-9 h-9 ${kpi.bg} rounded-xl flex items-center justify-center`}>
                                <kpi.icon size={18} className={kpi.color} />
                            </div>
                        </div>
                        <div className={`text-2xl font-black font-mono ${kpi.color}`}>
                            {loading ? '...' : kpi.value}
                        </div>
                    </div>
                ))}
            </div>

            {activeTab === 'ledger' && (<>
            {/* Bank Account Card */}
            <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Building2 size={20} />
                        <span className="text-sm font-black uppercase tracking-widest opacity-80">Main Operating Account</span>
                    </div>
                    <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-full">ACTIVE</span>
                </div>
                <div className="text-3xl font-black font-mono mb-1">{loading ? '...' : formatCurrency(netBalance)}</div>
                <p className="text-orange-100 text-sm">Available Balance</p>
                <div className="mt-4 flex items-center gap-6 text-sm">
                    <div>
                        <p className="opacity-60 text-xs uppercase">Payments Received</p>
                        <p className="font-black">{payments.length} records</p>
                    </div>
                    <div>
                        <p className="opacity-60 text-xs uppercase">Outstanding Invoices</p>
                        <p className="font-black">{invoices.filter(i => ['Unpaid', 'Partial', 'Overdue'].includes(i.status || '')).length} pending</p>
                    </div>
                </div>
            </div>

            {/* Transaction Ledger */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <RefreshCw size={16} className="text-orange-500" /> Transaction Ledger
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 w-56"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400" />
                            <span className="text-xs text-gray-400">to</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400" />
                            {(dateFrom || dateTo) && (
                                <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                                    className="text-xs text-red-500 font-bold hover:text-red-700">Clear</button>
                            )}
                        </div>
                        {(['all', 'Credit', 'Debit'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                {f === 'all' ? 'All' : f}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center text-gray-400 font-bold">Loading transactions...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-20 text-center">
                        <Landmark size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-bold uppercase text-sm">No transactions found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Date', 'Description', 'Reference', 'Category', 'Type', 'Amount', 'Balance'].map(h => (
                                        <th key={h} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.slice(0, 50).map(tx => (
                                    <tr key={tx.id} className="hover:bg-gray-50 transition-all">
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{tx.date}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{tx.description}</td>
                                        <td className="px-6 py-4 text-xs font-mono text-orange-600 font-bold">{tx.reference}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-lg uppercase">{tx.category}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`flex items-center gap-1 text-xs font-black ${tx.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {tx.type === 'Credit' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-sm font-black font-mono ${tx.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {tx.type === 'Credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black font-mono text-gray-700">{formatCurrency(tx.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filtered.length > 50 && (
                            <div className="p-4 text-center text-xs text-gray-400 font-bold border-t">
                                Showing 50 of {filtered.length} transactions
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
            )}

            {/* PDC Section */}
            {activeTab === 'pdc' && (
                <div className="space-y-4">
                    {/* PDC Alert */}
                    {dueTodayPDC.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-black text-amber-800">⚠️ {dueTodayPDC.length} cheque(s) due today or overdue</p>
                                <p className="text-xs text-amber-600 mt-0.5">Mark them as Cleared when deposited/cleared by bank</p>
                            </div>
                        </div>
                    )}

                    {/* Add PDC Button */}
                    <div className="flex justify-between items-center">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">{pdcList.length} Post Dated Cheques Recorded</p>
                        <button onClick={() => setShowPDCForm(!showPDCForm)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 transition-all">
                            + Record Cheque
                        </button>
                    </div>

                    {/* PDC Form */}
                    {showPDCForm && (
                        <div className="bg-white rounded-2xl border-2 border-orange-200 p-5 shadow-sm">
                            <p className="text-xs font-black text-orange-700 uppercase tracking-widest mb-4">📋 Record Post Dated Cheque</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    {key:'chequeNo',label:'Cheque No. *',ph:'e.g. 001234'},
                                    {key:'bankName',label:'Bank Name',ph:'e.g. Chase Bank'},
                                    {key:'payee',label:'Payee / Drawer',ph:'Customer or Supplier name'},
                                    {key:'description',label:'Description',ph:'Purpose of cheque'},
                                ].map(field => (
                                    <div key={field.key}>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">{field.label}</label>
                                        <input value={(pdcForm as any)[field.key]} onChange={e => setPdcForm(p => ({...p,[field.key]:e.target.value}))}
                                            placeholder={field.ph} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Cheque Date *</label>
                                    <input type="date" value={pdcForm.date} onChange={e => setPdcForm(p => ({...p,date:e.target.value}))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Amount ($) *</label>
                                    <input type="number" value={pdcForm.amount} onChange={e => setPdcForm(p => ({...p,amount:e.target.value}))}
                                        placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Type</label>
                                    <select value={pdcForm.type} onChange={e => setPdcForm(p => ({...p,type:e.target.value as any}))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                                        <option value="Received">Received (from customer)</option>
                                        <option value="Issued">Issued (to supplier)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button onClick={savePDCEntry} className="px-6 py-2.5 bg-gray-900 text-white text-sm font-black rounded-xl hover:bg-gray-700 transition-all">
                                    Save Cheque
                                </button>
                                <button onClick={() => setShowPDCForm(false)} className="px-4 py-2.5 text-sm text-gray-400 font-black hover:text-gray-700">Cancel</button>
                            </div>
                        </div>
                    )}

                    {/* PDC Table */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {pdcList.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                <p className="text-3xl mb-2">📋</p>
                                <p className="font-bold">No post dated cheques recorded</p>
                                <p className="text-sm mt-1">Click "+ Record Cheque" to add one</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>{['Cheque No','Bank','Payee','Date','Amount','Type','Status','Actions'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}</tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {pdcList.map(pdc => {
                                        const isOverdue = pdc.date <= today && pdc.status === 'Pending';
                                        const isFuture = pdc.date > today;
                                        return (
                                            <tr key={pdc.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-amber-50' : ''}`}>
                                                <td className="px-4 py-3 text-sm font-black font-mono text-gray-900">{pdc.chequeNo}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{pdc.bankName || '—'}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-800">{pdc.payee || '—'}</td>
                                                <td className="px-4 py-3 text-sm font-mono text-gray-600">
                                                    {pdc.date}
                                                    {isOverdue && <span className="ml-1 text-[9px] bg-red-100 text-red-600 font-black px-1.5 py-0.5 rounded-full">OVERDUE</span>}
                                                    {isFuture && <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 font-black px-1.5 py-0.5 rounded-full">FUTURE</span>}
                                                </td>
                                                <td className={`px-4 py-3 text-sm font-black font-mono ${pdc.type==='Received'?'text-emerald-600':'text-red-600'}`}>
                                                    {pdc.type==='Received'?'+':'-'}{formatCurrency(pdc.amount)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pdc.type==='Received'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{pdc.type}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                        pdc.status==='Cleared'?'bg-emerald-100 text-emerald-700':
                                                        pdc.status==='Bounced'?'bg-red-100 text-red-700':
                                                        pdc.status==='Cancelled'?'bg-gray-100 text-gray-600':
                                                        isOverdue?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'
                                                    }`}>{pdc.status}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {pdc.status === 'Pending' && (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => updatePDCStatus(pdc.id, 'Cleared')} className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 font-black rounded-lg hover:bg-emerald-200 transition-all">✓ Clear</button>
                                                            <button onClick={() => updatePDCStatus(pdc.id, 'Bounced')} className="text-[10px] px-2 py-1 bg-red-100 text-red-700 font-black rounded-lg hover:bg-red-200 transition-all">✗ Bounce</button>
                                                            <button onClick={() => updatePDCStatus(pdc.id, 'Cancelled')} className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 font-black rounded-lg hover:bg-gray-200 transition-all">Cancel</button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
