import { useState } from 'react';
import {
    Package,
    Tag,
    BarChart2,
    AlertTriangle,
    Plus,
    BarChart3
} from 'lucide-react';
import ProductCatalog from './ProductCatalog';
import Categories from './Categories';
import LowStockAlerts from './LowStockAlerts';
import clsx from 'clsx';

type TabType = 'Products' | 'Categories' | 'Stock Adjustment' | 'Low Stock';

export default function ProductManagement() {
    const [activeTab, setActiveTab] = useState<TabType>('Products');

    return (
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Page Header */}
            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 transform translate-x-12 -translate-y-12 opacity-5 group-hover:translate-x-4 group-hover:-translate-y-4 transition-transform duration-1000">
                    <Package size={240} className="text-gray-900" />
                </div>

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                            <Package size={40} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Product Management</h1>
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">Manage all your products, categories, and stock in one place</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-2">
                {[
                    { id: 'Products', label: 'All Products', icon: Package },
                    { id: 'Categories', label: 'Categories', icon: Tag },
                    { id: 'Stock Adjustment', label: 'Stock Adjustment', icon: BarChart2 },
                    { id: 'Low Stock', label: 'Low Stock Alerts', icon: AlertTriangle },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={clsx(
                            "flex items-center gap-3 px-8 py-4 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all",
                            activeTab === tab.id
                                ? "bg-gray-900 text-white shadow-xl shadow-gray-200"
                                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {activeTab === 'Products' && <ProductCatalog />}
                {activeTab === 'Categories' && <Categories />}
                {activeTab === 'Stock Adjustment' && (
                    <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                        <BarChart2 size={64} className="text-gray-200 mb-6" />
                        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-4">Stock Adjustment</h2>
                        <p className="text-gray-500 max-w-md mx-auto mb-10 text-sm font-medium leading-relaxed">
                            Adjust stock levels for specific products across your warehouse, vans, and stores.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                            <button className="p-8 bg-gray-50 border border-gray-100 rounded-3xl hover:bg-white hover:border-gray-900 hover:shadow-xl transition-all group">
                                <Plus className="mx-auto mb-4 text-gray-400 group-hover:text-gray-900" size={32} />
                                <span className="text-[11px] font-black uppercase tracking-widest block">New Adjustment</span>
                            </button>
                            <button className="p-8 bg-gray-50 border border-gray-100 rounded-3xl hover:bg-white hover:border-gray-900 hover:shadow-xl transition-all group">
                                <BarChart3 className="mx-auto mb-4 text-gray-400 group-hover:text-gray-900" size={32} />
                                <span className="text-[11px] font-black uppercase tracking-widest block">View History</span>
                            </button>
                        </div>
                    </div>
                )}
                {activeTab === 'Low Stock' && <LowStockAlerts />}
            </div>
        </div>
    );
}
