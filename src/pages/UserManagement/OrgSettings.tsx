import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Settings, Save, RotateCcw, Building2, UserCog,
    Truck, Store, CornerUpLeft, Lock
} from 'lucide-react';
import clsx from 'clsx';

export default function OrgSettings() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('company');

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
                        <Settings className="text-redwood-brand" /> Organization Settings
                    </h1>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 border border-gray-200 rounded-sm text-xs font-bold uppercase hover:bg-gray-50 flex items-center gap-2">
                        <RotateCcw size={14} /> Reset
                    </button>
                    <button className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase hover:bg-redwood-brand/90 flex items-center gap-2 shadow-md">
                        <Save size={14} /> Save Settings
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">

                <div className="flex gap-8 max-w-5xl mx-auto">
                    {/* Sidebar Tabs */}
                    <div className="w-64 shrink-0 space-y-1">
                        {[
                            { id: 'company', label: 'Company Info', icon: Building2 },
                            { id: 'users', label: 'User Defaults', icon: UserCog },
                            { id: 'distributors', label: 'Distributor Rules', icon: Truck },
                            { id: 'dealers', label: 'Dealer Rules', icon: Store },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase rounded-sm transition-all",
                                    activeTab === tab.id
                                        ? "bg-white text-redwood-brand border-l-4 border-redwood-brand shadow-sm"
                                        : "text-gray-500 hover:bg-gray-100/50 hover:text-gray-700"
                                )}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Settings Panel */}
                    <div className="flex-1 space-y-8">

                        {activeTab === 'company' && (
                            <div className="bg-white border border-redwood-border rounded-sm p-8 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                                <h2 className="text-lg font-black text-redwood-text-main uppercase mb-6 flex items-center gap-2">
                                    <Building2 size={20} className="text-gray-400" /> Company Information
                                </h2>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Company Name</label>
                                            <input type="text" defaultValue="ABC Corporation" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Legal Name</label>
                                            <input type="text" defaultValue="ABC Corp LLC" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tax ID (EIN)</label>
                                            <input type="text" defaultValue="12-3456789" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Incorporation State</label>
                                            <input type="text" defaultValue="Delaware" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Headquarters Address</label>
                                        <input type="text" defaultValue="123 Business St, New York, NY 10001" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div className="bg-white border border-redwood-border rounded-sm p-8 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                                <h2 className="text-lg font-black text-redwood-text-main uppercase mb-6 flex items-center gap-2">
                                    <UserCog size={20} className="text-gray-400" /> User Defaults
                                </h2>
                                <div className="space-y-6">
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-sm flex items-start gap-4">
                                        <Lock size={20} className="text-blue-600 mt-0.5" />
                                        <div>
                                            <h3 className="font-bold text-blue-900 mb-1">Security Policy</h3>
                                            <p className="text-sm text-blue-700">These settings apply to all new user accounts created in the system.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Default Role</label>
                                            <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold">
                                                <option>Employee</option>
                                                <option>Viewer</option>
                                                <option>Guest</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password Policy</label>
                                            <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold">
                                                <option>Strong (Sym + Num + Upper)</option>
                                                <option>Medium</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Session Timeout</label>
                                            <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold">
                                                <option>30 Minutes</option>
                                                <option>1 Hour</option>
                                                <option>4 Hours</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center pt-6">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input type="checkbox" defaultChecked className="w-5 h-5 text-redwood-brand rounded focus:ring-redwood-brand" />
                                                <span className="font-bold text-gray-700">Require 2FA for Admins</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'distributors' && (
                            <div className="bg-white border border-redwood-border rounded-sm p-8 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                                <h2 className="text-lg font-black text-redwood-text-main uppercase mb-6 flex items-center gap-2">
                                    <Truck size={20} className="text-gray-400" /> Distributor Rules
                                </h2>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Default Credit Limit</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                                <input type="text" defaultValue="100,000" className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold font-mono" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Auto-Approval Threshold</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                                <input type="text" defaultValue="50,000" className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold font-mono" />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Default Payment Terms</label>
                                        <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold">
                                            <option>Net 30 Days</option>
                                            <option>Net 60 Days</option>
                                            <option>Due on Receipt</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'dealers' && (
                            <div className="bg-white border border-redwood-border rounded-sm p-8 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                                <h2 className="text-lg font-black text-redwood-text-main uppercase mb-6 flex items-center gap-2">
                                    <Store size={20} className="text-gray-400" /> Dealer / Retailer Rules
                                </h2>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Default Credit Limit</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                                <input type="text" defaultValue="5,000" className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold font-mono" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Visit Frequency (Routes)</label>
                                            <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold">
                                                <option>Every 5 Days</option>
                                                <option>Weekly</option>
                                                <option>Bi-Weekly</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Default Payment Terms</label>
                                        <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold">
                                            <option>Net 15 Days</option>
                                            <option>Cash on Delivery</option>
                                        </select>
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
