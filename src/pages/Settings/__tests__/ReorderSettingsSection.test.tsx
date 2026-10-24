import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ReorderSettingsSection from '../ReorderSettingsSection';
import * as reorderService from '../../../services/reorderService';
import type { ReorderRun, ReorderSettings } from '../../../services/reorderService';

const { authState } = vi.hoisted(() => ({ authState: { role: 'admin' } }));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasRole: (...roles: string[]) => roles.includes(authState.role) }),
}));

vi.mock('../../../services/reorderService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/reorderService')>();
  return {
    REORDER_SETTING_RANGES: actual.REORDER_SETTING_RANGES,
    getReorderSettings: vi.fn(),
    updateReorderSettings: vi.fn(),
    runReorderNow: vi.fn(),
    getReorderRuns: vi.fn(),
  };
});

const SETTINGS: ReorderSettings = {
  tenant_id: 4,
  demand_window_days: 90,
  safety_factor: 1.5,
  default_lead_time_days: 7,
  min_days_of_cover_alert: 7,
  digest_enabled: false,
  digest_recipients: null,
  digest_hour_local: 7,
  timezone: 'America/Denver',
};

const RUN: ReorderRun = {
  id: 31,
  tenant_id: 4,
  run_at: '2026-10-24T13:05:00+00:00',
  trigger: 'manual',
  due_count: 3,
  suppliers_json: [],
  digest_sent: true,
  error: null,
};

describe('Settings › Reorder planning', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authState.role = 'admin';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(reorderService.getReorderSettings).mockResolvedValue(SETTINGS);
    vi.mocked(reorderService.getReorderRuns).mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function flush() {
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  async function render() {
    await act(async () => {
      root.render(<ReorderSettingsSection />);
    });
    await flush();
  }

  function field<T extends HTMLElement = HTMLInputElement>(label: string): T {
    const el = container.querySelector(`[aria-label="${label}"]`);
    if (!el) throw new Error(`missing ${label}`);
    return el as T;
  }

  async function type(el: HTMLInputElement | HTMLSelectElement, value: string) {
    await act(async () => {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  async function click(el: Element | null | undefined) {
    if (!el) throw new Error('missing element');
    await act(async () => {
      (el as HTMLElement).click();
    });
    await flush();
  }

  function button(label: string) {
    return [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
  }

  it('renders the API values, the backend ranges, and the read-only timezone', async () => {
    await render();
    expect(field('Demand window (days)').value).toBe('90');
    expect(field('Safety factor').value).toBe('1.5');
    expect(field('Default lead time (days)').value).toBe('7');
    expect(field('Min days of cover alert').value).toBe('7');
    expect(field<HTMLSelectElement>('Digest hour (local)').value).toBe('7');
    expect(field('Send daily digest').checked).toBe(false);
    expect(field('Digest recipients').value).toBe('');
    expect(container.querySelector('[data-testid="reorder-timezone"]')?.textContent).toBe('America/Denver (from company settings)');

    const text = container.textContent ?? '';
    expect(text).toContain('Allowed 7–365');
    expect(text).toContain('Allowed 1–5');
    expect(text).toContain('Allowed 1–365');
    expect(text).toContain('Allowed 0–365');
    expect(text).toContain('Allowed 0–23');
    expect(field('Demand window (days)').min).toBe('7');
    expect(field('Safety factor').max).toBe('5');
    expect(text).toContain("Scheduled runs only happen when the server's reorder scheduler is on.");
  });

  it('saves only the fields that changed', async () => {
    vi.mocked(reorderService.updateReorderSettings).mockResolvedValue({
      ...SETTINGS,
      safety_factor: 2,
      digest_enabled: true,
      digest_recipients: 'buyer@example.com',
    });
    await render();

    await type(field('Safety factor'), '2');
    await click(field('Send daily digest'));
    await type(field('Digest recipients'), ' buyer@example.com ');
    await click(button('Save'));

    expect(reorderService.updateReorderSettings).toHaveBeenCalledTimes(1);
    expect(reorderService.updateReorderSettings).toHaveBeenCalledWith({
      safety_factor: 2,
      digest_enabled: true,
      digest_recipients: 'buyer@example.com',
    });
    expect(container.querySelector('[data-testid="reorder-settings-message"]')?.textContent).toContain('Reorder settings saved.');
    expect(field('Digest recipients').value).toBe('buyer@example.com');
  });

  it('does not call the API when nothing changed', async () => {
    await render();
    await click(button('Save'));
    expect(reorderService.updateReorderSettings).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="reorder-settings-message"]')?.textContent).toContain('No changes to save.');
  });

  it('shows the backend 422 detail as the error', async () => {
    vi.mocked(reorderService.updateReorderSettings).mockRejectedValue(
      new Error('digest_recipients: Value error, invalid email: not-an-email'),
    );
    await render();
    await type(field('Digest recipients'), 'not-an-email');
    await click(button('Save'));

    expect(reorderService.updateReorderSettings).toHaveBeenCalledWith({ digest_recipients: 'not-an-email' });
    expect(container.querySelector('[data-testid="reorder-settings-message"]')?.textContent).toContain(
      'digest_recipients: Value error, invalid email: not-an-email',
    );
  });

  it('is read-only for an accountant: no Save, no Run now, inputs disabled', async () => {
    authState.role = 'accountant';
    await render();
    expect(field('Demand window (days)').disabled).toBe(true);
    expect(field('Send daily digest').disabled).toBe(true);
    expect(field<HTMLSelectElement>('Digest hour (local)').disabled).toBe(true);
    expect(button('Save')).toBeUndefined();
    expect(button('Run now')).toBeUndefined();
    expect(container.textContent).toContain('Read-only for your role.');
  });

  it('Run now shows the result and the new history row', async () => {
    vi.mocked(reorderService.runReorderNow).mockResolvedValue(RUN);
    await render();
    expect(container.querySelector('[data-testid="reorder-run-history"]')?.textContent).toContain('No runs yet.');

    vi.mocked(reorderService.getReorderRuns).mockResolvedValue([RUN]);
    await click(button('Run now'));

    expect(reorderService.runReorderNow).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="reorder-run-result"]')?.textContent).toBe('Run complete: 3 due · digest sent');
    const history = container.querySelector('[data-testid="reorder-run-history"]')?.textContent ?? '';
    expect(history).toContain('manual');
    expect(history).toContain('3');
    expect(history).toContain('Sent');
    expect(history).toContain('2026');
  });
});
