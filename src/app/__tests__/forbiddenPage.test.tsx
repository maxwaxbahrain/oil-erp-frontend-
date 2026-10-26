import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '../../components/ProtectedRoute';
import type { AuthRole } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mountForbidden(role: AuthRole) {
  vi.mocked(useAuth).mockReturnValue({
    user: { username: 'u1', full_name: 'User', role },
    isAuthenticated: true,
    isLoading: false,
    hasRole: (...roles: AuthRole[]) => roles.includes(role),
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as ReturnType<typeof useAuth>);

  const router = createMemoryRouter(
    [
      { path: '/dashboard', element: <div data-testid="home-dashboard">Dashboard</div> },
      {
        path: '/warehouse/picking',
        element: <div data-testid="home-picking">Picking</div>,
      },
      {
        element: <ProtectedRoute roles={['admin']} />,
        children: [{ path: '/settings/users', element: <div>Users</div> }],
      },
    ],
    { initialEntries: ['/settings/users'] },
  );

  act(() => {
    root.render(<RouterProvider router={router} />);
  });

  return router;
}

describe('ForbiddenPage actions', () => {
  it('renders Go back and Go to my home', () => {
    mountForbidden('sales');
    expect(container.textContent).toContain('403 Forbidden');
    expect(container.textContent).toContain('Go back');
    expect(container.textContent).toContain('Go to my home');
  });

  it('Go to my home navigates to /dashboard for sales', () => {
    const router = mountForbidden('sales');
    const homeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Go to my home'),
    );
    expect(homeBtn).toBeTruthy();
    act(() => {
      homeBtn!.click();
    });
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(container.querySelector('[data-testid="home-dashboard"]')).toBeTruthy();
  });

  it('Go to my home navigates to /warehouse/picking for warehouse', () => {
    const router = mountForbidden('warehouse');
    const homeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Go to my home'),
    );
    expect(homeBtn).toBeTruthy();
    act(() => {
      homeBtn!.click();
    });
    expect(router.state.location.pathname).toBe('/warehouse/picking');
    expect(container.querySelector('[data-testid="home-picking"]')).toBeTruthy();
  });
});
