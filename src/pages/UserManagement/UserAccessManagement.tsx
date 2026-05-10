import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Plus, Edit2, Trash2, Check, X,
    ChevronDown, ChevronRight, Users, Lock, Unlock
} from 'lucide-react';
import {
    getUsers, saveUser, deleteUser, getCurrentUser,
    ROLE_DEFINITIONS, MODULE_ACCESS,
    type User, type Role
} from '../../store/authStore';

const ALL_MODULES = [
    { key: 'dashboard', label: 'Dashboard', group: 'Core' },
    { key: 'customers', label: 'Customers', group: 'Sales' },
    { key: 'orders', label: 'Sales Orders', group: 'Sales' },
    { key: 'invoices', label: 'Invoices', group: 'Sales' },
    { key: 'quotations', label: 'Quotations', group: 'Sales' },
    { key: 'sales_returns', label: 'Sales Returns', group: 'Sales' },
    { key: 'credit_notes', label: 'Credit Notes', group: 'Sales' },
    { key: 'pod', label: 'POD — Driver App', group: 'Logistics' },
    { key: 'van_operations', label: 'Van Operations', group: 'Logistics' },
    { key: 'route_navigator', label: 'Route Navigator', group: 'Logistics' },
    { key: 'product_catalog', label: 'Product Catalog', group: 'Inventory' },
    { key: 'inventory_reports', label: 'Inventory Reports', group: 'Inventory' },
    { key: 'stock_adjustment', label: 'Stock Adjustment', group: 'Inventory' },
    { key: 'suppliers', label: 'Suppliers', group: 'Procurement' },
    { key: 'purchase_orders', label: 'Purchase Orders', group: 'Procurement' },
    { key: 'grn', label: 'GRN / Material Receipt', group: 'Procurement' },
    { key: 'banking', label: 'Banking', group: 'Finance' },
    { key: 'chart_of_accounts', label: 'Chart of Accounts', group: 'Finance' },
    { key: 'journal_voucher', label: 'Journal Voucher', group: 'Finance' },
    { key: 'bad_debts', label: 'Bad Debts Write-Off', group: 'Finance' },
    { key: 'payment_edit', label: 'Edit Payments', group: 'Finance' },
    { key: 'expenses', label: 'Expenses', group: 'Finance' },
    { key: 'financial_reports', label: 'Financial Reports', group: 'Reports' },
    { key: 'demand_forecast', label: 'Demand Forecast', group: 'Reports' },
    { key: 'price_lists', label: 'Price Lists', group: 'Reports' },
    { key: 'recurring_invoices', label: 'Recurring Invoices', group: 'Reports' },
    { key: 'ai_features', label: 'AI Features', group: 'AI' },
    { key: 'agents', label: 'AI Agents', group: 'AI' },
    { key: 'user_management', label: 'User Management', group: 'Admin' },
    { key: 'settings', label: 'Settings', group: 'Admin' },
];

const GROUPS = [...new Set(ALL_MODULES.map(m => m.group))];

const emptyUser = (): Omit<User, 'id' | 'createdAt'> => ({
    name: '', email: '', role: 'salesman', isActive: true, permissions: {},
});

