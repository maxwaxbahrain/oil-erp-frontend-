import { describe, expect, it, vi } from 'vitest';
import { createStreamSentenceSpeaker } from './nexusAskStreamSpeech';

vi.mock('./nexusSpeechOut', () => ({
  speakWithSynth: vi.fn(() => Promise.resolve()),
}));

describe('createStreamSentenceSpeaker', () => {
  it('speaks first sentence before full text is flushed', async () => {
    const { speakWithSynth } = await import('./nexusSpeechOut');
    const speaker = createStreamSentenceSpeaker();
    speaker.onText('Hello there. Still typing');
    await Promise.resolve();
    expect(speaker.spokeAny).toBe(true);
    expect(speakWithSynth).toHaveBeenCalledWith('Hello there.');
    speaker.flush('Hello there. Still typing more.');
    await speaker.wait();
    expect(speakWithSynth).toHaveBeenCalledWith('Still typing more.');
  });
});
