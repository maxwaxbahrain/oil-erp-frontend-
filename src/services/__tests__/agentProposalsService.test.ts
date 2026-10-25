import { afterEach, describe, expect, it, vi } from 'vitest';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../api/axios', () => ({ authFetch }));
vi.mock('../api', () => ({ API_BASE_URL: 'https://api.test/api' }));

import { approveProposal, listProposals, rejectProposal } from '../agentProposalsService';

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe('agentProposalsService URLs and bodies match app/agents/router.py', () => {
  afterEach(() => authFetch.mockReset());

  it('lists proposals with and without a status filter', async () => {
    authFetch.mockImplementation(() => ok({ proposals: [{ id: 1 }] }));
    expect(await listProposals()).toEqual([{ id: 1 }]);
    await listProposals('pending');
    await listProposals('failed', 20);

    expect(authFetch.mock.calls.map((call) => call[0])).toEqual([
      'https://api.test/api/agent/proposals',
      'https://api.test/api/agent/proposals?status=pending',
      'https://api.test/api/agent/proposals?status=failed&limit=20',
    ]);
  });

  it('posts approve with an empty body and reject with a reason or null', async () => {
    authFetch.mockImplementation(() => ok({ id: 4, status: 'approved' }));
    await approveProposal(4);
    await rejectProposal(4, '  Wrong supplier ');
    await rejectProposal(5, '   ');
    await rejectProposal(6);

    const calls = authFetch.mock.calls.map(([url, init]) => [url, init?.method, JSON.parse(init.body)]);
    expect(calls).toEqual([
      ['https://api.test/api/agent/proposals/4/approve', 'POST', {}],
      ['https://api.test/api/agent/proposals/4/reject', 'POST', { reason: 'Wrong supplier' }],
      ['https://api.test/api/agent/proposals/5/reject', 'POST', { reason: null }],
      ['https://api.test/api/agent/proposals/6/reject', 'POST', { reason: null }],
    ]);
  });

  it('surfaces the backend detail on 409 and 403', async () => {
    authFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ detail: 'Proposal is approved' }), { status: 409 })));
    await expect(approveProposal(4)).rejects.toThrow('Proposal is approved');
    authFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ detail: 'Not enough permissions' }), { status: 403 })));
    await expect(rejectProposal(4, 'x')).rejects.toThrow('Not enough permissions');
  });
});
