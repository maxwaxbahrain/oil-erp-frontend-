// ──────────────────────────────────────────────────────────────
// Pulse — Team Communication (live chat via chatService + tasks)
// ──────────────────────────────────────────────────────────────
import { useReducer, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react';
import { Send, Megaphone, Users, CheckSquare, RefreshCw, AtSign } from 'lucide-react';
import {
  getChannels,
  getMessages,
  sendMessage,
  markRead,
  createOrGetDm,
  getTasks,
  createTask,
  updateTaskStatus,
  getMentionableUsers,
  type ChatChannel,
  type ChatMessage,
  type ChatTask,
  type ChatTaskStatus,
  type CreateDmResponse,
  type MentionableUser,
} from '../../services/chatService';
import { useAuth, type AuthRole } from '../../contexts/AuthContext';
import api from '../../api/axios';
import NewTaskModal from './NewTaskModal';

const MESSAGE_POLL_MS = 4000;
const TASKS_REFRESH_MS = 30_000;
const SCROLL_NEAR_BOTTOM_PX = 80;
const TASKS_ENABLED = true;

type DisplayMessage = ChatMessage & { pending?: boolean };

interface Room {
  id: number;
  name: string;
  type: 'channel' | 'dm';
  unreadCount: number;
  hasUnreadMention: boolean;
  isDefault?: boolean;
  otherUserId?: number | null;
  otherUsername?: string | null;
}

function channelToRoom(ch: ChatChannel): Room {
  const isDm = ch.type === 'dm';
  return {
    id: ch.id,
    name: isDm ? (ch.other_username || 'Direct Message') : ch.name,
    type: ch.type,
    unreadCount: ch.unread_count,
    hasUnreadMention: ch.has_unread_mention,
    isDefault: ch.is_default,
    otherUserId: ch.other_user_id,
    otherUsername: ch.other_username,
  };
}

function dmResponseToRoom(dm: CreateDmResponse): Room {
  return {
    id: dm.id,
    name: dm.other_username || 'Direct Message',
    type: 'dm',
    unreadCount: dm.unread_count,
    hasUnreadMention: false,
    otherUserId: dm.other_user_id,
    otherUsername: dm.other_username,
  };
}

function formatMessageTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

function avatarColorFor(name: string): string {
  const colors = ['#4F8EF7', '#22C55E', '#7C3AED', '#F59E0B', '#EF4444'];
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h + name.charCodeAt(i)) % colors.length;
  }
  return colors[h]!;
}

function initialsFor(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

interface PendingMention {
  userId: number;
  insertText: string;
}

interface MentionHighlight {
  label: string;
  isSelf: boolean;
}

function mentionDisplayLabel(u: MentionableUser | { username: string; full_name?: string | null }): string {
  const full = 'full_name' in u ? u.full_name : null;
  return (full && full.trim()) || u.username;
}

/** Text from the last "@" before the cursor through the cursor — may include spaces. */
function getMentionContext(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const atIndex = before.lastIndexOf('@');
  if (atIndex === -1) return null;
  if (atIndex > 0 && !/\s/.test(before[atIndex - 1]!)) return null;
  return { query: before.slice(atIndex + 1), start: atIndex };
}

function filterMentionableUsers(users: MentionableUser[], query: string): MentionableUser[] {
  const q = query.toLowerCase();
  return users.filter((u) => {
    const username = u.username.toLowerCase();
    const display = mentionDisplayLabel(u).toLowerCase();
    return username.startsWith(q) || display.startsWith(q);
  });
}

function filterPendingMentionIds(body: string, pending: PendingMention[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const m of pending) {
    if (body.includes(m.insertText) && !seen.has(m.userId)) {
      seen.add(m.userId);
      ids.push(m.userId);
    }
  }
  return ids;
}

function resolveAuthUserId(user: { id?: number | string } | null): number | null {
  if (!user?.id) return null;
  if (typeof user.id === 'number' && Number.isFinite(user.id)) return user.id;
  if (typeof user.id === 'string' && /^\d+$/.test(user.id)) return Number(user.id);
  return null;
}

function buildMentionHighlights(
  users: MentionableUser[],
  authUser: { id?: number | string; username: string; full_name?: string | null } | null,
): MentionHighlight[] {
  const selfId = resolveAuthUserId(authUser);
  const byKey = new Map<string, MentionHighlight>();

  const add = (label: string, isSelf: boolean) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { label: trimmed, isSelf });
    } else if (isSelf && !existing.isSelf) {
      byKey.set(key, { label: trimmed, isSelf: true });
    }
  };

  for (const u of users) {
    const isSelf = selfId != null && u.id === selfId;
    add(mentionDisplayLabel(u), isSelf);
    if (u.username !== mentionDisplayLabel(u)) add(u.username, isSelf);
  }

  if (authUser) {
    add(authUser.username, true);
    if (authUser.full_name) add(authUser.full_name, true);
  }

  return Array.from(byKey.values()).sort((a, b) => b.label.length - a.label.length);
}

function isOwnMessage(
  msg: ChatMessage,
  user: { id?: number | string; username: string } | null,
): boolean {
  if (!user) return false;
  const uid = user.id;
  if (typeof uid === 'number' && Number.isFinite(uid)) {
    return msg.sender_user_id === uid;
  }
  if (typeof uid === 'string' && /^\d+$/.test(uid)) {
    return msg.sender_user_id === Number(uid);
  }
  return msg.sender_username === user.username;
}

interface ApiUser {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: AuthRole;
  is_active: boolean;
  created_at: string;
}

const TASK_COLUMNS: ChatTaskStatus[] = ['open', 'in_progress', 'done'];

const TASK_COLUMN_DOT: Record<ChatTaskStatus, string> = {
  open: '#8BA3C7',
  in_progress: '#F59E0B',
  done: '#22C55E',
};

const TASK_COLUMN_LABEL: Record<ChatTaskStatus, string> = {
  open: 'OPEN',
  in_progress: 'IN PROGRESS',
  done: 'DONE',
};

function formatTaskDueDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function isTaskOverdue(task: ChatTask): boolean {
  if (!task.due_date || task.status === 'done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.due_date}T00:00:00`);
  return due < today;
}

function nextTaskStatusAction(status: ChatTaskStatus): {
  label: string;
  next: ChatTaskStatus;
} | null {
  if (status === 'open') return { label: 'Start', next: 'in_progress' };
  if (status === 'in_progress') return { label: 'Done', next: 'done' };
  if (status === 'done') return { label: 'Reopen', next: 'open' };
  return null;
}

interface PulseState {
  activeTab: 'chat' | 'tasks';
  activeRoomId: number | null;
  rooms: Room[];
  newMessage: string;
  announceMode: boolean;
  announceText: string;
}

const initialState: PulseState = {
  activeTab: 'chat',
  activeRoomId: null,
  rooms: [],
  newMessage: '',
  announceMode: false,
  announceText: '',
};

type PulseAction =
  | { type: 'SET_TAB'; tab: 'chat' | 'tasks' }
  | { type: 'SET_CHANNELS'; rooms: Room[]; activeRoomId: number | null }
  | { type: 'REFRESH_CHANNELS'; rooms: Room[] }
  | { type: 'MERGE_DM'; room: Room }
  | { type: 'SET_ROOM'; roomId: number }
  | { type: 'SET_MESSAGE'; text: string }
  | { type: 'CLEAR_UNREAD'; roomId: number }
  | { type: 'SET_ANNOUNCE_MODE'; value: boolean }
  | { type: 'SET_ANNOUNCE_TEXT'; text: string };

function pulseReducer(state: PulseState, action: PulseAction): PulseState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };
    case 'SET_CHANNELS':
      return {
        ...state,
        rooms: action.rooms,
        activeRoomId: action.activeRoomId,
      };
    case 'REFRESH_CHANNELS':
      return {
        ...state,
        rooms: action.rooms,
      };
    case 'MERGE_DM': {
      const exists = state.rooms.some((r) => r.id === action.room.id);
      return {
        ...state,
        rooms: exists
          ? state.rooms.map((r) => (r.id === action.room.id ? { ...r, ...action.room } : r))
          : [...state.rooms, action.room],
        activeRoomId: action.room.id,
      };
    }
    case 'SET_ROOM':
      return { ...state, activeRoomId: action.roomId };
    case 'SET_MESSAGE':
      return { ...state, newMessage: action.text };
    case 'CLEAR_UNREAD':
      return {
        ...state,
        rooms: state.rooms.map(r => r.id === action.roomId ? { ...r, unreadCount: 0 } : r),
      };
    case 'SET_ANNOUNCE_MODE':
      return { ...state, announceMode: action.value, announceText: '' };
    case 'SET_ANNOUNCE_TEXT':
      return { ...state, announceText: action.text };
    default:
      return state;
  }
}

// Spec colour tokens — fallback to spec hex so the page renders
// correctly even without theme.css updates.
const C = {
  bg:     'var(--bg, #060f1c)',
  bg2:    'var(--bg2, #0a1726)',
  bg3:    'var(--bg3, #0f1f33)',
  bg4:    'var(--bg4, #142540)',
  blue:   'var(--blue, #4F8EF7)',
  green:  'var(--green, #22C55E)',
  red:    'var(--red, #EF4444)',
  amber:  'var(--amber, #F59E0B)',
  purple: 'var(--purple, #7C3AED)',
  t:      'var(--t, #EEF2FF)',
  t2:     'var(--t2, #8BA3C7)',
  t3:     'var(--t3, #3E5678)',
  br2:    'var(--br2, rgba(255,255,255,.12))',
} as const;

function renderMessageBodyWithMentions(body: string, highlights: MentionHighlight[]): ReactNode[] {
  if (highlights.length === 0) return [body];

  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] === '@') {
      const afterAt = body.slice(i + 1);
      let matched: MentionHighlight | null = null;
      for (const h of highlights) {
        if (afterAt.toLowerCase().startsWith(h.label.toLowerCase())) {
          matched = h;
          break;
        }
      }
      if (matched) {
        const len = 1 + matched.label.length;
        nodes.push(
          <span
            key={`mention-${i}-${matched.label}`}
            style={{
              color: C.blue,
              fontWeight: matched.isSelf ? 700 : 600,
              background: matched.isSelf ? 'rgba(79,142,247,.15)' : undefined,
              borderRadius: matched.isSelf ? 3 : undefined,
              padding: matched.isSelf ? '0 2px' : undefined,
            }}
          >
            {body.slice(i, i + len)}
          </span>,
        );
        i += len;
        continue;
      }
    }
    const nextAt = body.indexOf('@', i + 1);
    const end = nextAt === -1 ? body.length : nextAt;
    if (end > i) nodes.push(body.slice(i, end));
    i = end === i ? i + 1 : end;
  }
  return nodes;
}

