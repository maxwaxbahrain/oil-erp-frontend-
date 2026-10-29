import { describe, expect, it } from 'vitest';
import {
  historyBeforeCurrentQuestion,
  joinSpeechTranscript,
  shouldWaitForMoreWords,
  trimChatHistory,
  voiceLinesToHistory,
  looksUnfinished, cleanSpokenQuestion, isSmallTalk
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

  it('keeps the last Zava answer when the current question is already in the turns', () => {
    const lines = [
      { who: 'you' as const, text: 'Who owes the most?' },
      { who: 'zava' as const, text: 'Alpha owes $100.' },
      { who: 'you' as const, text: 'and the second one?' },
    ];
    expect(historyBeforeCurrentQuestion(lines, 'and the second one?')).toEqual([
      { role: 'user', content: 'Who owes the most?' },
      { role: 'assistant', content: 'Alpha owes $100.' },
    ]);
    expect(historyBeforeCurrentQuestion(lines.slice(0, 2), 'and the second one?')).toEqual([
      { role: 'user', content: 'Who owes the most?' },
      { role: 'assistant', content: 'Alpha owes $100.' },
    ]);
  });

  describe('conversation polish', () => {
    it('waits when a sentence stops mid-way', () => {
      expect(looksUnfinished('what are the')).toBe(true);
      expect(looksUnfinished('who owes the most')).toBe(false);
      expect(looksUnfinished('show me sales for')).toBe(true);
      expect(shouldWaitForMoreWords('how much stock do we have of')).toBe(true);
      expect(shouldWaitForMoreWords('how much stock do we have')).toBe(false);
      expect(shouldWaitForMoreWords('stop')).toBe(false);
    });
    it('strips greetings and misheard wake words', () => {
      expect(cleanSpokenQuestion('hey Java who owes the most')).toBe('who owes the most');
      expect(cleanSpokenQuestion('hello, Zava. what are the vans doing')).toBe('what are the vans doing');
      expect(cleanSpokenQuestion('hey Ja')).toBe('');
      expect(cleanSpokenQuestion('Javascript errors')).toBe('Javascript errors');
    });
    it('treats greetings and small talk as small talk', () => {
      expect(isSmallTalk('hey hello')).toBe(true);
      expect(isSmallTalk('hey Ja')).toBe(true);
      expect(isSmallTalk('hello how are you doing today')).toBe(true);
      expect(isSmallTalk('who owes the most')).toBe(false);
      expect(isSmallTalk("hey Zava what are today's sales")).toBe(false);
    });
  });
});
