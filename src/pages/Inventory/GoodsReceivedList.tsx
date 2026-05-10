import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Package,
    CheckCircle,
    Clock,
    TrendingUp,
    FileText,
    Filter,
    Truck,
    AlertCircle
} from 'lucide-react';
import { getGRNs, getGRNStats, getPendingPurchaseOrders, type GRN, type GRNStats } from '../../services/grnService';
import { type PurchaseOrder } from '../../services/purchasesService';

export default function GoodsReceivedList() {
    const navigate = useNavigate();
    const [grns, setGRNs] = useState<GRN[]>([]);
    const [stats, setStats] = useState<GRNStats | null>(null);
    const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Posted'>('All');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [grnsData, statsData, pendingPOsData] = await Promise.all([
                getGRNs(),
                getGRNStats(),
                getPendingPurchaseOrders()
            ]);
            setGRNs(grnsData);
            setStats(statsData);
            setPendingPOs(pendingPOsData);
        } catch (error) {
            console.error('Error loading GRN data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredGRNs = grns.filter(grn => {
        const matchesSearch =
            grn.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            grn.poReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
            grn.warehouse.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'All' || grn.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Posted':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-sm uppercase tracking-wider">
                        <CheckCircle size={12} />
                        Posted
                    </span>
                );
            case 'Draft':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-sm uppercase tracking-wider">
                        <Clock size={12} />
                        Draft
                    </span>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-redwood-brand mx-auto mb-4"></div>
                    <p className="text-gray-500 text-sm">Loading GRNs...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight uppercase">
                        Material Receipt
                    </h1>
                    <p className="text-sm text-redwood-text-muted mt-1">
                        Goods Received Notes (GRN) - Manage incoming inventory
                    </p>
                </div>
                <button
                    onClick={() => navigate('/receiving/new')}
                    className="px-6 py-3 bg-redwood-brand text-white text-[13px] font-bold rounded-sm hover:brightness-95 uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
                >
                    <Plus size={18} />
                    Create GRN
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white p-5 rounded-sm border border-redwood-border shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total GRNs</span>
                            <FileText size={16} className="text-gray-400" />
                        </div>
                        <div className="text-2xl font-black text-redwood-text-main">{stats.totalGRNs}</div>
                    </div>

                    <div className="bg-white p-5 rounded-sm border border-redwood-border shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Draft</span>
                            <Clock size={16} className="text-amber-500" />
                        </div>
                        <div className="text-2xl font-black text-amber-600">{stats.draftGRNs}</div>
                    </div>

                    <div className="bg-white p-5 rounded-sm border border-redwood-border shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Posted</span>
                            <CheckCircle size={16} className="text-emerald-500" />
                        </div>
                        <div className="text-2xl font-black text-emerald-600">{stats.postedGRNs}</div>
                    </div>

                    <div className="bg-white p-5 rounded-sm border border-redwood-border shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Value</span>
                            <TrendingUp size={16} className="text-gray-400" />
                        </div>
                        <div className="text-2xl font-black text-redwood-text-main">
                            ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-sm border border-redwood-border shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Pending POs</span>
                            <Truck size={16} className="text-blue-500" />
                        </div>
                        <div className="text-2xl font-black text-blue-600">{stats.pendingPOs}</div>
                    </div>
                </div>
            )}

            {/* Pending POs Alert */}
            {pendingPOs.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 mb-6 flex items-start gap-3">
                    <AlertCircle size={20} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="text-[13px] font-bold text-blue-800 mb-1">
                            {pendingPOs.length} Purchase Order{pendingPOs.length > 1 ? 's' : ''} Awaiting Receipt
                        </div>
                        <div className="text-[12px] text-blue-700">
                            Click "Create GRN" to receive goods from approved purchase orders.
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-sm border border-redwood-border shadow-sm mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Search by GRN number, PO reference, or warehouse..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-[13px] focus:border-redwood-brand outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm text-[13px] font-medium focus:border-redwood-brand outline-none"
                        >
                            <option value="All">All Status</option>
                            <option value="Draft">Draft</option>
                            <option value="Posted">Posted</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* GRN Table */}
            <div className="bg-white rounded-sm border border-redwood-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-redwood-bg-light border-b-2 border-redwood-border">
                                <th className="py-4 px-4 text-left text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">
                                    GRN Number
                                </th>
                                <th className="py-4 px-4 text-left text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">
                                    PO Reference
                                </th>
                                <th className="py-4 px-4 text-left text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">
                                    Warehouse
                                </th>
                                <th className="py-4 px-4 text-left text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="py-4 px-4 text-left text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">
                                    Items
                                </th>
                                <th className="py-4 px-4 text-right text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">
                                    Value
                                </th>
                                <th className="py-4 px-4 text-center text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGRNs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center">
                                        <Package size={48} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-gray-500 text-sm font-medium">
                                            {searchTerm || statusFilter !== 'All'
                                                ? 'No GRNs match your filters'
                                                : 'No GRNs created yet'
                                            }
                                        </p>
                                        {!searchTerm && statusFilter === 'All' && (
                                            <button
                                                onClick={() => navigate('/receiving/new')}
                                                className="mt-4 px-5 py-2 bg-redwood-brand text-white text-[12px] font-bold rounded-sm hover:brightness-95 uppercase tracking-wider transition-all"
                                            >
                                                Create First GRN
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filteredGRNs.map((grn) => (
                                    <tr
                                        key={grn.id}
                                        onClick={() => navigate(`/receiving/${grn.id}`)}
                                        className="border-b border-gray-100 hover:bg-redwood-bg-light/30 cursor-pointer transition-colors"
                                    >
                                        <td className="py-4 px-4">
                                            <div className="text-[13px] font-bold text-redwood-brand">
                                                {grn.grnNumber}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="text-[13px] font-medium text-gray-700">
                                                {grn.poReference}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="text-[13px] text-gray-600">
                                                {grn.warehouse}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="text-[13px] text-gray-600">
                                                {new Date(grn.receivedDate).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="text-[13px] font-mono text-gray-700">
                                                {grn.items.length} item{grn.items.length > 1 ? 's' : ''}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="text-[14px] font-bold text-gray-900 font-mono">
                                                ${grn.landedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            {getStatusBadge(grn.status)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Results count */}
            {filteredGRNs.length > 0 && (
                <div className="mt-4 text-center text-[12px] text-gray-500">
                    Showing {filteredGRNs.length} of {grns.length} GRN{grns.length > 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
}
