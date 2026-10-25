/**
 * Proposals a Zava answer created, shown under that answer. Each card is the
 * same ProposalCard as Warehouse › Stock; nothing happens until a person approves.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { listProposals, type AgentProposal, type ProposalSummary } from '../../services/agentProposalsService';
import ProposalCard from '../Warehouse/ProposalCard';
import { PROPOSALS_NOTE } from './zavaCopy';

/** Summary-only row when the full proposal is not in the pending list (already decided, or the list failed). */
function fromSummary(item: ProposalSummary): AgentProposal {
    return {
        ...item,
        rationale: null,
        payload: {},
        run_id: null,
        proposed_by_user_id: null,
        proposed_at: null,
        expires_at: null,
        decided_by_user_id: null,
        decided_at: null,
        reject_reason: null,
        result: null,
        error: null,
    };
}

export default function ZavaProposals({ items }: { items: ProposalSummary[] }) {
    const { hasRole } = useAuth();
    const canDecide = hasRole('admin', 'manager', 'warehouse');
    const [rows, setRows] = useState<AgentProposal[]>(() => items.map(fromSummary));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        // One pending list per answer, matched by id.
        listProposals('pending')
            .then((pending) => {
                if (cancelled) return;
                const byId = new Map(pending.map((row) => [row.id, row]));
                setRows(items.map((item) => byId.get(item.id) ?? fromSummary(item)));
            })
            .catch(() => {
                // Keep the summary-only cards from the chat response.
            });
        return () => {
            cancelled = true;
        };
    }, [items]);

    if (!items.length) return null;

    return (
        <div className="mt-3" data-testid="zava-proposals">
            <p className="text-xs text-redwood-text-muted">{PROPOSALS_NOTE}</p>
            {error && <p role="alert" className="mt-1 text-xs" style={{ color: 'var(--color-brand-red)' }}>{error}</p>}
            <div className="mt-2 grid gap-2">
                {rows.map((row) => (
                    <ProposalCard
                        key={row.id}
                        proposal={row}
                        canDecide={canDecide}
                        onDecided={(decided) => {
                            setError(null);
                            setRows((current) => current.map((item) => (item.id === decided.id ? decided : item)));
                        }}
                        onError={setError}
                    />
                ))}
            </div>
        </div>
    );
}
