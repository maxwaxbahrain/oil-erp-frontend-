import { describe, expect, it } from 'vitest';

import { matchWakeUtterance, stripWakeWord } from './wakeWord';

describe('hands-free wake word', () => {
  it('accepts Zava as the first whole word with a command', () => {
    expect(matchWakeUtterance('Zava what are the updates')).toEqual({
      kind: 'command',
      rest: 'what are the updates',
    });
    expect(matchWakeUtterance('Zava, what are the updates?').kind).toBe('command');
    expect(stripWakeWord('Zava what are the updates')).toBe('what are the updates');
  });

  it('accepts a short greeting before zava', () => {
    expect(matchWakeUtterance('Hey Zava, what are the updates?')).toEqual({
      kind: 'command',
      rest: 'what are the updates',
    });
    expect(matchWakeUtterance('OK Zava open collections')).toEqual({
      kind: 'command',
      rest: 'open collections',
    });
    expect(matchWakeUtterance('hi zava').kind).toBe('bare');
    expect(matchWakeUtterance('okay zava').kind).toBe('bare');
    expect(matchWakeUtterance('hello zava what next').kind).toBe('command');
  });

  it('rejects near-misses and non-first Zava', () => {
    expect(matchWakeUtterance('Java').kind).toBe('none');
    expect(matchWakeUtterance('lava').kind).toBe('none');
    expect(matchWakeUtterance('saver').kind).toBe('none');
    expect(matchWakeUtterance('I told Zava').kind).toBe('none');
    expect(matchWakeUtterance('tell Zava the updates').kind).toBe('none');
  });

  it('treats bare Zava as wake-only → follow-up record path', () => {
    expect(matchWakeUtterance('Zava')).toEqual({ kind: 'bare' });
    expect(matchWakeUtterance('zava!')).toEqual({ kind: 'bare' });
    expect(stripWakeWord('Zava')).toBe('');
  });
});
