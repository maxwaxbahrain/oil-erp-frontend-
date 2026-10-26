import { describe, expect, it, vi, afterEach } from 'vitest';
import { webSpeechAvailable, webSpeechRecognitionCtor } from './nexusLiveSpeech';

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
});
