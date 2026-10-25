import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProposalCard from '../ProposalCard';
import type { AgentProposal } from '../../../services/agentProposalsService';

vi.mock('../../../services/agentProposalsService', () => ({
  approveProposal: vi.fn(),
  rejectProposal: vi.fn(),
}));

const pending: AgentProposal = {
  id: 21,
  kind: 'cycle_count',
  status: 'pending',
  summary: 'Cycle count: locations under MAIN/A (2 lines)',
  rationale: 'Bin 1 drifted.',
  payload: { scope_type: 'locations', scope_path_prefix: 'MAIN/A', scope_product_ids: null, blind: false, note: null },
  run_id: 'run-1',
  proposed_by_user_id: 1,
  proposed_at: '2026-10-25T08:00:00+00:00',
  expires_at: '2026-11-01T08:00:00+00:00',
  decided_by_user_id: null,
  decided_at: null,
  reject_reason: null,
  result: null,
  error: null,
};

describe('ProposalCard cycle_count', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(proposal: AgentProposal) {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ProposalCard proposal={proposal} canDecide onDecided={() => undefined} onError={() => undefined} />
        </MemoryRouter>,
      );
    });
  }

  it('shows the label and the effect in the approve confirm', async () => {
    await render(pending);
    expect(container.textContent).toContain('Cycle count');
    const approve = [...container.querySelectorAll('button')].find((el) => el.textContent === 'Approve')!;
    await act(async () => approve.click());
    expect(container.querySelector('[role="dialog"]')!.textContent).toContain(
      'This opens a draft count that someone still has to perform. Stock does not change until the count is approved.',
    );
  });

  it('links the approved result to the new count', async () => {
    await render({
      ...pending,
      status: 'approved',
      decided_at: '2026-10-25T09:00:00+00:00',
      result: { count_id: 44, count_number: 'CC-000044', lines_total: 2 },
    });
    const link = container.querySelector('a')!;
    expect(link.textContent).toBe('Count CC-000044 created · 2 lines');
    expect(link.getAttribute('href')).toBe('/warehouse/counts/44');
  });
});
