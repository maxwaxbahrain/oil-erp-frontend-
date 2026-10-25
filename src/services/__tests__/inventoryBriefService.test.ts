import { afterEach, describe, expect, it, vi } from 'vitest';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../api/axios', () => ({ authFetch }));
vi.mock('../api', () => ({ API_BASE_URL: 'https://api.test/api' }));

import { getBriefSettings, listBriefSends, sendTestBrief, updateBriefSettings } from '../inventoryBriefService';

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe('inventoryBriefService URLs and bodies match app/agents/router.py', () => {
  afterEach(() => authFetch.mockReset());

  it('pins settings, partial PUT, test, and sends', async () => {
    authFetch.mockImplementation(() => ok({}));
    await getBriefSettings();
    await updateBriefSettings({ send_time: '06:30', recipients: null });
    await sendTestBrief();
    authFetch.mockImplementation(() => ok({ sends: [{ id: 2 }] }));
    expect(await listBriefSends()).toEqual([{ id: 2 }]);
    await listBriefSends(10);

    const calls = authFetch.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET', init?.body ? JSON.parse(init.body) : undefined]);
    expect(calls).toEqual([
      ['https://api.test/api/agent/inventory-brief/settings', 'GET', undefined],
      ['https://api.test/api/agent/inventory-brief/settings', 'PUT', { send_time: '06:30', recipients: null }],
      ['https://api.test/api/agent/inventory-brief/test', 'POST', {}],
      ['https://api.test/api/agent/inventory-brief/sends', 'GET', undefined],
      ['https://api.test/api/agent/inventory-brief/sends?limit=10', 'GET', undefined],
    ]);
  });

  it('joins a 422 list as field: message', async () => {
    authFetch.mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ detail: [{ loc: ['body', 'send_time'], msg: 'Value error, send_time must be HH:MM' }] }),
      { status: 422 },
    )));
    await expect(updateBriefSettings({ send_time: '25:00' })).rejects.toThrow('send_time: Value error, send_time must be HH:MM');
  });
});
