import { describe, expect, it } from 'vitest';
import type { AuthRole } from '../../contexts/AuthContext';
import { ADMIN_ROLES, DELIVERY_ROLES, FINANCE_ROLES } from '../../utils/rbac';
import { canAccessPath } from '../../utils/routeAccess';
import {
  makeHasRoleFor,
  ROLE_ROUTES,
  visibleAlertLinks,
  visibleTabs,
  visibleWorkspaces,
  workspaceLabel,
  WORKSPACE_ROLES,
} from '../headerNav';

// Re-export tab defs for admin parity check (mirrors headerNav internal list).
const TAB_DEFS = [
  { key: 'overview', label: 'Overview', route: '/dashboard', show: () => true },
  {
    key: 'finance',
    label: 'Finance & Tax',
    route: '/finance/dashboard',
    show: (hasRole: (...r: AuthRole[]) => boolean) => hasRole(...FINANCE_ROLES),
  },
  { key: 'warehouse', label: 'Warehouse', route: '/warehouse/dashboard', show: () => true },
  {
    key: 'mobile',
    label: 'Field & Mobile',
    route: '/logistics/pod',
    show: (hasRole: (...r: AuthRole[]) => boolean) =>
      hasRole(...DELIVERY_ROLES) || hasRole('sales'),
  },
  {
    key: 'security',
    label: 'Security',
    route: '/settings/users',
    show: (hasRole: (...r: AuthRole[]) => boolean) => hasRole(...ADMIN_ROLES),
  },
  { key: 'sales', label: 'Sales & CRM', route: '/sales/dashboard', show: () => true },
  { key: 'ai', label: 'AI Hub', route: '/ai/hub', show: () => true },
];

describe('headerNav access matrix', () => {
  const roles: AuthRole[] = ['admin', 'manager', 'accountant', 'sales', 'driver', 'warehouse'];
  const allCounts = { unpaid: 1, lowStock: 1, overdue: 1 };

  for (const role of roles) {
    it(`${role}: header targets pass canAccessPath`, () => {
      const hasRole = makeHasRoleFor(role);

      for (const ws of visibleWorkspaces(hasRole)) {
        expect(canAccessPath(hasRole, ws.route)).toBe(true);
      }
      for (const tab of visibleTabs(hasRole)) {
        expect(canAccessPath(hasRole, tab.route)).toBe(true);
      }
      for (const link of visibleAlertLinks(hasRole, allCounts)) {
        expect(canAccessPath(hasRole, link.route)).toBe(true);
      }
    });
  }
});

describe('sales header', () => {
  const hasRole = makeHasRoleFor('sales');

  it('tabs are Overview and AI Hub only', () => {
    const tabs = visibleTabs(hasRole);
    expect(tabs.map((t) => t.label)).toEqual(['Overview', 'AI Hub']);
  });

  it('no Aged AR alert link when overdue', () => {
    const links = visibleAlertLinks(hasRole, { unpaid: 0, lowStock: 0, overdue: 3 });
    expect(links.some((l) => l.key === 'agedAr')).toBe(false);
  });

  it('pill label on /dashboard is Overview', () => {
    expect(workspaceLabel(hasRole, '/dashboard')).toBe('Overview');
    expect(workspaceLabel(hasRole, '/dashboard')).not.toBe('System Admin');
  });
});

describe('warehouse header', () => {
  const hasRole = makeHasRoleFor('warehouse');

  it('does not show Overview tab', () => {
    const tabs = visibleTabs(hasRole);
    expect(tabs.some((t) => t.key === 'overview')).toBe(false);
  });

  it('workspace pill lists only accessible workspace routes', () => {
    const workspaces = visibleWorkspaces(hasRole);
    for (const ws of workspaces) {
      expect(canAccessPath(hasRole, ws.route)).toBe(true);
    }
    expect(workspaces.every((w) => WORKSPACE_ROLES.includes(w.label))).toBe(true);
  });
});

describe('admin header', () => {
  const hasRole = makeHasRoleFor('admin');

  it('shows the same tabs as legacy show flags (all routes allowed)', () => {
    const legacyKeys = TAB_DEFS.filter((t) => t.show(hasRole)).map((t) => t.key);
    const filteredKeys = visibleTabs(hasRole).map((t) => t.key);
    expect(filteredKeys).toEqual(legacyKeys);
  });

  it('shows all alert links when counts are positive', () => {
    const links = visibleAlertLinks(hasRole, { unpaid: 2, lowStock: 1, overdue: 1 });
    expect(links.map((l) => l.key)).toEqual(['invoices', 'stock', 'agedAr']);
  });

  it('pill can cycle through six workspaces', () => {
    const workspaces = visibleWorkspaces(hasRole);
    expect(workspaces).toHaveLength(6);
    expect(workspaces.map((w) => w.route)).toEqual(
      WORKSPACE_ROLES.map((label) => ROLE_ROUTES[label]),
    );
  });
});
