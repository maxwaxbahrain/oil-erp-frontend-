import type { AuthRole } from '../contexts/AuthContext';

/** Backend require_finance — admin + accountant */
export const FINANCE_ROLES: AuthRole[] = ['admin', 'accountant'];

/** Backend require_management — admin + manager + accountant */
export const MANAGEMENT_ROLES: AuthRole[] = ['admin', 'manager', 'accountant'];

/** Internal web staff — full ERP sidebar (non-SPOD field roles) */
export const INTERNAL_WEB_ROLES: AuthRole[] = ['admin', 'manager', 'accountant'];

/** SPOD field roles — strict sidebar whitelist */
export const SPOD_FIELD_ROLES: AuthRole[] = ['sales', 'driver'];

/** Sales SPOD web tools */
export const SALES_TOOL_ROLES: AuthRole[] = ['admin', 'manager', 'accountant', 'sales'];

/** Driver SPOD web tools (logistics; no sales module) */
export const DRIVER_TOOL_ROLES: AuthRole[] = ['admin', 'manager', 'driver'];

/** Shared SPOD: core self-service, catalog read, PULSE */
export const SPOD_COMMON_ROLES: AuthRole[] = ['admin', 'manager', 'accountant', 'sales', 'driver'];

/** SPOD AI subset — ARIA, Marcus, AI Hub chat, news */
export const SPOD_AI_ROLES: AuthRole[] = ['admin', 'manager', 'accountant', 'sales', 'driver'];

/** Sales-only voice (drivers use mobile SPOD, not voice web) */
export const SALES_VOICE_ROLES: AuthRole[] = ['admin', 'manager', 'accountant', 'sales'];

/** Manager/admin sales intelligence — excludes field sales */
export const SALES_INTEL_ROLES: AuthRole[] = ['admin', 'manager'];

/** Field / delivery operations (internal + driver) */
export const DELIVERY_ROLES: AuthRole[] = ['admin', 'manager', 'driver'];

/** Tenant admin settings */
export const ADMIN_ROLES: AuthRole[] = ['admin'];

/** @deprecated Use SALES_INTEL_ROLES — sales no longer sees credit/crm/amazon */
export const SALES_PREMIUM_ROLES: AuthRole[] = SALES_INTEL_ROLES;

/** Sales sidebar whitelist — only these paths render for sales role */
export const SALES_SIDEBAR_PATHS: ReadonlySet<string> = new Set([
    '/',
    '/portal',
    '/customers',
    '/sales/orders',
    '/sales/quotations',
    '/sales/invoices',
    '/sales/returns',
    '/sales/credit-notes',
    '/sales/price-lists',
    '/sales/recurring',
    '/products',
    '/pulse',
    '/pulse/notes',
    '/agents/customer-service',
    '/agents/business-advisor',
    '/ai/hub',
    '/news',
    '/voice/dashboard',
    '/voice/calls',
]);

/** Driver sidebar whitelist — SPOD field minus sales + voice, plus logistics */
export const DRIVER_SIDEBAR_PATHS: ReadonlySet<string> = new Set([
    '/',
    '/portal',
    '/products',
    '/pulse',
    '/pulse/notes',
    '/agents/customer-service',
    '/agents/business-advisor',
    '/ai/hub',
    '/news',
    '/logistics/pod',
    '/logistics/operations',
    '/logistics/routes',
]);

export function isSpodFieldRole(role: AuthRole | undefined): boolean {
    return role === 'sales' || role === 'driver';
}

/** For sales/driver: strict path allowlist. Internal staff: always true (section guards apply). */
export function isSidebarPathAllowed(role: AuthRole | undefined, path: string): boolean {
    if (!role || !isSpodFieldRole(role)) {
        return true;
    }
    if (role === 'sales') {
        return SALES_SIDEBAR_PATHS.has(path);
    }
    return DRIVER_SIDEBAR_PATHS.has(path);
}
