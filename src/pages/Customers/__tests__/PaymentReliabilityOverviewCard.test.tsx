import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentReliabilityOverviewCard } from '../CustomerOverview';

describe('PaymentReliabilityOverviewCard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function renderCard(
    props: ComponentProps<typeof PaymentReliabilityOverviewCard>,
  ) {
    await act(async () => {
      root.render(<PaymentReliabilityOverviewCard {...props} />);
    });
    await act(async () => {});
  }

  it('renders band from mocked score', async () => {
    await renderCard({
      state: 'ready',
      score: {
        id: 1,
        customer_id: 42,
        score: 88,
        band: 'GREEN',
        reasons: [{ code: 'baseline', text: 'No additional negative factors', points: 0 }],
        suggested_limit: 1500,
        as_of: '2026-09-01',
        computed_at: '2026-09-01T12:00:00',
        metrics: { score_version: 'v1' },
      },
      onSeeCreditTab: vi.fn(),
    });

    expect(container.textContent).toContain('Payment reliability');
    expect(container.textContent).toContain('GREEN');
    expect(container.textContent).toContain('88');
    expect(container.textContent).toContain('No additional negative factors');
    expect(container.textContent).toContain('See Credit tab');
  });

  it('renders Unavailable on failure state', async () => {
    await renderCard({
      state: 'error',
      score: null,
      onSeeCreditTab: vi.fn(),
    });

    expect(container.textContent).toContain('Payment reliability');
    expect(container.textContent).toContain('Unavailable');
  });
});
