import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  addChannelMembers,
  getChannelMembers,
  getMentionableUsers,
  mapChannelWriteError,
  removeChannelMember,
  type ChannelMember,
  type MentionableUser,
} from '../../services/chatService';

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

export interface ChannelMembersPanelProps {
  open: boolean;
  channelId: number;
  channelName: string;
  currentUserId: number | null;
  canRemove: boolean;
  onClose: () => void;
}

function memberLabel(u: { username: string; full_name: string | null }): string {
  return (u.full_name && u.full_name.trim()) || u.username;
}

export default function ChannelMembersPanel({
  open,
  channelId,
  channelName,
  currentUserId,
  canRemove,
  onClose,
}: ChannelMembersPanelProps) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [pickerUsers, setPickerUsers] = useState<MentionableUser[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [addUserId, setAddUserId] = useState<number | ''>('');
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setMembersLoading(true);
    setError(null);
    try {
      const rows = await getChannelMembers(channelId);
      setMembers(rows);
    } catch (err) {
      setError(mapChannelWriteError(err, 'Failed to load members'));
    } finally {
      setMembersLoading(false);
    }
  }, [channelId]);

  const loadPicker = useCallback(async () => {
    setPickerLoading(true);
    try {
      const rows = await getMentionableUsers();
      setPickerUsers(rows);
    } catch (err) {
      setError(mapChannelWriteError(err, 'Failed to load users'));
    } finally {
      setPickerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setAddUserId('');
    setError(null);
    void loadRoster();
    void loadPicker();
  }, [open, channelId, loadRoster, loadPicker]);

  if (!open) return null;

  const memberIds = new Set(members.map((m) => m.id));
  const addableUsers = pickerUsers.filter(
    (u) => !memberIds.has(u.id) && (currentUserId == null || u.id !== currentUserId),
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (addUserId === '') return;
    setAdding(true);
    setError(null);
    try {
      await addChannelMembers(channelId, [addUserId]);
      setAddUserId('');
      await loadRoster();
    } catch (err) {
      setError(mapChannelWriteError(err, 'Failed to add member'));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId: number) {
    setBusyUserId(userId);
    setError(null);
    try {
      await removeChannelMember(channelId, userId);
      await loadRoster();
    } catch (err) {
      setError(mapChannelWriteError(err, 'Failed to remove member'));
    } finally {
      setBusyUserId(null);
    }
  }

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
        if (e.target === e.currentTarget && !adding && busyUserId == null) onClose();
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
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t }}>Channel members</div>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>#{channelName}</div>
          </div>
          <button
            type="button"
            disabled={adding || busyUserId != null}
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.t3,
              cursor: adding || busyUserId != null ? 'not-allowed' : 'pointer',
              padding: 4,
              display: 'flex',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {membersLoading ? (
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>Loading members…</div>
        ) : (
          <div
            style={{
              background: C.bg4,
              border: `1px solid ${C.br2}`,
              borderRadius: 8,
              maxHeight: 220,
              overflowY: 'auto',
              marginBottom: 12,
            }}
          >
            {members.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: 11, color: C.t3 }}>
                No members
              </div>
            ) : (
              members.map((m) => {
                const inactive = !m.is_active;
                const showRemove = canRemove && (currentUserId == null || m.id !== currentUserId);
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '7px 10px',
                      borderBottom: `1px solid ${C.br2}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: inactive ? C.t3 : C.t,
                      }}>
                        {memberLabel(m)}
                        {inactive && (
                          <span style={{ fontWeight: 600, marginLeft: 6 }}>(inactive)</span>
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: C.t3 }}>@{m.username}</div>
                    </div>
                    {showRemove && (
                      <button
                        type="button"
                        disabled={busyUserId != null || adding}
                        onClick={() => void handleRemove(m.id)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${C.br2}`,
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 10,
                          color: C.red,
                          cursor: busyUserId != null || adding ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {busyUserId === m.id ? 'Removing…' : 'Remove'}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        <form onSubmit={(e) => void handleAdd(e)}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.t2, marginBottom: 4 }}>
            Add member
          </label>
          {pickerLoading ? (
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>Loading users…</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select
                value={addUserId === '' ? '' : String(addUserId)}
                disabled={adding || busyUserId != null}
                onChange={(e) => setAddUserId(e.target.value ? Number(e.target.value) : '')}
                style={{
                  flex: 1,
                  boxSizing: 'border-box',
                  background: C.bg4,
                  border: `1px solid ${C.br2}`,
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 12,
                  color: C.t,
                }}
              >
                <option value="">Select user…</option>
                {addableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {memberLabel(u)} (@{u.username})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addUserId === '' || adding || busyUserId != null}
                style={{
                  background: C.blue,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 7,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: addUserId === '' || adding || busyUserId != null ? 'not-allowed' : 'pointer',
                  opacity: addUserId === '' || adding || busyUserId != null ? 0.55 : 1,
                  flexShrink: 0,
                }}
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          )}
        </form>

        {error && (
          <div style={{ fontSize: 11, color: C.red, marginBottom: 10 }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${C.br2}`,
              borderRadius: 7,
              padding: '6px 14px',
              fontSize: 11,
              color: C.t2,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
