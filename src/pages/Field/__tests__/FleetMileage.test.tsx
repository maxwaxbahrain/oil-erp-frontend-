import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FleetMileage from '../FleetMileage';
import * as fleetService from '../../../services/fleetService';
import type { FleetMileageReport } from '../../../services/fleetService';

vi.mock('../../../services/fleetService', () => ({
  getFleetMileage: vi.fn(),
  recomputeFleetMileage: vi.fn(),
}));

const authState: { role: 'admin' | 'sales' } = { role: 'admin' };

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'test', full_name: 'Test User', role: authState.role },
    hasRole: (...roles: string[]) => roles.includes(authState.role),
    logout: () => undefined,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

const VAN_ALPHA_ID = '102b0330-3614-4c2c-93b8-fe76166dafb0';
const VAN_BETA_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const mockReport: FleetMileageReport = {
  unit: 'miles',
  total_distance: 90,
  total_stops: 12,
  days: [
    {
      day: '2026-10-01',
      total_distance: 30,
      total_stops: 4,
      vans: [
        {
          van_id: VAN_ALPHA_ID,
          van_name: 'Van Alpha',
          distance: 20,
          stops: 3,
          source: 'gps',
          ping_count: 40,
        },
        {
          van_id: VAN_BETA_ID,
          van_name: 'Van Beta',
          distance: 10,
          stops: 1,
          source: 'odometer',
          ping_count: 0,
        },
      ],
    },
    {
      day: '2026-10-02',
      total_distance: 30,
      total_stops: 4,
      vans: [
        {
          van_id: VAN_ALPHA_ID,
          van_name: 'Van Alpha',
          distance: 30,
          stops: 4,
          source: 'gps',
          ping_count: 55,
        },
      ],
    },
    {
      day: '2026-10-03',
      total_distance: 30,
      total_stops: 4,
      vans: [
        {
          van_id: VAN_BETA_ID,
          van_name: 'Van Beta',
          distance: 30,
          stops: 4,
          source: 'odometer',
          ping_count: 0,
        },
      ],
    },
  ],
};

describe('FleetMileage', () => {
  let container: HTMLDivElement;
  let root: Root;

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/field/fleet-mileage']}>
          <Routes>
            <Route path="/field/fleet-mileage" element={<FleetMileage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  beforeEach(() => {
    authState.role = 'admin';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(fleetService.getFleetMileage).mockResolvedValue(mockReport);
    vi.mocked(fleetService.recomputeFleetMileage).mockResolvedValue({
      day: '2026-10-01',
      tenant_id: 4,
      vans_updated: 2,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('renders tiles, three by-day rows, and van detail on expand', async () => {
    await renderPage();

    expect(container.textContent).toContain('90 mi');
    expect(container.textContent).toContain('Active vans');
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('12');

    const dayRows = container.querySelectorAll('tbody tr');
    expect(dayRows.length).toBeGreaterThanOrEqual(3);

    const expandBtn = container.querySelector('button[aria-label^="Expand 2026-10-01"]');
    expect(expandBtn).toBeTruthy();
    await act(async () => {
      expandBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain('Van Alpha');
    expect(container.textContent).toContain('GPS');
    expect(container.textContent).toContain('Odometer');
  });

  it('shows HTTP error and hides tables', async () => {
    vi.mocked(fleetService.getFleetMileage).mockRejectedValue(
      new Error('Fleet mileage failed: HTTP 500'),
    );
    await renderPage();

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('HTTP 500');
    expect(container.textContent).not.toContain('By van (range totals)');
  });

  it('uses km labels when the API returns km', async () => {
    vi.mocked(fleetService.getFleetMileage).mockResolvedValue({
      ...mockReport,
      unit: 'km',
      total_distance: 120,
    });
    await renderPage();

    expect(container.textContent).toContain('Total distance (km)');
    expect(container.textContent).toContain('120 km');
  });

  it('hides recompute for sales and POSTs for admin', async () => {
    authState.role = 'sales';
    await renderPage();
    expect(container.querySelector('[data-testid="fleet-mileage-recompute"]')).toBeNull();

    authState.role = 'admin';
    await renderPage();
    const btn = container.querySelector('[data-testid="fleet-mileage-recompute"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();

    await act(async () => {
      btn.click();
    });
    await flush();

    expect(fleetService.recomputeFleetMileage).toHaveBeenCalled();
    const dayArg = vi.mocked(fleetService.recomputeFleetMileage).mock.calls[0][0];
    expect(dayArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
