/**
 * Sidebar regroup locked to the pre-change route inventory.
 * Heads and labels may change. The set of routes each role sees must not.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import beforeInventory from './sidebarInventory.before.json';

const ROLES = ['admin', 'manager', 'accountant', 'sales', 'driver'] as const;
type Role = (typeof ROLES)[number];
type BuildName = 'production' | 'staging';

const LABEL_RENAMES: Record<string, string> = {
  '/sales/orders': 'Sales Orders',
  '/purchases': 'Purchase Orders',
  '/purchases/new': 'New Purchase Order',
  '/receiving': 'Goods Received (GRN)',
  '/finance/all-ledger': 'General Ledger',
  '/finance/financial-statement': 'Financial Statements',
  '/settings': 'Company Settings',
};

/** Purchase Returns was already in the sidebar, so this set stays empty in practice. */
const ALLOWED_ADDED_ROUTES = new Set<string>(['/purchases/returns']);

const ALWAYS_HIDDEN = [
  { route: '/finance/accounting', label: 'Accounting', flag: 'finance_accounting_dashboard' },
  { route: '/reports/sales', label: 'Profitability Reports', flag: 'reports_profitability_duplicate' },
] as const;

const EXPENSE_CHILD_ROUTES = [
  '/finance/expenses',
  '/finance/expenses/approvals',
  '/finance/expenses/bulk-upload',
  '/finance/expenses/mileage',
  '/finance/expenses/reports',
  '/finance/expenses/settings',
];

type Entry = {
  kind: 'head' | 'group' | 'item' | 'footer';
  head: string | null;
  group: string | null;
  label: string;
  route: string | null;
};

const authState: { role: Role; username: string } = { role: 'admin', username: 'admin' };

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: authState.username, full_name: 'Test User', role: authState.role },
    hasRole: (...roles: string[]) => roles.includes(authState.role),
    logout: () => undefined,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

function extract(container: HTMLElement): Entry[] {
  const aside = container.querySelector('aside');
  if (!aside) throw new Error('sidebar aside missing');
  const nav = aside.querySelector('nav');
  if (!nav) throw new Error('sidebar nav missing');

  const entries: Entry[] = [];
  let head: string | null = null;
  let group: string | null = null;

  const walker = document.createTreeWalker(nav, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as HTMLElement | null;
  while (node) {
    const className = typeof node.className === 'string' ? node.className : '';
    if (node.tagName === 'DIV' && className.includes('tracking-[0.25em]')) {
      head = (node.textContent || '').trim();
      group = null;
      entries.push({ kind: 'head', head, group: null, label: head, route: null });
    } else if (node.tagName === 'BUTTON' && className.includes('tracking-[0.2em]')) {
      const label = (node.querySelector('span')?.textContent || node.textContent || '').trim();
      group = label;
      entries.push({ kind: 'group', head, group: label, label, route: null });
    } else if (node.tagName === 'A') {
      const label = (node.querySelector('span')?.textContent || '').trim();
      const route = node.getAttribute('href');
      const inGroup = Boolean(group && node.closest('.pl-2'));
      entries.push({
        kind: 'item',
        head,
        group: inGroup ? group : null,
        label,
        route,
      });
    }
    node = walker.nextNode() as HTMLElement | null;
  }

  const footer = aside.lastElementChild;
  if (footer && footer !== nav) {
    footer.querySelectorAll('button').forEach((button) => {
      const label = (button.textContent || '').trim();
      if (!label) return;
      entries.push({ kind: 'footer', head: 'Footer', group: null, label, route: null });
    });
    footer.querySelectorAll('a').forEach((anchor) => {
      const label = (anchor.querySelector('span')?.textContent || '').trim();
      entries.push({
        kind: 'footer',
        head: 'Footer',
        group: null,
        label,
        route: anchor.getAttribute('href'),
      });
    });
  }

  return entries;
}

async function inventoryFor(role: Role, staging: boolean): Promise<Entry[]> {
  vi.resetModules();
  vi.stubEnv('VITE_APP_ENV', staging ? 'staging' : 'production');
  authState.role = role;
  authState.username = role === 'admin' ? 'admin' : `user-${role}`;
  const { default: Sidebar } = await import('../Sidebar');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
  });
  const entries = extract(container);
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return entries;
}

function routesOf(entries: Entry[]): string[] {
  return entries.filter((entry) => entry.route).map((entry) => entry.route as string);
}

function fixtureEntries(build: BuildName, role: Role): Entry[] {
  return beforeInventory.builds[build][role] as Entry[];
}

