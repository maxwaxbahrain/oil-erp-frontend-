import type { CSSProperties } from 'react';
import type { CustomerDraftView } from './nexusAskCreateCustomer';
import { formatCategoryLabel } from './nexusAskCreateCustomer';

const GREEN = '#22c55e';
const BLUE = '#4F8EF7';
const AMBER = '#FBBF24';
const RED = '#F87171';

type Props = {
  draft: CustomerDraftView;
  userLabel: string;
  duplicateChoice: 'pending' | 'create_anyway';
  createDisabled: boolean;
  creating: boolean;
  createError: string | null;
  voiceConfirmActive: boolean;
  voiceConfirmExpired: boolean;
  onCreate: () => void;
  onOpenForm: () => void;
  onDismiss: () => void;
  onOpenDuplicate: (id: number) => void;
  onCreateAnyway: () => void;
};

export default function NexusAskCustomerDraft({
  draft,
  userLabel,
  duplicateChoice,
  createDisabled,
  creating,
  createError,
  voiceConfirmActive,
  voiceConfirmExpired,
  onCreate,
  onOpenForm,
  onDismiss,
  onOpenDuplicate,
  onCreateAnyway,
}: Props) {
  const f = draft.fields;
  const showOpening =
    draft.openingBalanceMentioned || draft.openingBalanceFromApi;
  const dup = draft.duplicates[0];

  return (
    <div style={card} data-testid="nexus-customer-draft">
      <div style={headRow}>
        <span style={eyebrow}>NEW CUSTOMER — DRAFT</span>
        <span style={badge}>NEEDS CONFIRM</span>
      </div>
      <div style={titleStyle}>{f.name || '—'}</div>

      <dl style={fieldList}>
        {f.category ? (
          <>
            <dt>Category</dt>
            <dd>{formatCategoryLabel(f.category)}</dd>
          </>
        ) : null}
        {f.phone ? (
          <>
            <dt>Phone</dt>
            <dd>{f.phone}</dd>
          </>
        ) : null}
        {f.email ? (
          <>
            <dt>Email</dt>
            <dd>{f.email}</dd>
          </>
        ) : null}
        {f.address ? (
          <>
            <dt>Address</dt>
            <dd>{f.address}</dd>
          </>
        ) : null}
        {f.credit_limit != null ? (
          <>
            <dt>Credit limit</dt>
            <dd>${Math.round(f.credit_limit).toLocaleString('en-US')}</dd>
          </>
        ) : null}
        {showOpening ? (
          <>
            <dt>Opening balance</dt>
            <dd>— (use full form)</dd>
          </>
        ) : null}
      </dl>

      {draft.warnings.length > 0 && (
        <ul data-testid="nexus-draft-warnings" style={warnList}>
          {draft.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {showOpening && (
        <div data-testid="nexus-draft-opening-note" style={infoBox}>
          Opening balance must be entered in the full form.
        </div>
      )}

      {dup && duplicateChoice === 'pending' && (
        <div data-testid="nexus-draft-duplicates" style={dupBox}>
          A customer named <strong>{dup.name}</strong> already exists.
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" style={ghostBtn} data-testid="nexus-draft-open-dup" onClick={() => onOpenDuplicate(dup.id)}>
              Open existing
            </button>
            <button type="button" style={ghostBtn} data-testid="nexus-draft-create-anyway" onClick={onCreateAnyway}>
              Create anyway
            </button>
          </div>
        </div>
      )}

      <p style={foot}>
        Nothing is saved until you confirm. Logged under your name{userLabel ? ` (${userLabel})` : ''}.
      </p>

      {voiceConfirmActive && !voiceConfirmExpired && (
        <p data-testid="nexus-draft-voice-active" style={voiceHint}>
          Say <strong>confirm</strong> or <strong>create customer</strong> to create (30s).
        </p>
      )}
      {voiceConfirmExpired && (
        <p data-testid="nexus-draft-voice-expired" style={voiceHint}>
          Voice confirm expired — use the button.
        </p>
      )}

      {createError && (
        <p data-testid="nexus-draft-create-error" role="alert" style={err}>
          {createError}
        </p>
      )}

      <div style={btnRow}>
        <button
          type="button"
          data-testid="nexus-draft-create"
          style={{ ...primaryBtn, opacity: createDisabled || creating ? 0.55 : 1 }}
          disabled={createDisabled || creating}
          onClick={onCreate}
        >
          {creating ? 'Creating…' : 'Create customer'}
        </button>
        <button type="button" data-testid="nexus-draft-open-form" style={secondaryBtn} onClick={onOpenForm}>
          Open full form
        </button>
        <button type="button" data-testid="nexus-draft-cancel" style={ghostBtn} onClick={onDismiss}>
          Cancel
        </button>
      </div>
    </div>
  );
}

type SuccessProps = {
  name: string;
  userLabel: string;
  customerId: string;
  undoSecondsLeft: number;
  undoError: string | null;
  onOpen: () => void;
  onInvoice: () => void;
  onUndo: () => void;
};

export function NexusAskCustomerCreated({
  name,
  userLabel,
  customerId,
  undoSecondsLeft,
  undoError,
  onOpen,
  onInvoice,
  onUndo,
}: SuccessProps) {
  return (
    <div style={{ ...card, borderColor: 'rgba(34,197,94,0.45)' }} data-testid="nexus-customer-created">
      <div style={headRow}>
        <span style={{ ...eyebrow, color: GREEN }}>Customer created ✓</span>
        <span style={{ ...badge, color: GREEN, borderColor: GREEN }}>DONE</span>
      </div>
      <div style={titleStyle}>{name}</div>
      <p style={foot}>
        Created by {userLabel || 'you'} via Zava
      </p>
      <div style={btnRow}>
        <button type="button" data-testid="nexus-created-open" style={primaryBtn} onClick={onOpen}>
          Open customer
        </button>
        <button type="button" data-testid="nexus-created-invoice" style={secondaryBtn} onClick={onInvoice}>
          New invoice
        </button>
      </div>
      {undoError && (
        <p data-testid="nexus-created-undo-error" style={{ ...foot, color: '#FBBF24', marginTop: 8 }}>
          {undoError}
        </p>
      )}
      {undoSecondsLeft > 0 && !undoError && (
        <button type="button" data-testid="nexus-created-undo" style={{ ...ghostBtn, marginTop: 8 }} onClick={onUndo}>
          Undo ({undoSecondsLeft}s)
        </button>
      )}
      <span data-testid="nexus-created-id" hidden>
        {customerId}
      </span>
    </div>
  );
}

const card: CSSProperties = {
  background: 'rgba(10,18,34,0.92)',
  border: '1px solid rgba(79,142,247,0.35)',
  borderRadius: 12,
  padding: 12,
};

const headRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
};

const eyebrow: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.12em',
  color: '#94A3B8',
};

const badge: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.08em',
  color: BLUE,
  border: `1px solid ${BLUE}`,
  borderRadius: 4,
  padding: '2px 6px',
};

const titleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: '#F8FAFC',
  marginBottom: 8,
  lineHeight: 1.25,
};

const fieldList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '4px 10px',
  margin: '0 0 8px',
  fontSize: 12,
  color: '#CBD5E1',
};

const foot: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 11,
  color: '#64748B',
  lineHeight: 1.35,
};

const warnList: CSSProperties = {
  margin: '0 0 8px',
  paddingLeft: 16,
  fontSize: 11,
  color: AMBER,
};

const infoBox: CSSProperties = {
  fontSize: 11,
  color: '#93C5FD',
  background: 'rgba(79,142,247,0.12)',
  border: '1px solid rgba(79,142,247,0.35)',
  borderRadius: 8,
  padding: '8px 10px',
  marginBottom: 8,
  lineHeight: 1.35,
};

const dupBox: CSSProperties = {
  fontSize: 12,
  color: '#E2E8F0',
  background: 'rgba(251,191,36,0.1)',
  border: '1px solid rgba(251,191,36,0.35)',
  borderRadius: 8,
  padding: '8px 10px',
  marginBottom: 8,
};

const voiceHint: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 11,
  color: '#94A3B8',
};

const err: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12,
  color: RED,
};

const btnRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10,
};

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '8px 12px',
  background: GREEN,
  color: '#04120a',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
};

const secondaryBtn: CSSProperties = {
  border: `1px solid ${BLUE}`,
  borderRadius: 10,
  padding: '8px 12px',
  background: 'transparent',
  color: '#E2E8F0',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

const ghostBtn: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.35)',
  borderRadius: 10,
  padding: '8px 12px',
  background: 'transparent',
  color: '#94A3B8',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
};
