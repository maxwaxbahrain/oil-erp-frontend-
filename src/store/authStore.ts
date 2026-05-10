// ============================================================
// BETTANO LLC — Role-Based Access Control Engine
// ============================================================

export type Role = 'owner' | 'manager' | 'sales_manager' | 'salesman' | 'accountant' | 'van_driver' | 'marketing' | 'warehouse';

export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    phone?: string;
    isActive: boolean;
    createdAt: string;
    lastLogin?: string;
    permissions?: Record<string, string[]>;
}

export const ROLE_DEFINITIONS: Record<Role, { label: string; color: string; bgColor: string; icon: string; description: string }> = {
    owner:         { label: 'Owner / Boss',       color: 'text-purple-700', bgColor: 'bg-purple-100', icon: '👑', description: 'Full access to entire system' },
    manager:       { label: 'General Manager',    color: 'text-blue-700',   bgColor: 'bg-blue-100',   icon: '🏢', description: 'Full access except user management' },
    sales_manager: { label: 'Sales Manager',      color: 'text-emerald-700',bgColor: 'bg-emerald-100',icon: '📊', description: 'Sales, customers, invoices, reports' },
    salesman:      { label: 'Salesman',            color: 'text-green-700',  bgColor: 'bg-green-100',  icon: '🤝', description: 'Create invoices, view own customers' },
    accountant:    { label: 'Accountant',          color: 'text-amber-700',  bgColor: 'bg-amber-100',  icon: '📒', description: 'Finance, banking, accounting only' },
    van_driver:    { label: 'Van Driver',          color: 'text-orange-700', bgColor: 'bg-orange-100', icon: '🚐', description: 'POD, van operations, deliveries' },
    marketing:     { label: 'Marketing Manager',  color: 'text-pink-700',   bgColor: 'bg-pink-100',   icon: '📣', description: 'Customer data, reports, price lists' },
    warehouse:     { label: 'Warehouse Staff',    color: 'text-cyan-700',   bgColor: 'bg-cyan-100',   icon: '📦', description: 'Inventory, GRN, stock management' },
};

export const MODULE_ACCESS: Record<string, Role[]> = {
    dashboard:          ['owner','manager','sales_manager','salesman','accountant','van_driver','marketing','warehouse'],
    customers:          ['owner','manager','sales_manager','salesman','accountant','marketing'],
    orders:             ['owner','manager','sales_manager','salesman'],
    invoices:           ['owner','manager','sales_manager','salesman','accountant'],
    quotations:         ['owner','manager','sales_manager','salesman'],
    sales_returns:      ['owner','manager','sales_manager','accountant'],
    credit_notes:       ['owner','manager','sales_manager','accountant'],
    pod:                ['owner','manager','van_driver'],
    van_operations:     ['owner','manager','van_driver'],
    route_navigator:    ['owner','manager','van_driver'],
    product_catalog:    ['owner','manager','sales_manager','warehouse','marketing'],
    inventory_reports:  ['owner','manager','warehouse'],
    stock_adjustment:   ['owner','manager','warehouse'],
    suppliers:          ['owner','manager','accountant','warehouse'],
    purchase_orders:    ['owner','manager','accountant','warehouse'],
    grn:                ['owner','manager','warehouse'],
    banking:            ['owner','manager','accountant'],
    chart_of_accounts:  ['owner','accountant'],
    journal_voucher:    ['owner','accountant'],
    bad_debts:          ['owner','accountant'],
    payment_edit:       ['owner','accountant'],
    expenses:           ['owner','manager','accountant'],
    financial_reports:  ['owner','manager','accountant'],
    demand_forecast:    ['owner','manager','sales_manager','marketing'],
    price_lists:        ['owner','manager','sales_manager','marketing'],
    recurring_invoices: ['owner','manager','sales_manager'],
    ai_features:        ['owner','manager','sales_manager','marketing'],
    agents:             ['owner','manager','sales_manager'],
    user_management:    ['owner'],
    settings:           ['owner','manager'],
};

const USERS_KEY = 'bettano_users';
const CURRENT_USER_KEY = 'bettano_current_user';

export const DEFAULT_USERS: User[] = [
    { id: 'USR-001', name: 'System Admin', email: 'admin@bettano.com', role: 'owner', phone: '+1 347 951 2163', isActive: true, createdAt: '2024-01-01' },
];

export function getUsers(): User[] {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        const users: User[] = raw ? JSON.parse(raw) : [];
        if (!users.length) { localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS)); return DEFAULT_USERS; }
        return users;
    } catch { return DEFAULT_USERS; }
}

export function saveUser(user: User): void {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function deleteUser(id: string): void {
    localStorage.setItem(USERS_KEY, JSON.stringify(getUsers().filter(u => u.id !== id)));
}

export function getCurrentUser(): User {
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* fallback */ }
    return DEFAULT_USERS[0];
}

export function setCurrentUser(user: User): void {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ ...user, lastLogin: new Date().toISOString() }));
}

export function canAccess(module: string, user?: User): boolean {
    const u = user || getCurrentUser();
    if (u.role === 'owner') return true;
    if (u.permissions?.[module]) return u.permissions[module].includes('access');
    return (MODULE_ACCESS[module] || []).includes(u.role);
}

export const useAuth = () => {
    const user = getCurrentUser();
    return {
        user,
        isAuthenticated: true,
        canAccess: (module: string) => canAccess(module, user),
        isOwner: user.role === 'owner',
        isManager: user.role === 'owner' || user.role === 'manager',
    };
};
