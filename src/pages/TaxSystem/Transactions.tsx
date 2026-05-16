// Transactions — saved-tax-calculation list view (Session 1E).
//
// Hits GET /api/v1/tax/transactions.  Filters (status, customer, date)
// happen client-side after the initial fetch — keeps the UI snappy and
// avoids round-tripping for trivial searches.  For larger datasets the
// server-side filter via ?status=&customerId= could be re-added.
//
// "Export to CSV" builds the CSV in-browser from currently-loaded
// transactions.  Each line item gets its own row so the export is
// directly importable into a spreadsheet.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Receipt, Search, Download, RefreshCw, ChevronDown, ChevronRight, X } from 'lucide-react';
import {
    listTaxTransactions,
    type TaxTransactionRow,
} from './integrations/taxEngineApi';
import { PRODUCT_CATEGORY_LABEL } from './data/constants';
import { formatCurrency } from '../../services/settingsService';

type StatusFilter = 'all' | 'draft' | 'committed' | 'cancelled';

export default function Transactions() {
    const navigate = useNavigate();
    const [rows, setRows] = useState<TaxTransactionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters (client-side).
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [stateFilter, setStateFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Expanded rows show the per-line breakdown inline.
    const [expandedTxn, setExpandedTxn] = useState<string | null>(null);
    const lastLoadRef = useRef<number>(0);

    const reload = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetched = await listTaxTransactions({ limit: 500 });
            setRows(fetched);
            lastLoadRef.current = Date.now();
        } catch (e: any) {
            setError(e?.message || 'Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        reload();
    }, []);

    // Apply filters in-memory.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const st = stateFilter.trim().toUpperCase();
        const cat = categoryFilter.trim().toUpperCase();
        return rows.filter(r => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (st && (r.buyerState || '').toUpperCase() !== st) return false;
            if (dateFrom && r.createdAt && r.createdAt.slice(0, 10) < dateFrom) return false;
            if (dateTo && r.createdAt && r.createdAt.slice(0, 10) > dateTo) return false;
            if (cat) {
                const anyMatch = (r.lineBreakdown || []).some(
                    li => (li.category || '').toUpperCase() === cat,
                );
                if (!anyMatch) return false;
            }
            if (q) {
                const hay = [
                    r.transactionId,
                    r.customerId,
                    r.buyerState,
                    r.sellerState,
                    r.exemptCertNum,
                    ...(r.lineBreakdown || []).map(li => li.description || ''),
                ].join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [rows, search, statusFilter, stateFilter, categoryFilter, dateFrom, dateTo]);

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setStateFilter('');
        setCategoryFilter('');
        setDateFrom('');
        setDateTo('');
    };

    const exportCsv = () => {
        // One row per LINE ITEM.  Header includes both txn-level and
        // line-level fields so a spreadsheet user can pivot either way.
        const headers = [
            'transactionId',
            'createdAt',
            'status',
            'buyerState',
            'sellerState',
            'customerId',
            'exemptCertNum',
            'lineDescription',
            'lineCategory',
            'lineQuantity',
            'lineUnitPrice',
            'lineTotal',
            'lineRate',
            'lineStateTax',
            'lineLocalTax',
            'lineTotalTax',
            'lineSource',
            'lineTaxable',
            'txnSubtotal',
            'txnStateTax',
            'txnLocalTax',
            'txnTotalTax',
            'txnEffectiveRate',
            'txnGrandTotal',
        ];
        const escape = (v: any) => {
            if (v === null || v === undefined) return '';
            const s = String(v);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };
        const csvRows: string[] = [headers.join(',')];
        for (const t of filtered) {
            const lines = t.lineBreakdown && t.lineBreakdown.length > 0 ? t.lineBreakdown : [null];
            for (const li of lines) {
                csvRows.push([
                    t.transactionId,
                    t.createdAt || '',
                    t.status,
                    t.buyerState,
                    t.sellerState || '',
                    t.customerId || '',
                    t.exemptCertNum || '',
                    li?.description ?? '',
                    li?.category ?? '',
                    li?.quantity ?? '',
                    li?.unitPrice ?? '',
                    li?.lineTotal ?? '',
                    li?.rate ?? '',
                    li?.stateTax ?? '',
                    li?.localTax ?? '',
                    li?.totalTax ?? '',
                    li?.source ?? '',
                    li?.taxable ?? '',
                    t.subtotal,
                    t.stateTax,
                    t.localTax,
                    t.totalTax,
                    t.effectiveRate,
                    t.grandTotal,
                ].map(escape).join(','));
            }
        }
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tax-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all"
                >
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                            <Receipt size={22} className="text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                Tax Transactions
                            </h1>
                            <p className="text-xs text-gray-500 mt-1">
                                Every saved tax calculation — drafts, commits, and cancelled rows for audit.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={reload}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                        >
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button
                            onClick={exportCsv}
                            disabled={filtered.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                        >
                            <Download size={14} /> Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-2 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by txn ID, customer, line description…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                >
                    <option value="all">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="committed">Committed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <input
                    type="text"
                    value={stateFilter}
                    onChange={e => setStateFilter(e.target.value)}
                    placeholder="Buyer state (e.g. CA)"
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-400"
                />
                <input
                    type="text"
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    placeholder="Category (e.g. MEDICAL)"
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-orange-400"
                />
                <div className="flex items-center gap-1">
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                    />
                    <span className="text-gray-400 text-xs">→</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                    />
                </div>
                {(search || statusFilter !== 'all' || stateFilter || categoryFilter || dateFrom || dateTo) && (
                    <button
                        onClick={clearFilters}
                        className="md:col-span-6 inline-flex items-center justify-center gap-1.5 text-xs font-black text-gray-500 hover:text-gray-800 uppercase tracking-wider"
                    >
                        <X size={12} /> Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                        Showing {filtered.length} of {rows.length}
                    </p>
                </div>
                {loading ? (
                    <div className="p-12 text-center text-gray-400 font-bold">Loading…</div>
                ) : error ? (
                    <div className="p-12 text-center">
                        <p className="text-rose-600 font-bold">⚠ {error}</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-400 font-bold uppercase text-sm">
                            {rows.length === 0 ? 'No transactions yet' : 'No rows match the current filters'}
                        </p>
                        <p className="text-gray-300 text-xs mt-1">
                            {rows.length === 0 ? 'Run a calculation on the Calculator page to create one.' : 'Adjust or clear filters.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['', 'Transaction', 'Buyer', 'Customer', 'Subtotal', 'Total Tax', 'Grand Total', 'Eff Rate', 'Status', 'Created'].map(h => (
                                        <th key={h} className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(t => {
                                    const expanded = expandedTxn === t.transactionId;
                                    return (
                                        <Fragment key={t.transactionId}>
                                            <tr
                                                className="hover:bg-gray-50 cursor-pointer"
                                                onClick={() => setExpandedTxn(expanded ? null : t.transactionId)}
                                            >
                                                <td className="px-4 py-3">
                                                    {expanded
                                                        ? <ChevronDown size={14} className="text-gray-400" />
                                                        : <ChevronRight size={14} className="text-gray-400" />}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-mono text-gray-700">{t.transactionId}</td>
                                                <td className="px-4 py-3 text-xs font-mono font-bold text-gray-900">{t.buyerState}</td>
                                                <td className="px-4 py-3 text-xs text-gray-700">{t.customerId || '—'}</td>
                                                <td className="px-4 py-3 text-sm font-mono text-gray-700 text-right">{formatCurrency(t.subtotal)}</td>
                                                <td className="px-4 py-3 text-sm font-mono font-black text-orange-700 text-right">{formatCurrency(t.totalTax)}</td>
                                                <td className="px-4 py-3 text-sm font-mono text-gray-900 text-right">{formatCurrency(t.grandTotal)}</td>
                                                <td className="px-4 py-3 text-xs font-mono text-gray-500">{t.effectiveRate.toFixed(3)}%</td>
                                                <td className="px-4 py-3">
                                                    <StatusPill status={t.status} />
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                                                    {(t.createdAt || '').slice(0, 10)}
                                                </td>
                                            </tr>
                                            {expanded && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan={10} className="px-6 py-4">
                                                        <LineBreakdownInline lines={t.lineBreakdown || []} />
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const cls = status === 'committed'
        ? 'bg-emerald-100 text-emerald-700'
        : status === 'cancelled'
            ? 'bg-rose-100 text-rose-700'
            : 'bg-gray-100 text-gray-700';
    return (
        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cls}`}>
            {status}
        </span>
    );
}

function LineBreakdownInline({ lines }: { lines: Array<any> }) {
    if (!lines.length) {
        return <p className="text-xs text-gray-400 italic">No line breakdown.</p>;
    }
    return (
        <table className="w-full text-left text-xs">
            <thead>
                <tr>
                    {['#', 'Description', 'Category', 'Qty', 'Unit Price', 'Total', 'Rate', 'Tax', 'Source'].map(h => (
                        <th key={h} className="px-3 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {lines.map((li, idx) => (
                    <tr key={li.lineId ?? idx} className="border-t border-gray-200">
                        <td className="px-3 py-2 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 text-gray-700">{li.description || `Line ${idx + 1}`}</td>
                        <td className="px-3 py-2 text-gray-500">
                            {li.category ? PRODUCT_CATEGORY_LABEL[li.category] || li.category : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 font-mono text-right">{li.quantity}</td>
                        <td className="px-3 py-2 text-gray-700 font-mono text-right">{formatCurrency(li.unitPrice)}</td>
                        <td className="px-3 py-2 text-gray-900 font-mono font-bold text-right">{formatCurrency(li.lineTotal)}</td>
                        <td className="px-3 py-2 text-orange-600 font-mono">{Number(li.rate).toFixed(3)}%</td>
                        <td className="px-3 py-2 text-gray-900 font-mono font-bold text-right">{formatCurrency(li.totalTax)}</td>
                        <td className="px-3 py-2">
                            <SourceBadgeSmall source={li.source} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function SourceBadgeSmall({ source }: { source: string }) {
    const isExempt = source === 'exempt' || source === 'category-exempt' || source === 'non-taxable';
    const isTaxed = source === 'rule' || source === 'us-state-default' || source === 'provider';
    const cls = isExempt
        ? 'bg-emerald-100 text-emerald-700'
        : isTaxed
            ? 'bg-amber-100 text-amber-700'
            : 'bg-gray-100 text-gray-600';
    return (
        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${cls}`}>
            {isExempt ? 'Exempt' : isTaxed ? 'Taxable' : source}
        </span>
    );
}
