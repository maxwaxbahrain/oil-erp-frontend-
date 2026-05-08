import { useState } from 'react';
import {
    Shield, Check, Plus, Copy, Save, AlertCircle, CornerUpLeft
} from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

const ROLES = [
    { id: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system access', users: 3, type: 'System' },
    { id: 'BRANCH_MGR', name: 'Branch Manager', description: 'Manages branch operations', users: 45, type: 'Business' },
    { id: 'SALES_MGR', name: 'Sales Manager', description: 'Manages sales team & orders', users: 120, type: 'Business' },
    { id: 'VAN_SALES', name: 'Van Salesman', description: 'Field sales & POD', users: 180, type: 'Business' },
    { id: 'WH_MGR', name: 'Warehouse Manager', description: 'Inventory control', users: 15, type: 'Business' },
];

const MODULES = [
    { id: 'inventory', name: 'Inventory Management', features: ['View Stock', 'Adjust Stock', 'Transfers', 'Audit'] },
    { id: 'sales', name: 'Sales & Orders', features: ['Create Order', 'Approve Order', 'Apply Discount', 'Returns'] },
    { id: 'customers', name: 'Customer Database', features: ['View Profiles', 'Edit Credit', 'Delete Customer', 'Merge'] },
    { id: 'finance', name: 'Finance & Accounts', features: ['View Ledger', 'Process Payment', 'Financial Reports', 'Close Period'] },
    { id: 'users', name: 'User Administration', features: ['Manage Users', 'Manage Roles', 'Reset Passwords', 'View Logs'] },
];

const PERMISSIONS_MOCK: any = {
    'SUPER_ADMIN': { all: true },
    'BRANCH_MGR': {
        inventory: ['View Stock', 'Adjust Stock', 'Transfers'],
        sales: ['Create Order', 'Approve Order', 'Returns'],
        customers: ['View Profiles', 'Edit Credit'],
        finance: ['View Ledger', 'Process Payment'],
        users: ['Manage Users']
    }
};

export default function RoleManager() {
    const [selectedRole, setSelectedRole] = useState(ROLES[1]);

    const hasPermission = (module: string, feature: string) => {
        if (selectedRole.id === 'SUPER_ADMIN') return true;
        const rolePerms = PERMISSIONS_MOCK[selectedRole.id];
        return rolePerms?.[module]?.includes(feature);
    };

    return (
        <div className="flex h-full bg-redwood-bg-light">
            {/* Left: Role List */}
            <div className="w-80 bg-white border-r border-redwood-border flex flex-col">
                <div className="p-6 border-b border-redwood-border shrink-0">
                    <Link to="/users/dashboard" className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 hover:text-redwood-brand mb-4">
                        <CornerUpLeft size={12} /> Back to Dashboard
                    </Link>
                    <h1 className="text-xl font-black text-redwood-text-main uppercase flex items-center gap-2">
                        <Shield className="text-redwood-brand" /> Roles & Perms
                    </h1>
                    <button className="mt-4 w-full py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 shadow-sm hover:bg-redwood-brand/90">
                        <Plus size={14} /> Create Role
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {ROLES.map(role => (
                        <div
                            key={role.id}
                            onClick={() => setSelectedRole(role)}
                            className={clsx(
                                "p-4 mb-2 rounded-sm cursor-pointer border transition-all",
                                selectedRole.id === role.id
                                    ? "bg-redwood-bg-light border-redwood-brand shadow-sm"
                                    : "bg-white border-transparent hover:border-gray-200"
                            )}
                        >
                            <div className="flex justify-between mb-1">
                                <span className="font-black text-sm text-redwood-text-main">{role.name}</span>
                                {role.type === 'System' && <span className="text-[9px] bg-gray-200 px-1.5 py-0.5 rounded font-bold uppercase text-gray-600">System</span>}
                            </div>
                            <div className="text-xs text-gray-500 mb-2 line-clamp-1">{role.description}</div>
                            <div className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded w-fit font-bold uppercase">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> {role.users} Users assigned
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Matrix */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shadow-sm shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-redwood-text-main">{selectedRole.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">{selectedRole.description}</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-white border border-gray-300 rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-gray-50">
                            <Copy size={14} /> Clone
                        </button>
                        <button className="px-4 py-2 bg-emerald-600 text-white rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-emerald-700 shadow-md">
                            <Save size={14} /> Save Changes
                        </button>
                    </div>
                </div>

                {/* Matrix Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {selectedRole.id === 'SUPER_ADMIN' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 mb-6 flex gap-3 text-amber-800">
                            <AlertCircle className="shrink-0" />
                            <div>
                                <div className="font-bold text-sm uppercase">Full Access</div>
                                <div className="text-xs mt-1">This role has unrestricted access to all system modules and data. Permissions cannot be modified.</div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        {MODULES.map(module => (
                            <div key={module.id} className="bg-white border border-redwood-border rounded-sm overflow-hidden shadow-sm">
                                <div className="bg-redwood-bg-light p-3 border-b border-redwood-border flex items-center gap-2">
                                    <div className="w-2 h-4 bg-redwood-brand rounded-full"></div>
                                    <h3 className="font-black text-sm uppercase text-redwood-text-main">{module.name}</h3>
                                </div>
                                <div className="p-4 grid grid-cols-4 gap-4">
                                    {module.features.map(feature => {
                                        const isEnabled = hasPermission(module.id, feature);
                                        return (
                                            <label
                                                key={feature}
                                                className={clsx(
                                                    "flex items-center gap-3 p-3 border rounded-sm cursor-pointer transition-all hover:bg-gray-50",
                                                    isEnabled ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "w-5 h-5 rounded-sm border flex items-center justify-center transition-colors",
                                                    isEnabled ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 bg-white"
                                                )}>
                                                    {isEnabled && <Check size={12} strokeWidth={4} />}
                                                </div>
                                                <span className={clsx("text-xs font-bold uppercase", isEnabled ? "text-emerald-900" : "text-gray-500")}>
                                                    {feature}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
