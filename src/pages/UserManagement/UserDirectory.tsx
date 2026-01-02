import { useState } from 'react';
import {
    Search, Filter, Plus, Users, Mail, Phone, MapPin,
    MoreHorizontal, Shield, Briefcase, Download, CornerUpLeft
} from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

const USERS = [
    { id: 'USR-001', name: 'John Smith', role: 'Sales Manager', department: 'Sales', branch: 'New York Branch', status: 'Active', email: 'john.smith@company.com', phone: '+1-212-555-0101', avatar: 'JS' },
    { id: 'USR-002', name: 'Sarah Johnson', role: 'Regional Director', department: 'Management', branch: 'North America HQ', status: 'Active', email: 'sarah.j@company.com', phone: '+1-212-555-0102', avatar: 'SJ' },
    { id: 'USR-003', name: 'Mike Ross', role: 'Sales Executive', department: 'Sales', branch: 'New York Branch', status: 'Inactive', email: 'mike.ross@company.com', phone: '+1-212-555-0103', avatar: 'MR' },
];

export default function UserDirectory() {
    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <Link to="/users/dashboard" className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 hover:text-redwood-brand mb-2">
                        <CornerUpLeft size={12} /> Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Users className="text-redwood-brand" /> User Management
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Directory • Roles • Access Control
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-redwood-border rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-gray-50">
                        <Download size={14} /> Export
                    </button>
                    <Link to="/users/create" className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-redwood-brand/90 shadow-md">
                        <Plus size={14} /> Add User
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="p-8 pb-4 grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Users', value: '850', color: 'text-blue-600' },
                    { label: 'Active', value: '780', color: 'text-emerald-600' },
                    { label: 'Inactive', value: '70', color: 'text-gray-400' },
                    { label: 'New This Month', value: '12', color: 'text-purple-600' }
                ].map(stat => (
                    <div key={stat.label} className="bg-white border border-redwood-border p-4 rounded-sm shadow-sm">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{stat.label}</div>
                        <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters & List */}
            <div className="flex-1 overflow-hidden p-8 pt-0 flex flex-col">
                <div className="bg-white border border-redwood-border rounded-sm shadow-sm flex flex-col h-full">
                    {/* Filter Bar */}
                    <div className="p-4 border-b border-redwood-border flex gap-4 items-center bg-gray-50">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input type="text" placeholder="Search by name, email, ID..." className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-redwood-brand" />
                        </div>
                        <div className="h-6 w-px bg-gray-300 mx-2"></div>
                        <div className="flex gap-2">
                            {['Role', 'Branch', 'Status', 'Department'].map(f => (
                                <button key={f} className="px-4 py-2 bg-white border border-gray-200 rounded-sm text-xs font-bold text-gray-600 uppercase flex items-center gap-2 hover:bg-gray-50">
                                    {f} <Filter size={12} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 custom-scrollbar">
                        {USERS.map(user => (
                            <div key={user.id} className="bg-white border border-redwood-border rounded-sm p-4 flex items-start gap-4 hover:shadow-md transition-shadow group relative">
                                {/* Actions Overlay */}
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button className="px-3 py-1 bg-white border border-gray-200 text-xs font-bold uppercase rounded hover:bg-gray-50">Edit</button>
                                    <button className="px-3 py-1 bg-white border border-gray-200 text-xs font-bold uppercase rounded hover:bg-gray-50">View</button>
                                </div>

                                <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center font-black text-xl text-gray-400">
                                    {user.avatar}
                                </div>
                                <div className="flex-1 grid grid-cols-4 gap-4">
                                    <div className="col-span-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-black text-redwood-text-main text-lg">{user.name}</h3>
                                            <span className={clsx("px-2 py-0.5 rounded text-[9px] font-black uppercase", user.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                                                {user.status}
                                            </span>
                                        </div>
                                        <div className="text-[10px] font-mono text-gray-400">{user.id}</div>
                                        <div className="mt-3 flex gap-2">
                                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded flex items-center gap-2 text-[10px] font-bold uppercase">
                                                <Shield size={12} /> {user.role}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-1 border-l border-gray-100 pl-4 space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <Mail size={12} className="text-gray-400" /> {user.email}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <Phone size={12} className="text-gray-400" /> {user.phone}
                                        </div>
                                    </div>

                                    <div className="col-span-1 border-l border-gray-100 pl-4 space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <Briefcase size={12} className="text-gray-400" /> {user.department}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <MapPin size={12} className="text-gray-400" /> {user.branch}
                                        </div>
                                    </div>

                                    <div className="col-span-1 border-l border-gray-100 pl-4">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-2">System Access</div>
                                        <div className="text-xs font-medium">Last login: Today, 9:00 AM</div>
                                        <div className="text-xs font-medium text-gray-500">192.168.1.1</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination Footer */}
                    <div className="p-3 border-t border-redwood-border bg-gray-50 flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                        <div>Showing 1-3 of 850 users</div>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 bg-white border border-gray-200 rounded hover:bg-gray-100">Prev</button>
                            <button className="px-3 py-1 bg-white border border-gray-200 rounded hover:bg-gray-100">Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
