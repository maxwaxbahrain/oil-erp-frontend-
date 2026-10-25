/**
 * Hands-free wake word — "Zava" must lead the utterance (optionally after a short greeting).
 * No cut-off: the FINAL Web Speech transcript of the whole utterance is used.
 */

import { normalizeVoicePhrase } from '../nexus/voiceIntent';

export type WakeMatch =
  | { kind: 'none' }
  | { kind: 'bare' }
  | { kind: 'command'; rest: string };

/** Allowed one-word greetings immediately before "zava". */
export const WAKE_GREETINGS = new Set(['hey', 'hi', 'ok', 'okay', 'hello']);

/**
 * Wake is the first content word "zava", or "greeting + zava" at the start.
 * Rejects near-misses (java/lava/saver) and "zava" not at the start.
 */
export function matchWakeUtterance(raw: string): WakeMatch {
  const t = normalizeVoicePhrase(raw);
  if (!t) return { kind: 'none' };
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { kind: 'none' };

  let zavaIndex = -1;
  if (words[0] === 'zava') {
    zavaIndex = 0;
  } else if (WAKE_GREETINGS.has(words[0]) && words[1] === 'zava') {
    zavaIndex = 1;
  } else {
    return { kind: 'none' };
  }

  const rest = words.slice(zavaIndex + 1).join(' ');
  if (!rest) return { kind: 'bare' };
  return { kind: 'command', rest };
}

/** Strip a leading wake (and optional greeting); otherwise return normalized text. */
export function stripWakeWord(raw: string): string {
  const match = matchWakeUtterance(raw);
  if (match.kind === 'command') return match.rest;
  if (match.kind === 'bare') return '';
  return normalizeVoicePhrase(raw);
}
