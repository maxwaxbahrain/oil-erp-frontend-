import { useState } from 'react';
import {
    LayoutDashboard, Map, Truck, Package, FileText,
    Settings, Search, Filter,
    CheckCircle, XCircle, Clock, Download, Printer,
    BarChart2, Bell, LogOut, Shield, MessageSquare
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import clsx from 'clsx';

// --- Types ---
type ViewState = 'login' | 'dashboard' | 'map' | 'deliveries' | 'drivers' | 'reports' | 'settings' | 'communication';

// --- Mock Data ---
const DRIVERS = [
    { id: 'DRV-001', name: 'Mike Johnson', status: 'Active', online: true, completed: 12, total: 15, rating: 4.8, location: 'Brooklyn, NY', vehicle: 'Van-001' },
    { id: 'DRV-002', name: 'Tom Baker', status: 'Active', online: true, completed: 10, total: 12, rating: 4.5, location: 'Manhattan, NY', vehicle: 'Van-002' },
    { id: 'DRV-003', name: 'John Doe', status: 'Break', online: true, completed: 8, total: 10, rating: 4.6, location: 'Queens, NY', vehicle: 'Van-003' },
    { id: 'DRV-004', name: 'Sarah Miller', status: 'Offline', online: false, completed: 0, total: 10, rating: 4.9, location: 'Warehouse', vehicle: 'Van-004' },
];

const DELIVERIES = [
    { id: '#12345', customer: 'John Smith', address: '123 Main St, New York', driver: 'Mike Johnson', status: 'Completed', time: '2:45 PM', pod: true, cod: 150 },
    { id: '#12346', customer: 'Sarah Lee', address: '456 Oak Ave, Brooklyn', driver: 'Tom Baker', status: 'In Transit', time: '3:15 PM', pod: false, cod: 0 },
    { id: '#12347', customer: 'Mike Tyson', address: '789 Elm Rd, Queens', driver: 'John Doe', status: 'Pending', time: '4:00 PM', pod: false, cod: 200 },
    { id: '#12348', customer: 'Lisa Mona', address: '321 Pine Ln, Bronx', driver: 'Mike Johnson', status: 'Failed', time: '5:30 PM', pod: false, cod: 0, reason: 'Not Home' },
    { id: '#12349', customer: 'Bob Ross', address: '555 Art Blvd, Manhattan', driver: 'Tom Baker', status: 'Completed', time: '1:00 PM', pod: true, cod: 0 },
];

const STATS = {
    total: 150,
    completed: 95,
    pending: 45,
    failed: 10,
    successRate: 90.5,
    activeDrivers: 12,
    codCollected: 12450
};

export default function PODDashboard() {
    const [view, setView] = useState<ViewState>('dashboard');
    const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false); // Simulating Login

    // Login Component
    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-redwood-midnight flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-redwood-brand rounded-lg flex items-center justify-center">
                            <Truck size={32} className="text-white" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-black text-center text-redwood-text-main mb-2 uppercase tracking-tight">POD Dashboard Login</h2>
                    <p className="text-center text-redwood-text-muted text-sm mb-8">Enter your credentials to access the monitoring system</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-redwood-text-muted uppercase mb-1">Username</label>
                            <input type="text" className="w-full p-3 border border-redwood-border rounded-sm bg-redwood-bg-light focus:outline-none focus:border-redwood-brand" placeholder="admin@company.com" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-redwood-text-muted uppercase mb-1">Password</label>
                            <input type="password" className="w-full p-3 border border-redwood-border rounded-sm bg-redwood-bg-light focus:outline-none focus:border-redwood-brand" placeholder="••••••••" />
                        </div>
                        <button
                            onClick={() => setIsLoggedIn(true)}
                            className="w-full py-4 bg-redwood-brand text-white font-black uppercase tracking-widest rounded-sm hover:bg-redwood-brand/90 transition-all shadow-lg hover:shadow-xl translate-y-0 hover:-translate-y-0.5"
                        >
                            Access Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Main Layout
    return (
        <div className="flex h-[calc(100vh-64px)] bg-redwood-bg-light overflow-hidden">
            {/* Sidebar Navigation (Internal) */}
            <aside className="w-64 bg-white border-r border-redwood-border flex flex-col hidden lg:flex">
                <div className="p-6 border-b border-redwood-border">
                    <h2 className="text-sm font-black text-redwood-text-main uppercase tracking-wider flex items-center gap-2">
                        <Shield className="text-emerald-600" size={18} /> Admin Console
                    </h2>
                    <p className="text-[10px] text-redwood-text-muted mt-1">Logged in as Administrator</p>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                    {[
                        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
                        { id: 'map', label: 'Live Tracking', icon: Map },
                        { id: 'deliveries', label: 'All Deliveries', icon: Package },
                        { id: 'drivers', label: 'Driver Management', icon: Truck },
                        { id: 'reports', label: 'Reports & Analytics', icon: BarChart2 },
                        { id: 'communication', label: 'Customer Comms', icon: MessageSquare },
                        { id: 'settings', label: 'System Settings', icon: Settings },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id as ViewState)}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-sm transition-all text-xs font-bold uppercase tracking-wide",
                                view === item.id
                                    ? "bg-redwood-brand text-white shadow-md"
                                    : "text-redwood-text-muted hover:bg-redwood-bg-light hover:text-redwood-text-main"
                            )}
                        >
                            <item.icon size={16} />
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-redwood-border">
                    <button onClick={() => setIsLoggedIn(false)} className="w-full flex items-center gap-3 px-4 py-3 text-rose-600 hover:bg-rose-50 rounded-sm text-xs font-bold uppercase tracking-wide transition-all">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-8 relative">
                {/* Header Actions */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter">
                            {view === 'dashboard' ? 'Delivery Dashboard' : view.replace('-', ' ')}
                        </h1>
                        <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="p-2 bg-white border border-redwood-border rounded-full hover:bg-redwood-bg-light relative">
                            <Bell size={18} className="text-redwood-text-muted" />
                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                        </button>
                    </div>
                </div>

                {/* VIEW: DASHBOARD */}
                {view === 'dashboard' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: 'Total Deliveries', value: STATS.total, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Completed', value: STATS.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Pending', value: STATS.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                                { label: 'Failed', value: STATS.failed, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                            ].map((stat, i) => (
                                <div key={i} className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-redwood-text-muted tracking-widest mb-1">{stat.label}</div>
                                        <div className="text-3xl font-black text-redwood-text-main">{stat.value}</div>
                                    </div>
                                    <div className={clsx("p-3 rounded-full", stat.bg, stat.color)}>
                                        <stat.icon size={24} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Active Operations */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Live Map Placeholder */}
                            <div className="lg:col-span-2 bg-white border border-redwood-border rounded-sm p-1 shadow-sm h-[400px] relative overflow-hidden group">
                                <div className="absolute inset-0 bg-redwood-bg-light flex items-center justify-center">
                                    <div className="text-center opacity-30">
                                        <Map size={64} className="mx-auto mb-4" />
                                        <h3 className="text-xl font-black uppercase">Live Map View</h3>
                                    </div>
                                    {/* Simulated Pins */}
                                    <div className="absolute top-1/4 left-1/4 animate-bounce duration-[2000ms]"><Truck size={20} className="text-blue-600 drop-shadow-md" /></div>
                                    <div className="absolute top-1/2 left-1/2 animate-bounce duration-[2500ms]"><Truck size={20} className="text-emerald-600 drop-shadow-md" /></div>
                                    <div className="absolute bottom-1/3 right-1/4 animate-bounce duration-[3000ms]"><Truck size={20} className="text-amber-600 drop-shadow-md" /></div>
                                </div>
                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-sm border border-redwood-border text-xs font-bold uppercase shadow-sm">
                                    12 Active Drivers
                                </div>
                            </div>

                            {/* Charts Section */}
                            <div className="space-y-6">
                                {/* Delivery Trends Chart */}
                                <div className="bg-white border border-redwood-border rounded-sm p-4 shadow-sm h-64">
                                    <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Delivery Volume (7 Days)</h3>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={[
                                            { day: 'Mon', count: 120 }, { day: 'Tue', count: 132 }, { day: 'Wed', count: 101 },
                                            { day: 'Thu', count: 134 }, { day: 'Fri', count: 154 }, { day: 'Sat', count: 100 }, { day: 'Sun', count: 80 }
                                        ]}>
                                            <defs>
                                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#C74634" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#C74634" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', color: '#fff', fontSize: '12px', borderRadius: '4px', border: 'none' }} />
                                            <Area type="monotone" dataKey="count" stroke="#C74634" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Driver Status Chart */}
                                <div className="bg-white border border-redwood-border rounded-sm p-4 shadow-sm h-64 flex flex-col">
                                    <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-2">Driver Status Distribution</h3>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Active', value: 12, color: '#10B981' },
                                                        { name: 'Break', value: 2, color: '#F59E0B' },
                                                        { name: 'Offline', value: 1, color: '#EF4444' }
                                                    ]}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={40}
                                                    outerRadius={60}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {[
                                                        { name: 'Active', value: 12, color: '#10B981' },
                                                        { name: 'Break', value: 2, color: '#F59E0B' },
                                                        { name: 'Offline', value: 1, color: '#EF4444' }
                                                    ].map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-center gap-4 text-[10px] font-bold uppercase text-gray-500 mt-2">
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Active</div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Break</div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Offline</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW: DELIVERIES (List) */}
                {view === 'deliveries' && (
                    <div className="bg-white border border-redwood-border rounded-sm shadow-sm animate-in slide-in-from-bottom-2 duration-500">
                        {/* Filters */}
                        <div className="p-4 border-b border-redwood-border flex flex-wrap gap-4 items-center justify-between bg-redwood-bg-light/30">
                            <div className="flex gap-2">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-redwood-text-muted" />
                                    <input type="text" placeholder="Search orders..." className="pl-9 pr-4 py-2 bg-white border border-redwood-border rounded-sm text-sm focus:outline-none focus:border-redwood-brand w-64" />
                                </div>
                                <button className="px-4 py-2 bg-white border border-redwood-border rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-redwood-bg-light">
                                    <Filter size={14} /> Filter
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <button className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-redwood-brand/90 transition-all">
                                    <Download size={14} /> Export
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <table className="w-full text-left text-sm">
                            <thead className="bg-redwood-bg-light text-[10px] font-black uppercase text-redwood-text-muted tracking-widest">
                                <tr>
                                    <th className="p-4">Order ID</th>
                                    <th className="p-4">Customer</th>
                                    <th className="p-4">Driver</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-redwood-border">
                                {DELIVERIES.map((order) => (
                                    <tr key={order.id} className="hover:bg-redwood-bg-light/50 transition-colors">
                                        <td className="p-4 font-bold text-redwood-text-main">{order.id}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-redwood-text-main">{order.customer}</div>
                                            <div className="text-xs text-redwood-text-muted">{order.address}</div>
                                        </td>
                                        <td className="p-4 font-medium text-redwood-text-main">{order.driver}</td>
                                        <td className="p-4">
                                            <span className={clsx(
                                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                                    order.status === 'Failed' ? 'bg-rose-100 text-rose-700' :
                                                        order.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-blue-100 text-blue-700'
                                            )}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedDelivery(order)}
                                                className="text-xs font-bold text-redwood-brand hover:underline uppercase tracking-wide"
                                            >
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* VIEW: DRIVERS */}
                {view === 'drivers' && (
                    <div className="bg-white border border-redwood-border rounded-sm shadow-sm p-6 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {DRIVERS.map((driver) => (
                                <div key={driver.id} className="border border-redwood-border rounded-sm p-6 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">
                                                {driver.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-black text-redwood-text-main">{driver.name}</div>
                                                <div className="text-xs text-redwood-text-muted">{driver.id}</div>
                                            </div>
                                        </div>
                                        <div className={clsx("w-3 h-3 rounded-full", driver.online ? 'bg-emerald-500' : 'bg-gray-300')}></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                                        <div>
                                            <span className="text-gray-400">Completed</span>
                                            <div className="font-bold text-redwood-text-main">{driver.completed}/{driver.total}</div>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Rating</span>
                                            <div className="font-bold text-amber-500">{driver.rating} ⭐</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="flex-1 py-2 border border-redwood-border rounded-sm text-xs font-bold uppercase hover:bg-redwood-bg-light">Track</button>
                                        <button className="flex-1 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase hover:bg-redwood-brand/90">Contact</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VIEW: REPORTS */}
                {view === 'reports' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-white border border-redwood-border rounded-sm p-8 text-center py-20">
                            <BarChart2 size={48} className="mx-auto text-redwood-brand mb-4 opacity-20" />
                            <h3 className="text-xl font-black text-redwood-text-main uppercase">Advanced Analytics Suite</h3>
                            <p className="text-redwood-text-muted mt-2">Generate comprehensive performance reports, heatmaps, and trend analysis.</p>
                            <button className="mt-6 px-6 py-3 bg-redwood-brand text-white font-bold uppercase text-xs rounded-sm hover:bg-redwood-brand/90 transition-all">
                                Generate Daily Report
                            </button>
                        </div>
                    </div>
                )}

                {/* MODAL: DELIVERY DETAILS / POD */}
                {selectedDelivery && (
                    <div className="fixed inset-0 bg-redwood-midnight/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-2xl rounded-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-redwood-brand text-white p-4 flex justify-between items-center">
                                <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                                    <FileText size={16} /> Delivery Details: {selectedDelivery.id}
                                </h3>
                                <button onClick={() => setSelectedDelivery(null)} className="hover:bg-white/10 p-1 rounded"><XCircle size={20} /></button>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h4 className="text-xs font-black text-redwood-text-muted uppercase tracking-widest mb-4 border-b pb-2">Order Info</h4>
                                    <dl className="space-y-3 text-sm">
                                        <div className="flex justify-between"><dt className="text-gray-500">Customer</dt><dd className="font-bold">{selectedDelivery.customer}</dd></div>
                                        <div className="flex justify-between"><dt className="text-gray-500">Address</dt><dd className="font-bold text-right">{selectedDelivery.address}</dd></div>
                                        <div className="flex justify-between"><dt className="text-gray-500">Time</dt><dd className="font-bold">{selectedDelivery.time}</dd></div>
                                        <div className="flex justify-between"><dt className="text-gray-500">COD Amount</dt><dd className="font-bold text-emerald-600">${selectedDelivery.cod}</dd></div>
                                    </dl>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-redwood-text-muted uppercase tracking-widest mb-4 border-b pb-2">POD Status</h4>
                                    {selectedDelivery.pod ? (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-4 text-center">
                                            <CheckCircle className="mx-auto text-emerald-600 mb-2" size={32} />
                                            <div className="font-bold text-emerald-800 text-sm">Successfully Delivered</div>
                                            <div className="text-xs text-emerald-600 mt-1">Signature Captured • GPS Verified</div>
                                            <button className="mt-4 w-full py-2 bg-white border border-emerald-200 rounded-sm text-xs font-bold text-emerald-700 uppercase flex items-center justify-center gap-2 hover:bg-emerald-100">
                                                <Download size={12} /> Download Certificate
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 border border-gray-200 rounded-sm p-4 text-center">
                                            <Clock className="mx-auto text-gray-400 mb-2" size={32} />
                                            <div className="font-bold text-gray-600 text-sm">Proof of Delivery Pending</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => setSelectedDelivery(null)} className="px-4 py-2 bg-white border border-gray-300 rounded-sm text-xs font-bold uppercase hover:bg-gray-50">Close</button>
                                <button className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase hover:bg-redwood-brand/90 flex items-center gap-2">
                                    <Printer size={14} /> Print POD
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
