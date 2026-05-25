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
import { useReducer, useEffect, useRef, useState } from 'react';
import { Paperclip, Smile, Send, Megaphone, X, Users, CheckSquare } from 'lucide-react';

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
  id: string;
  name: string;
  dotColor: string;
  unreadCount: number;
  unreadColor: 'red' | 'amber';
  lastTime: string;
  pinned?: string;
  messages: Message[];
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

// ── Hardcoded data ────────────────────────────────────────────
const ROOMS: Room[] = [
  {
    id: 'general',
    name: 'General',
    dotColor: '#4F8EF7',
    unreadCount: 0,
    unreadColor: 'red',
    lastTime: '9:18 AM',
    pinned: 'Daily target: Collect $2,800 cash today · OW16 reorder approved',
    messages: [
      { id: 'g1', av: 'WQ', avatarColor: '#4F8EF7', user: 'Waqas', role: 'Sales Mgr',
        roleColor: 'rgba(79,142,247,.12)', roleTextColor: '#4F8EF7',
        time: '9:02 AM', text: 'Good morning! 821 invoices outstanding — push collections today.',
        isSystem: false, isWarn: false, tick: 'read', reactions: [{ emoji: '👍', count: 2 }] },
      { id: 'g2', av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: '9:05 AM', text: '✦ Marcus flagged Qahir — $3,875 overdue 32 days. Assigned to Waqas.',
        isSystem: true, isWarn: false, tick: 'read', reactions: [] },
      { id: 'g3', av: 'LE', avatarColor: '#22C55E', user: 'Leo', role: 'Driver',
        roleColor: 'rgba(34,197,94,.12)', roleTextColor: '#22C55E',
        time: '9:15 AM', text: 'Van 01 loaded. 13 stops today. OW16 stock low on van.',
        isSystem: false, isWarn: false, tick: 'read', reactions: [{ emoji: '✅', count: 1 }] },
      { id: 'g4', av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: '9:18 AM', text: '✦ Auto PO raised for OW16 × 80 units — needs approval before 12pm.',
        isSystem: true, isWarn: false, tick: 'read', reactions: [] },
    ],
  },
  {
    id: 'drivers',
    name: 'Drivers',
    dotColor: '#22C55E',
    unreadCount: 1,
    unreadColor: 'amber',
    lastTime: '1:15 PM',
    pinned: "Today's route — 13 stops · Van 01 · Leo · Start 8:14 AM · Est. return 5:30 PM",
    messages: [
      { id: 'd1', av: 'LE', avatarColor: '#22C55E', user: 'Leo', role: 'Driver',
        roleColor: 'rgba(34,197,94,.12)', roleTextColor: '#22C55E',
        time: '8:14 AM', text: 'Departed depot. 13 stops. Starting Ali A&R, 97 Palace St.',
        isSystem: false, isWarn: false, tick: 'read', reactions: [{ emoji: '👍', count: 2 }] },
      { id: 'd2', av: 'LE', avatarColor: '#22C55E', user: 'Leo', role: 'Driver',
        roleColor: 'rgba(34,197,94,.12)', roleTextColor: '#22C55E',
        time: '8:52 AM', text: 'Delivery done. Ali A&R signed. $480 collected. Receipt attached.',
        isSystem: false, isWarn: false, tick: 'read', reactions: [{ emoji: '✅', count: 1 }],
        fileAttachment: { type: 'image', name: 'delivery_ali_aandR.jpg', size: '1.2 MB' } },
      { id: 'd3', av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: '8:53 AM', text: '✦ Marcus AI: Photo auto-attached to INV-960340 as Proof of Delivery. Invoice marked Delivered ✓',
        isSystem: true, isWarn: false, tick: 'read', reactions: [] },
      { id: 'd4', av: 'WQ', avatarColor: '#4F8EF7', user: 'Waqas', role: 'Sales Mgr',
        roleColor: 'rgba(79,142,247,.12)', roleTextColor: '#4F8EF7',
        time: '9:05 AM', text: 'Great work Leo. Make sure you get signed receipts from Janan Motors too.',
        isSystem: false, isWarn: false, tick: 'read', reactions: [], replyTo: 'Leo: Delivery done. Ali A&R...' },
      { id: 'd5', av: 'LE', avatarColor: '#22C55E', user: 'Leo', role: 'Driver',
        roleColor: 'rgba(34,197,94,.12)', roleTextColor: '#22C55E',
        time: '11:02 AM', text: '5 stops done. Collected $1,122. PO document attached for Khalid.',
        isSystem: false, isWarn: false, tick: 'delivered', reactions: [],
        fileAttachment: { type: 'pdf', name: 'PO_Bettano_OW16_80units.pdf', size: '245 KB' } },
      { id: 'd6', av: 'LE', avatarColor: '#22C55E', user: 'Leo', role: 'Driver',
        roleColor: 'rgba(34,197,94,.12)', roleTextColor: '#22C55E',
        time: '1:15 PM', text: 'At Stop 6 — Mobil Centre. $328 to collect. Traffic delayed 20 min.',
        isSystem: false, isWarn: true, tick: 'sent', reactions: [] },
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    dotColor: '#22C55E',
    unreadCount: 3,
    unreadColor: 'red',
    lastTime: '10:17 AM',
    pinned: 'Monthly target: $10,000 · Current: $5,933 (59%) · Top customer: ALI A&R',
    messages: [
      { id: 's1', av: 'WQ', avatarColor: '#4F8EF7', user: 'Waqas', role: 'Sales Mgr',
        roleColor: 'rgba(79,142,247,.12)', roleTextColor: '#4F8EF7',
        time: '8:45 AM', text: 'WAQAS Trading asking bulk OW16 pricing — 50 units. ARIA handling it.',
        isSystem: false, isWarn: false, tick: 'read', reactions: [] },
      { id: 's2', av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: '8:47 AM', text: '✦ ARIA offered 5% discount — margin stays 33%. Within pricing policy. ✓',
        isSystem: true, isWarn: false, tick: 'read', reactions: [{ emoji: '✅', count: 1 }] },
      { id: 's3', av: 'WQ', avatarColor: '#4F8EF7', user: 'Waqas', role: 'Sales Mgr',
        roleColor: 'rgba(79,142,247,.12)', roleTextColor: '#4F8EF7',
        time: '10:02 AM', text: 'Ali A&R confirmed order — $2,200. Largest order this month!',
        isSystem: false, isWarn: false, tick: 'read', reactions: [{ emoji: '👍', count: 3 }] },
      { id: 's4', av: 'KH', avatarColor: '#F59E0B', user: 'Khalid', role: 'Warehouse',
        roleColor: 'rgba(245,158,11,.12)', roleTextColor: '#F59E0B',
        time: '10:15 AM', text: 'FastLuke UK cut OW16 on Amazon by 8%. BSR dropped to #445.',
        isSystem: false, isWarn: true, tick: 'read', reactions: [] },
      { id: 's5', av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: '10:17 AM', text: '✦ Amazon AI alerted Marcus. Recommendation: increase ads, do not cut price. See AI Hub.',
        isSystem: true, isWarn: false, tick: 'read', reactions: [] },
    ],
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    dotColor: '#F59E0B',
    unreadCount: 0,
    unreadColor: 'red',
    lastTime: '11:20 AM',
    pinned: 'Bin D1 QUARANTINE — Mobil 5W30 EXPIRED. Do not dispatch. Khalid to confirm removal.',
    messages: [
      { id: 'w1', av: 'KH', avatarColor: '#F59E0B', user: 'Khalid', role: 'Warehouse',
        roleColor: 'rgba(245,158,11,.12)', roleTextColor: '#F59E0B',
        time: '7:30 AM', text: 'Morning check done. Bin D1 quarantine confirmed — Mobil 5W30 EXPIRED.',
        isSystem: false, isWarn: true, tick: 'read', reactions: [] },
      { id: 'w2', av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: '7:32 AM', text: '✦ 3 products below reorder point: OW16 (40 units), Zenol 0W20 (12), Mobil 5W30 (8)',
        isSystem: true, isWarn: false, tick: 'read', reactions: [] },
      { id: 'w3', av: 'KH', avatarColor: '#F59E0B', user: 'Khalid', role: 'Warehouse',
        roleColor: 'rgba(245,158,11,.12)', roleTextColor: '#F59E0B',
        time: '8:10 AM', text: 'Castrol GTX received — 72 units placed in B2 Rack 3. All good.',
        isSystem: false, isWarn: false, tick: 'read', reactions: [{ emoji: '✅', count: 1 }] },
      { id: 'w4', av: 'KH', avatarColor: '#F59E0B', user: 'Khalid', role: 'Warehouse',
        roleColor: 'rgba(245,158,11,.12)', roleTextColor: '#F59E0B',
        time: '11:20 AM', text: 'Pick list PL-002 complete. INV-960336 packed for Van 01.',
        isSystem: false, isWarn: false, tick: 'read', reactions: [] },
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    dotColor: '#7C3AED',
    unreadCount: 0,
    unreadColor: 'red',
    lastTime: '10:00 AM',
    pinned: 'VAT return Q1 due Friday — review and approve before EOD Thursday.',
    messages: [
      { id: 'f1', av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: '8:00 AM', text: '✦ Daily Brief: Cash $784,761 · AR Outstanding $414,338 · VAT MTD $628',
        isSystem: true, isWarn: false, tick: 'read', reactions: [] },
      { id: 'f2', av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: '8:02 AM', text: '✦ Sequential invoice gap: INV-960339 → INV-960336. Tax audit risk.',
        isSystem: true, isWarn: true, tick: 'read', reactions: [] },
      { id: 'f3', av: 'WQ', avatarColor: '#4F8EF7', user: 'Waqas', role: 'Sales Mgr',
        roleColor: 'rgba(79,142,247,.12)', roleTextColor: '#4F8EF7',
        time: '9:45 AM', text: 'VAT return Q1 ready for review. Please approve before Friday.',
        isSystem: false, isWarn: false, tick: 'read', reactions: [] },
      { id: 'f4', av: 'SA', avatarColor: '#7C3AED', user: 'System Admin', role: 'AI',
        roleColor: 'rgba(124,58,237,.12)', roleTextColor: '#7C3AED',
        time: '10:00 AM', text: '✦ Compliance score 30% — 5 items open. Tax reg number missing on all invoices.',
        isSystem: true, isWarn: true, tick: 'read', reactions: [] },
    ],
  },
];

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
  activeRoomId: string;
  rooms: Room[];
  replyTo: string;
  newMessage: string;
  announceMode: boolean;
  announceText: string;
}

const initialState: PulseState = {
  activeTab: 'chat',
  activeRoomId: 'drivers',
  rooms: ROOMS,
  replyTo: '',
  newMessage: '',
  announceMode: false,
  announceText: '',
};

type PulseAction =
  | { type: 'SET_TAB'; tab: 'chat' | 'tasks' }
  | { type: 'SET_ROOM'; roomId: string }
  | { type: 'SET_REPLY'; text: string }
  | { type: 'CLEAR_REPLY' }
  | { type: 'SET_MESSAGE'; text: string }
  | { type: 'SEND_MESSAGE'; roomId: string; text: string; replyTo: string }
  | { type: 'SEND_FILE'; roomId: string; fileName: string; fileType: 'image' | 'pdf' | 'doc'; fileSize: string }
  | { type: 'SEND_MARCUS_FILE_REPLY'; roomId: string }
  | { type: 'ADD_REACTION'; roomId: string; messageId: string; emoji: string }
  | { type: 'UPGRADE_TICK'; roomId: string; messageId: string; tick: 'delivered' | 'read' }
  | { type: 'CLEAR_UNREAD'; roomId: string }
  | { type: 'SET_ANNOUNCE_MODE'; value: boolean }
  | { type: 'SET_ANNOUNCE_TEXT'; text: string }
  | { type: 'SEND_ANNOUNCE'; text: string };

function pulseReducer(state: PulseState, action: PulseAction): PulseState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };
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

