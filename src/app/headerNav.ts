import type { AuthRole } from '../contexts/AuthContext';
import { ADMIN_ROLES, DELIVERY_ROLES, FINANCE_ROLES } from '../utils/rbac';
import { canAccessPath, type HasRoleFn } from '../utils/routeAccess';

/** Header workspace pill — same routes as before; first label renamed from System Admin. */
export const WORKSPACE_ROLES = [
  'Overview',
  'Accountant',
  'Sales Manager',
  'Warehouse',
  'Van Driver',
  'AI Hub',
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ROLE_ROUTES: Record<WorkspaceRole, string> = {
  Overview: '/dashboard',
  Accountant: '/finance/dashboard',
  'Sales Manager': '/sales/dashboard',
  Warehouse: '/warehouse/dashboard',
  'Van Driver': '/logistics/pod',
  'AI Hub': '/ai/hub',
};

export function roleIndexForPath(pathname: string): number {
  if (pathname.startsWith('/finance') || pathname.startsWith('/tax')) {
    return WORKSPACE_ROLES.indexOf('Accountant');
  }
  if (
    pathname.startsWith('/sales') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/crm')
  ) {
    return WORKSPACE_ROLES.indexOf('Sales Manager');
  }
  if (
    pathname.startsWith('/warehouse') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/inventory')
  ) {
    return WORKSPACE_ROLES.indexOf('Warehouse');
  }
  if (pathname.startsWith('/van') || pathname.startsWith('/logistics') || pathname.startsWith('/pod')) {
    return WORKSPACE_ROLES.indexOf('Van Driver');
  }
  if (pathname.startsWith('/ai') || pathname.startsWith('/agents')) {
    return WORKSPACE_ROLES.indexOf('AI Hub');
  }
  return WORKSPACE_ROLES.indexOf('Overview');
}

export type WorkspaceEntry = { label: WorkspaceRole; route: string };

export function visibleWorkspaces(hasRole: HasRoleFn): WorkspaceEntry[] {
  return WORKSPACE_ROLES.flatMap((label) => {
    const route = ROLE_ROUTES[label];
    return canAccessPath(hasRole, route) ? [{ label, route }] : [];
  });
}

export function workspaceLabel(hasRole: HasRoleFn, pathname: string): WorkspaceRole | null {
  const visible = visibleWorkspaces(hasRole);
  if (visible.length === 0) return null;
  const derived = WORKSPACE_ROLES[roleIndexForPath(pathname)];
  const match = visible.find((w) => w.label === derived);
  return match?.label ?? visible[0].label;
}

export type HeaderTab = {
  key: string;
  label: string;
  route: string;
};

const HEADER_TAB_DEFS: Array<HeaderTab & { show: (hasRole: HasRoleFn) => boolean }> = [
  {
    key: 'overview',
    label: 'Overview',
    route: '/dashboard',
    show: () => true,
  },
  {
    key: 'finance',
    label: 'Finance & Tax',
    route: '/finance/dashboard',
    show: (hasRole) => hasRole(...FINANCE_ROLES),
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    route: '/warehouse/dashboard',
    show: () => true,
  },
  {
    key: 'mobile',
    label: 'Field & Mobile',
    route: '/logistics/pod',
    show: (hasRole) => hasRole(...DELIVERY_ROLES) || hasRole('sales'),
  },
  {
    key: 'security',
    label: 'Security',
    route: '/settings/users',
    show: (hasRole) => hasRole(...ADMIN_ROLES),
  },
  {
    key: 'sales',
    label: 'Sales & CRM',
    route: '/sales/dashboard',
    show: () => true,
  },
  {
    key: 'ai',
    label: 'AI Hub',
    route: '/ai/hub',
    show: () => true,
  },
];

export function visibleTabs(hasRole: HasRoleFn): HeaderTab[] {
  return HEADER_TAB_DEFS.filter(
    (t) => t.show(hasRole) && canAccessPath(hasRole, t.route),
  ).map(({ key, label, route }) => ({ key, label, route }));
}

export type AlertLinkKey = 'invoices' | 'stock' | 'agedAr';

export type AlertCountsInput = {
  unpaid: number;
  lowStock: number;
  overdue: number;
};

export type AlertLink = { key: AlertLinkKey; route: string; label: string };

const ALERT_LINK_DEFS: Array<
  AlertLink & { count: (c: AlertCountsInput) => boolean }
> = [
  {
    key: 'invoices',
    route: '/sales/invoices',
    label: 'Invoices →',
    count: (c) => c.unpaid > 0,
  },
  {
    key: 'stock',
    route: '/products',
    label: 'Stock →',
    count: (c) => c.lowStock > 0,
  },
  {
    key: 'agedAr',
    route: '/reports/aged-receivable',
    label: 'Aged AR →',
    count: (c) => c.overdue > 0,
  },
];

export function visibleAlertLinks(hasRole: HasRoleFn, counts: AlertCountsInput): AlertLink[] {
  return ALERT_LINK_DEFS.filter(
    (link) => link.count(counts) && canAccessPath(hasRole, link.route),
  ).map(({ key, route, label }) => ({ key, route, label }));
}

/** Next workspace route when cycling the pill (skips current pathname). */
export function nextWorkspaceRoute(
  hasRole: HasRoleFn,
  pathname: string,
): string | null {
  const visible = visibleWorkspaces(hasRole);
  if (visible.length <= 1) return null;
  const current = workspaceLabel(hasRole, pathname);
  const idx = visible.findIndex((w) => w.label === current);
  const start = idx >= 0 ? idx : 0;
  for (let step = 1; step <= visible.length; step++) {
    const next = visible[(start + step) % visible.length];
    if (next.route !== pathname) return next.route;
  }
  return visible[(start + 1) % visible.length]?.route ?? null;
}

export function makeHasRoleFor(role: AuthRole): HasRoleFn {
  return (...roles: AuthRole[]) => roles.includes(role);
}
