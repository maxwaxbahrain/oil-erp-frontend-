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

  it('enforces listen timeouts and upload fallback on speech errors', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).toMatch(/NEXUS_MAX_LISTEN_MS/);
    expect(src).toMatch(/onNoSpeech/);
    expect(src).toMatch(/shouldFallbackToUpload/);
    expect(src).toMatch(/startMediaRecorderListen/);
  });

  it('submits full utterance on silence, not per onFinal chunk', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).toMatch(/onUtteranceReady/);
    expect(src).not.toMatch(/onFinal:/);
  });

  it('stops listening before TTS and reopens after conversation delay', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).toMatch(/cancelListening\(\)/);
    expect(src).toMatch(/NEXUS_POST_TTS_LISTEN_DELAY_MS/);
    expect(src).toMatch(/NEXUS_CONVERSATION_FOLLOWUP_MS/);
    expect(src).toMatch(/historyBeforeCurrentQuestion/);
  });

  it('no-speech message only on mic tap, not conversation follow-up', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).toMatch(/listenModeRef\.current === 'tap'/);
  });
});