// Section divider — used between major sub-sections inside tabs.
function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)' }} />
      <span style={{ fontSize: 9, color: C.t3, fontWeight: 700, letterSpacing: '.8px' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,.07),transparent)' }} />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function PulseDashboard() {
  const [state, dispatch] = useReducer(pulseReducer, initialState);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  );
  const [mobileChatNavOpen, setMobileChatNavOpen] = useState<boolean>(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [pinnedDismissed, setPinnedDismissed] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tickTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const marcusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resize listener
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 900);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Scroll to bottom when active room or messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.activeRoomId, state.rooms]);

  // Clear unread when entering a room
  useEffect(() => {
    const room = state.rooms.find(r => r.id === state.activeRoomId);
    if (room && room.unreadCount > 0) {
      dispatch({ type: 'CLEAR_UNREAD', roomId: state.activeRoomId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeRoomId]);

  // Tick upgrade — sent → delivered (600ms) → read (1500ms) for AQ messages
  useEffect(() => {
    const timers = tickTimersRef.current;
    state.rooms.forEach(room => {
      room.messages.forEach(msg => {
        if (msg.av === 'AQ' && msg.tick === 'sent') {
          const t1 = setTimeout(() => {
            dispatch({ type: 'UPGRADE_TICK', roomId: room.id, messageId: msg.id, tick: 'delivered' });
          }, 600);
          const t2 = setTimeout(() => {
            dispatch({ type: 'UPGRADE_TICK', roomId: room.id, messageId: msg.id, tick: 'read' });
          }, 1500);
          timers.push(t1, t2);
        }
      });
    });
    return () => {
      timers.forEach(clearTimeout);
      tickTimersRef.current = [];
    };
  }, [state.rooms]);

  // Cleanup marcus timer on unmount
  useEffect(() => {
    return () => {
      if (marcusTimerRef.current) clearTimeout(marcusTimerRef.current);
    };
  }, []);

  const activeRoom: Room = state.rooms.find(r => r.id === state.activeRoomId) ?? state.rooms[0];

  // Boss summary aggregates
  const totalTasksToday = TASKS.length;
  const doneTasksTotal = TASKS.filter(t => t.status === 'done').length;
  const overdueTasksTotal = TASKS.filter(t => t.isOverdue).length;

  // ── Send handlers ──────────────────────────────────────────
  function handleSendMessage() {
    const text = state.newMessage.trim();
    if (!text) return;
    dispatch({ type: 'SEND_MESSAGE', roomId: state.activeRoomId, text, replyTo: state.replyTo });
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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

  function handleAnnounceSend() {
    const text = state.announceText.trim();
    if (!text) return;
    dispatch({ type: 'SEND_ANNOUNCE', text });
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: C.bg, color: C.t }}>
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
            { key: 'chat', label: 'Chat', Icon: Send },
            { key: 'tasks', label: 'Tasks', Icon: CheckSquare },
          ] as const).map(t => {
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
      {state.activeTab === 'chat' ? (
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
              {state.rooms.map(r => {
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

              {/* DMs header */}
              <div style={{ fontSize: 9, color: C.t3, fontWeight: 700, letterSpacing: '.7px', padding: '14px 12px 4px' }}>
                DIRECT MESSAGES
              </div>
              {TEAM_MEMBERS.map(m => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', cursor: 'pointer',
                  }}
                  title={`DM ${m.name} (UI demo — not wired)`}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: m.avatarColor, color: '#fff',
                    fontSize: 8, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {m.initials}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 11, color: C.t2, lineHeight: 1.2 }}>{m.name}</span>
                    <span style={{ fontSize: 9, color: C.t3, lineHeight: 1.2 }}>{m.role}</span>
                  </div>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[m.status], flexShrink: 0 }} />
                </div>
              ))}

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
                    #{activeRoom.name}
                  </span>
                  <span style={{ fontSize: 10, color: C.t3 }}>
                    {activeRoom.messages.length} messages · last activity {activeRoom.lastTime}
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

            {/* Messages area. minHeight:0 is the critical flex fix —
                without it, flex items ignore overflow and push children
                out of view. Bottom-nav clearance is now handled by the
                bounded flex column above + always-visible input bar
                below, so we only need a small breathing-room padding. */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              paddingBottom: isMobile ? '16px' : '8px',
            }}>
              <SectionDivider label="— TODAY —" />
              {activeRoom.messages.map(msg => {
                const isHovered = hoveredMsgId === msg.id;
                return (
                  <div
                    key={msg.id}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(prev => prev === msg.id ? null : prev)}
                    style={{
                      position: 'relative',
                      display: 'flex', gap: 9,
                      padding: '5px 14px',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: msg.avatarColor, color: '#fff',
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {msg.av}
                    </div>

                    {/* Body */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.t }}>{msg.user}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 600,
                          background: msg.roleColor, color: msg.roleTextColor,
                          padding: '1px 5px', borderRadius: 6,
                        }}>
                          {msg.role}
                        </span>
                        <span style={{ fontSize: 10, color: C.t3 }}>{msg.time}</span>
                      </div>

                      {/* Reply-to quote */}
                      {msg.replyTo && (
                        <div style={{
                          background: 'rgba(79,142,247,.08)',
                          borderLeft: `2px solid ${C.blue}`,
                          borderRadius: '0 6px 6px 0',
                          padding: '4px 8px',
                          fontSize: 10, color: C.t,
                          marginTop: 3,
                        }}>
                          ↩ {msg.replyTo}
                        </div>
                      )}

                      {/* File attachment */}
                      {msg.fileAttachment && (() => {
                        const f = msg.fileAttachment;
                        if (f.type === 'image') {
                          return (
                            <div style={{
                              marginTop: 5,
                              width: 180, height: 110,
                              background: C.bg3,
                              border: `1px solid ${C.br2}`,
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center',
                              position: 'relative',
                              gap: 2,
                            }}>
                              <div style={{ fontSize: 24 }}>📷</div>
                              <div style={{ fontSize: 10, color: C.t }}>{f.name}</div>
                              <div style={{ fontSize: 9, color: C.t2 }}>Tap to view full size</div>
                              <div style={{
                                position: 'absolute', bottom: 4, right: 4,
                                fontSize: 9, background: 'rgba(0,0,0,.6)', color: '#fff',
                                padding: '1px 6px', borderRadius: 6,
                              }}>
                                📎 Photo
                              </div>
                            </div>
                          );
                        }
                        const isPdf = f.type === 'pdf';
                        return (
                          <div style={{
                            marginTop: 5, maxWidth: 260,
                            background: C.bg3, border: `1px solid ${C.br2}`,
                            borderRadius: 9, padding: '9px 12px',
                            display: 'flex', gap: 9, cursor: 'pointer',
                            alignItems: 'center',
                          }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 8,
                              background: isPdf ? 'rgba(239,68,68,.1)' : 'rgba(79,142,247,.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 16, flexShrink: 0,
                            }}>
                              {isPdf ? '📄' : '📝'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: C.t, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.name}
                              </div>
                              <div style={{ fontSize: 10, color: C.t3 }}>{f.size}</div>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                 stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 5v14M19 12l-7 7-7-7" />
                            </svg>
                          </div>
                        );
                      })()}

                      {/* Message text */}
                      <div style={{
                        fontSize: 12,
                        marginTop: 3,
                        lineHeight: 1.45,
                        color: msg.isSystem ? C.blue : msg.isWarn ? C.amber : C.t2,
                      }}>
                        {msg.text}
                      </div>

                      {/* Reactions */}
                      {msg.reactions.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                          {msg.reactions.map(rx => (
                            <button
                              key={rx.emoji}
                              type="button"
                              onClick={() =>
                                dispatch({
                                  type: 'ADD_REACTION', roomId: activeRoom.id,
                                  messageId: msg.id, emoji: rx.emoji,
                                })
                              }
                              style={{
                                display: 'flex', gap: 3,
                                background: 'rgba(255,255,255,.06)',
                                border: `1px solid ${C.br2}`,
                                borderRadius: 20,
                                padding: '2px 7px',
                                fontSize: 11, cursor: 'pointer',
                                color: C.t2,
                                alignItems: 'center',
                              }}
                            >
                              <span>{rx.emoji}</span>
                              <span style={{ fontSize: 10 }}>{rx.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Read tick */}
                    <div style={{
                      fontSize: 10, marginLeft: 'auto',
                      alignSelf: 'flex-end',
                      color: msg.tick === 'read' ? C.blue : C.t3,
                      whiteSpace: 'nowrap',
                    }}>
                      {msg.tick === 'sent' ? '✓' : '✓✓'}
                    </div>

                    {/* Hover actions panel */}
                    {isHovered && (
                      <div style={{
                        position: 'absolute', right: 14, top: 4,
                        background: C.bg3, border: `1px solid ${C.br2}`,
                        borderRadius: 8, padding: '3px 5px',
                        display: 'flex', gap: 3, zIndex: 5,
                      }}>
                        {(['👍', '✅', '❌'] as const).map(e => (
                          <button
                            key={e}
                            type="button"
                            onClick={() =>
                              dispatch({
                                type: 'ADD_REACTION', roomId: activeRoom.id,
                                messageId: msg.id, emoji: e,
                              })
                            }
                            style={{
                              width: 26, height: 26, borderRadius: 6,
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              fontSize: 14,
                            }}
                          >
                            {e}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            dispatch({ type: 'SET_REPLY', text: `${msg.user}: ${truncate(msg.text, 50)}` })
                          }
                          style={{
                            width: 26, height: 26, borderRadius: 6,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: C.t2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          title="Reply"
                        >
                          ↩
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {state.replyTo && (
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

            {/* Input bar — flexShrink:0 keeps it visible at the bottom
                of the bounded flex column. No sticky/absolute needed:
                the parent's overflow:hidden + minHeight:0 caps the
                column height so this row naturally sits above the
                mobile bottom nav. env(safe-area-inset-bottom) on
                mobile handles iOS notch devices. */}
            <div style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              paddingBottom: isMobile
                ? 'calc(8px + env(safe-area-inset-bottom))'
                : '8px',
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
              <input
                type="text"
                value={state.newMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatch({ type: 'SET_MESSAGE', text: e.target.value })
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={`Message #${activeRoom.name}...`}
                style={{
                  flex: 1,
                  background: C.bg4,
                  border: `1px solid ${C.br2}`,
                  borderRadius: 9, padding: '8px 12px',
                  fontSize: 12, color: C.t,
                  outline: 'none',
                  minWidth: 0,
                }}
              />
              <span style={{ fontSize: 10, color: C.t3 }}>@</span>
              <button
                type="button"
                onClick={handleSendMessage}
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
          </div>
        </div>
      ) : (
        // ── TASKS PANEL ────────────────────────────────────────
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
