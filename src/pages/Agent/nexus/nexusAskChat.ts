import api, { ACCESS_TOKEN_KEY } from '../../../api/axios';
import type { SpatialBlock } from '../spatial';
import { navButtonsFromBlocks, type AskAnswer } from './nexusAskNav';
import { trimChatHistory, type ChatTurn } from './nexusVoiceCapture';

export type { AskAnswer, AskNavButton } from './nexusAskNav';
export type { ChatTurn as ChatHistoryTurn } from './nexusVoiceCapture';

type ChatResponse = {
  answer?: string;
  headline?: string;
  note?: string | null;
  blocks?: SpatialBlock[];
  done?: boolean;
  error?: string;
  token?: string;
};

export type AskZavaStreamHooks = {
  onPartial?: (text: string) => void;
  onSentence?: (sentence: string) => void;
};

/**
 * Older backends reject unknown body fields (extra="forbid" → 422/400).
 * After one such rejection we stop sending `history` until the page reloads.
 */
let historyUnsupported = false;

export const STREAM_IDLE_MS = 5_000;

/** Test-only: reset the session flag. */
export function __resetChatHistorySupportForTests(): void {
  historyUnsupported = false;
}

function isHistoryRejection(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 422 || status === 400;
}

function chatBaseUrl(): string {
  return String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .trim()
    .replace(/\/+$/, '');
}

export function payloadToAskAnswer(data: ChatResponse): AskAnswer {
  const headline = (data.headline || data.answer || '').trim();
  if (!headline) throw new Error('empty');
  const detail = String(data.note || data.answer || '').trim();
  const buttons = navButtonsFromBlocks(data.blocks);
  return {
    headline,
    detail: detail && detail !== headline ? detail : '',
    buttons,
  };
}

function buildChatPayload(message: string, history?: ChatTurn[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    message,
    mode: 'voice',
    stream: true,
  };
  const trimmed = history && !historyUnsupported ? trimChatHistory(history) : [];
  if (trimmed.length) payload.history = trimmed;
  return payload;
}

/** Parse one SSE block (`data: {...}` lines). */
export function parseSseDataLines(frame: string): ChatResponse[] {
  const out: ChatResponse[] = [];
  for (const line of frame.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const raw = line.slice(5).trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as ChatResponse);
    } catch {
      /* ignore malformed */
    }
  }
  return out;
}

type StreamReadResult = { ok: true; answer: AskAnswer } | { ok: false };

/**
 * POST /api/agent/chat with stream:true. Returns ok:false when caller should fall back to JSON.
 */
export async function readAgentChatSse(
  payload: Record<string, unknown>,
  hooks: AskZavaStreamHooks,
  idleMs = STREAM_IDLE_MS,
): Promise<StreamReadResult> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'text/event-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${chatBaseUrl()}/api/agent/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false };
  }

  if (!res.ok || !res.body) {
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    return { ok: false };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let gotEvent = false;
  let donePayload: ChatResponse | undefined;
  let idleTimer = 0;
  let sentenceCursor = 0;

  const bumpIdle = () => {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      try {
        void reader.cancel();
      } catch {
        /* ignore */
      }
    }, idleMs);
  };

  const handlePayload = (evt: ChatResponse) => {
    gotEvent = true;
    bumpIdle();
    if (typeof evt.token === 'string' && evt.token) {
      accumulated += evt.token;
      hooks.onPartial?.(accumulated);
      sentenceCursor = drainNewSentences(accumulated, sentenceCursor, hooks);
    }
    if (evt.error && evt.done) {
      donePayload = { answer: evt.error, headline: evt.error };
    }
    if (evt.done && !evt.token) {
      donePayload = evt;
    }
  };

  bumpIdle();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const evt of parseSseDataLines(frame)) {
          handlePayload(evt);
        }
      }
    }
    if (buffer.trim()) {
      for (const evt of parseSseDataLines(buffer)) {
        handlePayload(evt);
      }
    }
  } catch {
    window.clearTimeout(idleTimer);
    return { ok: false };
  }

  window.clearTimeout(idleTimer);

  if (!gotEvent) return { ok: false };

  try {
    if (donePayload != null) {
      const done = donePayload;
      const merged: ChatResponse = {
        ...done,
        answer: done.answer || accumulated || done.headline,
        headline: done.headline || accumulated || done.answer,
      };
      const answer = payloadToAskAnswer(merged);
      flushTailSentences(
        [answer.headline, answer.detail].filter(Boolean).join(' '),
        sentenceCursor,
        hooks,
      );
      return { ok: true, answer };
    }
    if (accumulated.trim()) {
      flushTailSentences(accumulated, sentenceCursor, hooks);
      return {
        ok: true,
        answer: payloadToAskAnswer({ answer: accumulated, headline: accumulated }),
      };
    }
  } catch {
    return { ok: false };
  }
  return { ok: false };
}

function drainNewSentences(full: string, cursor: number, hooks: AskZavaStreamHooks): number {
  if (!hooks.onSentence) return cursor;
  let pos = cursor;
  let rest = full.slice(pos);
  while (rest.length) {
    const m = rest.match(/^(.+?[.!?])(?:\s+|$)/);
    if (!m?.[1]) break;
    const sent = m[1].trim();
    pos += m[0].length;
    hooks.onSentence(sent);
    rest = full.slice(pos);
  }
  return pos;
}

function flushTailSentences(full: string, cursor: number, hooks: AskZavaStreamHooks) {
  const pos = drainNewSentences(full, cursor, hooks);
  const tail = full.slice(pos).trim();
  if (tail && hooks.onSentence) hooks.onSentence(tail);
}

export async function askZavaChatStream(
  message: string,
  history?: ChatTurn[],
  hooks?: AskZavaStreamHooks,
): Promise<AskAnswer | null> {
  const payload = buildChatPayload(message, history);
  const streamHooks: AskZavaStreamHooks = {
    onPartial: hooks?.onPartial,
    onSentence: hooks?.onSentence,
  };
  const result = await readAgentChatSse(payload, streamHooks);
  if (!result.ok) return null;
  return result.answer;
}

export async function askZavaChatPreferStream(
  message: string,
  history?: ChatTurn[],
  hooks?: AskZavaStreamHooks,
): Promise<AskAnswer> {
  const streamed = await askZavaChatStream(message, history, hooks);
  if (streamed) return streamed;
  return askZavaChat(message, history);
}

export async function askZavaChat(message: string, history?: ChatTurn[]): Promise<AskAnswer> {
  const payload: { message: string; history?: ChatTurn[] } = { message };
  const trimmed = history && !historyUnsupported ? trimChatHistory(history) : [];
  if (trimmed.length) payload.history = trimmed;

  let response;
  try {
    response = await api.post<ChatResponse>('/api/agent/chat', payload, { timeout: 70_000 });
  } catch (err) {
    if (!payload.history || !isHistoryRejection(err)) throw err;
    // Retry once without history and remember for this session.
    historyUnsupported = true;
    response = await api.post<ChatResponse>('/api/agent/chat', { message }, { timeout: 70_000 });
  }
  return payloadToAskAnswer(response.data);
}
