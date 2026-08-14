import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { AuthRole } from '../../contexts/AuthContext';

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

export interface TaskModalUser {
  id: number;
  username: string;
  full_name: string | null;
  role: AuthRole;
  is_active: boolean;
}

export interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    assigned_to_user_id: number;
    due_date?: string;
    channel_id?: number;
  }) => Promise<void>;
  users: TaskModalUser[];
  usersLoading: boolean;
  usersError: string | null;
  onRetryUsers: () => void;
  defaultChannelId: number | null;
  submitting: boolean;
  error: string | null;
}

export default function NewTaskModal({
  open,
  onClose,
  onSubmit,
  users,
  usersLoading,
  usersError,
  onRetryUsers,
  defaultChannelId,
  submitting,
  error,
}: NewTaskModalProps) {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [announceInGeneral, setAnnounceInGeneral] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setAssigneeId('');
    setDueDate('');
    setAnnounceInGeneral(true);
    setLocalError(null);
  }, [open]);

  if (!open) return null;

  const activeUsers = users.filter((u) => u.is_active);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setLocalError('Title is required');
      return;
    }
    if (assigneeId === '') {
      setLocalError('Assignee is required');
      return;
    }
    if (announceInGeneral && defaultChannelId == null) {
      setLocalError('General channel is not available — uncheck announce or try again later');
      return;
    }
    try {
      await onSubmit({
        title: trimmed,
        assigned_to_user_id: assigneeId,
        due_date: dueDate.trim() || undefined,
        channel_id: announceInGeneral && defaultChannelId != null ? defaultChannelId : undefined,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create task');
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
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t }}>New Task</div>
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
            Title *
          </label>
          <input
            type="text"
            value={title}
            maxLength={300}
            disabled={submitting}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
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
            Assignee *
          </label>
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
            <select
              value={assigneeId === '' ? '' : String(assigneeId)}
              disabled={submitting}
              onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: C.bg4,
                border: `1px solid ${C.br2}`,
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 12,
                color: C.t,
                marginBottom: 12,
              }}
            >
              <option value="">Select assignee…</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.username} (@{u.username}) · {u.role}
                </option>
              ))}
            </select>
          )}

          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.t2, marginBottom: 4 }}>
            Due date (optional)
          </label>
          <input
            type="date"
            value={dueDate}
            disabled={submitting}
            onChange={(e) => setDueDate(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: C.bg4,
              border: `1px solid ${C.br2}`,
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              color: C.t,
              marginBottom: 12,
            }}
          />

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: C.t2,
            marginBottom: 14,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}>
            <input
              type="checkbox"
              checked={announceInGeneral}
              disabled={submitting}
              onChange={(e) => setAnnounceInGeneral(e.target.checked)}
            />
            Announce in General
          </label>

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
              {submitting ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
