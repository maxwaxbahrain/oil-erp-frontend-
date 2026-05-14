import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, CheckCircle, ChevronRight } from 'lucide-react';
import { type Supplier } from '../../services/purchasesService';

// SupplierList v3 (direct API): bypasses the localStorage-backed service
// layer entirely. Even if an old service bundle is cached in the browser,
// this page always shows backend suppliers + backend balances.
const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
const SUPPLIERS_API = `${API_HOST}/api/suppliers`;

export default function SupplierList() {
    const navigate = useNavigate();
    const location = useLocation();
    const [suppliers, setSuppliers] = useState<(Supplier & { balance: number })[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        // Purge stale localStorage left over from the pre-backend era. Those
        // rows had SUP-${Date.now()} ids that no longer resolve on the
        // backend and would otherwise leak into the list on cached bundles.
        try {
            localStorage.removeItem('suppliers');
            localStorage.removeItem('supplier_payments');
            localStorage.removeItem('purchase_orders');
        } catch { /* ignore quota / private-mode */ }

        // eslint-disable-next-line no-console
        console.log('[SupplierList v3] Loading suppliers from API:', `${SUPPLIERS_API}/`);

        const fetchSuppliers = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${SUPPLIERS_API}/`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const rows = await res.json();
                const list: any[] = Array.isArray(rows) ? rows : [];
                // Fan out: fetch each supplier's balance in parallel from the
                // backend's computed /balance endpoint.
                const withBalance = await Promise.all(
                    list.map(async (s) => {
                        let balance = 0;
                        try {
                            const br = await fetch(`${SUPPLIERS_API}/${s.id}/balance`);
                            if (br.ok) {
                                const j = await br.json();
                                balance = Number(j.balance) || 0;
                            }
                        } catch { /* ignore one supplier */ }
                        return {
                            id: String(s.id),
                            name: s.name || '',
                            code: s.code || '',
                            contactPerson: s.contact_person || '',
                            email: s.email || '',
                            phone: s.phone || '',
                            address: s.address || '',
                            taxId: s.tax_id || '',
                            status: (s.status === 'Blocked' ? 'Blocked' : 'Active') as 'Active' | 'Blocked',
                            paymentTerms: s.payment_terms || 'Net 30',
                            currency: s.currency || 'USD',
                            balance,
                        } as Supplier & { balance: number };
                    })
                );
                // eslint-disable-next-line no-console
                console.log(`[SupplierList v3] Got ${withBalance.length} suppliers`,
                    withBalance.map(s => ({ id: s.id, name: s.name, balance: s.balance })));
                setSuppliers(withBalance);
            } catch (error) {
                console.error('[SupplierList v3] Failed to fetch suppliers:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSuppliers();

        if (location.state?.success) {
            setShowSuccess(true);
            setSuccessMessage(location.state.message || 'Supplier created successfully!');
            setTimeout(() => setShowSuccess(false), 5000);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-10 h-10 border-4 border-redwood-brand border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Success Notification */}
            {showSuccess && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-sm shadow-md mb-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="text-emerald-500" size={24} />
                        <div>
                            <p className="text-sm font-bold text-emerald-900">{successMessage}</p>
                            <p className="text-xs text-emerald-700 mt-1">The supplier has been added to your system.</p>
                        </div>
                        <button
                            onClick={() => setShowSuccess(false)}
                            className="ml-auto text-emerald-600 hover:text-emerald-900 text-xl font-bold"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Supplier Master</h1>
                <button onClick={() => navigate('/suppliers/new')} className="bg-redwood-brand text-white px-4 py-2 rounded-sm text-xs font-bold uppercase flex items-center gap-2">
                    <Plus size={16} /> Add New Supplier
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase">Supplier</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase text-right">Balance</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase text-center">Status</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {suppliers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center">
                                    <p className="text-sm font-bold text-gray-400 uppercase">No Suppliers Yet</p>
                                    <p className="text-xs text-gray-400 mt-2">Click "Add New Supplier" to get started</p>
                                </td>
                            </tr>
                        ) : (
                            suppliers.map((s) => (
                                <tr
                                    key={s.id}
                                    className="hover:bg-redwood-bg-light/30 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/suppliers/${s.id}`)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-extrabold text-sm text-gray-900 group-hover:text-redwood-brand transition-colors">{s.name}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{s.code}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-redwood-brand font-black text-sm">
                                        {s.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-sm text-[9px] font-black uppercase tracking-wider ${s.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-300 group-hover:text-redwood-brand transition-colors">
                                        <ChevronRight size={18} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}