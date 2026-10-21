import { describe, expect, it } from 'vitest';

import {
  HANDS_FREE_PREFS_LOAD_ERROR,
  HANDS_FREE_UNSUPPORTED_HINT,
  handsFreeSupported,
  isChromeOrEdge,
} from './browserSupport';

describe('hands-free browser support', () => {
  it('allows Chrome and Edge only', () => {
    expect(isChromeOrEdge('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36')).toBe(true);
    expect(isChromeOrEdge('Mozilla/5.0 Edg/120.0.0.0 Chrome/120 Safari/537.36')).toBe(true);
    expect(isChromeOrEdge('Mozilla/5.0 Firefox/120.0')).toBe(false);
    expect(isChromeOrEdge('Mozilla/5.0 Safari/605.1.15')).toBe(false);
    expect(HANDS_FREE_UNSUPPORTED_HINT).toMatch(/Chrome or Edge/);
  });

  it('requires Web Speech when checking full support', () => {
    const win = {
      SpeechRecognition: undefined,
      webkitSpeechRecognition: undefined,
    } as unknown as Window & typeof globalThis;
    expect(handsFreeSupported('Mozilla/5.0 Chrome/120.0.0.0', win)).toBe(false);
    const ok = {
      webkitSpeechRecognition: function Fake() {},
    } as unknown as Window & typeof globalThis;
    expect(handsFreeSupported('Mozilla/5.0 Chrome/120.0.0.0', ok)).toBe(true);
  });

  it('exposes prefs load failure copy', () => {
    expect(HANDS_FREE_PREFS_LOAD_ERROR).toBe("Couldn't load voice settings");
  });
});
