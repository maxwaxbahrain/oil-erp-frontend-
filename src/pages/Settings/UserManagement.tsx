import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  X,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../api/axios';
import PasswordInput from '../../components/ui/PasswordInput';
import { useAuth, type AuthRole } from '../../contexts/AuthContext';

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  green: '#22C55E',
  red: '#EF4444',
  amber: '#F59E0B',
  purple: '#9B6FE4',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
};

const ROLES: AuthRole[] = ['admin', 'manager', 'accountant', 'driver', 'sales'];

const ROLE_STYLE: Record<AuthRole, { bg: string; color: string }> = {
  admin: { bg: 'rgba(155,111,228,.15)', color: '#C4B5FD' },
  manager: { bg: 'rgba(79,142,247,.15)', color: '#93C5FD' },
  accountant: { bg: 'rgba(245,158,11,.15)', color: '#FCD34D' },
  driver: { bg: 'rgba(249,115,22,.15)', color: '#FDBA74' },
  sales: { bg: 'rgba(34,197,94,.15)', color: '#86EFAC' },
};

const panel: CSSProperties = {
  background: C.bg2,
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 12,
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: C.bg3,
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  color: C.text,
  outline: 'none',
};

interface ApiUser {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: AuthRole;
  is_active: boolean;
  created_at: string;
}

interface UserFormState {
  full_name: string;
  username: string;
  email: string;
  password: string;
  role: AuthRole;
  is_active: boolean;
}

const emptyForm = (): UserFormState => ({
  full_name: '',
  username: '',
  email: '',
  password: '',
  role: 'sales',
  is_active: true,
});

function extractError(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return 'Something went wrong. Please try again.';
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<ApiUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ApiUser[]>('/api/auth/users');
      setUsers(data);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (user: ApiUser) => {
    setEditingUser(user);
    setForm({
      full_name: user.full_name || '',
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm());
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {
          full_name: form.full_name.trim() || null,
          username: form.username.trim(),
          email: form.email.trim(),
          role: form.role,
          is_active: form.is_active,
        };
        if (form.password.trim()) payload.password = form.password;
        await api.patch(`/api/auth/users/${editingUser.id}`, payload);
        showToast('success', 'User updated successfully');
      } else {
        if (!form.password.trim()) {
          showToast('error', 'Password is required for new users');
          setSaving(false);
          return;
        }
        await api.post('/api/auth/users', {
          full_name: form.full_name.trim() || null,
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          is_active: form.is_active,
        });
        showToast('success', 'User created successfully');
      }
      closeModal();
      await loadUsers();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/auth/users/${deleteTarget.id}`);
      showToast('success', `${deleteTarget.username} deleted`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setDeleting(false);
    }
  };

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [users]
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>
            <span>System & Settings</span>
            <span style={{ color: C.dim }}>/</span>
            <span style={{ color: C.blue }}>User Management</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: 'rgba(79,142,247,.15)' }}
            >
              <UserCheck size={22} style={{ color: C.blue }} />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: C.text }}>
                User Management
              </h1>
              <p className="text-xs" style={{ color: C.muted }}>
                Admin only · Create and manage ERP user accounts
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: C.blue }}
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {/* Table */}
      <div style={panel} className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin" style={{ color: C.blue }} />
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold" style={{ color: C.muted }}>No users found</p>
            <button type="button" onClick={openCreate} className="mt-3 text-sm font-semibold" style={{ color: C.blue }}>
              Add your first user
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr style={{ background: C.bg3 }}>
                  {['Full Name', 'Username', 'Email', 'Role', 'Status', 'Created Date', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: C.muted, borderBottom: '1px solid rgba(255,255,255,.07)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => {
                  const roleStyle = ROLE_STYLE[user.role] || ROLE_STYLE.sales;
                  const isSelf = currentUser?.username === user.username;
                  return (
                    <tr key={user.id} className="transition-colors hover:bg-white/[.02]">
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: C.text }}>
                        {user.full_name || '—'}
                        {isSelf && (
                          <span className="ml-2 text-[10px] font-bold uppercase" style={{ color: C.blue }}>(you)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{user.username}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{user.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                          style={{ background: roleStyle.bg, color: roleStyle.color }}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            background: user.is_active ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                            color: user.is_active ? C.green : C.red,
                          }}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>
                        {user.created_at ? format(new Date(user.created_at), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors hover:bg-white/5"
                            style={{ borderColor: 'rgba(255,255,255,.12)', color: C.muted }}
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(user)}
                            disabled={isSelf}
                            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ borderColor: 'rgba(239,68,68,.25)', color: '#FCA5A5' }}
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
            style={{ background: C.bg2, border: '1px solid rgba(255,255,255,.1)' }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: C.text }}>
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <button type="button" onClick={closeModal} style={{ color: C.muted }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Full Name">
                <input
                  style={inputStyle}
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="John Smith"
                />
              </Field>
              <Field label="Username">
                <input
                  style={inputStyle}
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  required
                  minLength={3}
                  placeholder="jsmith"
                />
              </Field>
              <Field label="Email">
                <input
                  style={inputStyle}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="user@soltol.com"
                />
              </Field>
              <Field label={editingUser ? 'New Password (optional)' : 'Password'}>
                <PasswordInput
                  style={inputStyle}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required={!editingUser}
                  minLength={editingUser ? undefined : 8}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Min 8 characters'}
                />
              </Field>
              <Field label="Role">
                <select
                  style={inputStyle}
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AuthRole }))}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role} style={{ background: C.bg3 }}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5" style={{ background: C.bg3 }}>
                <span className="text-sm font-medium" style={{ color: C.text }}>Active</span>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="h-4 w-4 accent-blue-500"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ color: C.muted, border: '1px solid rgba(255,255,255,.12)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: C.blue }}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: C.bg2, border: '1px solid rgba(255,255,255,.1)' }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(239,68,68,.15)' }}>
                <AlertTriangle size={18} style={{ color: C.red }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: C.text }}>Delete user?</h3>
                <p className="text-sm" style={{ color: C.muted }}>
                  Remove <strong style={{ color: C.text }}>{deleteTarget.username}</strong> permanently. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ color: C.muted, border: '1px solid rgba(255,255,255,.12)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: C.red }}
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[60] flex max-w-sm items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-xl"
          style={{
            background: toast.type === 'success' ? 'rgba(34,197,94,.95)' : 'rgba(239,68,68,.95)',
            color: '#fff',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
        {label}
      </label>
      {children}
    </div>
  );
}