function RoomUnreadBadges({ room }: { room: Room }) {
  return (
    <>
      {room.hasUnreadMention && (
        <span
          title="Unread mention"
          style={{
            fontSize: 9,
            padding: '1px 5px',
            borderRadius: 8,
            background: 'rgba(79,142,247,.2)',
            color: C.blue,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          @
        </span>
      )}
      {room.unreadCount > 0 && (
        <span style={{
          fontSize: 9,
          padding: '1px 5px',
          borderRadius: 8,
          background: 'rgba(239,68,68,.2)',
          color: '#EF4444',
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {room.unreadCount}
        </span>
      )}
    </>
  );
}

// ── Main component ───────────────────────────────────────────
export default function PulseDashboard() {
  const { user: authUser, hasRole } = useAuth();
  const isManagement = hasRole('admin', 'manager', 'accountant');
  const [state, dispatch] = useReducer(pulseReducer, initialState);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  );
  const [mobileChatNavOpen, setMobileChatNavOpen] = useState<boolean>(false);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [latestId, setLatestId] = useState<number | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [dmPickerOpen, setDmPickerOpen] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<ApiUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [dmCreating, setDmCreating] = useState(false);
  const dmPickerRef = useRef<HTMLDivElement>(null);
  const [tasks, setTasks] = useState<ChatTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [createTaskSubmitting, setCreateTaskSubmitting] = useState(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [pendingMentions, setPendingMentions] = useState<PendingMention[]>([]);
  const [mentionPopupOpen, setMentionPopupOpen] = useState(false);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const [composerCursor, setComposerCursor] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionPopupRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<number | null>(null);
  const latestIdRef = useRef<number | null>(null);
  const initialLoadInFlightRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const lastMarkedReadIdRef = useRef(0);
  const pollTickRef = useRef(0);
  const nearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const rows = await getChannels();
      const rooms = rows.map(channelToRoom);
      const defaultRoom =
        rooms.find((r) => r.isDefault) ??
        rooms.find((r) => r.type === 'channel') ??
        rooms[0];
      dispatch({
        type: 'SET_CHANNELS',
        rooms,
        activeRoomId: defaultRoom?.id ?? null,
      });
    } catch (err) {
      setChannelsError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  const refreshChannelBadges = useCallback(async () => {
    try {
      const rows = await getChannels();
      dispatch({ type: 'REFRESH_CHANNELS', rooms: rows.map(channelToRoom) });
    } catch (err) {
      console.warn('Failed to refresh channel badges:', err);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    let cancelled = false;
    void getMentionableUsers()
      .then((rows) => {
        if (!cancelled) setMentionableUsers(rows);
      })
      .catch((err) => {
        console.warn('Failed to load mentionable users:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mentionHighlights = useMemo(
    () => buildMentionHighlights(mentionableUsers, authUser),
    [mentionableUsers, authUser],
  );

  const mentionContext = useMemo(
    () => (mentionPopupOpen ? getMentionContext(state.newMessage, composerCursor) : null),
    [mentionPopupOpen, state.newMessage, composerCursor],
  );

  const mentionSuggestions = useMemo(
    () => (mentionContext ? filterMentionableUsers(mentionableUsers, mentionContext.query) : []),
    [mentionContext, mentionableUsers],
  );

  const showMentionPopup =
    mentionPopupOpen && mentionContext != null && mentionSuggestions.length > 0;

  useEffect(() => {
    if (!mentionPopupOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (mentionPopupRef.current?.contains(e.target as Node)) return;
      if (composerTextareaRef.current?.contains(e.target as Node)) return;
      setMentionPopupOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [mentionPopupOpen]);

  useEffect(() => {
    if (!mentionPopupOpen || !mentionContext) return;
    if (mentionSuggestions.length === 0) {
      setMentionPopupOpen(false);
    }
  }, [mentionPopupOpen, mentionContext, mentionSuggestions.length]);

  useEffect(() => {
    if (!showMentionPopup) return;
    setMentionHighlightIndex((idx) =>
      mentionSuggestions.length === 0 ? 0 : Math.min(idx, mentionSuggestions.length - 1),
    );
  }, [showMentionPopup, mentionSuggestions.length, mentionContext?.query]);

  const loadTenantUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const { data } = await api.get<ApiUser[]>('/api/auth/users');
      setTenantUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const rows = await getTasks();
      setTasks(rows);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.activeTab !== 'tasks') return;

    void loadTasks();

    const tick = () => {
      if (document.visibilityState === 'visible') {
        void loadTasks();
      }
    };

    document.addEventListener('visibilitychange', tick);
    const timer = window.setInterval(tick, TASKS_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [state.activeTab, loadTasks]);

  useEffect(() => {
    if (newTaskModalOpen) {
      void loadTenantUsers();
    }
  }, [newTaskModalOpen, loadTenantUsers]);

  useEffect(() => {
    if (dmPickerOpen) {
      void loadTenantUsers();
    }
  }, [dmPickerOpen, loadTenantUsers]);

  useEffect(() => {
    if (!dmPickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (dmPickerRef.current && !dmPickerRef.current.contains(e.target as Node)) {
        setDmPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [dmPickerOpen]);

  const isCurrentTenantUser = useCallback((u: ApiUser) => {
    if (!authUser) return false;
    if (typeof authUser.id === 'number' && authUser.id === u.id) return true;
    if (typeof authUser.id === 'string' && /^\d+$/.test(authUser.id) && Number(authUser.id) === u.id) {
      return true;
    }
    return authUser.username === u.username;
  }, [authUser]);

  const pickableUsers = tenantUsers.filter(
    (u) => u.is_active && !isCurrentTenantUser(u),
  );

  async function handleStartDm(userId: number) {
    setDmCreating(true);
    setDmPickerOpen(false);
    try {
      const dm = await createOrGetDm(userId);
      dispatch({ type: 'MERGE_DM', room: dmResponseToRoom(dm) });
      if (isMobile) setMobileChatNavOpen(false);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to open direct message');
      setDmPickerOpen(true);
    } finally {
      setDmCreating(false);
    }
  }

  useEffect(() => {
    latestIdRef.current = latestId;
  }, [latestId]);

  // Resize listener
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 900);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const loadMessagesInitial = useCallback(async (channelId: number) => {
    if (initialLoadInFlightRef.current) return;
    initialLoadInFlightRef.current = true;
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const result = await getMessages(channelId);
      if (activeChannelRef.current !== channelId) return;
      setMessages(result.messages);
      const resolvedLatest =
        result.latest_id ??
        (result.messages.length > 0
          ? Math.max(...result.messages.map((m) => m.id))
          : null);
      setLatestId(resolvedLatest);
      latestIdRef.current = resolvedLatest;
      initialScrollDoneRef.current = false;
    } catch (err) {
      if (activeChannelRef.current === channelId) {
        setMessagesError(err instanceof Error ? err.message : 'Failed to load messages');
      }
    } finally {
      initialLoadInFlightRef.current = false;
      if (activeChannelRef.current === channelId) {
        setMessagesLoading(false);
      }
    }
  }, []);

  // Initial message load when active channel changes
  useEffect(() => {
    const channelId = state.activeRoomId;
    activeChannelRef.current = channelId;
    lastMarkedReadIdRef.current = 0;
    pollTickRef.current = 0;
    nearBottomRef.current = true;
    initialScrollDoneRef.current = false;
    setSendError(null);

    if (channelId == null) {
      setMessages([]);
      setLatestId(null);
      latestIdRef.current = null;
      setMessagesLoading(false);
      setMessagesError(null);
      return;
    }

    setMessages([]);
    setLatestId(null);
    latestIdRef.current = null;
    void loadMessagesInitial(channelId);
  }, [state.activeRoomId, loadMessagesInitial]);

  const pollNewMessages = useCallback(async (channelId: number) => {
    if (document.visibilityState !== 'visible') return;
    if (activeChannelRef.current !== channelId) return;
    if (pollInFlightRef.current || initialLoadInFlightRef.current) return;

    pollInFlightRef.current = true;
    try {
      pollTickRef.current += 1;
      if (pollTickRef.current % 4 === 0) {
        await refreshChannelBadges();
      }

      const after = latestIdRef.current ?? 0;
      const result = await getMessages(channelId, { after });
      if (activeChannelRef.current !== channelId) return;

      if (result.messages.length > 0) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const appended = result.messages.filter((m) => !ids.has(m.id));
          return appended.length > 0 ? [...prev, ...appended] : prev;
        });
      }
      if (result.latest_id != null) {
        setLatestId(result.latest_id);
        latestIdRef.current = result.latest_id;
      } else if (result.messages.length > 0) {
        const maxId = Math.max(...result.messages.map((m) => m.id));
        if (maxId > (latestIdRef.current ?? 0)) {
          setLatestId(maxId);
          latestIdRef.current = maxId;
        }
      }
    } catch (err) {
      console.warn('Message poll failed:', err);
    } finally {
      pollInFlightRef.current = false;
    }
  }, [refreshChannelBadges]);

  // Poll for new messages while a channel is active
  useEffect(() => {
    const channelId = state.activeRoomId;
    if (channelId == null || messagesLoading || messagesError) return;

    const tick = () => {
      void pollNewMessages(channelId);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(tick, MESSAGE_POLL_MS);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state.activeRoomId, messagesLoading, messagesError, pollNewMessages]);

  // Mark channel read when viewing new messages
  useEffect(() => {
    const channelId = state.activeRoomId;
    if (channelId == null) return;
    if (document.visibilityState !== 'visible') return;
    if (messagesLoading || messagesError) return;

    const lastMsgId = latestId ?? (messages.length > 0 ? messages[messages.length - 1]!.id : null);
    if (lastMsgId == null || lastMsgId <= 0) return;
    if (lastMarkedReadIdRef.current >= lastMsgId) return;

    let cancelled = false;
    void markRead(channelId, lastMsgId)
      .then(() => {
        if (cancelled || activeChannelRef.current !== channelId) return;
        lastMarkedReadIdRef.current = lastMsgId;
        dispatch({ type: 'CLEAR_UNREAD', roomId: channelId });
      })
      .catch((err) => {
        console.warn('markRead failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [state.activeRoomId, messages, latestId, messagesLoading, messagesError]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_NEAR_BOTTOM_PX;
  }, []);

  // Auto-scroll when near bottom or on initial load
  useEffect(() => {
    if (messagesLoading) return;
    const shouldScroll = !initialScrollDoneRef.current || nearBottomRef.current;
    if (!shouldScroll) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: initialScrollDoneRef.current ? 'smooth' : 'auto',
    });
    initialScrollDoneRef.current = true;
  }, [messages, messagesLoading]);

  const activeRoom = state.activeRoomId != null
    ? state.rooms.find(r => r.id === state.activeRoomId)
    : undefined;
  const channelRooms = state.rooms.filter(r => r.type === 'channel');
  const dmRooms = state.rooms.filter(r => r.type === 'dm');
  const defaultChannelId =
    channelRooms.find((r) => r.isDefault)?.id ??
    channelRooms.find((r) => r.name === 'General')?.id ??
    channelRooms[0]?.id ??
    null;

  const openTasksCount = tasks.filter((t) => t.status === 'open').length;
  const inProgressTasksCount = tasks.filter((t) => t.status === 'in_progress').length;
  const doneTasksCount = tasks.filter((t) => t.status === 'done').length;

  const currentUserId = (): number | null => {
    if (!authUser?.id) return null;
    if (typeof authUser.id === 'number') return authUser.id;
    if (typeof authUser.id === 'string' && /^\d+$/.test(authUser.id)) return Number(authUser.id);
    return null;
  };

  const canMoveTask = useCallback((task: ChatTask): boolean => {
    const uid = currentUserId();
    if (uid != null && task.assigned_to_user_id === uid) return true;
    return isManagement;
  }, [authUser, isManagement]);

  async function handleTaskStatusChange(taskId: number, nextStatus: ChatTaskStatus) {
    const snapshot = tasks;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: nextStatus,
              completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
            }
          : t,
      ),
    );
    setStatusUpdatingId(taskId);
    setTasksError(null);
    try {
      const updated = await updateTaskStatus(taskId, nextStatus);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setTasks(snapshot);
      setTasksError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function handleCreateTask(payload: {
    title: string;
    assigned_to_user_id: number;
    due_date?: string;
    channel_id?: number;
  }) {
    setCreateTaskSubmitting(true);
    setCreateTaskError(null);
    try {
      const created = await createTask(payload);
      setTasks((prev) => [created, ...prev]);
      setNewTaskModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      setCreateTaskError(message);
      throw err;
    } finally {
      setCreateTaskSubmitting(false);
    }
  }

  // ── Send handlers ──────────────────────────────────────────
  function selectMention(user: MentionableUser) {
    const ta = composerTextareaRef.current;
    const text = state.newMessage;
    const cursor = ta?.selectionStart ?? composerCursor;
    const ctx = getMentionContext(text, cursor);
    if (!ctx) return;

    const display = mentionDisplayLabel(user);
    const insert = `@${display} `;
    const insertText = `@${display}`;
    const newText = text.slice(0, ctx.start) + insert + text.slice(cursor);

    dispatch({ type: 'SET_MESSAGE', text: newText });
    setPendingMentions((prev) => [
      ...prev.filter((p) => p.userId !== user.id),
      { userId: user.id, insertText },
    ]);
    setMentionPopupOpen(false);

    const newCursor = ctx.start + insert.length;
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(newCursor, newCursor);
      setComposerCursor(newCursor);
    });
  }

  function openMentionAtCursor() {
    const ta = composerTextareaRef.current;
    const cursor = ta?.selectionStart ?? state.newMessage.length;
    const before = state.newMessage.slice(0, cursor);
    const after = state.newMessage.slice(cursor);
    const needsSpace = before.length > 0 && !/\s$/.test(before);
    const prefix = needsSpace ? ' @' : '@';
    const newText = before + prefix + after;
    const newCursor = before.length + prefix.length;

    dispatch({ type: 'SET_MESSAGE', text: newText });
    setComposerCursor(newCursor);
    setMentionPopupOpen(true);
    setMentionHighlightIndex(0);

    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(newCursor, newCursor);
    });
  }

  function handleComposerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const { value, selectionStart } = e.target;
    dispatch({ type: 'SET_MESSAGE', text: value });
    const cursor = selectionStart ?? value.length;
    setComposerCursor(cursor);
    const ctx = getMentionContext(value, cursor);
    if (ctx) {
      const suggestions = filterMentionableUsers(mentionableUsers, ctx.query);
      if (suggestions.length > 0) {
        setMentionPopupOpen(true);
        setMentionHighlightIndex(0);
      } else {
        setMentionPopupOpen(false);
      }
    } else {
      setMentionPopupOpen(false);
    }
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentionPopup && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionHighlightIndex((idx) => Math.min(idx + 1, mentionSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionHighlightIndex((idx) => Math.max(idx - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        selectMention(mentionSuggestions[mentionHighlightIndex]!);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionPopupOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  }

  async function handleSendMessage() {
    const text = state.newMessage.trim();
    if (!text || state.activeRoomId == null) return;

    const channelId = state.activeRoomId;
    const mentionedIds = filterPendingMentionIds(text, pendingMentions);
    const tempId = -Date.now();
    const optimistic: DisplayMessage = {
      id: tempId,
      sender_user_id: typeof authUser?.id === 'number'
        ? authUser.id
        : typeof authUser?.id === 'string' && /^\d+$/.test(authUser.id)
          ? Number(authUser.id)
          : -1,
      sender_username: authUser?.username ?? 'You',
      body: text,
      created_at: new Date().toISOString(),
      edited_at: null,
      pending: true,
    };

    dispatch({ type: 'SET_MESSAGE', text: '' });
    setPendingMentions([]);
    setMentionPopupOpen(false);
    setSendError(null);
    nearBottomRef.current = true;
    setMessages((prev) => [...prev, optimistic]);

    try {
      const sent = await sendMessage(channelId, text, mentionedIds);
      if (activeChannelRef.current !== channelId) return;
      setMessages((prev) => {
        const withoutDup = prev.filter((m) => m.id !== sent.id);
        return withoutDup.map((m) =>
          m.id === tempId
            ? {
                id: sent.id,
                sender_user_id: sent.sender_user_id,
                sender_username: sent.sender_username,
                body: sent.body,
                created_at: sent.created_at,
                edited_at: null,
              }
            : m,
        );
      });
      if (sent.id > (latestIdRef.current ?? 0)) {
        setLatestId(sent.id);
        latestIdRef.current = sent.id;
      }
    } catch (err) {
      if (activeChannelRef.current !== channelId) return;
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }

  async function handleAnnounceSend() {
    const text = state.announceText.trim();
    if (!text) return;
    const defaultRoom =
      state.rooms.find((r) => r.isDefault) ??
      state.rooms.find((r) => r.type === 'channel');
    if (!defaultRoom) return;

    dispatch({ type: 'SET_ANNOUNCE_MODE', value: false });
    dispatch({ type: 'SET_ANNOUNCE_TEXT', text: '' });

    try {
      const sent = await sendMessage(defaultRoom.id, `📢 ANNOUNCEMENT: ${text}`);
      if (state.activeRoomId === defaultRoom.id && activeChannelRef.current === defaultRoom.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [
            ...prev,
            {
              id: sent.id,
              sender_user_id: sent.sender_user_id,
              sender_username: sent.sender_username,
              body: sent.body,
              created_at: sent.created_at,
              edited_at: null,
            },
          ];
        });
        if (sent.id > (latestIdRef.current ?? 0)) {
          setLatestId(sent.id);
          latestIdRef.current = sent.id;
        }
        nearBottomRef.current = true;
      }
    } catch (err) {
      console.warn('Announce send failed:', err);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: C.bg,
      color: C.t,
    }}>
      {/* Page header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.br2}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.t, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span aria-hidden>💬</span> Pulse — Team Communication
            </h1>
            <p style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>
              Rooms · Direct messages · Tasks · Team board
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_ANNOUNCE_MODE', value: true })}
              style={{
                background: 'rgba(79,142,247,.1)',
                border: '1px solid rgba(79,142,247,.25)',
                borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                color: C.blue, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Megaphone size={14} /> Announce to all
            </button>
          </div>
        </div>

        {/* Phase tabs */}
        <div style={{ display: 'flex', gap: 2, marginTop: 12 }}>
          {([
            { key: 'chat' as const, label: 'Chat', Icon: Send },
            ...(TASKS_ENABLED
              ? [{ key: 'tasks' as const, label: 'Tasks', Icon: CheckSquare }]
              : []),
          ]).map(t => {
            const Icon = t.Icon;
            const active = state.activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => dispatch({ type: 'SET_TAB', tab: t.key })}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px 6px 0 0',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: 'none',
                  borderBottom: active ? `2px solid ${C.blue}` : '2px solid transparent',
                  background: active ? 'rgba(79,142,247,.1)' : 'transparent',
                  color: active ? C.blue : C.t3,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {(!TASKS_ENABLED || state.activeTab === 'chat') ? (
        // ── CHAT PANEL ─────────────────────────────────────────
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Sidebar — hidden on mobile by default, toggleable via mobileChatNavOpen */}
          {(!isMobile || mobileChatNavOpen) && (
            <div
              style={{
                width: isMobile ? '70%' : 200,
                maxWidth: isMobile ? 280 : 200,
                background: C.bg2,
                borderRight: `1px solid ${C.br2}`,
                overflowY: 'auto',
                position: isMobile ? 'absolute' : 'static',
                zIndex: isMobile ? 60 : 'auto',
                top: isMobile ? 'auto' : undefined,
                bottom: 0, left: 0,
                height: isMobile ? '100%' : 'auto',
                boxShadow: isMobile ? '4px 0 24px rgba(0,0,0,.4)' : 'none',
                flexShrink: 0,
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* ROOMS header */}
              <div style={{ fontSize: 9, color: C.t3, fontWeight: 700, letterSpacing: '.7px', padding: '10px 12px 4px' }}>
                ROOMS
              </div>
              {channelsLoading && (
                <div style={{ padding: '8px 12px', fontSize: 11, color: C.t3 }}>
                  Loading channels…
                </div>
              )}
              {channelsError && (
                <div style={{ padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>{channelsError}</div>
                  <button
                    type="button"
                    onClick={() => void loadChannels()}
                    style={{
                      background: 'rgba(79,142,247,.1)',
                      border: '1px solid rgba(79,142,247,.25)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.blue,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <RefreshCw size={11} /> Retry
                  </button>
                </div>
              )}
              {!channelsLoading && !channelsError && channelRooms.length === 0 && (
                <div style={{ padding: '8px 12px', fontSize: 11, color: C.t3 }}>
                  No channels yet
                </div>
              )}
              {channelRooms.map(r => {
                const active = state.activeRoomId === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      dispatch({ type: 'SET_ROOM', roomId: r.id });
                      if (isMobile) setMobileChatNavOpen(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 12px', cursor: 'pointer',
                      background: active ? 'rgba(79,142,247,.1)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget.style.background = 'rgba(255,255,255,.04)'); }}
                    onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'transparent'); }}
                  >
                    <span style={{
                      fontSize: 12,
                      color: active ? C.t : C.t2,
                      fontWeight: active ? 600 : 400,
                      flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.name}
                    </span>
                    <RoomUnreadBadges room={r} />
                  </div>
                );
              })}

              {/* DMs header + picker */}
              <div
                ref={dmPickerRef}
                style={{ position: 'relative', padding: '14px 12px 4px' }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}>
                  <div style={{ fontSize: 9, color: C.t3, fontWeight: 700, letterSpacing: '.7px' }}>
                    DIRECT MESSAGES
                  </div>
                  <button
                    type="button"
                    disabled={dmCreating}
                    onClick={() => setDmPickerOpen((v) => !v)}
                    style={{
                      background: 'rgba(79,142,247,.1)',
                      border: '1px solid rgba(79,142,247,.25)',
                      borderRadius: 6,
                      padding: '2px 7px',
                      fontSize: 9,
                      fontWeight: 600,
                      color: C.blue,
                      cursor: dmCreating ? 'not-allowed' : 'pointer',
                      opacity: dmCreating ? 0.6 : 1,
                    }}
                  >
                    + New message
                  </button>
                </div>
                {dmPickerOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 8,
                    right: 8,
                    zIndex: 80,
                    background: C.bg3,
                    border: `1px solid ${C.br2}`,
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,.35)',
                    maxHeight: 220,
                    overflowY: 'auto',
                  }}>
                    {usersLoading && (
                      <div style={{ padding: '10px 12px', fontSize: 11, color: C.t3 }}>
                        Loading users…
                      </div>
                    )}
                    {usersError && !usersLoading && (
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>{usersError}</div>
                        <button
                          type="button"
                          onClick={() => void loadTenantUsers()}
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
                    )}
                    {!usersLoading && !usersError && pickableUsers.length === 0 && (
                      <div style={{ padding: '10px 12px', fontSize: 11, color: C.t3 }}>
                        No other active users
                      </div>
                    )}
                    {!usersLoading && pickableUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        disabled={dmCreating}
                        onClick={() => void handleStartDm(u.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 2,
                          padding: '8px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${C.br2}`,
                          cursor: dmCreating ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.t }}>
                          {u.full_name || u.username}
                        </span>
                        <span style={{ fontSize: 9, color: C.t3 }}>
                          @{u.username} · {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {dmRooms.map(r => {
                const active = state.activeRoomId === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      dispatch({ type: 'SET_ROOM', roomId: r.id });
                      if (isMobile) setMobileChatNavOpen(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 12px', cursor: 'pointer',
                      background: active ? 'rgba(79,142,247,.1)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget.style.background = 'rgba(255,255,255,.04)'); }}
                    onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'transparent'); }}
                  >
                    <span style={{
                      fontSize: 11,
                      color: active ? C.t : C.t2,
                      fontWeight: active ? 600 : 400,
                      flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.name}
                    </span>
                    <RoomUnreadBadges room={r} />
                  </div>
                );
              })}
              {/* Announce bottom button */}
              <div style={{ marginTop: 'auto', padding: '10px 8px' }}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_ANNOUNCE_MODE', value: true })}
                  style={{
                    width: '100%',
                    background: 'rgba(79,142,247,.08)',
                    border: '1px solid rgba(79,142,247,.2)',
                    borderRadius: 8, padding: '6px 9px', fontSize: 10, color: C.blue,
                    fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  <Megaphone size={12} /> Announce to all rooms
                </button>
              </div>
            </div>
          )}

          {/* Main chat area — bounded flex column. minHeight:0 +
              overflow:hidden are critical so the inner messages
              area scrolls and the input bar (flexShrink:0) stays
              pinned at the bottom without position:sticky (which
              breaks under overflow:hidden ancestors). */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
          }}>
            {!activeRoom && !channelsLoading && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.t3,
                fontSize: 13,
              }}>
                Select a channel
              </div>
            )}

            {activeRoom && (
              <>
            {/* Channel header */}
            <div style={{
              padding: '10px 14px',
              borderBottom: `1px solid ${C.br2}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setMobileChatNavOpen(v => !v)}
                    aria-label="Toggle channels"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: C.t2, padding: 4, display: 'flex', alignItems: 'center',
                    }}
                  >
                    <Users size={16} />
                  </button>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.t }}>
                    {activeRoom.type === 'dm' ? activeRoom.name : `#${activeRoom.name}`}
                  </span>
                  <span style={{ fontSize: 10, color: C.t3 }}>
                    {activeRoom.type === 'dm' ? 'Direct message' : 'Channel'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_ANNOUNCE_MODE', value: true })}
                  style={{
                    background: 'rgba(79,142,247,.08)',
                    border: '1px solid rgba(79,142,247,.2)',
                    borderRadius: 6, padding: '4px 9px', fontSize: 10, color: C.blue,
                    fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Megaphone size={11} /> Announce
                </button>
                {TASKS_ENABLED && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_TAB', tab: 'tasks' })}
                  style={{
                    background: 'rgba(34,197,94,.08)',
                    border: '1px solid rgba(34,197,94,.2)',
                    borderRadius: 6, padding: '4px 9px', fontSize: 10, color: C.green,
                    fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <CheckSquare size={11} /> Tasks
                </button>
                )}
              </div>
            </div>

            <div
              ref={messagesScrollRef}
              onScroll={handleMessagesScroll}
              style={{
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              paddingBottom: isMobile ? '80px' : '8px',
            }}>
              {messagesLoading && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 120,
                  fontSize: 13,
                  color: C.t3,
                  padding: 24,
                }}>
                  Loading messages…
                </div>
              )}
              {!messagesLoading && messagesError && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 120,
                  padding: 24,
                  gap: 10,
                }}>
                  <div style={{ fontSize: 13, color: C.red }}>{messagesError}</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (state.activeRoomId != null) {
                        void loadMessagesInitial(state.activeRoomId);
                      }
                    }}
                    style={{
                      background: 'rgba(79,142,247,.1)',
                      border: '1px solid rgba(79,142,247,.25)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.blue,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <RefreshCw size={11} /> Retry
                  </button>
                </div>
              )}
              {!messagesLoading && !messagesError && messages.length === 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 120,
                  fontSize: 13,
                  color: C.t3,
                  padding: 24,
                }}>
                  No messages yet — say hello.
                </div>
              )}
              {!messagesLoading && !messagesError && messages.map((msg) => {
                const own = isOwnMessage(msg, authUser);
                const label = own ? 'You' : msg.sender_username;
                const avColor = own ? '#4F8EF7' : avatarColorFor(msg.sender_username);
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      gap: 9,
                      padding: '5px 14px',
                      flexDirection: own ? 'row-reverse' : 'row',
                    }}
                  >
                    <div style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: avColor,
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {initialsFor(label)}
                    </div>
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: own ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                        flexDirection: own ? 'row-reverse' : 'row',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.t }}>{label}</span>
                        <span style={{ fontSize: 10, color: C.t3 }}>{formatMessageTime(msg.created_at)}</span>
                        {msg.pending && (
                          <span style={{ fontSize: 9, color: C.t3 }}>Sending…</span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 12,
                        marginTop: 3,
                        lineHeight: 1.45,
                        color: own ? C.t : C.t2,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxWidth: '85%',
                        opacity: msg.pending ? 0.75 : 1,
                      }}>
                        {renderMessageBodyWithMentions(msg.body, mentionHighlights)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
              </>
            )}

            {activeRoom && (
            <>
            {sendError && (
              <div style={{
                margin: '0 14px 6px',
                padding: '6px 10px',
                borderRadius: 6,
                background: 'rgba(239,68,68,.1)',
                border: '1px solid rgba(239,68,68,.25)',
                fontSize: 11,
                color: C.red,
                flexShrink: 0,
              }}>
                {sendError}
              </div>
            )}
            {/* Input bar. On mobile, position:fixed bottom:56 pins it
                directly above the 56px mobile bottom nav — bulletproof
                regardless of ancestor overflow/height. On desktop, it
                stays as a normal flexShrink:0 row at the bottom of the
                bounded flex column. */}
            <div style={isMobile ? {
              position: 'fixed',
              bottom: 56,
              left: 0,
              right: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              padding: '8px 12px',
              borderTop: '1px solid rgba(255,255,255,.12)',
              background: '#060f1c',
            } : {
              flexShrink: 0,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              padding: '8px 12px',
              borderTop: `1px solid ${C.br2}`,
              background: C.bg,
              zIndex: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                {showMentionPopup && (
                  <div
                    ref={mentionPopupRef}
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      marginBottom: 6,
                      zIndex: 90,
                      background: C.bg3,
                      border: `1px solid ${C.br2}`,
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,.35)',
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {mentionSuggestions.map((u, idx) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectMention(u)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 2,
                          padding: '8px 12px',
                          background: idx === mentionHighlightIndex ? 'rgba(79,142,247,.12)' : 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${C.br2}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onMouseEnter={() => setMentionHighlightIndex(idx)}
                      >
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.t }}>
                          {mentionDisplayLabel(u)}
                        </span>
                        <span style={{ fontSize: 9, color: C.t3 }}>@{u.username}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <button
                    type="button"
                    onClick={openMentionAtCursor}
                    title="Mention someone"
                    style={{
                      background: 'rgba(79,142,247,.1)',
                      border: `1px solid rgba(79,142,247,.25)`,
                      borderRadius: 7,
                      padding: '7px 8px',
                      color: C.blue,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AtSign size={14} />
                  </button>
                  <textarea
                    ref={composerTextareaRef}
                    rows={1}
                    value={state.newMessage}
                    onChange={handleComposerChange}
                    onKeyDown={handleComposerKeyDown}
                    onClick={(e) => setComposerCursor(e.currentTarget.selectionStart ?? 0)}
                    onKeyUp={(e) => setComposerCursor(e.currentTarget.selectionStart ?? 0)}
                    placeholder={`Message #${activeRoom.name}...`}
                    style={{
                      flex: 1,
                      background: C.bg4,
                      border: `1px solid ${C.br2}`,
                      borderRadius: 9,
                      padding: '8px 12px',
                      fontSize: 12,
                      color: C.t,
                      outline: 'none',
                      minWidth: 0,
                      resize: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 1.4,
                      maxHeight: 120,
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!state.newMessage.trim()}
                style={{
                  background: C.blue, color: '#fff',
                  border: 'none', borderRadius: 7,
                  padding: '7px 12px', fontSize: 11, fontWeight: 700,
                  cursor: state.newMessage.trim() ? 'pointer' : 'not-allowed',
                  opacity: state.newMessage.trim() ? 1 : 0.55,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Send size={12} /> Send
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      ) : (
        // ── TASKS PANEL ─────────────────────────────────────────
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 0 }}>
          <div style={{
            background: C.bg3,
            border: `1px solid ${C.br2}`,
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 12,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={14} color={C.blue} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.t }}>Tasks</div>
                  <div style={{ fontSize: 9, color: C.t3 }}>
                    {isManagement ? 'All tenant tasks' : 'Your assigned tasks'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: C.t2 }}>
                  <span style={{ color: C.blue, fontWeight: 700 }}>{openTasksCount} open</span>
                  {' · '}
                  <span style={{ color: C.amber, fontWeight: 700 }}>{inProgressTasksCount} in progress</span>
                  {' · '}
                  <span style={{ color: C.green, fontWeight: 700 }}>{doneTasksCount} done</span>
                </span>
                <button
                  type="button"
                  onClick={() => void loadTasks()}
                  disabled={tasksLoading}
                  style={{
                    background: 'rgba(79,142,247,.1)',
                    border: '1px solid rgba(79,142,247,.25)',
                    borderRadius: 7, padding: '5px 10px', fontSize: 10, fontWeight: 600,
                    color: C.blue, cursor: tasksLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                    opacity: tasksLoading ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={11} /> Refresh
                </button>
                {isManagement && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateTaskError(null);
                      setNewTaskModalOpen(true);
                    }}
                    style={{
                      background: C.blue, color: '#fff', border: 'none',
                      borderRadius: 7, padding: '5px 11px', fontSize: 10, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + New Task
                  </button>
                )}
              </div>
            </div>
          </div>

          {tasksLoading && tasks.length === 0 && (
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 10 }}>Loading tasks…</div>
          )}
          {tasksError && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>{tasksError}</div>
              <button
                type="button"
                onClick={() => void loadTasks()}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.br2}`,
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 10,
                  color: C.blue,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
            gap: 8,
          }}>
            {TASK_COLUMNS.map((status) => {
              const colTasks = tasks.filter((t) => t.status === status);
              return (
                <div key={status} style={{
                  background: C.bg2,
                  borderRadius: 10,
                  padding: 10,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: 8, paddingBottom: 6,
                    borderBottom: `1px solid ${C.br2}`,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: TASK_COLUMN_DOT[status] }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.4px', color: C.t }}>
                      {TASK_COLUMN_LABEL[status]}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 600,
                      background: 'rgba(255,255,255,.06)', color: C.t2,
                      padding: '1px 6px', borderRadius: 10,
                      marginLeft: 'auto',
                    }}>
                      {colTasks.length}
                    </span>
                  </div>

                  {colTasks.length === 0 && !tasksLoading && (
                    <div style={{ fontSize: 10, color: C.t3, padding: '8px 4px' }}>No tasks</div>
                  )}

                  {colTasks.map((task) => {
                    const overdue = isTaskOverdue(task);
                    const isDone = task.status === 'done';
                    const action = nextTaskStatusAction(task.status);
                    const showAction = action != null && canMoveTask(task);
                    const assigneeInitials = initialsFor(task.assigned_to_username);
                    const assigneeColor = avatarColorFor(task.assigned_to_username);
                    const dueLabel = formatTaskDueDate(task.due_date);
                    const dueColor = overdue ? C.red : isDone ? C.green : C.t3;

                    return (
                      <div
                        key={task.id}
                        title={task.description ?? undefined}
                        style={{
                          background: overdue ? 'rgba(239,68,68,.03)' : C.bg3,
                          border: `1px solid ${overdue ? 'rgba(239,68,68,.3)' : C.br2}`,
                          borderLeft: `3px solid ${isDone ? C.green : overdue ? C.red : TASK_COLUMN_DOT[status]}`,
                          borderRadius: 9,
                          padding: '9px 10px',
                          marginBottom: 7,
                          opacity: isDone ? 0.85 : 1,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.t, lineHeight: 1.4, marginBottom: 7 }}>
                          {task.title}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: assigneeColor, color: '#fff',
                              fontSize: 8, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              {assigneeInitials}
                            </div>
                            <span style={{ fontSize: 9, color: C.t2 }}>
                              {task.assigned_to_username}
                            </span>
                          </div>
                          {dueLabel && (
                            <span style={{ fontSize: 9, fontWeight: 600, color: dueColor, flexShrink: 0 }}>
                              {overdue ? 'Overdue · ' : ''}{dueLabel}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 9, color: C.t3, marginBottom: showAction ? 8 : 0 }}>
                          Created by {task.created_by_username}
                        </div>

                        {showAction && action && (
                          <button
                            type="button"
                            disabled={statusUpdatingId === task.id}
                            onClick={() => void handleTaskStatusChange(task.id, action.next)}
                            style={{
                              width: '100%',
                              background: action.next === 'done' ? 'rgba(34,197,94,.12)' : 'rgba(79,142,247,.1)',
                              border: `1px solid ${action.next === 'done' ? 'rgba(34,197,94,.25)' : 'rgba(79,142,247,.25)'}`,
                              borderRadius: 6,
                              padding: '5px 8px',
                              fontSize: 10,
                              fontWeight: 700,
                              color: action.next === 'done' ? C.green : C.blue,
                              cursor: statusUpdatingId === task.id ? 'not-allowed' : 'pointer',
                              opacity: statusUpdatingId === task.id ? 0.6 : 1,
                            }}
                          >
                            {statusUpdatingId === task.id ? 'Updating…' : action.label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <NewTaskModal
        open={newTaskModalOpen}
        onClose={() => {
          if (!createTaskSubmitting) setNewTaskModalOpen(false);
        }}
        onSubmit={handleCreateTask}
        users={tenantUsers}
        usersLoading={usersLoading}
        usersError={usersError}
        onRetryUsers={() => void loadTenantUsers()}
        defaultChannelId={defaultChannelId}
        submitting={createTaskSubmitting}
        error={createTaskError}
      />

      {/* Announce modal */}
      {state.announceMode && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: C.bg3, border: `1px solid ${C.br2}`, borderRadius: 12,
            padding: 20, width: 420, maxWidth: '100%',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Megaphone size={14} color={C.blue} /> Announce to All Rooms
            </div>
            <div style={{ fontSize: 11, color: C.t2, marginBottom: 12 }}>
              Message will post to General, Drivers, Sales, Warehouse and Finance
            </div>
            <textarea
              rows={6}
              value={state.announceText}
              onChange={e => dispatch({ type: 'SET_ANNOUNCE_TEXT', text: e.target.value })}
              placeholder="Type your announcement..."
              style={{
                width: '100%',
                background: C.bg4,
                border: `1px solid ${C.br2}`,
                borderRadius: 8,
                padding: 10,
                fontSize: 12, color: C.t,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_ANNOUNCE_MODE', value: false })}
                style={{
                  background: 'transparent', border: `1px solid ${C.br2}`,
                  borderRadius: 7, padding: '6px 14px', fontSize: 11, color: C.t2,
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAnnounceSend}
                disabled={!state.announceText.trim()}
                style={{
                  background: C.blue, color: '#fff',
                  border: 'none', borderRadius: 7,
                  padding: '6px 14px', fontSize: 11, fontWeight: 700,
                  cursor: state.announceText.trim() ? 'pointer' : 'not-allowed',
                  opacity: state.announceText.trim() ? 1 : 0.55,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Send size={12} /> Send to all rooms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local keyframes for onroute pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.4); opacity: .55; }
        }
      `}</style>
    </div>
  );
}
