/**
 * Full-sentence voice capture helpers — join finals + interim, defer short unknown phrases.
 */

import { parseVoiceIntent } from './voiceIntent';

export const NEXUS_SILENCE_BEFORE_SUBMIT_MS = 1500;
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

/** Words a person does not normally end a question on ("what are the…", "who owes my…"). */
const UNFINISHED_LAST_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'can', 'did', 'do', 'does', 'for', 'from', 'give', 'how',
  'i', 'in', 'is', 'many', 'much', 'my', 'of', 'on', 'or', 'our', 'show', 'tell', 'the',
  'their', 'to', 'uh', 'um', 'was', 'what', "what's", 'when', 'where', 'which', 'who', "who's",
  'why', 'with', 'your',
]);

/** True when the sentence clearly stops mid-way, e.g. "what are the". */
export function looksUnfinished(text: string): boolean {
  const words = text.trim().toLowerCase().replace(/[.,!?]+$/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  if (words.length === 1 && parseVoiceIntent(text).type !== 'unknown') return false;
  return UNFINISHED_LAST_WORDS.has(words[words.length - 1]);
}

/** Wait for more of the sentence: 1–2 unknown words, or a sentence that stops mid-way. */
export function shouldWaitForMoreWords(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (looksUnfinished(t)) return true;
  if (countWords(t) > 2) return false;
  return parseVoiceIntent(t).type === 'unknown';
}

/** Chrome often hears "Zava" as Java / Ja / Sava. */
const WAKE_WORDS = /^(zava|zaava|java|jaava|jova|ja|sava|saba|zaba|jaba)\b[\s,.!?]*/i;
const GREETINGS = /^(hey|hi|hello|hiya|ok|okay|so|um|uh|well)\b[\s,.!?]*/i;

/** Strip leading "hey / hello / Zava" so the AI gets only the real question. */
export function cleanSpokenQuestion(text: string): string {
  let t = text.trim();
  for (let i = 0; i < 4; i++) {
    const next = t.replace(GREETINGS, '').replace(WAKE_WORDS, '').trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

const SMALL_TALK = /^(how are you( doing)?( today)?|how's it going|how is it going|what's up|whats up|good (morning|afternoon|evening)|thanks|thank you|are you there|can you hear me)[\s.!?]*$/i;

/** Greeting-only or small talk: answer instantly on the device, no AI call. */
export function isSmallTalk(text: string): boolean {
  const q = cleanSpokenQuestion(text);
  return !q || SMALL_TALK.test(q);
}

export const SMALL_TALK_REPLY = "Hi! I'm here. Ask me about sales, stock, or who owes you money.";

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

/** Prior turns for /api/agent/chat. Drops the question just asked; keeps Zava's last answer. */
export function historyBeforeCurrentQuestion(
  lines: readonly { who: 'zava' | 'you'; text: string }[],
  question: string,
): ChatTurn[] {
  const q = question.trim();
  const last = lines[lines.length - 1];
  const prior = last && last.who === 'you' && last.text.trim() === q ? lines.slice(0, -1) : lines;
  return voiceLinesToHistory(prior);
}
