import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CreditHoldBanner from '../CreditHoldBanner';
import type { CreditHoldDetail } from '../../services/api';

const heldInvoices = [
  { invoice_id: 1, invoice_number: 'INV-1001', outstanding: 500, days_unpaid: 60 },
];

const baseHold: CreditHoldDetail = {
  mode: 'warn',
  held: true,
  message: 'Customer has unpaid balance.',
  invoices: heldInvoices,
};

function renderBanner(props: ComponentProps<typeof CreditHoldBanner>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<CreditHoldBanner {...props} />);
  });
  return { container, root };
}

describe('CreditHoldBanner', () => {
  let roots: Root[] = [];

  afterEach(() => {
    roots.forEach((root) => act(() => root.unmount()));
    roots = [];
    document.body.innerHTML = '';
  });

  beforeEach(() => {
    roots = [];
  });

  it('renders nothing when hold is null', () => {
    const { container, root } = renderBanner({ hold: null, canOverride: false });
    roots.push(root);
    expect(container.querySelector('[data-testid="credit-hold-banner"]')).toBeNull();
  });

  it('renders amber warn banner without override button', () => {
    const { container, root } = renderBanner({
      hold: { ...baseHold, mode: 'warn' },
      canOverride: true,
      onOverride: vi.fn(),
    });
    roots.push(root);
    const banner = container.querySelector('[data-testid="credit-hold-banner"]');
    expect(banner?.textContent).toContain('Credit hold — warning');
    expect(banner?.className).toContain('amber');
    expect(container.textContent).not.toContain('Override and continue');
  });

  it('renders red block banner with override when canOverride', () => {
    const onOverride = vi.fn();
    const { container, root } = renderBanner({
      hold: { ...baseHold, mode: 'block', code: 'credit_hold' },
      canOverride: true,
      onOverride,
    });
    roots.push(root);
    const banner = container.querySelector('[data-testid="credit-hold-banner"]');
    expect(banner?.textContent).toContain('Credit hold — order blocked');
    expect(banner?.className).toContain('red');
    const btn = container.querySelector('button');
    expect(btn?.textContent).toBe('Override and continue');
    act(() => btn?.click());
    expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it('renders red block banner without button and shows helper text when !canOverride', () => {
    const { container, root } = renderBanner({
      hold: { ...baseHold, mode: 'block', code: 'credit_hold' },
      canOverride: false,
    });
    roots.push(root);
    expect(container.textContent).toContain('Ask a manager to override or collect payment first');
    expect(container.textContent).not.toContain('Override and continue');
  });

  it('shows cash-only wording for cash exempt hold', () => {
    const { container, root } = renderBanner({
      hold: {
        ...baseHold,
        mode: 'block',
        exempt_reason: 'cash',
        enforced: false,
      },
      canOverride: true,
      onOverride: vi.fn(),
    });
    roots.push(root);
    const banner = container.querySelector('[data-testid="credit-hold-banner"]');
    expect(banner?.textContent).toContain('On credit hold — cash only');
    expect(banner?.className).toContain('amber');
    expect(container.textContent).not.toContain('Override and continue');
  });
});
