import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InventoryAgentPanel from '../InventoryAgentPanel';
import * as proposals from '../../../services/agentProposalsService';
import * as brief from '../../../services/inventoryBriefService';
import { isSidebarPathAllowed, WAREHOUSE_PAGE_ROLES } from '../../../utils/rbac';
import type { AgentProposal } from '../../../services/agentProposalsService';

const authState = { role: 'admin' };

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasRole: (...roles: string[]) => roles.includes(authState.role) }),
}));

vi.mock('../../../services/agentProposalsService', () => ({
  PROPOSAL_STATUSES: ['pending', 'approved', 'rejected', 'failed', 'expired'],
  listProposals: vi.fn(),
  approveProposal: vi.fn(),
  rejectProposal: vi.fn(),
}));

vi.mock('../../../services/inventoryBriefService', () => ({
  getBriefSettings: vi.fn(),
  updateBriefSettings: vi.fn(),
  sendTestBrief: vi.fn(),
  listBriefSends: vi.fn(),
}));

const draftPo: AgentProposal = {
  id: 12,
  kind: 'draft_po',
  status: 'pending',
  summary: 'Draft PO to Agent Mill: 24 × Engine Oil 5W30 (EO-5W30)',
  rationale: 'On hand 25 is below the reorder point of 100.',
  payload: { supplier_id: 7, lines: [{ product_id: 3, quantity: 24 }] },
  run_id: 'run-1',
  proposed_by_user_id: 1,
  proposed_at: '2026-10-20T08:00:00+00:00',
  expires_at: '2026-10-27T08:00:00+00:00',
  decided_by_user_id: null,
  decided_at: null,
  reject_reason: null,
  result: null,
  error: null,
};

const transfer: AgentProposal = {
  ...draftPo,
  id: 13,
  kind: 'bin_transfer',
  summary: 'Move 5 × Engine Oil 5W30 (EO-5W30) from B-AG-1 to MAIN',
  rationale: null,
  payload: { product_id: 3, from_location_id: 4, to_location_id: 1, quantity: 5 },
};

const settings = {
  tenant_id: 4,
  enabled: false,
  send_time: '07:00',
  recipients: 'ops@example.com',
  include_proposals: true,
  timezone: 'America/Denver',
};

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <InventoryAgentPanel />
      </MemoryRouter>,
    );
  });
  await flush();
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const found = Array.from(scope.querySelectorAll('button')).find((el) => el.textContent?.trim() === label);
  if (!found) throw new Error(`No button "${label}"`);
  return found as HTMLButtonElement;
}

function hasButton(label: string, scope: ParentNode = container): boolean {
  return Array.from(scope.querySelectorAll('button')).some((el) => el.textContent?.trim() === label);
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await flush();
}

