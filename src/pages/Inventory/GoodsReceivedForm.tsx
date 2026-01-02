import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Truck,
    Package,
    ClipboardCheck,
    AlertTriangle,
    CheckSquare,
    Printer,
    FileText,
    Warehouse
} from 'lucide-react';

// Mock Data Types
interface GRNItem {
    productId: string;
    productName: string;
    orderedQty: number;
    receivedQty: number;
    acceptedQty: number;
    rejectedQty: number;
    unitCost: number;
}

export default function GoodsReceivedForm() {
    const navigate = useNavigate();
    const [grnNumber] = useState(`GRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    const [poReference, setPoReference] = useState('PO-2025-0012'); // Mock default
    const [warehouse, setWarehouse] = useState('Main Depot');
    const [_status, setStatus] = useState('Draft');

    // Mock Items from PO
    const [items, setItems] = useState<GRNItem[]>([
        { productId: 'P-101', productName: 'Premium Motor Oil 5W-30', orderedQty: 100, receivedQty: 100, acceptedQty: 100, rejectedQty: 0, unitCost: 45.00 },
        { productId: 'P-102', productName: 'Diesel Exhaust Fluid', orderedQty: 50, receivedQty: 50, acceptedQty: 48, rejectedQty: 2, unitCost: 12.50 },
    ]);

    const handleReceiveAll = () => {
        const updated = items.map(item => ({
            ...item,
            receivedQty: item.orderedQty,
            acceptedQty: item.orderedQty,
            rejectedQty: 0
        }));
        setItems(updated);
    };

    const handleItemChange = (index: number, field: keyof GRNItem, value: any) => {
        const newItems = [...items];
        // @ts-ignore
        newItems[index][field] = Number(value);
        setItems(newItems);
    };

    // Costing
    const totalReceivedValue = items.reduce((sum, item) => sum + (item.receivedQty * item.unitCost), 0);
    const freightCost = 250.00; // Mock fixed freight
    const landedCost = totalReceivedValue + freightCost;

    return (
        <div className="max-w-[1200px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/receiving')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-redwood-text-main tracking-tight uppercase">Goods Received Note</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Stock Inward</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-[11px] font-bold text-redwood-brand uppercase tracking-wider">{grnNumber}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-[12px] font-bold rounded-sm hover:bg-gray-50 uppercase tracking-widest transition-all flex items-center gap-2">
                        <Printer size={16} /> Print GRN
                    </button>
                    <button onClick={() => setStatus('Posted')} className="px-6 py-2.5 bg-emerald-600 text-white text-[12px] font-bold rounded-sm hover:brightness-95 uppercase tracking-widest transition-all shadow-md flex items-center gap-2">
                        <CheckSquare size={16} /> Post GRN
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Header Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <ClipboardCheck size={14} /> GRN Header
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">PO Reference</label>
                                <div className="flex gap-2">
                                    <input
                                        value={poReference}
                                        onChange={(e) => setPoReference(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                    />
                                    <button className="p-2 bg-gray-100 border border-gray-200 rounded-sm hover:bg-gray-200 text-gray-600">
                                        <Truck size={16} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Warehouse</label>
                                <div className="relative">
                                    <Warehouse size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <select
                                        value={warehouse}
                                        onChange={(e) => setWarehouse(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-sm pl-9 pr-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none appearance-none"
                                    >
                                        <option>Main Depot</option>
                                        <option>North Warehouse</option>
                                        <option>South Distribution Center</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Received By</label>
                                <input
                                    defaultValue="Current User"
                                    readOnly
                                    className="w-full bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium text-gray-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Costing Summary */}
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <FileText size={14} /> Costing (Landed)
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-[12px] text-gray-600">
                                <span>Goods Value</span>
                                <span className="font-mono font-bold">${totalReceivedValue.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[12px] text-gray-600">
                                <span>Freight (Allocated)</span>
                                <span className="font-mono font-bold">${freightCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                                <span className="text-[12px] font-black text-redwood-text-main uppercase">Total Landed Cost</span>
                                <span className="text-[16px] font-black text-emerald-600 font-mono tracking-tight">${landedCost.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Grid */}
                <div className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm min-h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                <Package size={14} /> Items Received
                            </h3>
                            <button
                                onClick={handleReceiveAll}
                                className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider hover:bg-emerald-50 px-3 py-1.5 rounded-sm border border-emerald-200 transition-colors"
                            >
                                One-click Receive All
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-redwood-bg-light">
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[30%]">Product</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[15%] text-center">Ordered</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[15%] text-center">Received</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[15%] text-center">Accepted</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[15%] text-center">Rejected</th>
                                        <th className="py-3 px-2 w-[10%]"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index} className="group hover:bg-redwood-bg-light/30 transition-colors border-b border-gray-50">
                                            <td className="p-2">
                                                <div className="text-[13px] font-bold text-redwood-text-main">{item.productName}</div>
                                                <div className="text-[10px] text-gray-400">{item.productId}</div>
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className="text-[13px] font-mono text-gray-600">{item.orderedQty}</span>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={item.receivedQty}
                                                    onChange={(e) => handleItemChange(index, 'receivedQty', e.target.value)}
                                                    className="w-full text-center bg-gray-50 border border-transparent hover:border-gray-200 focus:border-redwood-brand rounded-sm py-1 text-[13px] font-mono"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={item.acceptedQty}
                                                    onChange={(e) => handleItemChange(index, 'acceptedQty', e.target.value)}
                                                    className="w-full text-center bg-emerald-50 border border-transparent hover:border-emerald-200 focus:border-emerald-500 rounded-sm py-1 text-[13px] font-mono text-emerald-700"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={item.rejectedQty}
                                                    onChange={(e) => handleItemChange(index, 'rejectedQty', e.target.value)}
                                                    className="w-full text-center bg-rose-50 border border-transparent hover:border-rose-200 focus:border-rose-500 rounded-sm py-1 text-[13px] font-mono text-rose-700"
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                {item.rejectedQty > 0 || item.receivedQty !== item.orderedQty ? (
                                                    <AlertTriangle size={16} className="text-amber-500 mx-auto animate-pulse" />
                                                ) : (
                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mx-auto"></div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mismatch Warning */}
                        {items.some(i => i.receivedQty !== i.orderedQty) && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-sm flex items-start gap-3">
                                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-[12px] font-bold text-amber-800 uppercase tracking-wide">Quantity Mismatch Detected</div>
                                    <div className="text-[11px] text-amber-700 mt-1">
                                        Received quantity does not match ordered quantity for one or more items. Please verify before posting.
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
