import { describe, expect, it, vi, afterEach } from 'vitest';
import { startWebSpeechListen, webSpeechAvailable, webSpeechRecognitionCtor } from './nexusLiveSpeech';

describe('nexusLiveSpeech', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects missing SpeechRecognition', () => {
    expect(webSpeechAvailable()).toBe(false);
    expect(webSpeechRecognitionCtor()).toBeNull();
  });

  it('detects SpeechRecognition when present', () => {
    class FakeRecognition {}
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    expect(webSpeechAvailable()).toBe(true);
  });

  it('ignores aborted on intentional stop (tap / timeout / claimMic)', () => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = 'en-US';
      onresult = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {}
      stop() {
        this.onerror?.({ error: 'aborted' });
        this.onend?.();
      }
    }
    vi.stubGlobal('SpeechRecognition', FakeRecognition);

    const onError = vi.fn();
    const onEnd = vi.fn();
    const session = startWebSpeechListen(
      {
        onInterim: vi.fn(),
        onFinal: vi.fn(),
        onError,
        onEnd,
      },
      { noSpeechMs: 60_000, maxListenMs: 60_000 },
    );

    session.stop();
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();
  });

  it('reports network errors for upload fallback', () => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = 'en-US';
      onresult = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        queueMicrotask(() => this.onerror?.({ error: 'network' }));
      }
      stop() {}
    }
    vi.stubGlobal('SpeechRecognition', FakeRecognition);

    const onError = vi.fn();
    startWebSpeechListen(
      {
        onInterim: vi.fn(),
        onFinal: vi.fn(),
        onError,
        onEnd: vi.fn(),
      },
      { noSpeechMs: 60_000, maxListenMs: 60_000 },
    );

    return new Promise<void>((resolve) => {
      queueMicrotask(() => {
        expect(onError).toHaveBeenCalledWith('network', { stoppedByUs: false });
        resolve();
      });
    });
  });
});
