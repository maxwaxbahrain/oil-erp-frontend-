/** Hands-free Step A: Chrome / Edge (Chromium) only. */

export function isChromeOrEdge(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  const ua = userAgent || '';
  // Edge (Chromium) includes Edg/; Chrome includes Chrome/ but not Edg/
  if (/Edg\//i.test(ua)) return true;
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua) && !/OPR\//i.test(ua)) return true;
  return false;
}

export function hasWebSpeechRecognition(win: Window & typeof globalThis = window): boolean {
  const w = win as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return typeof w.SpeechRecognition === 'function' || typeof w.webkitSpeechRecognition === 'function';
}

export function handsFreeSupported(
  userAgent?: string,
  win: Window & typeof globalThis = typeof window !== 'undefined' ? window : ({} as Window & typeof globalThis),
): boolean {
  return isChromeOrEdge(userAgent) && hasWebSpeechRecognition(win);
}

export const HANDS_FREE_UNSUPPORTED_HINT = 'Hands-free needs Chrome or Edge.';
export const HANDS_FREE_PREFS_LOAD_ERROR = "Couldn't load voice settings";
