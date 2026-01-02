import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, CheckCircle, ChevronRight } from 'lucide-react';
import { getSuppliers, getSupplierBalance, type Supplier } from '../../services/purchasesService';

export default function SupplierList() {
    const navigate = useNavigate();
    const location = useLocation();
    const [suppliers, setSuppliers] = useState<(Supplier & { balance: number })[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const fetchSuppliers = async () => {
            setLoading(true);
            try {
                const fetchedSuppliers = await getSuppliers();
                const suppliersWithBalance = await Promise.all(
                    fetchedSuppliers.map(async (s) => ({
                        ...s,
                        balance: await getSupplierBalance(s.id)
                    }))
                );
                setSuppliers(suppliersWithBalance);
            } catch (error) {
                console.error('Failed to fetch suppliers:', error);
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