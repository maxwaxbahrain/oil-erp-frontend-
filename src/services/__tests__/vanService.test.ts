import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vanService, type Van } from '../vanService';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

const van: Van = {
  id: 'van-1',
  van_number: 'Van 1',
  driver_name: 'Ahmed Khan',
  driver_phone: '+973-1234-5678',
  vehicle_number: 'BH-12345',
  capacity_liters: 5000,
  status: 'active',
};

describe('vanService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('create posts to /vans without a trailing slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 201, van));
    vi.stubGlobal('fetch', fetchMock);

    await vanService.create({
      van_number: 'Van 1',
      driver_name: 'Ahmed Khan',
      driver_phone: '+973-1234-5678',
      vehicle_number: 'BH-12345',
      capacity_liters: 5000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/vans')).toBe(true);
    expect(url.endsWith('/vans/')).toBe(false);
    expect(init.method).toBe('POST');
  });

  it('getAll rejects on a failed response and writes nothing to localStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(false, 404, { detail: 'Not Found' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(vanService.getAll()).rejects.toThrow('Not Found');
    expect(localStorage.getItem('vans')).toBeNull();
  });

  it('create rejects with backend detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResp(false, 422, { detail: 'van_number is required' })),
    );

    await expect(vanService.create({ driver_name: 'Ahmed Khan' })).rejects.toThrow(
      'van_number is required',
    );
  });

  it('getAll returns the array on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResp(true, 200, [van])));

    await expect(vanService.getAll()).resolves.toEqual([van]);
  });
});
