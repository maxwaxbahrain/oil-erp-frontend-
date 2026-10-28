import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { NEXUS_SILENCE_BEFORE_SUBMIT_MS, NEXUS_SHORT_UTTERANCE_WAIT_MS } from './nexusVoiceCapture';
import { startWebSpeechListen, webSpeechAvailable, webSpeechRecognitionCtor } from './nexusLiveSpeech';

describe('nexusLiveSpeech', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('detects missing SpeechRecognition', () => {
    vi.useRealTimers();
    expect(webSpeechAvailable()).toBe(false);
    expect(webSpeechRecognitionCtor()).toBeNull();
  });

  it('detects SpeechRecognition when present', () => {
    vi.useRealTimers();
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
        onTranscript: vi.fn(),
        onUtteranceReady: vi.fn(),
        onError,
        onEnd,
      },
      { noSpeechMs: 60_000, maxListenMs: 60_000 },
    );

    session.stop();
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();
  });

  it('reports network errors for upload fallback', async () => {
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
        onTranscript: vi.fn(),
        onUtteranceReady: vi.fn(),
        onError,
        onEnd: vi.fn(),
      },
      { noSpeechMs: 60_000, maxListenMs: 60_000 },
    );

    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith('network', { stoppedByUs: false });
  });

  it('joins multi-part finals and submits once after silence, not on first final', () => {
    class FakeRecognition {
      static last: FakeRecognition | null = null;
      continuous = true;
      interimResults = true;
      lang = 'en-US';
      onresult: ((ev: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null =
        null;
      onerror = null;
      onend: (() => void) | null = null;
      constructor() {
        FakeRecognition.last = this;
      }
      start() {}
      stop() {
        this.onend?.();
      }
    }
    vi.stubGlobal('SpeechRecognition', FakeRecognition);

    const onUtteranceReady = vi.fn();
    startWebSpeechListen(
      { onTranscript: vi.fn(), onUtteranceReady, onError: vi.fn(), onEnd: vi.fn() },
      { noSpeechMs: 60_000, maxListenMs: 60_000 },
    );

    const liveRec = FakeRecognition.last!;
    liveRec.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'who owes' } }],
    });
    expect(onUtteranceReady).not.toHaveBeenCalled();

    liveRec.onresult?.({
      resultIndex: 1,
      results: [
        { isFinal: true, 0: { transcript: 'who owes' } },
        { isFinal: true, 0: { transcript: 'the most' } },
      ],
    });
    expect(onUtteranceReady).not.toHaveBeenCalled();

    vi.advanceTimersByTime(NEXUS_SILENCE_BEFORE_SUBMIT_MS);
    expect(onUtteranceReady).toHaveBeenCalledTimes(1);
    expect(onUtteranceReady).toHaveBeenCalledWith('who owes the most');
  });

  it('waits longer for 1–2 unknown words before submit', () => {
    class FakeRecognition {
      static last: FakeRecognition | null = null;
      continuous = true;
      interimResults = true;
      lang = 'en-US';
      onresult: ((ev: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null =
        null;
      onerror = null;
      onend: (() => void) | null = null;
      constructor() {
        FakeRecognition.last = this;
      }
      start() {}
      stop() {
        this.onend?.();
      }
    }
    vi.stubGlobal('SpeechRecognition', FakeRecognition);

    const onUtteranceReady = vi.fn();
    startWebSpeechListen(
      { onTranscript: vi.fn(), onUtteranceReady, onError: vi.fn(), onEnd: vi.fn() },
      { noSpeechMs: 60_000, maxListenMs: 60_000 },
    );
    FakeRecognition.last!.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'order' } }],
    });
    vi.advanceTimersByTime(NEXUS_SILENCE_BEFORE_SUBMIT_MS);
    expect(onUtteranceReady).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NEXUS_SHORT_UTTERANCE_WAIT_MS);
    expect(onUtteranceReady).toHaveBeenCalledWith('order');
  });
});
