/**
 * Full-sentence voice capture helpers — join finals + interim, defer short unknown phrases.
 */

import { parseVoiceIntent } from './voiceIntent';

export const NEXUS_SILENCE_BEFORE_SUBMIT_MS = 1200;
export const NEXUS_SHORT_UTTERANCE_WAIT_MS = 2500;
export const NEXUS_POST_TTS_LISTEN_DELAY_MS = 300;
export const NEXUS_CONVERSATION_FOLLOWUP_MS = 8000;
export const NEXUS_CHAT_HISTORY_MAX_TURNS = 6;

export function joinSpeechTranscript(finalParts: readonly string[], interim: string): string {
  const finals = finalParts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  const tail = interim.trim();
  if (!finals) return tail;
  if (!tail) return finals;
  if (tail.startsWith(finals)) return tail;
  if (finals.includes(tail)) return finals;
  return `${finals} ${tail}`.trim();
}

export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/** 1–2 words that are not a deterministic voice command — wait for more of the sentence. */
export function shouldWaitForMoreWords(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (countWords(t) > 2) return false;
  return parseVoiceIntent(t).type === 'unknown';
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export function trimChatHistory(turns: readonly ChatTurn[], max = NEXUS_CHAT_HISTORY_MAX_TURNS): ChatTurn[] {
  return turns.slice(-max);
}

export function voiceLinesToHistory(lines: readonly { who: 'zava' | 'you'; text: string }[]): ChatTurn[] {
  const mapped: ChatTurn[] = lines
    .map((l) => ({
      role: (l.who === 'you' ? 'user' : 'assistant') as ChatTurn['role'],
      content: l.text.trim(),
    }))
    .filter((l) => l.content);
  return trimChatHistory(mapped);
}