export default function UserAccessManagement() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newUser, setNewUser] = useState(emptyUser());
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(GROUPS));
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');

    useEffect(() => { setUsers(getUsers()); }, []);

    // Guard — only owner can access
    if (currentUser.role !== 'owner') {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <Lock size={48} className="text-gray-200 mb-4" />
                <p className="text-gray-500 font-black text-lg">Access Restricted</p>
                <p className="text-gray-400 text-sm mt-1">Only the Owner can manage user access.</p>
                <button onClick={() => navigate(-1)} className="mt-4 px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-black">Go Back</button>
            </div>
        );
    }

    const handleSaveUser = () => {
        if (!newUser.name.trim() || !newUser.email.trim()) { alert('Name and email are required.'); return; }
        setSaving(true);
        const user: User = {
            ...newUser,
            id: selectedUser?.id || `USR-${Date.now()}`,
            createdAt: selectedUser?.createdAt || new Date().toISOString().slice(0, 10),
        };
        saveUser(user);
        setUsers(getUsers());
        setShowAddForm(false);
        setSelectedUser(user);
        setNewUser(emptyUser());
        setSaving(false);
        setSuccess(`✅ ${user.name} saved successfully`);
        setTimeout(() => setSuccess(''), 3000);
    };

    const handleDeleteUser = (id: string) => {
        if (id === 'USR-001') { alert('Cannot delete the primary admin account.'); return; }
        if (!confirm('Delete this user? They will lose all access immediately.')) return;
        deleteUser(id);
        setUsers(getUsers());
        if (selectedUser?.id === id) setSelectedUser(null);
    };

    const togglePermission = (userId: string, moduleKey: string) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        const perms: Record<string,string[]> = { ...(user.permissions || {}) };
        const roleDefault = (MODULE_ACCESS[moduleKey] || []).includes(user.role);
        if (perms[moduleKey]) {
            delete perms[moduleKey];
        } else {
            perms[moduleKey] = roleDefault ? [] : ['access']; // Toggle
        }
        const updated = { ...user, permissions: perms };
        saveUser(updated);
        setUsers(getUsers());
        setSelectedUser(updated);
    };

    const hasAccess = (user: User, moduleKey: string): boolean => {
        if (user.role === 'owner') return true;
        if (user.permissions?.[moduleKey] !== undefined) {
            return user.permissions[moduleKey].includes('access');
        }
        return (MODULE_ACCESS[moduleKey] || []).includes(user.role);
    };

    const openEdit = (user: User) => {
        setSelectedUser(user);
        setNewUser({ name: user.name, email: user.email, role: user.role, phone: user.phone, isActive: user.isActive, permissions: user.permissions || {} });
        setShowAddForm(true);
        setEditMode(true);
    };

    return (
        <div className="space-y-5 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-300">

            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                            <Shield size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">User Access Management</h1>
                            <p className="text-gray-400 text-xs mt-0.5">Control who can see and do what — like SAP · {users.length} users configured</p>
                        </div>
                    </div>
                    <button onClick={() => { setEditMode(false); setNewUser(emptyUser()); setShowAddForm(!showAddForm); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-black transition-all">
                        <Plus size={16} /> Add User
                    </button>
                </div>
            </div>

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-bold text-emerald-700 flex items-center gap-2">
                    <Check size={16} /> {success}
                </div>
            )}

            {/* Add / Edit Form */}
            {showAddForm && (
                <div className="bg-white border-2 border-purple-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-sm font-black text-purple-700 uppercase tracking-widest">
                            {editMode ? '✏️ Edit User' : '➕ Add New User'}
                        </h2>
                        <button onClick={() => setShowAddForm(false)} className="w-7 h-7 bg-gray-100 hover:bg-red-50 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 transition-all">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Full Name *</label>
                            <input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Ahmed Al-Rashid"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Email *</label>
                            <input value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                                placeholder="ahmed@bettano.com"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Phone</label>
                            <input value={newUser.phone || ''} onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))}
                                placeholder="+1 347 000 0000"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Role *</label>
                            <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value as Role }))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400">
                                {(Object.entries(ROLE_DEFINITIONS) as [Role, any][]).map(([key, def]) => (
                                    <option key={key} value={key}>{def.icon} {def.label}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">{ROLE_DEFINITIONS[newUser.role]?.description}</p>
                        </div>
                        <div className="flex items-end gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={newUser.isActive} onChange={e => setNewUser(p => ({ ...p, isActive: e.target.checked }))} className="accent-purple-600" />
                                <span className="text-sm font-bold text-gray-700">Active Account</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-5">
                        <button onClick={handleSaveUser} disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 transition-all disabled:opacity-50">
                            <Check size={14} /> {editMode ? 'Save Changes' : 'Create User'}
                        </button>
                        <button onClick={() => setShowAddForm(false)}
                            className="px-4 py-2.5 text-sm font-black text-gray-400 hover:text-gray-700 transition-all">Cancel</button>
                    </div>
                </div>
            )}

            {/* Main Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

                {/* User List */}
                <div className="xl:col-span-4 space-y-2">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest px-1 mb-3">Users ({users.length})</p>
                    {users.map(user => {
                        const role = ROLE_DEFINITIONS[user.role];
                        const isSelected = selectedUser?.id === user.id;
                        return (
                            <div key={user.id}
                                onClick={() => setSelectedUser(isSelected ? null : user)}
                                className={`bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all ${isSelected ? 'border-purple-400 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${role.bgColor}`}>
                                            {role.icon}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-900">{user.name}</p>
                                            <p className="text-[10px] text-gray-400">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${role.bgColor} ${role.color}`}>{role.label}</span>
                                        {!user.isActive && <span className="text-[10px] bg-red-100 text-red-600 font-black px-2 py-0.5 rounded-full">Inactive</span>}
                                    </div>
                                </div>
                                {isSelected && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                                        <button onClick={e => { e.stopPropagation(); openEdit(user); }}
                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 rounded-lg text-xs font-black transition-all">
                                            <Edit2 size={11} /> Edit
                                        </button>
                                        {user.id !== 'USR-001' && (
                                            <button onClick={e => { e.stopPropagation(); handleDeleteUser(user.id); }}
                                                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-lg text-xs font-black transition-all">
                                                <Trash2 size={11} /> Delete
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Permission Matrix */}
                <div className="xl:col-span-8">
                    {selectedUser ? (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="bg-gray-900 px-5 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{ROLE_DEFINITIONS[selectedUser.role].icon}</span>
                                    <div>
                                        <p className="text-sm font-black text-white">{selectedUser.name}</p>
                                        <p className="text-[10px] text-gray-400">{ROLE_DEFINITIONS[selectedUser.role].label} · {selectedUser.email}</p>
                                    </div>
                                </div>
                                <div>
                                    {selectedUser.role === 'owner' ? (
                                        <span className="text-[10px] font-black text-purple-400 bg-purple-500/20 px-3 py-1.5 rounded-full">Full Access — Cannot Restrict</span>
                                    ) : (
                                        <span className="text-[10px] text-gray-400">Click 🔓/🔒 to toggle access per module</span>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 space-y-3 max-h-[620px] overflow-y-auto">
                                {GROUPS.map(group => {
                                    const groupMods = ALL_MODULES.filter(m => m.group === group);
                                    const isExpanded = expandedGroups.has(group);
                                    const accessCount = groupMods.filter(m => hasAccess(selectedUser, m.key)).length;
                                    return (
                                        <div key={group} className="border border-gray-100 rounded-xl overflow-hidden">
                                            <button onClick={() => setExpandedGroups(prev => {
                                                const next = new Set(prev);
                                                if (next.has(group)) next.delete(group); else next.add(group);
                                                return next;
                                            })} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-all">
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                                                    <span className="text-xs font-black text-gray-700 uppercase tracking-widest">{group}</span>
                                                    <span className="text-[10px] text-gray-400">{accessCount}/{groupMods.length} modules</span>
                                                </div>
                                                <div className="w-24 bg-gray-200 rounded-full h-1.5">
                                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(accessCount / groupMods.length) * 100}%` }} />
                                                </div>
                                            </button>
                                            {isExpanded && (
                                                <div className="divide-y divide-gray-50">
                                                    {groupMods.map(mod => {
                                                        const access = hasAccess(selectedUser, mod.key);
                                                        const isOwner = selectedUser.role === 'owner';
                                                        const roleDefault = (MODULE_ACCESS[mod.key] || []).includes(selectedUser.role);
                                                        const isCustom = !!(selectedUser.permissions && mod.key in selectedUser.permissions);
                                                        return (
                                                            <div key={mod.key} className={`flex items-center justify-between px-4 py-3 ${access ? 'bg-white' : 'bg-gray-50'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-2 h-2 rounded-full ${access ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                                                    <span className="text-sm text-gray-700">{mod.label}</span>
                                                                    {isCustom && !isOwner && (
                                                                        <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Custom</span>
                                                                    )}
                                                                    {!roleDefault && !isCustom && !isOwner && (
                                                                        <span className="text-[9px] text-gray-400">Not in role</span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => !isOwner && togglePermission(selectedUser.id, mod.key)}
                                                                    disabled={isOwner}
                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                                                        isOwner ? 'text-gray-300 cursor-default' :
                                                                        access ? 'bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600' :
                                                                        'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
                                                                    }`}>
                                                                    {isOwner ? <Lock size={12} /> : access ? <><Unlock size={12} /> Granted</> : <><Lock size={12} /> Denied</>}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                            <Users size={48} className="mx-auto text-gray-200 mb-4" />
                            <p className="text-gray-400 font-black">Select a user</p>
                            <p className="text-gray-300 text-sm mt-1">Click any user on the left to manage their module access</p>
                        </div>
                    )}
                </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
                Changes take effect immediately · Green = has access · Red = no access · Purple = custom override
            </p>
        </div>
    );
}
