import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProtectedRoute from '../../components/ProtectedRoute';
import { MANAGEMENT_ROLES } from '../../utils/rbac';

const { authState } = vi.hoisted(() => ({
  authState: { role: 'manager' as string },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasRole: (...roles: string[]) => roles.includes(authState.role),
    user: { role: authState.role, username: 'u', full_name: 'User' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('../../pages/Reports/DemandForecasting', () => ({
  default: () => <div data-testid="demand-forecast-page">Demand forecasting</div>,
}));

import DemandForecasting from '../../pages/Reports/DemandForecasting';

function DemandForecastRouteTree() {
  return (
    <Routes>
      <Route element={<ProtectedRoute roles={MANAGEMENT_ROLES} />}>
        <Route path="/reports/demand-forecast" element={<DemandForecasting />} />
      </Route>
    </Routes>
  );
}

describe('/reports/demand-forecast route wiring', () => {
  it('routes.tsx mounts DemandForecasting under management guard (not AccountingSetupRequired)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/routes.tsx'), 'utf8');
    expect(source).toContain("path=\"/reports/demand-forecast\" element={<DemandForecasting />}");
    expect(source).not.toMatch(/path="\/reports\/demand-forecast" element=\{<AccountingSetupRequired \/>}/);
    expect(source).toContain('roles={MANAGEMENT_ROLES}');
  });
});

describe('/reports/demand-forecast access', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authState.role = 'manager';
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders DemandForecasting for management and never the accounting stub', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/reports/demand-forecast']}>
          <DemandForecastRouteTree />
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('[data-testid="demand-forecast-page"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Requires accounting setup');
  });

  it('blocks driver role with 403', async () => {
    authState.role = 'driver';
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/reports/demand-forecast']}>
          <DemandForecastRouteTree />
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('[data-testid="demand-forecast-page"]')).toBeNull();
    expect(container.textContent).toContain('403 Forbidden');
  });
});
