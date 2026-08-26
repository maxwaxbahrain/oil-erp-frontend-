import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { mapChannelWriteError, type MentionableUser } from '../../services/chatService';

const C = {
  bg3: 'var(--bg3, #0f1f33)',
  bg4: 'var(--bg4, #142540)',
  blue: 'var(--blue, #4F8EF7)',
  red: 'var(--red, #EF4444)',
  t: 'var(--t, #EEF2FF)',
  t2: 'var(--t2, #8BA3C7)',
  t3: 'var(--t3, #3E5678)',
  br2: 'var(--br2, rgba(255,255,255,.12))',
} as const;

export interface NewChannelModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; member_user_ids: number[] }) => Promise<void>;
  users: MentionableUser[];
  usersLoading: boolean;
  usersError: string | null;
  onRetryUsers: () => void;
  currentUserId: number | null;
  submitting: boolean;
  error: string | null;
}

function memberLabel(u: MentionableUser): string {
  return (u.full_name && u.full_name.trim()) || u.username;
}

export default function NewChannelModal({
  open,
  onClose,
  onSubmit,
  users,
  usersLoading,
  usersError,
  onRetryUsers,
  currentUserId,
  submitting,
  error,
}: NewChannelModalProps) {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSelectedIds([]);
    setLocalError(null);
  }, [open]);

  if (!open) return null;

  const pickableUsers = users.filter((u) => currentUserId == null || u.id !== currentUserId);

  function toggleMember(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError('Name is required');
      return;
    }
    if (trimmed.toLowerCase() === 'general') {
      setLocalError('General is reserved');
      return;
    }
    try {
      await onSubmit({ name: trimmed, member_user_ids: selectedIds });
    } catch (err) {
      setLocalError(mapChannelWriteError(err, 'Failed to create channel'));
    }
  }

  const displayError = localError ?? error;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        style={{
          background: C.bg3,
          border: `1px solid ${C.br2}`,
          borderRadius: 12,
          padding: 20,
          width: 420,
          maxWidth: '100%',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t }}>New Channel</div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.t3,
              cursor: submitting ? 'not-allowed' : 'pointer',
              padding: 4,
              display: 'flex',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.t2, marginBottom: 4 }}>
            Channel name *
          </label>
          <input
            type="text"
            value={name}
            maxLength={80}
            disabled={submitting}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Warehouse"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: C.bg4,
              border: `1px solid ${C.br2}`,
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              color: C.t,
              outline: 'none',
              marginBottom: 12,
            }}
          />

          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.t2, marginBottom: 4 }}>
            Members
          </label>
          <div style={{ fontSize: 10, color: C.t3, marginBottom: 6 }}>
            You are always a member. Choose who else to add.
          </div>
          {usersLoading ? (
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>Loading users…</div>
          ) : usersError ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>{usersError}</div>
              <button
                type="button"
                onClick={onRetryUsers}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.br2}`,
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 10,
                  color: C.blue,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <div
              style={{
                background: C.bg4,
                border: `1px solid ${C.br2}`,
                borderRadius: 8,
                maxHeight: 180,
                overflowY: 'auto',
                marginBottom: 12,
              }}
            >
              {pickableUsers.length === 0 ? (
                <div style={{ padding: '8px 10px', fontSize: 11, color: C.t3 }}>
                  No other users to add
                </div>
              ) : (
                pickableUsers.map((u) => {
                  const checked = selectedIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 10px',
                        borderBottom: `1px solid ${C.br2}`,
                        fontSize: 11,
                        color: C.t,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={submitting}
                        onChange={() => toggleMember(u.id)}
                      />
                      <span>
                        {memberLabel(u)}
                        <span style={{ color: C.t3 }}> @{u.username}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          )}

          {displayError && (
            <div style={{ fontSize: 11, color: C.red, marginBottom: 10 }}>{displayError}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              style={{
                background: 'transparent',
                border: `1px solid ${C.br2}`,
                borderRadius: 7,
                padding: '6px 14px',
                fontSize: 11,
                color: C.t2,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || usersLoading || !!usersError}
              style={{
                background: C.blue,
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 700,
                cursor: submitting || usersLoading || usersError ? 'not-allowed' : 'pointer',
                opacity: submitting || usersLoading || usersError ? 0.55 : 1,
              }}
            >
              {submitting ? 'Creating…' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
