import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AgentPage from '../AgentPage';
import ZavaProposals from '../zavaProposals';
import { INVENTORY_PILLS, PROPOSALS_NOTE } from '../zavaCopy';
import * as proposals from '../../../services/agentProposalsService';
import type { AgentProposal } from '../../../services/agentProposalsService';

const authState = { role: 'admin' };

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

vi.mock('../../../api/axios', () => ({ default: api }));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: authState.role, full_name: 'Ana Admin', username: 'ana' },
    hasRole: (...roles: string[]) => roles.includes(authState.role),
  }),
}));

vi.mock('../../../config/appEnv', () => ({ isStaging: false }));

vi.mock('../handsFree/HandsFreeToggle', () => ({ default: () => null }));

vi.mock('../../../services/agentProposalsService', () => ({
  PROPOSAL_STATUSES: ['pending', 'approved', 'rejected', 'failed', 'expired'],
  listProposals: vi.fn(),
  approveProposal: vi.fn(),
  rejectProposal: vi.fn(),
}));

const pendingPo: AgentProposal = {
  id: 21,
  kind: 'draft_po',
  status: 'pending',
  summary: 'Draft PO to Agent Mill: 24 × Engine Oil 5W30 (EO-5W30)',
  rationale: 'On hand 25 is below the reorder point of 100.',
  payload: { supplier_id: 7, lines: [{ product_id: 3, quantity: 24 }] },
  run_id: 'run-9',
  proposed_by_user_id: 1,
  proposed_at: '2026-10-24T08:00:00+00:00',
  expires_at: '2026-10-31T08:00:00+00:00',
  decided_by_user_id: null,
  decided_at: null,
  reject_reason: null,
  result: null,
  error: null,
};

const snoozeSummary = { id: 22, kind: 'snooze' as const, summary: 'Snooze reorder for Gear Grease (GG-1) for 14 days', status: 'pending' as const };

let container: HTMLDivElement;
let root: Root;

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function mount(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
  await flush();
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const found = Array.from(scope.querySelectorAll('button')).find((el) => el.textContent?.trim() === label);
  if (!found) throw new Error(`No button "${label}"`);
  return found as HTMLButtonElement;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await flush();
}

function chatReply(body: Record<string, unknown>) {
  api.post.mockImplementation((url: string) => {
    if (url === '/api/agent/chat') {
      return Promise.resolve({
        data: { answer: 'I proposed a reorder. A person needs to approve it.', headline: 'I proposed a reorder.', note: null, blocks: [], follow_ups: [], steps: [], ...body },
      });
    }
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
}

describe('Zava proposal cards', () => {
  beforeEach(() => {
    authState.role = 'admin';
    Element.prototype.scrollIntoView = vi.fn();
    // jsdom has no IntersectionObserver; the page uses one for the side rail.
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    api.get.mockImplementation((url: string) => {
      if (url === '/api/agent/signals') return Promise.resolve({ data: { cards: [] } });
      if (url === '/api/agent/data-health') return Promise.resolve({ data: { data_health: [] } });
      return Promise.resolve({ data: {} });
    });
    vi.mocked(proposals.listProposals).mockResolvedValue([pendingPo]);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders a card per proposal under the answer that made them', async () => {
    chatReply({ proposals: [{ id: 21, kind: 'draft_po', summary: pendingPo.summary, status: 'pending' }, snoozeSummary] });
    await mount(<AgentPage />);
    await click(button('What needs attention today?'));

    expect(api.post).toHaveBeenCalledWith('/api/agent/chat', { message: 'What needs attention today?' }, expect.anything());
    const block = container.querySelector('[data-testid="zava-proposals"]') as HTMLElement;
    expect(block.closest('article')).not.toBeNull();
    expect(block.textContent).toContain(PROPOSALS_NOTE);
    expect(proposals.listProposals).toHaveBeenCalledTimes(1);
    expect(proposals.listProposals).toHaveBeenCalledWith('pending');
    // 21 matched the pending list: full card with rationale. 22 was not: summary-only fallback.
    const po = block.querySelector('[data-testid="proposal-21"]') as HTMLElement;
    expect(po.textContent).toContain('On hand 25 is below the reorder point of 100.');
    const snooze = block.querySelector('[data-testid="proposal-22"]') as HTMLElement;
    expect(snooze.textContent).toContain('Snooze reorder for Gear Grease (GG-1) for 14 days');
    expect(snooze.textContent).toContain('Snooze');
  });

  it('approve from the thread posts and shows the result on the card', async () => {
    chatReply({ proposals: [{ id: 21, kind: 'draft_po', summary: pendingPo.summary, status: 'pending' }] });
    vi.mocked(proposals.approveProposal).mockResolvedValue({
      ...pendingPo,
      status: 'approved',
      decided_at: '2026-10-24T09:00:00+00:00',
      result: { po_id: 55, po_number: 'RO-AB12CD34', status: 'Draft' },
    });
    await mount(<AgentPage />);
    await click(button('What needs attention today?'));

    const card = () => container.querySelector('[data-testid="proposal-21"]') as HTMLElement;
    await click(button('Approve', card()));
    const dialog = container.querySelector('[role="dialog"][aria-label="Approve proposal"]') as HTMLElement;
    expect(dialog.textContent).toContain(pendingPo.summary);
    await click(button('Confirm approve', dialog));

    expect(proposals.approveProposal).toHaveBeenCalledWith(21);
    expect(card().textContent).toContain('Approved');
    const link = card().querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toBe('PO RO-AB12CD34');
    expect(link.getAttribute('href')).toBe('/suppliers/7?tab=purchases');
  });

  it('a response with no proposals renders no cards', async () => {
    chatReply({ proposals: [] });
    await mount(<AgentPage />);
    await click(button('What needs attention today?'));
    expect(container.textContent).toContain('I proposed a reorder. A person needs to approve it.');
    expect(container.querySelector('[data-testid="zava-proposals"]')).toBeNull();
    expect(proposals.listProposals).not.toHaveBeenCalled();
  });

  it('the three inventory pills send their text as a normal message', async () => {
    chatReply({ proposals: [] });
    await mount(<AgentPage />);
    const pills = container.querySelector('[data-testid="zava-inventory-pills"]') as HTMLElement;
    expect(Array.from(pills.querySelectorAll('button')).map((el) => el.textContent)).toEqual([...INVENTORY_PILLS]);
    expect(INVENTORY_PILLS).toEqual([
      'What should I reorder this week?',
      'Any open pick shortages?',
      "What stock hasn't moved in 90 days?",
    ]);
    for (const text of INVENTORY_PILLS) {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      api.post.mockClear();
      await mount(<AgentPage />);
      await click(button(text, container.querySelector('[data-testid="zava-inventory-pills"]') as HTMLElement));
      expect(api.post).toHaveBeenCalledWith('/api/agent/chat', { message: text }, expect.anything());
    }
  });

  it('an accountant sees the cards read-only', async () => {
    authState.role = 'accountant';
    await mount(<ZavaProposals items={[{ id: 21, kind: 'draft_po', summary: pendingPo.summary, status: 'pending' }]} />);
    const card = container.querySelector('[data-testid="proposal-21"]') as HTMLElement;
    expect(card.textContent).toContain('Read only');
    expect(Array.from(card.querySelectorAll('button')).length).toBe(0);
  });
});
