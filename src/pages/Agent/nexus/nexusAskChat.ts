import api from '../../../api/axios';
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
};

/**
 * Older backends reject unknown body fields (extra="forbid" → 422/400).
 * After one such rejection we stop sending `history` until the page reloads.
 */
let historyUnsupported = false;

/** Test-only: reset the session flag. */
export function __resetChatHistorySupportForTests(): void {
  historyUnsupported = false;
}

function isHistoryRejection(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 422 || status === 400;
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
  const headline = (response.data.headline || response.data.answer || '').trim();
  if (!headline) throw new Error('empty');
  const detail = String(response.data.note || response.data.answer || '').trim();
  const buttons = navButtonsFromBlocks(response.data.blocks);
  return {
    headline,
    detail: detail && detail !== headline ? detail : '',
    buttons,
  };
}
