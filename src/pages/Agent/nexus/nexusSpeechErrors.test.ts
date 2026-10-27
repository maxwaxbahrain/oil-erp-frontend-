import { describe, expect, it } from 'vitest';
import { NO_SPEECH_HEARD_MSG, plainSpeechError, shouldFallbackToUpload } from './nexusSpeechErrors';

describe('plainSpeechError', () => {
  it('maps common recogniser codes to plain English', () => {
    expect(plainSpeechError('not-allowed')).toContain('Microphone blocked');
    expect(plainSpeechError('audio-capture')).toContain('No microphone found');
    expect(plainSpeechError('network')).toContain('using backup');
    expect(plainSpeechError('no-speech')).toBe(NO_SPEECH_HEARD_MSG);
  });
});

describe('shouldFallbackToUpload', () => {
  it('is true for network/service/aborted only', () => {
    expect(shouldFallbackToUpload('network')).toBe(true);
    expect(shouldFallbackToUpload('aborted')).toBe(true);
    expect(shouldFallbackToUpload('not-allowed')).toBe(false);
  });
});
