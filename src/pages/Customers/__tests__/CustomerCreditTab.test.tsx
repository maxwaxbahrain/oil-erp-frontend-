import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../../../services/api';
import CustomerCreditTab from '../CustomerCreditTab';

const componentSource = readFileSync(
  resolve(process.cwd(), 'src/pages/Customers/CustomerCreditTab.tsx'),
  'utf8',
);

describe('CustomerCreditTab', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderTab(canManage = false) {
    await act(async () => {
      root.render(
        <CustomerCreditTab
          customerId="42"
          customerName="Alpha Shop"
          creditLimit={5000}
          canManage={canManage}
        />,
      );
    });
    await act(async () => {});
  }

  it('does not use forbidden "credit rating" or "credit score" wording in source', () => {
    expect(componentSource).not.toMatch(/credit rating/i);
    expect(componentSource).not.toMatch(/credit score/i);
  });

  it('renders GREEN payment score layer from mocked API', async () => {
    vi.spyOn(api, 'getPaymentScore').mockResolvedValue({
      id: 1,
      customer_id: 42,
      score: 88,
      band: 'GREEN',
      reasons: [{ code: 'baseline', text: 'No additional negative factors', points: 0 }],
      suggested_limit: 1500,
      as_of: '2026-09-01',
      computed_at: '2026-09-01T12:00:00',
      metrics: { score_version: 'v1' },
    });
    vi.spyOn(api, 'getCreditProviderSettings').mockResolvedValue({
      connected: false,
      environment: null,
      username_masked: null,
      last_auth_ok_at: null,
      last_error: null,
    });
    vi.spyOn(api, 'getCreditChecks').mockResolvedValue([]);

    await renderTab();

    expect(container.textContent).toContain('Payment reliability');
    expect(container.textContent).toContain('GREEN');
    expect(container.textContent).toContain('88');
    expect(container.textContent).toContain('Suggested limit');
    expect(container.textContent).not.toMatch(/credit rating/i);
    expect(container.textContent).not.toMatch(/credit score/i);
  });

  it('renders UNRATED state without numeric score', async () => {
    vi.spyOn(api, 'getPaymentScore').mockResolvedValue({
      id: 2,
      customer_id: 42,
      score: null,
      band: 'UNRATED',
      reasons: [
        {
          code: 'thin_history',
          text: 'Fewer than 3 paid invoices in 12 months — not enough history to score',
          points: 0,
        },
      ],
      suggested_limit: 0,
      as_of: '2026-09-01',
      computed_at: '2026-09-01T12:00:00',
      metrics: { score_version: 'v1' },
    });
    vi.spyOn(api, 'getCreditProviderSettings').mockResolvedValue({
      connected: false,
      environment: null,
      username_masked: null,
      last_auth_ok_at: null,
      last_error: null,
    });
    vi.spyOn(api, 'getCreditChecks').mockResolvedValue([]);

    await renderTab();

    expect(container.textContent).toContain('UNRATED');
    expect(container.textContent).toContain('not enough history to score');
    expect(container.textContent).not.toContain('Suggested limit');
  });

  it('renders Creditsafe not connected card', async () => {
    vi.spyOn(api, 'getPaymentScore').mockResolvedValue({
      id: 3,
      customer_id: 42,
      score: 70,
      band: 'YELLOW',
      reasons: [],
      suggested_limit: 900,
      as_of: '2026-09-01',
      computed_at: '2026-09-01T12:00:00',
      metrics: { score_version: 'v1' },
    });
    vi.spyOn(api, 'getCreditProviderSettings').mockResolvedValue({
      connected: false,
      environment: null,
      username_masked: null,
      last_auth_ok_at: null,
      last_error: null,
    });
    vi.spyOn(api, 'getCreditChecks').mockResolvedValue([]);

    await renderTab();

    expect(container.textContent).toContain('Creditsafe not connected');
    expect(container.textContent).toContain('Connect in Settings › Credit data sources');
  });
});
