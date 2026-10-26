import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('useNexusVoice transcript handling', () => {
  it('only uses didn\'t catch for empty transcripts in answerUnknownQuestion', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).toMatch(/if \(!q\) \{[\s\S]*didn't catch that/);
    expect(src).toMatch(/answerUnknownQuestion/);
    expect(src).not.toMatch(/case 'unknown':[\s\S]*didn't catch that/);
  });

  it('falls back to MediaRecorder when SpeechRecognition is missing', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).toMatch(/webSpeechAvailable/);
    expect(src).toMatch(/MediaRecorder/);
  });
});
