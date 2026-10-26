import type { AuthRole } from '../contexts/AuthContext';
import {
  ADMIN_ROLES,
  DRIVER_TOOL_ROLES,
  FINANCE_ROLES,
  INTERNAL_WEB_ROLES,
  MANAGEMENT_ROLES,
  SALES_TOOL_ROLES,
  SPOD_AI_ROLES,
  SPOD_COMMON_ROLES,
  WAREHOUSE_PAGE_ROLES,
} from './rbac';

export type HasRoleFn = (...roles: AuthRole[]) => boolean;

/** Route allowlists mirrored from src/app/routes.tsx (nested ProtectedRoute wrappers). */
export const ROUTE_ROLES = {
  '/dashboard': SPOD_COMMON_ROLES,
  '/finance/dashboard': FINANCE_ROLES,
  '/sales/dashboard': INTERNAL_WEB_ROLES,
  '/warehouse/dashboard': INTERNAL_WEB_ROLES,
  '/warehouse/picking': WAREHOUSE_PAGE_ROLES,
  '/logistics/pod': DRIVER_TOOL_ROLES,
  '/ai/hub': SPOD_AI_ROLES,
  '/settings/users': ADMIN_ROLES,
  '/sales/invoices': SALES_TOOL_ROLES,
  '/products': SPOD_COMMON_ROLES,
  '/reports/aged-receivable': MANAGEMENT_ROLES,
} as const satisfies Record<string, readonly AuthRole[]>;

export type HeaderAccessPath = keyof typeof ROUTE_ROLES;

export function canAccessPath(hasRole: HasRoleFn, path: string): boolean {
  const roles = ROUTE_ROLES[path as HeaderAccessPath];
  if (!roles) return false;
  return hasRole(...roles);
}
