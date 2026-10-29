import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { parseSseDataLines, readAgentChatSse, askZavaChatPreferStream, __resetChatHistorySupportForTests } from './nexusAskChat';

describe('parseSseDataLines', () => {
  it('parses token and done events', () => {
    const frame = 'data: {"token":"Hello "}\n\ndata: {"token":"world."}\n';
    const events = parseSseDataLines(frame);
    expect(events[0]?.token).toBe('Hello ');
    expect(events[1]?.token).toBe('world.');
  });
});

describe('readAgentChatSse', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('accumulates tokens and calls onPartial progressively', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('data: {"token":"First sent."}\n\n'),
      encoder.encode('data: {"headline":"First sent.","done":true}\n\n'),
    ];
    let i = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (i >= chunks.length) return { done: true, value: undefined };
              return { done: false, value: chunks[i++] };
            },
            cancel: vi.fn(),
          }),
        },
      }),
    );

    const partials: string[] = [];
    const sentences: string[] = [];
    const result = await readAgentChatSse(
      { message: 'hi', mode: 'voice', stream: true },
      {
        onPartial: (t) => partials.push(t),
        onSentence: (s) => sentences.push(s),
      },
      60_000,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answer.headline).toBe('First sent.');
    expect(partials).toEqual(['First sent.']);
    expect(sentences).toContain('First sent.');
  });

  it('returns ok:false when no events within idle window', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', { getItem: () => null });
    let rejectRead: ((e: Error) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              new Promise((_resolve, reject) => {
                rejectRead = reject;
              }),
            cancel: () => rejectRead?.(new Error('cancelled')),
          }),
        },
      }),
    );

    const pending = readAgentChatSse(
      { message: 'hi', mode: 'voice', stream: true },
      { onPartial: vi.fn() },
      100,
    );
    await vi.advanceTimersByTimeAsync(150);
    const result = await pending;
    expect(result.ok).toBe(false);
    vi.useRealTimers();
  });
});

describe('askZavaChatPreferStream fallback', () => {
  beforeEach(() => {
    __resetChatHistorySupportForTests();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('falls back to JSON post when stream fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    vi.doMock('../../../api/axios', () => ({
      default: {
        post: vi.fn().mockResolvedValue({
          data: { headline: 'JSON answer.', note: '', answer: 'JSON answer.' },
        }),
      },
      ACCESS_TOKEN_KEY: 'access_token',
    }));
    const { askZavaChatPreferStream } = await import('./nexusAskChat');
    const api = (await import('../../../api/axios')).default;
    const answer = await askZavaChatPreferStream('hello');
    expect(answer.headline).toBe('JSON answer.');
    expect(api.post).toHaveBeenCalledWith('/api/agent/chat', { message: 'hello' }, expect.any(Object));
  });
});
