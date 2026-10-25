/** Labels and styles shared by ProposalCard, the Warehouse › Stock inbox, and the Zava thread. */
import type { CSSProperties } from 'react';
import type { ProposalStatus } from '../../services/agentProposalsService';

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  failed: 'Failed',
  expired: 'Expired',
};

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export const muted: CSSProperties = { fontSize: '11px', color: 'var(--color-redwood-text-muted)' };
export const input: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '8px',
  padding: '7px 10px',
  fontSize: '12px',
  color: 'var(--color-redwood-text-main)',
};
export const approveBtn: CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(34,197,94,.28)',
  background: 'var(--color-badge-green-bg)',
  color: 'var(--color-brand-green-tint)',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};

export function chip(active: boolean): CSSProperties {
  return {
    background: active ? 'rgba(79,142,247,.18)' : 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '11px',
    color: 'var(--color-redwood-text-main)',
    cursor: 'pointer',
  };
}
