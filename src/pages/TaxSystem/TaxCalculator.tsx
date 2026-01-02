import { useState } from 'react';
import {
    Calculator, MapPin, Package, ShoppingCart,
    ArrowRight, CheckCircle, RefreshCw, DollarSign
} from 'lucide-react';
import clsx from 'clsx';

export default function TaxCalculator() {
    const [calculating, setCalculating] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleCalculate = () => {
        setCalculating(true);
        // Simulate API call
        setTimeout(() => {
            setResult({
                taxable: true,
                jurisdiction: 'San Francisco County',
                stateRate: 0.0725,
                countyRate: 0.01,
                cityRate: 0.00,
                totalRate: 0.0825,
                taxAmount: 82.50,
                total: 1082.50
            });
            setCalculating(false);
        }, 1500);
    };

    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Calculator className="text-redwood-brand" /> Tax Engine
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Real-Time Transaction Simulator • USA
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="flex gap-8 max-w-6xl mx-auto h-full">

                    {/* Left: Input */}
                    <div className="w-1/2 flex flex-col gap-6">
                        <div className="bg-white border border-redwood-border p-6 rounded-sm shadow-sm">
                            <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-6 flex items-center gap-2">
                                <ShoppingCart size={16} /> Transaction Details
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product</label>
                                    <div className="relative">
                                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" defaultValue="Laptop Computer" className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Price ($)</label>
                                        <input type="number" defaultValue="1000.00" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity</label>
                                        <input type="number" defaultValue="1" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold font-mono" />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ship To Address</label>
                                    <div className="relative mb-2">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" defaultValue="123 Market St" className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input type="text" defaultValue="San Francisco" className="col-span-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm text-xs font-bold" />
                                        <input type="text" defaultValue="CA" className="col-span-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm text-xs font-bold" />
                                        <input type="text" defaultValue="94102" className="col-span-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm text-xs font-bold font-mono" />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100 flex gap-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Customer Type</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="custType" defaultChecked className="text-redwood-brand focus:ring-redwood-brand" />
                                                <span className="text-xs font-bold">Business (B2B)</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="custType" className="text-redwood-brand focus:ring-redwood-brand" />
                                                <span className="text-xs font-bold">Consumer (B2C)</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Tax Exempt?</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="exempt" className="text-redwood-brand focus:ring-redwood-brand" />
                                                <span className="text-xs font-bold">Yes</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="exempt" defaultChecked className="text-redwood-brand focus:ring-redwood-brand" />
                                                <span className="text-xs font-bold">No</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleCalculate}
                            disabled={calculating}
                            className={clsx(
                                "w-full py-4 rounded-sm font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 transition-all",
                                calculating ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-redwood-brand text-white hover:bg-redwood-brand/90"
                            )}
                        >
                            {calculating ? (
                                <>
                                    <RefreshCw className="animate-spin" size={20} /> Analyzing Tax Nexus...
                                </>
                            ) : (
                                <>
                                    Calculate Tax <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right: Output */}
                    <div className="w-1/2">
                        {result ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Analysis Card */}
                                <div className="bg-white border border-redwood-border rounded-sm overflow-hidden shadow-sm">
                                    <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                                        <div className="font-black uppercase tracking-wider text-xs flex items-center gap-2">
                                            <CheckCircle className="text-emerald-400" size={14} /> AI Tax Analysis
                                        </div>
                                        <div className="text-[10px] font-mono text-gray-400">ID: TX-2024-89332</div>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2"></div>
                                            <div className="flex-1">
                                                <div className="text-xs font-bold uppercase text-gray-500">Product Classification</div>
                                                <div className="text-sm font-bold text-gray-800">Tangible Personal Property</div>
                                                <div className="text-xs text-emerald-600 font-bold mt-1">✅ Taxable in CA</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2"></div>
                                            <div className="flex-1">
                                                <div className="text-xs font-bold uppercase text-gray-500">Location Analysis</div>
                                                <div className="text-sm font-bold text-gray-800">San Francisco, CA 94102</div>
                                                <div className="text-xs text-gray-600 mt-1">Jurisdiction: {result.jurisdiction}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2"></div>
                                            <div className="flex-1">
                                                <div className="text-xs font-bold uppercase text-gray-500">Rate Lookup (Live)</div>
                                                <div className="grid grid-cols-3 gap-2 mt-1 text-sm">
                                                    <div>
                                                        <span className="text-gray-500 block text-[10px]">State</span>
                                                        <span className="font-mono font-bold">{(result.stateRate * 100).toFixed(2)}%</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 block text-[10px]">County</span>
                                                        <span className="font-mono font-bold">{(result.countyRate * 100).toFixed(2)}%</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 block text-[10px]">Total</span>
                                                        <span className="font-mono font-black text-redwood-brand">{(result.totalRate * 100).toFixed(2)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Total Card */}
                                <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-md">
                                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Invoice Summary</h3>
                                    <div className="space-y-2 pb-4 border-b border-gray-100">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-bold text-gray-600">Subtotal</span>
                                            <span className="font-mono font-bold">$1,000.00</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="font-bold text-redwood-text-main">CA Sales Tax ({(result.totalRate * 100).toFixed(2)}%)</span>
                                            <span className="font-mono font-bold text-redwood-brand">${result.taxAmount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xl font-black mt-4">
                                        <span className="text-gray-800">TOTAL</span>
                                        <span className="font-mono text-emerald-600">${result.total.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-sm flex items-center gap-3 animate-pulse">
                                    <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                                        <CheckCircle size={16} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black uppercase text-emerald-800">Recorded Automatically</div>
                                        <div className="text-[10px] text-emerald-600">Saved to CA sales tax ledger & nexus tracker.</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-gray-200 rounded-sm">
                                <Calculator size={64} className="mb-4 text-gray-300" />
                                <div className="text-xl font-bold uppercase text-gray-400 text-center">
                                    Ready to Calculate<br />
                                    <span className="text-sm font-normal normal-case mt-2 block">Enter transaction details to simulate tax engine</span>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
