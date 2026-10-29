import { describe, expect, it, vi } from 'vitest';
import { createStreamSentenceSpeaker } from './nexusAskStreamSpeech';

vi.mock('./nexusSpeechOut', () => ({
  speakWithSynth: vi.fn(() => Promise.resolve()),
  cancelSynth: vi.fn(),
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

  it('does not speak a money sentence early', async () => {
    const { speakWithSynth } = await import('./nexusSpeechOut');
    vi.mocked(speakWithSynth).mockClear();
    const speaker = createStreamSentenceSpeaker();
    speaker.onText('You have $4,200 overdue.');
    await Promise.resolve();
    expect(speakWithSynth).not.toHaveBeenCalled();
    expect(speaker.spokeAny).toBe(false);
    speaker.flush('You have $4,200 overdue.');
    await speaker.wait();
    expect(speakWithSynth).toHaveBeenCalledWith('You have $4,200 overdue.');
  });

  it('skips queued sentences after cancel()', async () => {
    const { speakWithSynth, cancelSynth } = await import('./nexusSpeechOut');
    vi.mocked(speakWithSynth).mockClear();
    const speaker = createStreamSentenceSpeaker();
    speaker.onText('Hello there. More to come.');
    speaker.cancel();
    expect(cancelSynth).toHaveBeenCalled();
    await speaker.wait();
    expect(speakWithSynth).not.toHaveBeenCalled();
  });
});