describe('sidebar arrangement completeness', () => {
  it('keeps the same routes for every role on production and staging', async () => {
    const rows: string[] = [];
    const problems: string[] = [];

    for (const build of ['production', 'staging'] as const) {
      for (const role of ROLES) {
        const before = fixtureEntries(build, role);
        const after = await inventoryFor(role, build === 'staging');
        const beforeRoutes = routesOf(before);
        const afterRoutes = routesOf(after);
        const beforeSet = new Set(beforeRoutes);
        const afterSet = new Set(afterRoutes);
        const missing = beforeRoutes.filter((route) => !afterSet.has(route));
        const added = afterRoutes.filter((route) => !beforeSet.has(route));
        const illegalAdded = added.filter((route) => !ALLOWED_ADDED_ROUTES.has(route));
        rows.push(
          `${role} | ${build} | ${beforeRoutes.length} | ${afterRoutes.length} | ${missing.join(', ') || '—'} | ${added.join(', ') || '—'}`,
        );
        if (beforeRoutes.length !== afterRoutes.length || missing.length || illegalAdded.length) {
          problems.push(
            `${role}/${build} before=${beforeRoutes.length} after=${afterRoutes.length} missing=[${missing.join(', ')}] added=[${illegalAdded.join(', ')}]`,
          );
        }

        const beforeByRoute = new Map(before.filter((entry) => entry.route).map((entry) => [entry.route, entry.label]));
        for (const entry of after) {
          if (!entry.route || !beforeByRoute.has(entry.route)) continue;
          const expected = LABEL_RENAMES[entry.route] ?? beforeByRoute.get(entry.route);
          if (entry.label !== expected) {
            problems.push(`${role}/${build} ${entry.route} label ${entry.label} !== ${expected}`);
          }
        }

        const beforeFooter = before.filter((entry) => entry.kind === 'footer').map((entry) => entry.label);
        const afterFooter = after.filter((entry) => entry.kind === 'footer').map((entry) => entry.label);
        if (beforeFooter.join('|') !== afterFooter.join('|')) {
          problems.push(`${role}/${build} footer ${afterFooter.join('|')} !== ${beforeFooter.join('|')}`);
        }

        for (let index = 0; index < after.length; index += 1) {
          if (after[index].kind !== 'head') continue;
          const next = after.slice(index + 1).find((entry) => entry.kind === 'head' || entry.kind === 'item' || entry.kind === 'group');
          if (!next || next.kind === 'head') {
            problems.push(`${role}/${build} empty head ${after[index].label}`);
          }
        }
      }
    }

    console.log(rows.join('\n'));
    expect(problems, rows.join('\n')).toEqual([]);
  });

  it('keeps pilot items hidden on a production build', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_APP_ENV', 'production');
    const flags = await import('../../../config/moduleFlags');
    expect(flags.MODULE_FLAGS.payroll).toBe(false);
    expect(flags.MODULE_FLAGS.tax_management).toBe(false);
    expect(flags.MODULE_FLAGS.sales_returns).toBe(false);
    expect(flags.MODULE_FLAGS.finance_accounting_dashboard).toBe(false);
    expect(flags.MODULE_FLAGS.reports_profitability_duplicate).toBe(false);
    expect(flags.MODULE_FLAGS.finance_banking).toBe(true);
    expect(flags.MODULE_FLAGS.pulse).toBe(true);
    expect(flags.MODULE_FLAGS.meeting_notes).toBe(true);

    for (const role of ROLES) {
      const beforeProd = new Set(routesOf(fixtureEntries('production', role)));
      const beforeStaging = routesOf(fixtureEntries('staging', role));
      const hiddenRoutes = beforeStaging.filter((route) => !beforeProd.has(route));
      const after = await inventoryFor(role, false);
      const afterRoutes = new Set(routesOf(after));
      const labels = new Set(after.map((entry) => entry.label));

      for (const route of hiddenRoutes) {
        expect(afterRoutes.has(route), `${role} production unhid ${route}`).toBe(false);
      }
      for (const item of ALWAYS_HIDDEN) {
        expect(afterRoutes.has(item.route), `${role} production shows ${item.label}`).toBe(false);
        expect(labels.has(item.label), `${role} production shows ${item.label}`).toBe(false);
      }
      expect(labels.has('Payroll')).toBe(false);
      expect(labels.has('Tax Management')).toBe(false);
    }
  });

  it('still hides Accounting and Profitability Reports on staging', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_APP_ENV', 'staging');
    const flags = await import('../../../config/moduleFlags');
    expect(flags.MODULE_FLAGS.finance_accounting_dashboard).toBe(false);
    expect(flags.MODULE_FLAGS.reports_profitability_duplicate).toBe(false);
    expect(flags.MODULE_FLAGS.payroll).toBe(true);
    expect(flags.MODULE_FLAGS.tax_management).toBe(true);

    for (const role of ROLES) {
      const after = await inventoryFor(role, true);
      const afterRoutes = new Set(routesOf(after));
      for (const item of ALWAYS_HIDDEN) {
        expect(afterRoutes.has(item.route), `${role} staging shows ${item.label}`).toBe(false);
      }
    }
  });

  it('leaves the Expenses group open with the same six children', async () => {
    const after = await inventoryFor('admin', false);
    const children = after.filter((entry) => entry.group === 'Expenses' && entry.route).map((entry) => entry.route);
    expect(children).toEqual(EXPENSE_CHILD_ROUTES);
  });
});
