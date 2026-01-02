import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, TrendingUp, Handshake, Store, ArrowLeft,
    Calendar, Download, ChevronRight, CornerUpLeft
} from 'lucide-react';

export default function OrgPerformance() {
    const navigate = useNavigate();
    const [period, setPeriod] = useState('December 2024');

    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <button
                        onClick={() => navigate('/users/dashboard')}
                        className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 hover:text-redwood-brand mb-2"
                    >
                        <CornerUpLeft size={12} /> Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <TrendingUp className="text-redwood-brand" /> Organization Performance
                    </h1>
                </div>
                <div className="flex gap-2">
                    <div className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-sm text-xs font-bold flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        {period}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">

                <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* User Performance */}
                    <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                            <Users size={20} className="text-blue-600" />
                            <h2 className="text-lg font-black text-gray-800 uppercase">Users & Sales Team</h2>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3">Top Performers</h3>
                                {[
                                    { name: 'John Smith', role: 'Sales Manager', sales: '$156,890', rank: 1 },
                                    { name: 'Mike Johnson', role: 'Van Sales', sales: '$142,500', rank: 2 },
                                    { name: 'Sarah Lee', role: 'Key Accounts', sales: '$138,200', rank: 3 },
                                ].map((user, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-sm mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">
                                                {user.rank}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-800">{user.name}</div>
                                                <div className="text-[10px] text-gray-500 uppercase">{user.role}</div>
                                            </div>
                                        </div>
                                        <div className="font-mono font-black text-gray-900">{user.sales}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <div className="bg-emerald-50 p-3 rounded text-center">
                                    <div className="text-2xl font-black text-emerald-600">92%</div>
                                    <div className="text-[10px] font-bold uppercase text-emerald-800">Team Efficiency</div>
                                </div>
                                <div className="bg-blue-50 p-3 rounded text-center">
                                    <div className="text-2xl font-black text-blue-600">4.5/5</div>
                                    <div className="text-[10px] font-bold uppercase text-blue-800">Avg Productivity</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Distributor Performance */}
                    <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                            <Handshake size={20} className="text-indigo-600" />
                            <h2 className="text-lg font-black text-gray-800 uppercase">Distributors</h2>
                        </div>
                        <div className="space-y-6">
                            <div className="flex justify-between items-end">
                                <div>
                                    <div className="text-xs font-bold text-gray-500 uppercase">Total Monthly Sales</div>
                                    <div className="text-3xl font-black text-indigo-900">$2.5M</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                        +12% <TrendingUp size={12} />
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase">vs Last Month</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold text-gray-600">
                                    <span>Top Distributor</span>
                                    <span>ABC Dist</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-indigo-500 h-full w-[85%]"></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold text-gray-600">
                                    <span>On-Time Payments</span>
                                    <span>95%</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full w-[95%]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    {/* Dealers Analysis */}
                    <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                            <Store size={20} className="text-orange-600" />
                            <h2 className="text-lg font-black text-gray-800 uppercase">Dealer Network</h2>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-xl font-black text-gray-800">1,180</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Active Retailers</div>
                            </div>
                            <div>
                                <div className="text-xl font-black text-gray-800">$755</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Avg Order Val</div>
                            </div>
                            <div>
                                <div className="text-xl font-black text-emerald-600">+12%</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Growth Rate</div>
                            </div>
                        </div>
                    </div>

                    {/* Partner Contribution */}
                    <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                            <Handshake size={20} className="text-teal-600" />
                            <h2 className="text-lg font-black text-gray-800 uppercase">Strategic Partners</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-teal-50 p-3 rounded border border-teal-100">
                                <div className="text-xs font-black uppercase text-teal-800">Partner Value Generation</div>
                                <div className="text-lg font-black text-teal-900">$15.2M / yr</div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-600">Cost Savings</span>
                                <span className="font-mono font-black text-gray-800">$2.3M</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-600">Service Level Agr (SLA)</span>
                                <span className="font-mono font-black text-emerald-600">96%</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
