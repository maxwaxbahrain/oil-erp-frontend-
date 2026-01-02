import { useState } from 'react';
import { Truck, MapPin, Users, FileText, Calculator } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const vanPerformanceData = [
    { van: 'Van 1', driver: 'Oscar Miller', sales: 2840.00, deliveries: 45, efficiency: 94 },
    { van: 'Van 2', driver: 'Henry Wilson', sales: 2480.00, deliveries: 38, efficiency: 91 },
    { van: 'Van 3', driver: 'Liam Davis', sales: 2210.00, deliveries: 35, efficiency: 88 },
    { van: 'Van 4', driver: 'Noah Brown', sales: 1960.00, deliveries: 31, efficiency: 85 },
];

const dailyReconciliationData = [
    { product: 'Premium Widget', opening: 100, loaded: 50, sold: 120, returns: 2, closing: 28, price: 12.00, value: 1440.00 },
    { product: 'Standard Gadget', opening: 80, loaded: 40, sold: 90, returns: 0, closing: 30, price: 8.50, value: 765.00 },
    { product: 'Basic Tool', opening: 50, loaded: 20, sold: 45, returns: 1, closing: 24, price: 5.00, value: 225.00 },
];

export default function VanPerformance() {
    const [selectedVan, setSelectedVan] = useState('Van 1');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Truck size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Van Operations</h1>
                        <p className="text-sm text-gray-500 font-medium">Daily Sales Reconciliation & Performance</p>
                    </div>
                </div>

                {/* Action Shortcuts */}
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all">
                        <MapPin size={16} /> Route Plan
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all">
                        <Users size={16} /> Customers
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all">
                        <FileText size={16} /> Credit Notes
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Stats & Chart */}
                <div className="space-y-8 lg:col-span-1">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Sales</div>
                            <div className="text-2xl font-black text-gray-900">$9,490</div>
                            <div className="text-xs text-emerald-600 font-bold mt-1">▲ 12% vs yesterday</div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Avg Efficiency</div>
                            <div className="text-2xl font-black text-indigo-600">89.5%</div>
                            <div className="text-xs text-gray-400 font-bold mt-1">Target: 85%</div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col h-[400px]">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-6">Sales by Van</h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vanPerformanceData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                    <XAxis dataKey="van" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="sales" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Right Column: Day Reconciliation */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                    <Calculator size={20} className="text-indigo-600" /> Daily Reconciliation
                                </h2>
                                <p className="text-xs text-gray-500 font-medium">Track inventory flow per van</p>
                            </div>
                            <div className="flex gap-2">
                                <select
                                    className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={selectedVan}
                                    onChange={(e) => setSelectedVan(e.target.value)}
                                >
                                    <option>Van 1</option>
                                    <option>Van 2</option>
                                    <option>Van 3</option>
                                    <option>Van 4</option>
                                </select>
                                <input
                                    type="date"
                                    className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Product</th>
                                        <th className="px-4 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-wider">Opening</th>
                                        <th className="px-4 py-4 text-center text-xs font-black text-emerald-600 uppercase tracking-wider">+ Loaded</th>
                                        <th className="px-4 py-4 text-center text-xs font-black text-indigo-600 uppercase tracking-wider">- Sold</th>
                                        <th className="px-4 py-4 text-center text-xs font-black text-rose-600 uppercase tracking-wider">- Returns</th>
                                        <th className="px-4 py-4 text-center text-xs font-black text-gray-900 uppercase tracking-wider">= Closing</th>
                                        <th className="px-6 py-4 text-right text-xs font-black text-gray-900 uppercase tracking-wider">Value Sold</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {dailyReconciliationData.map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900">{row.product}</div>
                                                <div className="text-xs text-gray-400 font-medium">${row.price.toFixed(2)}</div>
                                            </td>
                                            <td className="px-4 py-4 text-center text-sm font-medium text-gray-600">{row.opening}</td>
                                            <td className="px-4 py-4 text-center text-sm font-bold text-emerald-600 bg-emerald-50/50 rounded-lg">{row.loaded}</td>
                                            <td className="px-4 py-4 text-center text-sm font-bold text-indigo-600 bg-indigo-50/50 rounded-lg">{row.sold}</td>
                                            <td className="px-4 py-4 text-center text-sm font-bold text-rose-600 bg-rose-50/50 rounded-lg">{row.returns}</td>
                                            <td className="px-4 py-4 text-center text-sm font-black text-gray-900 border-l border-r border-gray-100 bg-gray-50/30">{row.closing}</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-gray-900">${row.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                    {/* Total Row */}
                                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                                        <td className="px-6 py-4 text-sm font-black text-gray-900 uppercase tracking-wide">Daily Total</td>
                                        <td className="px-4 py-4 text-center text-sm font-bold text-gray-500">-</td>
                                        <td className="px-4 py-4 text-center text-sm font-bold text-gray-500">-</td>
                                        <td className="px-4 py-4 text-center text-sm font-black text-indigo-600">{dailyReconciliationData.reduce((a, b) => a + b.sold, 0)}</td>
                                        <td className="px-4 py-4 text-center text-sm font-bold text-rose-600">{dailyReconciliationData.reduce((a, b) => a + b.returns, 0)}</td>
                                        <td className="px-4 py-4 text-center text-sm font-bold text-gray-900">-</td>
                                        <td className="px-6 py-4 text-right text-lg font-black text-indigo-700">${dailyReconciliationData.reduce((a, b) => a + b.value, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
