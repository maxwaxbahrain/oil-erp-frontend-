// ──────────────────────────────────────────────────────────────
// Pulse — Team Communication
// Phase 1: Chat (rooms, DMs, file/photo upload, read receipts,
//          reactions, reply-to, announce)
// Phase 2: Tasks (boss overview, Kanban board, AI auto-tasks,
//          role badges, overdue highlighting)
//
// Pure presentational component — all data hardcoded. No services,
// no hooks from store/api, no fetches. Spec lives in
// ~/Downloads/PULSE_MASTER_PROMPT_FINAL.md.
// ──────────────────────────────────────────────────────────────
import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { Paperclip, Smile, Send, Megaphone, X, Users, CheckSquare, RefreshCw } from 'lucide-react';
import {
  getChannels,
  getMessages,
  sendMessage,
  markRead,
  createOrGetDm,
  type ChatChannel,
  type ChatMessage,
  type CreateDmResponse,
} from '../../services/chatService';
import { useAuth, type AuthRole } from '../../contexts/AuthContext';
import api from '../../api/axios';

const MESSAGE_POLL_MS = 4000;
const SCROLL_NEAR_BOTTOM_PX = 80;
const TASKS_ENABLED = false; // Phase 6 — wire real tasks API

type DisplayMessage = ChatMessage & { pending?: boolean };

// ── Types ─────────────────────────────────────────────────────
interface Reaction { emoji: string; count: number }

interface FileAttachment {
  type: 'image' | 'pdf' | 'doc';
  name: string;
  size: string;
}

interface Message {
  id: string;
  av: string;
  avatarColor: string;
  user: string;
  role: string;
  roleColor: string;
  roleTextColor: string;
  time: string;
  text: string;
  isSystem: boolean;
  isWarn: boolean;
  tick: 'sent' | 'delivered' | 'read';
  reactions: Reaction[];
  replyTo?: string;
  fileAttachment?: FileAttachment;
}

interface Room {
  id: number;
  name: string;
  type: 'channel' | 'dm';
  dotColor: string;
  unreadCount: number;
  unreadColor: 'red' | 'amber';
  lastTime: string;
  pinned?: string;
  messages: Message[];
  isDefault?: boolean;
  otherUserId?: number | null;
  otherUsername?: string | null;
}

const CHANNEL_DOT = '#4F8EF7';
const DM_DOT = '#7C3AED';

