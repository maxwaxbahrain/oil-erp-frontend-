import { useNavigate } from 'react-router-dom';
import {
    Users, Shield, Handshake, Store, Briefcase,
    Plus, Upload, Activity,
    BarChart2, Network
} from 'lucide-react';

export default function OrgDashboard() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter">Organization Dashboard</h1>
                        <p className="text-sm text-gray-500 font-medium mt-1">Welcome, Admin | ABC Corporation</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-white border border-redwood-border rounded-sm text-xs font-bold uppercase hover:bg-gray-50 flex items-center gap-2">
                            <Upload size={14} /> Bulk Import
                        </button>
                        <button
                            onClick={() => navigate('/users/hierarchy')}
                            className="px-4 py-2 bg-white border border-redwood-border rounded-sm text-xs font-bold uppercase hover:bg-gray-50 flex items-center gap-2"
                        >
                            <Network size={14} /> Org Chart
                        </button>
                    </div>
                </div>

                {/* Quick Stats Banner */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                    {[
                        { label: 'Total Users', value: '850' },
                        { label: 'Active Today', value: '780', color: 'text-emerald-600' },
                        { label: 'Branches', value: '45' },
                        { label: 'Partners', value: '308' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-gray-50 border border-gray-100 p-4 rounded-sm">
                            <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{stat.label}</div>
                            <div className={`text-2xl font-black mt-1 ${stat.color || 'text-gray-800'}`}>{stat.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">

                {/* Users & Employees */}
                <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                    <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded">
                                <Users size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-redwood-text-main uppercase tracking-tight">Users & Employees</h2>
                                <p className="text-xs text-gray-500">Manage internal staff, access levels, and departments</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-blue-600">850</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase">Total Users</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-8">
                        {/* Stats Column */}
                        <div className="col-span-1 space-y-4 border-r border-gray-100 pr-8">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Active Today</span>
                                    <span className="text-emerald-600">780</span>
                                </div>
                                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full w-[91%]"></div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Quick Stats</h3>
                                <ul className="space-y-2">
                                    <li className="flex justify-between text-xs text-gray-600"><span>Sales Team</span><span className="font-bold">180</span></li>
                                    <li className="flex justify-between text-xs text-gray-600"><span>Warehouse</span><span className="font-bold">85</span></li>
                                    <li className="flex justify-between text-xs text-gray-600"><span>Admin</span><span className="font-bold">65</span></li>
                                </ul>
                            </div>
                        </div>

                        {/* Actions Column */}
                        <div className="col-span-2 grid grid-cols-2 gap-4">
                            <button
                                onClick={() => navigate('/users/directory')}
                                className="group p-4 border border-gray-200 rounded-sm hover:border-blue-500 hover:shadow-md transition-all text-left bg-gray-50 hover:bg-white"
                            >
                                <div className="font-black text-blue-900 group-hover:text-blue-600 uppercase flex items-center gap-2 mb-1">
                                    <Users size={16} /> View Users
                                </div>
                                <div className="text-xs text-gray-500">Browse employee directory and profiles</div>
                            </button>

                            <button className="group p-4 border border-gray-200 rounded-sm hover:border-emerald-500 hover:shadow-md transition-all text-left bg-gray-50 hover:bg-white">
                                <div className="font-black text-emerald-900 group-hover:text-emerald-600 uppercase flex items-center gap-2 mb-1">
                                    <Plus size={16} /> Add New User
                                </div>
                                <div className="text-xs text-gray-500">Onboard a new employee to the system</div>
                            </button>

                            <button className="group p-4 border border-gray-200 rounded-sm hover:border-purple-500 hover:shadow-md transition-all text-left bg-gray-50 hover:bg-white">
                                <div className="font-black text-purple-900 group-hover:text-purple-600 uppercase flex items-center gap-2 mb-1">
                                    <BarChart2 size={16} /> User Reports
                                </div>
                                <div className="text-xs text-gray-500">Activity logs and performance data</div>
                            </button>

                            <button className="group p-4 border border-gray-200 rounded-sm hover:border-gray-400 hover:shadow-md transition-all text-left bg-gray-50 hover:bg-white">
                                <div className="font-black text-gray-700 group-hover:text-gray-900 uppercase flex items-center gap-2 mb-1">
                                    <Upload size={16} /> Bulk Import
                                </div>
                                <div className="text-xs text-gray-500">Upload CSV/Excel user data</div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Roles & Permissions */}
                <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                    <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 text-amber-600 rounded">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-redwood-text-main uppercase tracking-tight">Roles & Permissions</h2>
                                <p className="text-xs text-gray-500">Configure system access and security policies</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-amber-600">25</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase">Active Roles</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-8">
                        <div className="col-span-1 space-y-4 border-r border-gray-100 pr-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs font-bold text-gray-500">Custom Roles</div>
                                    <div className="text-lg font-black text-gray-800">10</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-gray-500">System Roles</div>
                                    <div className="text-lg font-black text-gray-800">15</div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Most Assigned</h3>
                                <ul className="space-y-2">
                                    <li className="flex justify-between text-xs text-gray-600"><span>Sales Manager</span><span className="font-bold">120</span></li>
                                    <li className="flex justify-between text-xs text-gray-600"><span>Van Salesman</span><span className="font-bold">180</span></li>
                                </ul>
                            </div>
                        </div>
                        <div className="col-span-2 grid grid-cols-2 gap-4">
                            <button
                                onClick={() => navigate('/users/roles')}
                                className="group p-4 border border-gray-200 rounded-sm hover:border-amber-500 hover:shadow-md transition-all text-left bg-gray-50 hover:bg-white"
                            >
                                <div className="font-black text-amber-900 group-hover:text-amber-600 uppercase flex items-center gap-2 mb-1">
                                    <Shield size={16} /> View Roles
                                </div>
                                <div className="text-xs text-gray-500">Manage role definitions and assignments</div>
                            </button>
                            <button
                                onClick={() => navigate('/users/roles')} // Assuming create is in same page or separate modal
                                className="group p-4 border border-gray-200 rounded-sm hover:border-emerald-500 hover:shadow-md transition-all text-left bg-gray-50 hover:bg-white"
                            >
                                <div className="font-black text-emerald-900 group-hover:text-emerald-600 uppercase flex items-center gap-2 mb-1">
                                    <Plus size={16} /> Create Role
                                </div>
                                <div className="text-xs text-gray-500">Define a new access role</div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Network Partners (Distributors / Dealers / Partners) */}
                <div className="grid grid-cols-2 gap-6">
                    {/* Distributors */}
                    <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
                                <Handshake size={20} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-sm font-black text-redwood-text-main uppercase">Distributors</h2>
                                <div className="text-[10px] text-gray-500">245 Active • Gold, Silver, Platinum</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => navigate('/users/distributors')}
                                className="p-3 border border-gray-200 rounded-sm hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
                            >
                                <span className="font-black text-xs uppercase block text-indigo-900">View All</span>
                            </button>
                            <button className="p-3 border border-gray-200 rounded-sm hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left">
                                <span className="font-black text-xs uppercase block text-emerald-900">+ Add New</span>
                            </button>
                        </div>
                    </div>

                    {/* Dealers */}
                    <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-orange-50 text-orange-600 rounded">
                                <Store size={20} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-sm font-black text-redwood-text-main uppercase">Dealers</h2>
                                <div className="text-[10px] text-gray-500">1,180 Active • Retail Network</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => navigate('/users/dealers')}
                                className="p-3 border border-gray-200 rounded-sm hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
                            >
                                <span className="font-black text-xs uppercase block text-orange-900">View All</span>
                            </button>
                            <button className="p-3 border border-gray-200 rounded-sm hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left">
                                <span className="font-black text-xs uppercase block text-emerald-900">+ Add New</span>
                            </button>
                        </div>
                    </div>

                    {/* Partners */}
                    <div className="col-span-2 bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-teal-50 text-teal-600 rounded">
                                    <Briefcase size={20} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-redwood-text-main uppercase">Strategic Partners</h2>
                                    <div className="text-[10px] text-gray-500">86 Active • Suppliers, Logistics, Tech</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate('/users/partners')}
                                    className="px-4 py-2 border border-gray-200 rounded-sm hover:bg-teal-50 text-xs font-bold uppercase text-teal-800"
                                >
                                    Manage Partners
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-gray-50 border border-gray-200 rounded-sm p-6">
                    <h3 className="text-xs font-black uppercase text-gray-500 tracking-widest mb-4 flex items-center gap-2">
                        <Activity size={14} /> Recent Organization Activity
                    </h3>
                    <div className="space-y-3">
                        {[
                            { time: '5 mins ago', action: 'New user added', detail: 'John Doe (Sales Manager)' },
                            { time: '1 hour ago', action: 'Distributor Registered', detail: 'XYZ Traders Inc.' },
                            { time: '2 hours ago', action: 'Role Updated', detail: 'Sales Manager permissions modified' },
                        ].map((act, i) => (
                            <div key={i} className="flex gap-4 text-xs">
                                <div className="text-gray-400 font-mono w-24 shrink-0">{act.time}</div>
                                <div className="font-bold text-gray-700">{act.action}</div>
                                <div className="text-gray-500">{act.detail}</div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