async function typeInto(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function card(id: number): HTMLElement {
  const el = container.querySelector(`[data-testid="proposal-${id}"]`);
  if (!el) throw new Error(`No card ${id}`);
  return el as HTMLElement;
}

describe('InventoryAgentPanel', () => {
  beforeEach(() => {
    authState.role = 'admin';
    vi.mocked(proposals.listProposals).mockResolvedValue([draftPo, transfer]);
    vi.mocked(brief.getBriefSettings).mockResolvedValue(settings);
    vi.mocked(brief.listBriefSends).mockResolvedValue([
      {
        id: 3,
        tenant_id: 4,
        local_date: '2026-10-23',
        trigger: 'scheduled',
        sent_at: '2026-10-23T13:00:00+00:00',
        recipients_count: 2,
        status: 'sent',
        narrative_ok: false,
        error: null,
      },
    ]);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('renders proposal cards and the status filter sends the param', async () => {
    await render();
    expect(proposals.listProposals).toHaveBeenCalledWith('pending');
    const first = card(12);
    expect(first.textContent).toContain('Draft PO');
    expect(first.textContent).toContain('Draft PO to Agent Mill: 24 × Engine Oil 5W30 (EO-5W30)');
    expect(first.textContent).toContain('On hand 25 is below the reorder point of 100.');
    expect(first.textContent).toContain('expires');
    expect(card(13).textContent).toContain('Bin transfer');

    vi.mocked(proposals.listProposals).mockResolvedValue([]);
    await click(button('Failed'));
    expect(proposals.listProposals).toHaveBeenLastCalledWith('failed');
    expect(container.textContent).toContain('No failed proposals.');

    await click(button('Pending'));
    expect(container.textContent).toContain('No proposals waiting for approval.');
  });

  it('approve confirms, posts, and the card shows approved with the RO link', async () => {
    vi.mocked(proposals.approveProposal).mockResolvedValue({
      ...draftPo,
      status: 'approved',
      decided_at: '2026-10-24T09:00:00+00:00',
      result: { po_id: 55, po_number: 'RO-AB12CD34', status: 'Draft' },
    });
    await render();
    await click(button('Approve', card(12)));
    const dialog = container.querySelector('[role="dialog"][aria-label="Approve proposal"]') as HTMLElement;
    expect(dialog.textContent).toContain('Draft PO to Agent Mill: 24 × Engine Oil 5W30 (EO-5W30)');
    expect(dialog.textContent).toContain('creates a draft purchase order');
    expect(proposals.approveProposal).not.toHaveBeenCalled();

    vi.mocked(proposals.listProposals).mockResolvedValue([transfer]);
    await click(button('Confirm approve', dialog));
    expect(proposals.approveProposal).toHaveBeenCalledWith(12);
    expect(proposals.listProposals).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Proposal #12 approved.');
    const approved = card(12);
    expect(approved.textContent).toContain('Approved');
    const link = approved.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toBe('PO RO-AB12CD34');
    expect(link.getAttribute('href')).toBe('/suppliers/7?tab=purchases');
    expect(hasButton('Approve', approved)).toBe(false);
  });

  it('approve that comes back failed shows the error and keeps the card', async () => {
    vi.mocked(proposals.approveProposal).mockResolvedValue({
      ...transfer,
      status: 'failed',
      error: 'insufficient stock at location',
      decided_at: '2026-10-24T09:00:00+00:00',
    });
    await render();
    await click(button('Approve', card(13)));
    vi.mocked(proposals.listProposals).mockResolvedValue([draftPo]);
    await click(button('Confirm approve'));
    const failed = card(13);
    expect(failed.textContent).toContain('Failed');
    expect(failed.textContent).toContain('Error: insufficient stock at location');
    expect(container.textContent).not.toContain('approved.');
  });

  it('shows the backend detail when approve is refused', async () => {
    vi.mocked(proposals.approveProposal).mockRejectedValue(new Error('Proposal is expired'));
    await render();
    await click(button('Approve', card(12)));
    await click(button('Confirm approve'));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Proposal #12: Proposal is expired');
  });

  it('reject sends the reason', async () => {
    vi.mocked(proposals.rejectProposal).mockResolvedValue({ ...draftPo, status: 'rejected', reject_reason: 'Wrong supplier' });
    await render();
    await click(button('Reject', card(12)));
    await typeInto(container.querySelector('[aria-label="Reject reason"]') as HTMLInputElement, 'Wrong supplier');
    await click(button('Confirm reject'));
    expect(proposals.rejectProposal).toHaveBeenCalledWith(12, 'Wrong supplier');
    expect(card(12).textContent).toContain('Reason: Wrong supplier');
  });

  it('accountant sees the list read-only with a tooltip', async () => {
    authState.role = 'accountant';
    await render();
    expect(card(12).textContent).toContain('Draft PO to Agent Mill');
    expect(hasButton('Approve')).toBe(false);
    expect(hasButton('Reject')).toBe(false);
    const readOnly = Array.from(card(12).querySelectorAll('span')).find((el) => el.textContent === 'Read only');
    expect(readOnly?.getAttribute('title')).toContain('Only admin, manager, or warehouse');
    expect(hasButton('Save')).toBe(false);
    expect(hasButton('Send me a test brief')).toBe(false);
    expect((container.querySelector('[aria-label="Send time"]') as HTMLInputElement).disabled).toBe(true);
  });

  it('warehouse can open the page and approve', async () => {
    authState.role = 'warehouse';
    expect(WAREHOUSE_PAGE_ROLES).toContain('warehouse');
    expect(isSidebarPathAllowed('warehouse', '/warehouse/stock')).toBe(true);
    vi.mocked(proposals.approveProposal).mockResolvedValue({ ...transfer, status: 'approved', result: { source_id: 'abc', movement_ids: [91, 92], from_location_id: 4, to_location_id: 1, quantity: 5 } });
    await render();
    await click(button('Approve', card(13)));
    await click(button('Confirm approve'));
    expect(proposals.approveProposal).toHaveBeenCalledWith(13);
    expect(card(13).textContent).toContain('5 moved');
    expect(card(13).textContent).toContain('Movements #91, #92');
    // Settings stay read-only for warehouse.
    expect(hasButton('Save')).toBe(false);
  });

  it('brief settings render API values with a read-only timezone', async () => {
    await render();
    expect((container.querySelector('[aria-label="Brief enabled"]') as HTMLInputElement).checked).toBe(false);
    expect((container.querySelector('[aria-label="Send time"]') as HTMLInputElement).value).toBe('07:00');
    expect((container.querySelector('[aria-label="Recipients"]') as HTMLInputElement).value).toBe('ops@example.com');
    expect((container.querySelector('[aria-label="Include proposals"]') as HTMLInputElement).checked).toBe(true);
    expect(container.querySelector('[data-testid="brief-timezone"]')?.textContent).toBe('America/Denver (from company settings)');
    expect(container.textContent).toContain('Comma-separated; empty = company admins');
    expect(container.textContent).toContain("Scheduled sends only happen when the server's inventory brief scheduler is on.");
    const table = container.querySelector('[aria-label="Recent sends"]') as HTMLTableElement;
    expect(table.textContent).toContain('scheduled');
    expect(table.textContent).toContain('sent');
    expect(button('Save').disabled).toBe(true);
  });

  it('save sends only the changed fields and shows a 422 detail', async () => {
    vi.mocked(brief.updateBriefSettings).mockResolvedValue({ ...settings, enabled: true, send_time: '06:30' });
    await render();
    await click(container.querySelector('[aria-label="Brief enabled"]') as HTMLInputElement);
    await typeInto(container.querySelector('[aria-label="Send time"]') as HTMLInputElement, '06:30');
    await click(button('Save'));
    expect(brief.updateBriefSettings).toHaveBeenCalledWith({ enabled: true, send_time: '06:30' });
    expect(container.textContent).toContain('Brief settings saved.');

    vi.mocked(brief.updateBriefSettings).mockRejectedValue(new Error('send_time: Value error, send_time must be HH:MM'));
    await typeInto(container.querySelector('[aria-label="Recipients"]') as HTMLInputElement, '');
    await click(button('Save'));
    expect(brief.updateBriefSettings).toHaveBeenLastCalledWith({ recipients: null });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('send_time: Value error, send_time must be HH:MM');
  });

  it('test brief shows the returned status', async () => {
    vi.mocked(brief.sendTestBrief).mockResolvedValue({
      id: 9,
      tenant_id: 4,
      local_date: null,
      trigger: 'test',
      sent_at: '2026-10-24T10:00:00+00:00',
      recipients_count: 1,
      status: 'sent',
      narrative_ok: true,
      error: null,
    });
    await render();
    await click(button('Send me a test brief'));
    expect(brief.sendTestBrief).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Test brief sent.');
    expect(brief.listBriefSends).toHaveBeenCalledTimes(2);
  });
});