function channelToRoom(ch: ChatChannel): Room {
  const isDm = ch.type === 'dm';
  return {
    id: ch.id,
    name: isDm ? (ch.other_username || 'Direct Message') : ch.name,
    type: ch.type,
    dotColor: isDm ? DM_DOT : CHANNEL_DOT,
    unreadCount: ch.unread_count,
    unreadColor: ch.unread_count > 0 ? 'red' : 'red',
    lastTime: '',
    messages: [],
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
    dotColor: DM_DOT,
    unreadCount: dm.unread_count,
    unreadColor: dm.unread_count > 0 ? 'red' : 'red',
    lastTime: '',
    messages: [],
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

interface TeamMember {
  id: string;
  initials: string;
  name: string;
  role: string;
  roleColor: string;
  roleTextColor: string;
  avatarColor: string;
  status: 'online' | 'onroute' | 'offline';
  taskCount: number;
  doneCount: number;
  overdueCount: number;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'inprogress' | 'review' | 'done';
  assigneeId: string;
  tag: string;
  tagColor: string;
  tagTextColor: string;
  dueLabel: string;
  isOverdue: boolean;
  createdBy: 'ai' | 'manual';
  aiCreator?: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  { id: 'wq', initials: 'WQ', name: 'Waqas', role: 'Sales Manager',
    roleColor: 'rgba(79,142,247,.12)', roleTextColor: '#4F8EF7',
    avatarColor: '#4F8EF7', status: 'online',
    taskCount: 3, doneCount: 1, overdueCount: 1 },
  { id: 'sa', initials: 'SA', name: 'System Admin', role: 'Admin',
    roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
    avatarColor: '#7C3AED', status: 'online',
    taskCount: 4, doneCount: 0, overdueCount: 0 },
  { id: 'le', initials: 'LE', name: 'Leo', role: 'Van Driver',
    roleColor: 'rgba(34,197,94,.12)', roleTextColor: '#22C55E',
    avatarColor: '#22C55E', status: 'onroute',
    taskCount: 2, doneCount: 1, overdueCount: 0 },
  { id: 'kh', initials: 'KH', name: 'Khalid', role: 'Warehouse',
    roleColor: 'rgba(245,158,11,.12)', roleTextColor: '#F59E0B',
    avatarColor: '#F59E0B', status: 'offline',
    taskCount: 1, doneCount: 2, overdueCount: 0 },
];

const TASKS: Task[] = [
  { id: 't1', title: 'Call Qahir re overdue payment $3,875',
    description: '32 days overdue. Marcus flagged. Call before 2pm to avoid credit hold Friday.',
    priority: 'critical', status: 'pending',
    assigneeId: 'wq', tag: 'Finance', tagColor: 'rgba(245,158,11,.12)', tagTextColor: '#F59E0B',
    dueLabel: 'Today', isOverdue: false, createdBy: 'ai', aiCreator: 'Marcus' },
  { id: 't2', title: 'Approve OW16 Auto PO — 80 units $3,040',
    description: 'Supplier +18% above avg. Marcus recommends 40 units only and negotiate.',
    priority: 'high', status: 'pending',
    assigneeId: 'sa', tag: 'Procurement', tagColor: 'rgba(79,142,247,.12)', tagTextColor: '#4F8EF7',
    dueLabel: '12pm', isOverdue: false, createdBy: 'ai', aiCreator: 'Auto PO' },
  { id: 't3', title: 'Receive Bettano UAE shipment — Thursday',
    description: 'OW16 × 80 units incoming. Clear Bin A1 before arrival.',
    priority: 'medium', status: 'pending',
    assigneeId: 'kh', tag: 'Warehouse', tagColor: 'rgba(34,197,94,.12)', tagTextColor: '#22C55E',
    dueLabel: 'Thu 23 May', isOverdue: false, createdBy: 'manual' },
  { id: 't4', title: 'VAT return Q1 — review and approve',
    description: 'Ready for review. Address sequential gap INV-960339→960336 first.',
    priority: 'high', status: 'inprogress',
    assigneeId: 'sa', tag: 'Finance', tagColor: 'rgba(245,158,11,.12)', tagTextColor: '#F59E0B',
    dueLabel: 'Fri 24 May', isOverdue: false, createdBy: 'manual' },
  { id: 't5', title: 'Pause Zenol 0W20 Amazon ads — ACOS 38.6%',
    description: 'Burning $140/mo. Amazon AI flagged. Pause and review targeting.',
    priority: 'high', status: 'inprogress',
    assigneeId: 'wq', tag: 'Amazon', tagColor: 'rgba(251,146,60,.12)', tagTextColor: '#FB923C',
    dueLabel: 'Yesterday', isOverdue: true, createdBy: 'ai', aiCreator: 'Amazon AI' },
  { id: 't6', title: '5W30 clearance promo — 15% off before new formula',
    description: 'Bettano launching new formula. Clear 203 existing units first.',
    priority: 'medium', status: 'inprogress',
    assigneeId: 'wq', tag: 'Sales', tagColor: 'rgba(34,197,94,.12)', tagTextColor: '#22C55E',
    dueLabel: 'This week', isOverdue: false, createdBy: 'manual' },
  { id: 't7', title: 'Fix missing tax reg number on all invoices',
    description: 'Tax reg number missing on every invoice. Add in Settings → Company Profile.',
    priority: 'critical', status: 'review',
    assigneeId: 'sa', tag: 'Compliance', tagColor: 'rgba(239,68,68,.12)', tagTextColor: '#EF4444',
    dueLabel: 'Urgent', isOverdue: false, createdBy: 'ai', aiCreator: 'Marcus' },
  { id: 't8', title: 'Amazon ads budget +$200/mo approved',
    description: 'Activate from Amazon Seller Central dashboard.',
    priority: 'low', status: 'done',
    assigneeId: 'wq', tag: 'Amazon', tagColor: 'rgba(251,146,60,.12)', tagTextColor: '#FB923C',
    dueLabel: 'Done', isOverdue: false, createdBy: 'manual' },
  { id: 't9', title: 'Castrol GTX shipment received — 72 units B2',
    description: 'All units placed in B2 Rack 3. Quality check complete.',
    priority: 'low', status: 'done',
    assigneeId: 'kh', tag: 'Warehouse', tagColor: 'rgba(34,197,94,.12)', tagTextColor: '#22C55E',
    dueLabel: 'Done', isOverdue: false, createdBy: 'manual' },
  { id: 't10', title: 'Stop 1–5 deliveries complete — $1,122 collected',
    description: 'All receipts signed. Cash handed to Waqas.',
    priority: 'low', status: 'done',
    assigneeId: 'le', tag: 'Delivery', tagColor: 'rgba(34,197,94,.12)', tagTextColor: '#22C55E',
    dueLabel: 'Done', isOverdue: false, createdBy: 'manual' },
];

// ── State / reducer ───────────────────────────────────────────
interface PulseState {
  activeTab: 'chat' | 'tasks';
  activeRoomId: number | null;
  rooms: Room[];
  replyTo: string;
  newMessage: string;
  announceMode: boolean;
  announceText: string;
}

const initialState: PulseState = {
  activeTab: 'chat',
  activeRoomId: null,
  rooms: [],
  replyTo: '',
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
  | { type: 'SET_REPLY'; text: string }
  | { type: 'CLEAR_REPLY' }
  | { type: 'SET_MESSAGE'; text: string }
  | { type: 'SEND_MESSAGE'; roomId: number; text: string; replyTo: string }
  | { type: 'SEND_FILE'; roomId: number; fileName: string; fileType: 'image' | 'pdf' | 'doc'; fileSize: string }
  | { type: 'SEND_MARCUS_FILE_REPLY'; roomId: number }
  | { type: 'ADD_REACTION'; roomId: number; messageId: string; emoji: string }
  | { type: 'UPGRADE_TICK'; roomId: number; messageId: string; tick: 'delivered' | 'read' }
  | { type: 'CLEAR_UNREAD'; roomId: number }
  | { type: 'SET_ANNOUNCE_MODE'; value: boolean }
  | { type: 'SET_ANNOUNCE_TEXT'; text: string }
  | { type: 'SEND_ANNOUNCE'; text: string };

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
    case 'SET_REPLY':
      return { ...state, replyTo: action.text };
    case 'CLEAR_REPLY':
      return { ...state, replyTo: '' };
    case 'SET_MESSAGE':
      return { ...state, newMessage: action.text };
    case 'SEND_MESSAGE': {
      const newMsg: Message = {
        id: Date.now().toString() + '-m',
        av: 'AQ', avatarColor: '#4F8EF7', user: 'You', role: 'Admin',
        roleColor: 'rgba(79,142,247,.12)', roleTextColor: '#4F8EF7',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        text: action.text, isSystem: false, isWarn: false, tick: 'sent',
        reactions: [],
        replyTo: action.replyTo || undefined,
      };
      return {
        ...state,
        newMessage: '',
        replyTo: '',
        rooms: state.rooms.map(r =>
          r.id === action.roomId ? { ...r, messages: [...r.messages, newMsg] } : r
        ),
      };
    }
    case 'SEND_FILE': {
      const fileMsg: Message = {
        id: Date.now().toString() + '-f',
        av: 'AQ', avatarColor: '#4F8EF7', user: 'You', role: 'Admin',
        roleColor: 'rgba(79,142,247,.12)', roleTextColor: '#4F8EF7',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        text: action.fileType === 'image' ? 'Photo sent.' : 'File sent.',
        isSystem: false, isWarn: false, tick: 'sent', reactions: [],
        fileAttachment: { type: action.fileType, name: action.fileName, size: action.fileSize },
      };
      return {
        ...state,
        rooms: state.rooms.map(r =>
          r.id === action.roomId ? { ...r, messages: [...r.messages, fileMsg] } : r
        ),
      };
    }
    case 'SEND_MARCUS_FILE_REPLY': {
      const marcusMsg: Message = {
        id: Date.now().toString() + '-mc',
        av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        text: '✦ Marcus AI: Photo detected — attaching to latest open delivery invoice as Proof of Delivery.',
        isSystem: true, isWarn: false, tick: 'read', reactions: [],
      };
      return {
        ...state,
        rooms: state.rooms.map(r =>
          r.id === action.roomId ? { ...r, messages: [...r.messages, marcusMsg] } : r
        ),
      };
    }
    case 'ADD_REACTION': {
      return {
        ...state,
        rooms: state.rooms.map(r => {
          if (r.id !== action.roomId) return r;
          return {
            ...r,
            messages: r.messages.map(m => {
              if (m.id !== action.messageId) return m;
              const exists = m.reactions.find(rx => rx.emoji === action.emoji);
              const reactions = exists
                ? exists.count === 1
                  ? m.reactions.filter(rx => rx.emoji !== action.emoji)
                  : m.reactions.map(rx => rx.emoji === action.emoji ? { ...rx, count: rx.count + 1 } : rx)
                : [...m.reactions, { emoji: action.emoji, count: 1 }];
              return { ...m, reactions };
            }),
          };
        }),
      };
    }
    case 'UPGRADE_TICK': {
      return {
        ...state,
        rooms: state.rooms.map(r => {
          if (r.id !== action.roomId) return r;
          return {
            ...r,
            messages: r.messages.map(m =>
              m.id === action.messageId ? { ...m, tick: action.tick } : m
            ),
          };
        }),
      };
    }
    case 'CLEAR_UNREAD':
      return {
        ...state,
        rooms: state.rooms.map(r => r.id === action.roomId ? { ...r, unreadCount: 0 } : r),
      };
    case 'SET_ANNOUNCE_MODE':
      return { ...state, announceMode: action.value, announceText: '' };
    case 'SET_ANNOUNCE_TEXT':
      return { ...state, announceText: action.text };
    case 'SEND_ANNOUNCE': {
      const announceMsg: Message = {
        id: Date.now().toString() + '-an',
        av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'Broadcast',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        text: '📢 ANNOUNCEMENT: ' + action.text,
        isSystem: true, isWarn: false, tick: 'read', reactions: [],
      };
      return {
        ...state,
        announceMode: false,
        announceText: '',
        rooms: state.rooms.map(r => ({ ...r, messages: [...r.messages, announceMsg] })),
      };
    }
    default:
      return state;
  }
}

// ── helpers ───────────────────────────────────────────────────
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '...' : s);

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

