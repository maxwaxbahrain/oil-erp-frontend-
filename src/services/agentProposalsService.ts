/**
 * Inventory agent proposals (app/agents/router.py, outside the agent gate).
 * A proposal is a pending row; only a person approving it runs the backend
 * service. Nothing here computes stock, money, or dates.
 */
import { authFetch } from '../api/axios';
import { ledgerQuery } from './inventoryLedgerService';
import { parseError } from './reorderService';

export type ProposalKind = 'draft_po' | 'snooze' | 'bin_transfer';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'failed' | 'expired';

export const PROPOSAL_STATUSES: ProposalStatus[] = ['pending', 'approved', 'rejected', 'failed', 'expired'];

export interface DraftPoProposalResult {
  po_id: number;
  po_number: string;
  status: string;
}

export interface SnoozeProposalResult {
  product_id: number;
  until: string;
}

export interface BinTransferProposalResult {
  source_id: string;
  movement_ids: number[];
  from_location_id: number;
  to_location_id: number;
  quantity: number;
}

/** proposal_dict in app/agents/inventory/proposals.py. Timestamps are ISO with offset. */
export interface AgentProposal {
  id: number;
  kind: ProposalKind;
  status: ProposalStatus;
  summary: string;
  rationale: string | null;
  /** draft_po: {supplier_id, lines}; snooze: {product_id, days, reason}; bin_transfer: {product_id, from_location_id, to_location_id, quantity}. */
  payload: Record<string, unknown>;
  run_id: string | null;
  proposed_by_user_id: number | null;
  proposed_at: string | null;
  expires_at: string | null;
  decided_by_user_id: number | null;
  decided_at: string | null;
  reject_reason: string | null;
  result: DraftPoProposalResult | SnoozeProposalResult | BinTransferProposalResult | null;
  error: string | null;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return readJson<T>(ledgerQuery(path, {}), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function listProposals(status?: ProposalStatus, limit?: number): Promise<AgentProposal[]> {
  const body = await readJson<{ proposals: AgentProposal[] }>(ledgerQuery('/agent/proposals', { status, limit }));
  return body.proposals ?? [];
}

/** 200 with status approved or failed. 403 without the write role, 404 another tenant, 409 decided or expired. */
export function approveProposal(id: number): Promise<AgentProposal> {
  return postJson<AgentProposal>(`/agent/proposals/${id}/approve`, {});
}

export function rejectProposal(id: number, reason?: string | null): Promise<AgentProposal> {
  const trimmed = (reason ?? '').trim();
  return postJson<AgentProposal>(`/agent/proposals/${id}/reject`, { reason: trimmed || null });
}
