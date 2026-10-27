import { describe, expect, it } from 'vitest';
import {
  joinSpeechTranscript,
  shouldWaitForMoreWords,
  trimChatHistory,
  voiceLinesToHistory,
} from './nexusVoiceCapture';

describe('nexusVoiceCapture', () => {
  it('joins all final segments and trailing interim', () => {
    expect(joinSpeechTranscript(['what are', 'the vans'], 'doing')).toBe('what are the vans doing');
    expect(joinSpeechTranscript(['order'], ' more stock please')).toBe('order more stock please');
  });

  it('does not submit early on first final alone — short unknown waits', () => {
    expect(shouldWaitForMoreWords('order')).toBe(true);
    expect(shouldWaitForMoreWords('what are')).toBe(true);
    expect(shouldWaitForMoreWords('yes')).toBe(false);
    expect(shouldWaitForMoreWords('stop')).toBe(false);
    expect(shouldWaitForMoreWords('who owes the most')).toBe(false);
  });

  it('keeps at most 6 chat turns for history', () => {
    const lines = Array.from({ length: 8 }, (_, i) => ({
      who: (i % 2 === 0 ? 'you' : 'zava') as 'you' | 'zava',
      text: `line ${i}`,
    }));
    const h = voiceLinesToHistory(lines);
    expect(h).toHaveLength(6);
    expect(h[0].content).toBe('line 2');
    expect(trimChatHistory(h, 3)).toHaveLength(3);
  });
});