const STATUS_DOT: Record<TeamMember['status'], string> = {
  online: '#22C55E',
  onroute: '#F59E0B',
  offline: '#3E5678',
};

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

const PRIORITY_COLOR: Record<Task['priority'], string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#4F8EF7',
  low: '#3E5678',
};

const COLUMN_DOT: Record<Task['status'], string> = {
  pending: '#8BA3C7',
  inprogress: '#F59E0B',
  review: '#4F8EF7',
  done: '#22C55E',
};

const COLUMN_LABEL: Record<Task['status'], string> = {
  pending: 'PENDING',
  inprogress: 'IN PROGRESS',
  review: 'REVIEW',
  done: 'DONE',
};

// ── Main component ───────────────────────────────────────────
export default function PulseDashboard() {
  const { user: authUser } = useAuth();
  const [state, dispatch] = useReducer(pulseReducer, initialState);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  );
  const [mobileChatNavOpen, setMobileChatNavOpen] = useState<boolean>(false);
  const [pinnedDismissed, setPinnedDismissed] = useState<Record<number, boolean>>({});
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const marcusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (!TASKS_ENABLED && state.activeTab !== 'chat') {
      dispatch({ type: 'SET_TAB', tab: 'chat' });
    }
  }, [state.activeTab]);

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

  // Cleanup marcus timer on unmount
  useEffect(() => {
    return () => {
      if (marcusTimerRef.current) clearTimeout(marcusTimerRef.current);
    };
  }, []);

  const activeRoom = state.activeRoomId != null
    ? state.rooms.find(r => r.id === state.activeRoomId)
    : undefined;
  const channelRooms = state.rooms.filter(r => r.type === 'channel');
  const dmRooms = state.rooms.filter(r => r.type === 'dm');

  // Boss summary aggregates
  const totalTasksToday = TASKS.length;
  const doneTasksTotal = TASKS.filter(t => t.status === 'done').length;
  const overdueTasksTotal = TASKS.filter(t => t.isOverdue).length;

  // ── Send handlers ──────────────────────────────────────────
  async function handleSendMessage() {
    const text = state.newMessage.trim();
    if (!text || state.activeRoomId == null) return;

    const channelId = state.activeRoomId;
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
    dispatch({ type: 'CLEAR_REPLY' });
    setSendError(null);
    nearBottomRef.current = true;
    setMessages((prev) => [...prev, optimistic]);

    try {
      const sent = await sendMessage(channelId, text);
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

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || state.activeRoomId == null) return;
    const sizeKB = file.size / 1024;
    const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;
    const nameLower = file.name.toLowerCase();
    let type: 'image' | 'pdf' | 'doc' = 'doc';
    if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(nameLower)) {
      type = 'image';
    } else if (nameLower.endsWith('.pdf')) {
      type = 'pdf';
    } else {
      type = 'doc';
    }
    dispatch({
      type: 'SEND_FILE', roomId: state.activeRoomId,
      fileName: file.name, fileType: type, fileSize: sizeLabel,
    });
    // For image uploads, Marcus AI posts an auto-reply ~1.2s later
    if (type === 'image') {
      const roomId = state.activeRoomId;
      if (marcusTimerRef.current) clearTimeout(marcusTimerRef.current);
      marcusTimerRef.current = setTimeout(() => {
        dispatch({ type: 'SEND_MARCUS_FILE_REPLY', roomId });
      }, 1200);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
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
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.dotColor, flexShrink: 0 }} />
                    <span style={{
                      fontSize: 12,
                      color: active ? C.t : C.t2,
                      fontWeight: active ? 600 : 400,
                      flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.name}
                    </span>
                    {r.unreadCount > 0 && (
                      <span style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 8,
                        background: r.unreadColor === 'red' ? 'rgba(239,68,68,.2)' : 'rgba(245,158,11,.2)',
                        color: r.unreadColor === 'red' ? '#EF4444' : '#F59E0B',
                        fontWeight: 600,
                      }}>
                        {r.unreadCount}
                      </span>
                    )}
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
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: r.dotColor, color: '#fff',
                      fontSize: 8, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {(r.otherUsername || r.name).slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{
                      fontSize: 11,
                      color: active ? C.t : C.t2,
                      fontWeight: active ? 600 : 400,
                      flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.name}
                    </span>
                    {r.unreadCount > 0 && (
                      <span style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 8,
                        background: 'rgba(239,68,68,.2)',
                        color: '#EF4444',
                        fontWeight: 600,
                      }}>
                        {r.unreadCount}
                      </span>
                    )}
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
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: activeRoom.dotColor, flexShrink: 0 }} />
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

            {/* Pinned bar */}
            {activeRoom.pinned && !pinnedDismissed[activeRoom.id] && (
              <div style={{
                background: 'rgba(79,142,247,.06)',
                borderBottom: '1px solid rgba(79,142,247,.15)',
                padding: '5px 14px',
                fontSize: 10, color: C.t2,
                display: 'flex', alignItems: 'center', gap: 6,
                flexShrink: 0,
              }}>
                <span style={{ color: C.blue }}>📍</span>
                <span style={{ color: C.blue, fontWeight: 600 }}>Pinned:</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeRoom.pinned}
                </span>
                <button
                  type="button"
                  onClick={() => setPinnedDismissed(p => ({ ...p, [activeRoom.id]: true }))}
                  style={{
                    background: 'transparent', border: 'none', color: C.t3, cursor: 'pointer',
                    padding: 2, display: 'flex', alignItems: 'center',
                  }}
                  aria-label="Dismiss pinned"
                >
                  <X size={11} />
                </button>
              </div>
            )}

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
                        {msg.body}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
              </>
            )}

            {activeRoom && state.replyTo && (
              <div style={{
                margin: '0 14px',
                background: 'rgba(79,142,247,.08)',
                borderLeft: `2px solid ${C.blue}`,
                borderRadius: '0 7px 7px 0',
                padding: '5px 9px',
                display: 'flex', justifyContent: 'space-between',
                fontSize: 11, color: C.t2,
                flexShrink: 0,
              }}>
                <span>↩ Replying to: {truncate(state.replyTo, 60)}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'CLEAR_REPLY' })}
                  style={{ background: 'transparent', border: 'none', color: C.t3, cursor: 'pointer' }}
                  aria-label="Cancel reply"
                >
                  <X size={11} />
                </button>
              </div>
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
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderTop: '1px solid rgba(255,255,255,.12)',
              background: '#060f1c',
            } : {
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderTop: `1px solid ${C.br2}`,
              background: C.bg,
              zIndex: 10,
            }}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFilePick}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: C.t2, padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                <Paperclip size={16} />
              </button>
              <button
                type="button"
                aria-label="Emoji (decorative)"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: C.t2, padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                <Smile size={16} />
              </button>
              <textarea
                rows={1}
                value={state.newMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  dispatch({ type: 'SET_MESSAGE', text: e.target.value })
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
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
              <span style={{ fontSize: 10, color: C.t3 }}>@</span>
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
        // ── TASKS PANEL (Phase 6) ─────────────────────────────
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 0 }}>
          {/* Boss summary strip */}
          <div style={{
            background: C.bg3,
            border: `1px solid ${C.br2}`,
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 12,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, flexWrap: 'wrap', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={14} color={C.blue} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.t }}>
                    Team Overview — Boss View
                  </div>
                  <div style={{ fontSize: 9, color: C.t3 }}>
                    Who is doing what right now
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: C.t2 }}>
                  Today: <span style={{ color: C.blue, fontWeight: 700 }}>{totalTasksToday} tasks</span> ·
                  {' '}<span style={{ color: C.green, fontWeight: 700 }}>{doneTasksTotal} done</span> ·
                  {' '}<span style={{ color: overdueTasksTotal > 0 ? C.red : C.t3, fontWeight: 700 }}>{overdueTasksTotal} overdue</span>
                </span>
                <button
                  type="button"
                  style={{
                    background: C.blue, color: '#fff', border: 'none',
                    borderRadius: 7, padding: '5px 11px', fontSize: 10, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Assign task (UI demo — not wired)"
                >
                  + Assign Task
                </button>
              </div>
            </div>

            {/* Member grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
              gap: 8,
            }}>
              {TEAM_MEMBERS.map(m => {
                const memberTasks = TASKS.filter(t => t.assigneeId === m.id);
                const tCount = memberTasks.length;
                const dCount = memberTasks.filter(t => t.status === 'done').length;
                const oCount = memberTasks.filter(t => t.isOverdue).length;
                const isOnroute = m.status === 'onroute';
                return (
                  <div key={m.id} style={{
                    background: C.bg4,
                    borderRadius: 9,
                    padding: '9px 10px',
                    border: `1px solid ${C.br2}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: m.avatarColor, color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {m.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.t }}>
                          {m.name}
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          background: m.roleColor, color: m.roleTextColor,
                          padding: '1px 5px', borderRadius: 6,
                          display: 'inline-block', marginTop: 1,
                        }}>
                          {m.role}
                        </span>
                      </div>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: STATUS_DOT[m.status], flexShrink: 0,
                        animation: isOnroute ? 'pulse 1.5s ease-in-out infinite' : undefined,
                      }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
                      <Stat label="Tasks" value={tCount} color={C.blue} />
                      <Stat label="Done" value={dCount} color={C.green} />
                      <Stat label="Overdue" value={oCount} color={oCount > 0 ? C.red : C.t3} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI auto-task banner */}
          <div style={{
            background: 'rgba(79,142,247,.07)',
            border: '1px solid rgba(79,142,247,.2)',
            borderRadius: 8,
            padding: '7px 10px',
            marginBottom: 10,
            display: 'flex', gap: 7, fontSize: 10, color: C.t2,
            alignItems: 'center',
          }}>
            <span style={{ color: C.blue, fontSize: 12, fontWeight: 700 }}>✦</span>
            <span>
              Marcus AI auto-created 2 tasks today —
              {' '}<strong style={{ color: C.t }}>'Call Qahir re overdue $3,875'</strong> assigned to Waqas ·
              {' '}<strong style={{ color: C.t }}>'Approve OW16 PO'</strong> assigned to System Admin
            </span>
          </div>

          {/* Kanban board */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)',
            gap: 8,
          }}>
            {(['pending', 'inprogress', 'review', 'done'] as const).map(status => {
              const colTasks = TASKS.filter(t => t.status === status);
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
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: COLUMN_DOT[status] }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.4px', color: C.t }}>
                      {COLUMN_LABEL[status]}
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

                  {colTasks.map(task => {
                    const assignee = TEAM_MEMBERS.find(m => m.id === task.assigneeId);
                    const isDone = task.status === 'done';
                    const stripeColor = isDone
                      ? C.green
                      : task.priority === 'low'
                        ? C.br2
                        : PRIORITY_COLOR[task.priority];
                    const priorityLabel = isDone
                      ? '✓ DONE'
                      : task.isOverdue
                        ? 'OVERDUE'
                        : PRIORITY_LABEL[task.priority];
                    const priorityColor = isDone
                      ? C.green
                      : task.isOverdue
                        ? C.red
                        : PRIORITY_COLOR[task.priority];

                    const dueColor =
                      task.dueLabel === 'Done' ? C.green :
                      task.dueLabel === 'Today' || task.dueLabel === 'Urgent' || task.dueLabel === 'Yesterday' ? C.red :
                      task.isOverdue ? C.amber :
                      C.t3;

                    return (
                      <div
                        key={task.id}
                        title={task.description}
                        style={{
                          background: task.isOverdue ? 'rgba(239,68,68,.03)' : C.bg3,
                          border: `1px solid ${task.isOverdue ? 'rgba(239,68,68,.3)' : C.br2}`,
                          borderLeft: `3px solid ${stripeColor}`,
                          borderRadius: 9,
                          padding: '9px 10px',
                          marginBottom: 7,
                          cursor: 'pointer',
                          opacity: isDone ? 0.65 : 1,
                          transition: 'border-color .15s',
                        }}
                        onMouseEnter={e => {
                          if (!task.isOverdue) e.currentTarget.style.borderColor = 'rgba(79,142,247,.3)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = task.isOverdue ? 'rgba(239,68,68,.3)' : C.br2;
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700,
                            background: task.tagColor, color: task.tagTextColor,
                            padding: '1px 6px', borderRadius: 5,
                          }}>
                            {task.tag}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 600, color: priorityColor }}>
                            {priorityLabel}
                          </span>
                        </div>

                        <div style={{ fontSize: 11, fontWeight: 600, color: C.t, lineHeight: 1.4, marginBottom: 7 }}>
                          {task.title}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: assignee?.avatarColor ?? C.t3,
                              color: '#fff', fontSize: 8, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              {assignee?.initials ?? '??'}
                            </div>
                            <span style={{ fontSize: 9, color: C.t2 }}>
                              {assignee?.name ?? 'Unknown'}
                            </span>
                            {assignee && (
                              <span style={{
                                fontSize: 8, fontWeight: 700,
                                background: assignee.roleColor, color: assignee.roleTextColor,
                                padding: '1px 4px', borderRadius: 4,
                              }}>
                                {assignee.role}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 600, color: dueColor, flexShrink: 0 }}>
                            {task.dueLabel}
                          </span>
                        </div>

                        {task.createdBy === 'ai' && (
                          <div style={{
                            fontSize: 9, color: C.purple,
                            marginTop: 5, display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            <span>✦</span>
                            <span>Created by AI · {task.aiCreator ?? 'AI'}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    title="Add task (UI demo — not wired)"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: '1px dashed rgba(255,255,255,.1)',
                      borderRadius: 8,
                      padding: 6,
                      fontSize: 10, color: C.t3, cursor: 'pointer',
                      transition: 'border-color .15s, color .15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(79,142,247,.3)';
                      e.currentTarget.style.color = C.blue;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)';
                      e.currentTarget.style.color = C.t3;
                    }}
                  >
                    + Add task
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

// ── Small inline stat component ──────────────────────────────
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      borderRadius: 6,
      padding: '4px 6px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 8, color: C.t3, marginTop: 1, textTransform: 'uppercase', letterSpacing: '.4px' }}>
        {label}
      </div>
    </div>
  );
}
