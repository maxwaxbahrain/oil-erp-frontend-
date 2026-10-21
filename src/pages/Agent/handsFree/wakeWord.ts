/**
 * Hands-free wake word — "Zava" must be the first whole word of the utterance.
 * No cut-off: the FINAL Web Speech transcript of the whole utterance is used.
 */

import { normalizeVoicePhrase } from '../nexus/voiceIntent';

export type WakeMatch =
  | { kind: 'none' }
  | { kind: 'bare' }
  | { kind: 'command'; rest: string };

/** First token must be exactly "zava" (whole word). */
export function matchWakeUtterance(raw: string): WakeMatch {
  const t = normalizeVoicePhrase(raw);
  if (!t) return { kind: 'none' };
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { kind: 'none' };
  if (words[0] !== 'zava') return { kind: 'none' };
  if (words.length === 1) return { kind: 'bare' };
  return { kind: 'command', rest: words.slice(1).join(' ') };
}

/** Strip a leading wake word when present; otherwise return normalized text. */
export function stripWakeWord(raw: string): string {
  const match = matchWakeUtterance(raw);
  if (match.kind === 'command') return match.rest;
  if (match.kind === 'bare') return '';
  return normalizeVoicePhrase(raw);
}
