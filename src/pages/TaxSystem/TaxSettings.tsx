import { useState } from 'react';
import {
    Settings, Save, Globe, Shield, RefreshCw, Bell, CreditCard
} from 'lucide-react';
import clsx from 'clsx';

export default function TaxSettings() {
    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Settings className="text-redwood-brand" /> Tax System Settings
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Global Configuration • Automation Rules • Notifications
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-redwood-brand/90 shadow-md">
                        <Save size={14} /> Save Changes
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Active Jurisdictions */}
                    <div className="bg-white border border-redwood-border rounded-sm p-8 shadow-sm">
                        <h2 className="text-lg font-black uppercase text-redwood-text-main mb-6 flex items-center gap-2">
                            <Globe size={20} className="text-gray-400" /> Active Tax Jurisdictions
                        </h2>
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-sm flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🇺🇸</span>
                                <div>
                                    <div className="font-black text-emerald-900">United States (Primary)</div>
                                    <div className="text-xs text-emerald-700">Fully Automated • Federal, State, Local</div>
                                </div>
                            </div>
                            <button className="px-3 py-1 bg-white border border-emerald-200 text-emerald-700 text-xs font-bold uppercase rounded hover:bg-emerald-50">Manage</button>
                        </div>
                        <div className="text-sm text-gray-600 mb-4">Select additional operating countries:</div>
                        <div className="grid grid-cols-3 gap-4">
                            {['🇧🇭 Bahrain', '🇦🇪 UAE', '🇵🇰 Pakistan'].map(country => (
                                <label key={country} className="flex items-center gap-3 p-3 border border-gray-200 rounded-sm cursor-pointer hover:bg-gray-50">
                                    <input type="checkbox" className="w-4 h-4 text-redwood-brand rounded focus:ring-redwood-brand" />
                                    <span className="text-sm font-bold text-gray-700">{country}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Automation Engine */}
                    <div className="bg-white border border-redwood-border rounded-sm p-8 shadow-sm">
                        <h2 className="text-lg font-black uppercase text-redwood-text-main mb-6 flex items-center gap-2">
                            <RefreshCw size={20} className="text-gray-400" /> Automation Engine
                        </h2>
                        <div className="space-y-4">
                            {[
                                'Auto-calculate tax on all transactions',
                                'Real-time tax rate updates (Daily)',
                                'Auto-file tax returns on due dates',
                                'Auto-pay tax liabilities via ACH',
                                'Apply product-level tax exemptions automatically'
                            ].map((item, i) => (
                                <label key={i} className="flex items-center justify-between p-3 border-b border-gray-50 hover:bg-gray-50">
                                    <span className="text-sm font-medium text-gray-800">{item}</span>
                                    <div className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" defaultChecked className="sr-only peer" />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-redwood-brand"></div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Safety & Compliance */}
                    <div className="bg-white border border-redwood-border rounded-sm p-8 shadow-sm">
                        <h2 className="text-lg font-black uppercase text-redwood-text-main mb-6 flex items-center gap-2">
                            <Shield size={20} className="text-gray-400" /> Safety Protocols
                        </h2>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Manual Review Threshold</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input type="text" defaultValue="10,000.00" className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold" />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Filings above this amount require human approval.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tax Logic Provider</label>
                                <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm font-bold text-gray-700">
                                    <option>Avalara (Global)</option>
                                    <option>Vertex (USA)</option>
                                    <option>TaxJar</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="bg-white border border-redwood-border rounded-sm p-8 shadow-sm">
                        <h2 className="text-lg font-black uppercase text-redwood-text-main mb-6 flex items-center gap-2">
                            <Bell size={20} className="text-gray-400" /> Notifications
                        </h2>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Filing Deadlines', checked: true },
                                { label: 'Payment Dues', checked: true },
                                { label: 'Nexus Warnings', checked: true },
                                { label: 'Rate Changes', checked: false },
                                { label: 'New Legislation', checked: true },
                                { label: 'Audit Alerts', checked: true }
                            ].map(notif => (
                                <label key={notif.label} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" defaultChecked={notif.checked} className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500" />
                                    <span className="text-sm text-gray-700">{notif.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
