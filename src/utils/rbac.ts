import type { AuthRole } from '../contexts/AuthContext';

/** Backend require_finance — admin + accountant */
export const FINANCE_ROLES: AuthRole[] = ['admin', 'accountant'];

/** Backend require_management — admin + manager + accountant */
export const MANAGEMENT_ROLES: AuthRole[] = ['admin', 'manager', 'accountant'];

/** Field / delivery operations */
export const DELIVERY_ROLES: AuthRole[] = ['admin', 'manager', 'driver'];

/** Sales premium (excludes driver — sales-adjacent finance intelligence) */
export const SALES_PREMIUM_ROLES: AuthRole[] = ['admin', 'manager', 'sales'];

/** Tenant admin settings */
export const ADMIN_ROLES: AuthRole[] = ['admin'];
