import {
    Briefcase, Truck, Code, Factory,
    MoreHorizontal, ExternalLink, Plus, CornerUpLeft
} from 'lucide-react';
import clsx from 'clsx';

const PARTNERS = [
    {
        type: 'Strategic Partners', icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50', list: [
            { name: 'Global Enterprise Corp', id: 'PRT-001', role: 'Joint Venture', status: 'Active' },
            { name: 'MegaCorp Intl', id: 'PRT-002', role: 'Strategic Alliance', status: 'Active' }
        ]
    },
    {
        type: 'Suppliers / Vendors', icon: Factory, color: 'text-blue-600', bg: 'bg-blue-50', list: [
            { name: 'Raw Materials Co.', id: 'SUP-001', role: 'Primary Supplier', status: 'Active' },
            { name: 'Packaging Solutions', id: 'SUP-002', role: 'Packaging Vendor', status: 'Active' }
        ]
    },
    {
        type: 'Logistics Partners', icon: Truck, color: 'text-emerald-600', bg: 'bg-emerald-50', list: [
            { name: 'FastTrack Logistics', id: 'LOG-001', role: 'Shipping', status: 'Active' },
            { name: 'Ocean Freight Ltd', id: 'LOG-002', role: 'International', status: 'Active' }
        ]
    },
    {
        type: 'Technology Partners', icon: Code, color: 'text-purple-600', bg: 'bg-purple-50', list: [
            { name: 'Cisco Systems', id: 'TEC-001', role: 'Networking', status: 'Active' },
            { name: 'Oracle', id: 'TEC-002', role: 'Software', status: 'Active' }
        ]
    }
];

import { Link } from 'react-router-dom';

// ...

export default function PartnerDirectory() {
    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <Link to="/users/dashboard" className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 hover:text-redwood-brand mb-2">
                        <CornerUpLeft size={12} /> Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Briefcase className="text-redwood-brand" /> Partner Management
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Suppliers • Logistics • Strategic Alliances
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-redwood-brand/90 shadow-md">
                        <Plus size={14} /> Add Partner
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                {PARTNERS.map((category, idx) => (
                    <div key={idx} className="space-y-4">
                        <h2 className="flex items-center gap-3 text-lg font-black text-redwood-text-main">
                            <div className={clsx("p-2 rounded-sm", category.bg)}>
                                <category.icon size={20} className={category.color} />
                            </div>
                            {category.type}
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {category.list.map(partner => (
                                <div key={partner.id} className="bg-white border border-redwood-border rounded-sm p-5 hover:shadow-md transition-shadow group">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-redwood-text-main">{partner.name}</h3>
                                        <button className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"><MoreHorizontal size={16} /></button>
                                    </div>
                                    <div className="text-xs text-gray-500 mb-4">{partner.role} • <span className="font-mono">{partner.id}</span></div>

                                    <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                            {partner.status}
                                        </span>
                                        <button className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1 hover:underline">
                                            View Profile <ExternalLink size={10} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Add New Placeholder Card */}
                            <div className="border-2 border-dashed border-gray-200 rounded-sm flex flex-col items-center justify-center p-6 text-gray-400 hover:bg-gray-50 hover:border-gray-300 cursor-pointer transition-colors min-h-[140px]">
                                <Plus size={24} className="mb-2" />
                                <div className="text-xs font-bold uppercase">Add {category.type.split(' ')[0]}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
