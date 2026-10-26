import api from '../../../api/axios';
import type { SpatialBlock } from '../spatial';
import { navButtonsFromBlocks, type AskAnswer } from './nexusAskNav';

export type { AskAnswer, AskNavButton } from './nexusAskNav';

export async function askZavaChat(message: string): Promise<AskAnswer> {
  const response = await api.post<{
    answer?: string;
    headline?: string;
    note?: string | null;
    blocks?: SpatialBlock[];
  }>('/api/agent/chat', { message }, { timeout: 70_000 });
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
