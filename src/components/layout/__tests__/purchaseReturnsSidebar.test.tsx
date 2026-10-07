import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Sidebar from '../Sidebar';

const authState = {
  role: 'admin' as 'admin' | 'manager' | 'accountant' | 'sales' | 'driver',
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: authState.role, full_name: 'Test User', role: authState.role },
    hasRole: (...roles: string[]) => roles.includes(authState.role),
    logout: () => undefined,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

describe('Purchase Returns sidebar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authState.role = 'admin';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderSidebar() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      );
    });
  }

  it('shows Purchase Returns for admin, manager, and accountant after Material Receipt', async () => {
    for (const role of ['admin', 'manager', 'accountant'] as const) {
      authState.role = role;
      await renderSidebar();
      const link = container.querySelector('a[href="/purchases/returns"]');
      expect(link?.textContent).toContain('Purchase Returns');
      const html = container.innerHTML;
      expect(html.indexOf('Purchase Returns')).toBeGreaterThan(html.indexOf('Material Receipt (GRN)'));
    }
  });

  it('hides Purchase Returns from sales and driver', async () => {
    for (const role of ['sales', 'driver'] as const) {
      authState.role = role;
      await renderSidebar();
      expect(container.querySelector('a[href="/purchases/returns"]')).toBeNull();
      expect(container.textContent).not.toContain('Purchase Returns');
    }
  });
});
