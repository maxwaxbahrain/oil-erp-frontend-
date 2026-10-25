import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '../../api/axios';
import { connectVoiceWS, getWsToken, setStoredApiKey } from '../voiceService';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
});

describe('voice socket auth', () => {
    it('sends the login and the tenant key when asking for a socket token', async () => {
        localStorage.setItem(ACCESS_TOKEN_KEY, 'login-token');
        setStoredApiKey('87d289ff-580e-59e2-86f8-55da18d0c619.secret');
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ token: 't', expires_in: 60, ws_path: '/ws/voice/a/8?token=t' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await getWsToken(8);

        const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer login-token');
        expect(headers['X-Tenant-Api-Key']).toBe('87d289ff-580e-59e2-86f8-55da18d0c619.secret');
    });

    it('stops on a rejected socket token instead of staying on connecting', async () => {
        vi.useFakeTimers();
        localStorage.setItem(ACCESS_TOKEN_KEY, 'login-token');
        setStoredApiKey('87d289ff-580e-59e2-86f8-55da18d0c619.secret');
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ detail: 'Not authenticated' }),
        });
        vi.stubGlobal('fetch', fetchMock);
        const statuses: string[] = [];

        connectVoiceWS({
            repId: 8,
            onMessage: () => {},
            onStatusChange: (status) => statuses.push(status),
        });

        await vi.advanceTimersByTimeAsync(0);
        expect(statuses.at(-1)).toBe('idle');
        await vi.advanceTimersByTimeAsync(60_000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
