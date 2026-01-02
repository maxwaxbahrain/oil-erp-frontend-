import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Truck,
    Package,
    ArrowRightCircle,
    MapPin,
    AlertCircle,
    CheckCircle,
    Printer
} from 'lucide-react';

interface TransferItem {
    productId: string;
    productName: string;
    uom: string;
    availableQty: number;
    transferQty: number;
}

export default function StockTransfer() {
    const navigate = useNavigate();
    const [transferId] = useState(`TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    const [date] = useState(new Date().toISOString().split('T')[0]);
    const [fromLocation, setFromLocation] = useState('Main Warehouse');
    const [toLocation, setToLocation] = useState('Van 101');
    const [items, setItems] = useState<TransferItem[]>([
        { productId: 'P-101', productName: 'Premium Motor Oil 5W-30', uom: 'Case', availableQty: 500, transferQty: 0 },
        { productId: 'P-205', productName: 'Hydraulic Fluid ISO 46', uom: 'Drum', availableQty: 120, transferQty: 0 }
    ]);
    const [_status, setStatus] = useState('Draft');

    const handleTransferQtyChange = (index: number, value: string) => {
        const qty = Number(value);
        const newItems = [...items];
        newItems[index].transferQty = qty;
        setItems(newItems);
    };

    const handleStockFill = () => {
        // Mock feature: Fill based on Van needs
        const filled = items.map(item => ({
            ...item,
            transferQty: Math.min(item.availableQty, 20) // Mock logic
        }));
        setItems(filled);
    };

    return (
        <div className="max-w-[1000px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/inventory/transfer')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-redwood-text-main tracking-tight uppercase">Stock Transfer</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Internal Movement</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-[11px] font-bold text-redwood-brand uppercase tracking-wider">{transferId}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-[12px] font-bold rounded-sm hover:bg-gray-50 uppercase tracking-widest transition-all flex items-center gap-2">
                        <Printer size={16} /> Print Slip
                    </button>
                    <button onClick={() => setStatus('Posted')} className="px-6 py-2.5 bg-redwood-brand text-white text-[12px] font-bold rounded-sm hover:brightness-95 uppercase tracking-widest transition-all shadow-md flex items-center gap-2">
                        <ArrowRightCircle size={16} /> Transfer Stock
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Source & Destination */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <MapPin size={14} /> Location Details
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex justify-between">
                                    <span>From Location</span>
                                    <span className="text-emerald-600">Source</span>
                                </label>
                                <select
                                    value={fromLocation}
                                    onChange={(e) => setFromLocation(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                >
                                    <option>Main Warehouse</option>
                                    <option>North Depot</option>
                                </select>
                            </div>

                            <div className="flex justify-center text-gray-300">
                                <ArrowRightCircle className="rotate-90" size={20} />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex justify-between">
                                    <span>To Location</span>
                                    <span className="text-amber-600">Destination</span>
                                </label>
                                <select
                                    value={toLocation}
                                    onChange={(e) => setToLocation(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium focus:border-redwood-brand outline-none"
                                >
                                    <option>Van 101</option>
                                    <option>Van 102</option>
                                    <option>South Store</option>
                                </select>
                            </div>

                            <div className="pt-4 border-t border-dashed border-gray-200">
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Transfer Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    readOnly
                                    className="w-full bg-gray-50 border border-gray-200 rounded-sm px-3 py-2 text-[13px] font-medium text-gray-600"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Grid */}
                <div className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[12px] font-black text-redwood-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                <Package size={14} /> Inventory Movement
                            </h3>
                            <button
                                onClick={handleStockFill}
                                className="text-[11px] font-bold text-redwood-brand uppercase tracking-wider hover:bg-redwood-bg-light px-3 py-1.5 rounded-sm border border-redwood-border/50 transition-colors flex items-center gap-2"
                            >
                                <Truck size={12} /> Auto-fill Opening Stock
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-redwood-bg-light">
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[40%]">Product</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[20%] text-center">Available</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[20%] text-center">Transfer Qty</th>
                                        <th className="py-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[20%] text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index} className="group hover:bg-redwood-bg-light/30 transition-colors border-b border-gray-50">
                                            <td className="p-2">
                                                <div className="text-[13px] font-bold text-redwood-text-main">{item.productName}</div>
                                                <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                    {item.productId} <span className="w-1 h-1 rounded-full bg-gray-300"></span> {item.uom}
                                                </div>
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className="text-[13px] font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded-sm">
                                                    {item.availableQty}
                                                </span>
                                            </td>
                                            <td className="p-2">
                                                <div className="relative max-w-[100px] mx-auto">
                                                    <input
                                                        type="number"
                                                        value={item.transferQty}
                                                        onChange={(e) => handleTransferQtyChange(index, e.target.value)}
                                                        className={`w-full text-center border rounded-sm py-1 text-[13px] font-mono focus:ring-1 outline-none ${item.transferQty > item.availableQty
                                                                ? 'border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-500 focus:ring-rose-200'
                                                                : 'border-gray-200 bg-white focus:border-redwood-brand focus:ring-redwood-brand/20'
                                                            }`}
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-2 text-center">
                                                {item.transferQty > item.availableQty ? (
                                                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-600 uppercase tracking-wide">
                                                        <AlertCircle size={12} /> Stock Error
                                                    </div>
                                                ) : item.transferQty > 0 ? (
                                                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
                                                        <CheckCircle size={12} /> Valid
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300 text-xl">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Validation Message */}
                        {items.some(i => i.transferQty > i.availableQty) && (
                            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-sm flex items-start gap-3 animate-in shake">
                                <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-[12px] font-bold text-rose-800 uppercase tracking-wide">Validation Error</div>
                                    <div className="text-[11px] text-rose-700 mt-1">
                                        Cannot transfer more stock than available. Please adjust quantities.
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
