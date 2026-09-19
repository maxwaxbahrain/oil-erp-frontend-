import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../../../services/api';
import CreditDataSources from '../CreditDataSources';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function setFieldValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    element instanceof HTMLSelectElement
      ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('CreditDataSources', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    navigateMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CreditDataSources />
        </MemoryRouter>,
      );
    });
    await act(async () => {});
  }

  it('renders Not connected from mocked settings', async () => {
    vi.spyOn(api, 'getCreditProviderSettings').mockResolvedValue({
      connected: false,
      environment: null,
      username_masked: null,
      last_auth_ok_at: null,
      last_error: null,
    });

    await renderPage();

    expect(container.textContent).toContain('Credit data sources');
    expect(container.textContent).toContain('Not connected');
    expect(container.textContent).toContain('Creditsafe Connect');
  });

  it('renders Connected state from mocked settings', async () => {
    vi.spyOn(api, 'getCreditProviderSettings').mockResolvedValue({
      connected: true,
      environment: 'sandbox',
      username_masked: 'ab***',
      last_auth_ok_at: '2026-09-01T12:00:00Z',
      last_error: null,
    });

    await renderPage();

    expect(container.textContent).toContain('Connected');
    expect(container.textContent).toContain('sandbox');
    expect(container.textContent).toContain('ab***');
    expect(container.textContent).toContain('Last successful auth');
  });

  it('save calls PUT /ai/credit/settings with password and does not echo it back', async () => {
    vi.spyOn(api, 'getCreditProviderSettings').mockResolvedValue({
      connected: false,
      environment: null,
      username_masked: null,
      last_auth_ok_at: null,
      last_error: null,
    });
    const saveSpy = vi.spyOn(api, 'saveCreditProviderSettings').mockResolvedValue({
      connected: true,
      environment: 'production',
      username_masked: 'te***',
      last_auth_ok_at: '2026-09-18T12:00:00Z',
      last_error: null,
    });

    await renderPage();

    const usernameInput = container.querySelector('#creditsafe-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#creditsafe-password') as HTMLInputElement;
    const environmentSelect = container.querySelector('#creditsafe-environment') as HTMLSelectElement;

    await act(async () => {
      setFieldValue(usernameInput, 'tenant-user');
      setFieldValue(passwordInput, 'secret-pass');
      setFieldValue(environmentSelect, 'production');
    });

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {});

    expect(saveSpy).toHaveBeenCalledWith({
      username: 'tenant-user',
      password: 'secret-pass',
      environment: 'production',
    });
    expect(container.textContent).toContain('Connected');
    expect(container.textContent).not.toContain('secret-pass');
    expect((container.querySelector('#creditsafe-password') as HTMLInputElement).value).toBe('');
  });
});
