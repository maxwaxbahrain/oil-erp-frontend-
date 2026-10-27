import api from '../../../api/axios';
import type { SpatialBlock } from '../spatial';
import { navButtonsFromBlocks, type AskAnswer } from './nexusAskNav';
import { trimChatHistory, type ChatTurn } from './nexusVoiceCapture';

export type { AskAnswer, AskNavButton } from './nexusAskNav';
export type { ChatTurn as ChatHistoryTurn } from './nexusVoiceCapture';

export async function askZavaChat(message: string, history?: ChatTurn[]): Promise<AskAnswer> {
  const payload: { message: string; history?: ChatTurn[] } = { message };
  const trimmed = history ? trimChatHistory(history) : [];
  if (trimmed.length) payload.history = trimmed;

  const response = await api.post<{
    answer?: string;
    headline?: string;
    note?: string | null;
    blocks?: SpatialBlock[];
  }>('/api/agent/chat', payload, { timeout: 70_000 });
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
