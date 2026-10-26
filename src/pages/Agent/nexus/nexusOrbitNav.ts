/**
 * Orbit module + tool-chip routes and RBAC mirrors of Sidebar (no Sidebar import).
 */

import type { AuthRole } from '../../../contexts/AuthContext';
import { MODULE_FLAGS } from '../../../config/moduleFlags';
import {
  ADMIN_ROLES,
  DELIVERY_ROLES,
  FINANCE_ROLES,
  MANAGEMENT_ROLES,
  WAREHOUSE_PAGE_ROLES,
  isSidebarPathAllowed,
} from '../../../utils/rbac';
import type { HomeModuleId } from './homeSummaryApi';

export type OrbitNavCtx = {
  role: AuthRole | undefined;
  hasRole: (...roles: AuthRole[]) => boolean;
};

export type OrbitModuleDef = {
  id: HomeModuleId;
  label: string;
  href: string;
  /** Clockwise angle from centre (deg). 0 = right, -90 = top. */
  angle: number;
};

export type OrbitChipDef = {
  id: string;
  label: string;
  href: string;
};

/** 10 modules clockwise from Sales (top-right) → Payroll (top-left). */
export const ORBIT_MODULE_DEFS: OrbitModuleDef[] = [
  { id: 'sales', label: 'Sales', href: '/sales/invoices', angle: -72 },
  { id: 'customers', label: 'Customers & CRM', href: '/customers', angle: -36 },
  { id: 'collections', label: 'Collections', href: '/finance/collections', angle: 0 },
  { id: 'purchase', label: 'Purchase', href: '/purchases', angle: 36 },
  { id: 'inventory', label: 'Inventory', href: '/products', angle: 72 },
  { id: 'warehouse', label: 'Warehouse', href: '/warehouse/stock', angle: 108 },
  { id: 'delivery', label: 'Delivery', href: '/logistics/operations', angle: 144 },
  { id: 'finance', label: 'Finance', href: '/finance/chart-of-accounts', angle: 180 },
  { id: 'expenses', label: 'Expenses', href: '/finance/expenses', angle: 216 },
  { id: 'payroll', label: 'Payroll & HR', href: '/finance/payroll', angle: 252 },
];

export const ORBIT_CHIP_DEFS: OrbitChipDef[] = [
  { id: 'tax', label: 'Tax', href: '/tax' },
  { id: 'reports', label: 'Reports', href: '/reports/day-book' },
  { id: 'marketing', label: 'Marketing', href: '/marketing' },
  { id: 'ai_hub', label: 'AI Hub', href: '/ai/hub' },
  { id: 'users', label: 'Users', href: '/settings/users' },
  { id: 'security', label: 'Security', href: '/settings/password' },
];

function pathOk(ctx: OrbitNavCtx, path: string): boolean {
  return isSidebarPathAllowed(ctx.role, path);
}

/** Hide cards the role cannot open (Sidebar-equivalent gates). */
export function canOpenOrbitModule(ctx: OrbitNavCtx, id: HomeModuleId): boolean {
  const def = ORBIT_MODULE_DEFS.find((d) => d.id === id);
  if (!def) return false;
  if (!pathOk(ctx, def.href)) return false;

  switch (id) {
    case 'sales':
      return pathOk(ctx, '/sales/invoices') || pathOk(ctx, '/sales/orders');
    case 'customers':
      return pathOk(ctx, '/customers');
    case 'collections':
      return ctx.hasRole(...MANAGEMENT_ROLES) && pathOk(ctx, '/finance/collections');
    case 'purchase':
      return pathOk(ctx, '/purchases');
    case 'inventory':
      return pathOk(ctx, '/products');
    case 'warehouse':
      return ctx.hasRole(...WAREHOUSE_PAGE_ROLES) && pathOk(ctx, '/warehouse/stock');
    case 'delivery':
      return ctx.hasRole(...DELIVERY_ROLES) && pathOk(ctx, '/logistics/operations');
    case 'finance':
      return ctx.hasRole(...FINANCE_ROLES) && pathOk(ctx, '/finance/chart-of-accounts');
    case 'expenses':
      return ctx.hasRole(...MANAGEMENT_ROLES) && pathOk(ctx, '/finance/expenses');
    case 'payroll':
      return (
        MODULE_FLAGS.payroll &&
        ctx.hasRole(...FINANCE_ROLES) &&
        pathOk(ctx, '/finance/payroll')
      );
    default:
      return false;
  }
}

export function canOpenOrbitChip(ctx: OrbitNavCtx, chipId: string): boolean {
  const def = ORBIT_CHIP_DEFS.find((c) => c.id === chipId);
  if (!def) return false;
  if (!pathOk(ctx, def.href)) return false;

  switch (chipId) {
    case 'tax':
      return MODULE_FLAGS.tax_management && ctx.hasRole(...FINANCE_ROLES);
    case 'reports':
      return ctx.hasRole(...MANAGEMENT_ROLES);
    case 'marketing':
      return MODULE_FLAGS.marketing;
    case 'ai_hub':
      return pathOk(ctx, '/ai/hub');
    case 'users':
      return ctx.hasRole(...ADMIN_ROLES);
    case 'security':
      return pathOk(ctx, '/settings/password');
    default:
      return false;
  }
}

export function visibleOrbitModules(ctx: OrbitNavCtx): OrbitModuleDef[] {
  return ORBIT_MODULE_DEFS.filter((d) => canOpenOrbitModule(ctx, d.id));
}

export function visibleOrbitChips(ctx: OrbitNavCtx): OrbitChipDef[] {
  return ORBIT_CHIP_DEFS.filter((c) => canOpenOrbitChip(ctx, c.id));
}
