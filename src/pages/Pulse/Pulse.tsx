import { useState, useEffect, useRef } from 'react';
import {
    Send, Plus, Check, Clock, AlertCircle,
    Zap, Search, X, Edit2, Trash2
} from 'lucide-react';
import { getUsers, getCurrentUser, type User } from '../../store/authStore';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// ── Types ─────────────────────────────────────────────────────
interface Message {
    id: string;
    roomId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    content: string;
    timestamp: string;
    reactions: Record<string, string[]>;
    isPinned?: boolean;
    isAnnouncement?: boolean;
    // Optional pre-formatted clock time (e.g. "9:02 AM") used by the
    // hardcoded sample messages.  Real user-sent messages omit this
    // and fall back to the `timeAgo(timestamp)` relative format.
    displayTime?: string;
}

interface Task {
    id: string;
    title: string;
    description: string;
    assigneeId: string;
    assigneeName: string;
    assignedById: string;
    assignedByName: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'in_progress' | 'review' | 'done';
    dueDate: string;
    roomId?: string;
    createdAt: string;
    completedAt?: string;
}

interface Room {
    id: string;
    name: string;
    emoji: string;
    description: string;
    type: 'room' | 'direct';
    members: string[];
    createdBy: string;
    unread: number;
    pinned?: boolean;
}

// ── Storage ────────────────────────────────────────────────────
const MSGS_KEY  = 'pulse_messages';
const TASKS_KEY = 'pulse_tasks';
const ROOMS_KEY = 'pulse_rooms';

const DEFAULT_ROOMS: Room[] = [
    { id: 'general',   name: 'General',   emoji: '📢', description: 'Company-wide announcements', type: 'room', members: [], createdBy: 'system', unread: 0, pinned: true },
    { id: 'sales',     name: 'Sales',     emoji: '💰', description: 'Sales team updates',        type: 'room', members: [], createdBy: 'system', unread: 0 },
    { id: 'warehouse', name: 'Warehouse', emoji: '📦', description: 'Inventory & logistics',    type: 'room', members: [], createdBy: 'system', unread: 0 },
    { id: 'drivers',   name: 'Drivers',   emoji: '🚐', description: 'Van & delivery team',     type: 'room', members: [], createdBy: 'system', unread: 0 },
    { id: 'finance',   name: 'Finance',   emoji: '📊', description: 'Accounting & payments',  type: 'room', members: [], createdBy: 'system', unread: 0 },
];

// ── Hardcoded sample data ─────────────────────────────────────
// These constants populate the Chat / Tasks / Board views when no
// real data has been stored yet, so a fresh user lands on a
// "buzzing team" view instead of an empty screen.  Once the user
// posts a real message or assigns a real task, the sample data
// drops away and the live stored data takes over — the existing
// localStorage flow is untouched.

// Avatar tint per sender name (used for sample messages).  Real
// users without a match fall back to the existing gray avatar.
const USER_COLORS: Record<string, string> = {
    'Waqas':        '#4F8EF7',
    'System Admin': '#7C3AED',
    'Leo':          '#22C55E',
    'Khalid':       '#F59E0B',
};

// Override room unread badge count + color so the sidebar looks
// like a real team workflow ("Sales has 3 new messages, Drivers
// has 1").  When a room id isn't in this map, the real room.unread
// value renders unchanged.
const ROOM_UNREAD_OVERRIDE: Record<string, { count: number; color: string }> = {
    general:   { count: 0, color: '#F97316' },
    sales:     { count: 3, color: '#EF4444' },
    warehouse: { count: 0, color: '#F97316' },
    drivers:   { count: 1, color: '#F59E0B' },
    finance:   { count: 0, color: '#F97316' },
};

// Online status dot override per teammate name (used in the team
// roster).  Falls back to u.isActive for users not listed.
const USER_ONLINE_STATUS: Record<string, 'online' | 'busy' | 'offline'> = {
    'System Admin': 'online',
    'Waqas':        'online',
    'Leo':          'busy',
    'Khalid':       'offline',
};

// Small builder to keep the sample-message blocks readable.
const mkSampleMsg = (
    id: string, roomId: string, senderName: string, senderRole: string,
    content: string, displayTime: string,
): Message => ({
    id, roomId,
    senderId: `sample-${senderName.replace(/\s+/g, '-')}`,
    senderName, senderRole, content,
    timestamp: new Date().toISOString(),
    reactions: {},
    displayTime,
});

const SAMPLE_MESSAGES_BY_ROOM: Record<string, Message[]> = {
    general: [
        mkSampleMsg('s-g-1', 'general', 'Waqas',        'owner',      "Good morning team! 821 invoices outstanding — let's push collections today.",         '9:02 AM'),
        mkSampleMsg('s-g-2', 'general', 'System Admin', 'owner',      'Marcus flagged Qahir — $3,875 overdue 32 days. Who is handling this?',                '9:05 AM'),
        mkSampleMsg('s-g-3', 'general', 'Waqas',        'owner',      "I'll call Qahir at 11am. He usually pays within a week of a call.",                   '9:07 AM'),
        mkSampleMsg('s-g-4', 'general', 'Leo',          'van_driver', 'Van 01 loaded and ready. 13 stops today. OW16 stock is low on van.',                  '9:15 AM'),
        mkSampleMsg('s-g-5', 'general', 'System Admin', 'owner',      'Auto PO raised for OW16 × 80 units — needs approval before 12pm.',                    '9:18 AM'),
        mkSampleMsg('s-g-6', 'general', 'Khalid',       'warehouse',  "Bettano confirmed delivery Thursday. I'll be at warehouse to receive.",               '9:31 AM'),
    ],
    sales: [
        mkSampleMsg('s-s-1', 'sales', 'Waqas',        'owner',     'WAQAS Trading asking for bulk OW16 pricing — 50 units. ARIA is handling it.',          '8:45 AM'),
        mkSampleMsg('s-s-2', 'sales', 'System Admin', 'owner',     'ARIA offered 5% discount — margin stays at 33%. Within policy.',                       '8:47 AM'),
        mkSampleMsg('s-s-3', 'sales', 'Waqas',        'owner',     'Ali A&R confirmed order for next week — $2,200. Largest order this month!',           '10:02 AM'),
        mkSampleMsg('s-s-4', 'sales', 'Khalid',       'warehouse', 'FastLuke UK cut OW16 price on Amazon by 8%. Our BSR dropped to #445.',                '10:15 AM'),
        mkSampleMsg('s-s-5', 'sales', 'System Admin', 'owner',     "Amazon AI already alerted Marcus. Recommendation: increase sponsored ads, don't cut price.", '10:17 AM'),
    ],
    warehouse: [
        mkSampleMsg('s-w-1', 'warehouse', 'Khalid',       'warehouse', 'Morning check done. Bin D1 quarantine confirmed — Mobil 5W30 batch EXPIRED.',         '7:30 AM'),
        mkSampleMsg('s-w-2', 'warehouse', 'System Admin', 'owner',     '⚠ 3 products below reorder point: OW16 (40), Zenol 0W20 (12), Mobil 5W30 (8)',         '7:32 AM'),
        mkSampleMsg('s-w-3', 'warehouse', 'Khalid',       'warehouse', 'Received Castrol GTX shipment — 72 units. Placed in B2 Rack 3. All good.',            '8:10 AM'),
        mkSampleMsg('s-w-4', 'warehouse', 'Khalid',       'warehouse', 'Pick list PL-002 complete. INV-960336 packed and ready for Van 01 collection.',       '11:20 AM'),
    ],
    drivers: [
        mkSampleMsg('s-d-1', 'drivers', 'Leo',   'van_driver', 'Departed depot. 13 stops today. Starting with Ali A&R on 97 Palace St.',         '8:14 AM'),
        mkSampleMsg('s-d-2', 'drivers', 'Leo',   'van_driver', '5 stops done. Collected $1,122 cash so far. Qahir stop is at 2pm.',              '11:02 AM'),
        mkSampleMsg('s-d-3', 'drivers', 'Waqas', 'owner',      'Good work Leo! Make sure you get a signed receipt from Janan Motors.',           '11:05 AM'),
        mkSampleMsg('s-d-4', 'drivers', 'Leo',   'van_driver', 'At Stop 6 — Mobil Centre. $328 to collect. Back on track after traffic.',        '1:15 PM'),
    ],
    finance: [
        mkSampleMsg('s-f-1', 'finance', 'System Admin', 'owner', 'Daily Finance Brief: Cash position $784,761. AR Outstanding $414,338. VAT collected MTD $628.', '8:00 AM'),
        mkSampleMsg('s-f-2', 'finance', 'System Admin', 'owner', '⚠ Sequential invoice gap detected: INV-960339 → INV-960336. Tax audit risk.',                   '8:02 AM'),
        mkSampleMsg('s-f-3', 'finance', 'Waqas',        'owner', 'VAT return Q1 is ready for review. Please check and approve before Friday.',                   '9:45 AM'),
        mkSampleMsg('s-f-4', 'finance', 'System Admin', 'owner', 'Compliance score at 30% — 5 items still open. Tax reg number missing on all invoices.',        '10:00 AM'),
    ],
};

// Sample task board — mapped onto the existing Task interface so it
// renders through the unmodified Tasks / Board UI.  "critical" in the
// spec maps to priority='urgent' (the only 4 priorities the interface
// accepts).  Status uppercase labels map to lowercase.
const SAMPLE_TASKS: Task[] = [
    { id: 'SMP-T001', title: 'Call Qahir re overdue payment $3,875',
      priority: 'urgent', status: 'pending',
      assigneeId: 'sample-Waqas',  assigneeName: 'Waqas',
      assignedById: 'system',      assignedByName: 'Marcus AI',
      dueDate: 'Today',            roomId: 'finance',
      description: '32 days overdue. Marcus flagged. Call before 2pm to avoid credit hold Friday.',
      createdAt: new Date().toISOString() },
    { id: 'SMP-T002', title: 'Approve OW16 Auto PO — 80 units $3,040',
      priority: 'high', status: 'pending',
      assigneeId: 'sample-System-Admin', assigneeName: 'System Admin',
      assignedById: 'system',            assignedByName: 'Auto PO Bot',
      dueDate: 'Today 12pm',             roomId: 'general',
      description: 'Supplier price +18%. Marcus recommends approve 40 units only and negotiate.',
      createdAt: new Date().toISOString() },
    { id: 'SMP-T003', title: 'Receive Bettano UAE shipment — Thursday',
      priority: 'medium', status: 'pending',
      assigneeId: 'sample-Khalid', assigneeName: 'Khalid',
      assignedById: 'sample-Waqas', assignedByName: 'Waqas',
      dueDate: 'Thu 23 May',       roomId: 'warehouse',
      description: 'OW16 × 80 units incoming. Ensure Bin A1 is cleared.',
      createdAt: new Date().toISOString() },
    { id: 'SMP-T004', title: 'VAT return Q1 — review and approve',
      priority: 'high', status: 'in_progress',
      assigneeId: 'sample-System-Admin', assigneeName: 'System Admin',
      assignedById: 'sample-Waqas',      assignedByName: 'Waqas',
      dueDate: 'Fri 24 May',             roomId: 'finance',
      description: 'Ready for review. Sequential gap INV-960339→960336 must be addressed first.',
      createdAt: new Date().toISOString() },
    { id: 'SMP-T005', title: 'Pause Zenol 0W20 Amazon ads — ACOS 38.6%',
      priority: 'high', status: 'in_progress',
      assigneeId: 'sample-Waqas',  assigneeName: 'Waqas',
      assignedById: 'system',      assignedByName: 'Amazon AI',
      dueDate: 'Today',            roomId: 'sales',
      description: 'Amazon AI flagged — burning $140/mo at 38.6% ACOS. Pause and review targeting.',
      createdAt: new Date().toISOString() },
    { id: 'SMP-T006', title: '5W30 clearance promo — 15% off before new formula',
      priority: 'medium', status: 'in_progress',
      assigneeId: 'sample-Waqas',         assigneeName: 'Waqas',
      assignedById: 'sample-System-Admin', assignedByName: 'System Admin',
      dueDate: 'This week',               roomId: 'sales',
      description: 'Bettano launching new 5W30 formula. Run promo to clear 203 existing units.',
      createdAt: new Date().toISOString() },
    { id: 'SMP-T007', title: 'Fix missing tax reg number on all invoices',
      priority: 'urgent', status: 'review',
      assigneeId: 'sample-System-Admin', assigneeName: 'System Admin',
      assignedById: 'system',            assignedByName: 'Compliance Bot',
      dueDate: 'Urgent',                 roomId: 'finance',
      description: 'Tax registration number missing on every invoice — legal requirement. Add in Settings → Company Profile.',
      createdAt: new Date().toISOString() },
    { id: 'SMP-T008', title: 'Amazon sponsored ads budget +$200/mo approved',
      priority: 'low', status: 'done',
      assigneeId: 'sample-Waqas',         assigneeName: 'Waqas',
      assignedById: 'sample-System-Admin', assignedByName: 'System Admin',
      dueDate: 'Done',                    roomId: 'sales',
      description: 'Approved in strategy meeting. Activate from Amazon Seller Central dashboard.',
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString() },
];

function getRooms(): Room[] {
    try {
        const raw = localStorage.getItem(ROOMS_KEY);
        if (!raw) { localStorage.setItem(ROOMS_KEY, JSON.stringify(DEFAULT_ROOMS)); return DEFAULT_ROOMS; }
        return JSON.parse(raw);
    } catch { return DEFAULT_ROOMS; }
}
function saveRooms(r: Room[]) { localStorage.setItem(ROOMS_KEY, JSON.stringify(r)); }

function getMsgs(roomId: string): Message[] {
    try {
        const all = JSON.parse(localStorage.getItem(MSGS_KEY) || '{}');
        return all[roomId] || [];
    } catch { return []; }
}
function saveMsg(msg: Message) {
    try {
        const all = JSON.parse(localStorage.getItem(MSGS_KEY) || '{}');
        if (!all[msg.roomId]) all[msg.roomId] = [];
        all[msg.roomId].push(msg);
        localStorage.setItem(MSGS_KEY, JSON.stringify(all));
    } catch {}
}

function getTasks(): Task[] {
    try { return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]'); } catch { return []; }
}
function saveTask(task: Task) {
    const tasks = getTasks();
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) tasks[idx] = task; else tasks.unshift(task);
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

const PRIORITY_STYLE: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 border-red-300',
    high:   'bg-orange-100 text-orange-700 border-orange-300',
    medium: 'bg-amber-100 text-amber-700 border-amber-300',
    low:    'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_ICON: Record<string, any> = {
    pending: Clock, in_progress: Zap, review: AlertCircle, done: Check,
};

const REACTIONS = ['👍','✅','🔥','👀','💯','❤️'];

const ROLE_COLORS: Record<string, string> = {
    owner: 'text-purple-400', manager: 'text-blue-400',
    sales_manager: 'text-emerald-400', salesman: 'text-green-400',
    accountant: 'text-amber-400', van_driver: 'text-orange-400',
    marketing: 'text-pink-400', warehouse: 'text-cyan-400',
};

// ── Main Component ─────────────────────────────────────────────
export default function Pulse() {
    const me = getCurrentUser();
    const [users, setUsers] = useState<User[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [activeRoom, setActiveRoom] = useState<string>('general');
    const [messages, setMessages] = useState<Message[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [input, setInput] = useState('');
    const [view, setView] = useState<'chat'|'tasks'|'board'>('chat');
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [showNewRoom, setShowNewRoom] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [taskForm, setTaskForm] = useState({ title:'', description:'', assigneeId:'', priority:'medium' as Task['priority'], dueDate:'', roomId:activeRoom });
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomEmoji, setNewRoomEmoji] = useState('💬');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setUsers(getUsers());
        const r = getRooms();
        setRooms(r);
        setTasks(getTasks());
    }, []);

    useEffect(() => {
        setMessages(getMsgs(activeRoom));
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeRoom]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const activeRoomData = rooms.find(r => r.id === activeRoom);

    const sendMessage = (content?: string, isAnnouncement = false) => {
        const text = content || input.trim();
        if (!text) return;
        const msg: Message = {
            id: Date.now().toString(),
            roomId: activeRoom,
            senderId: me.id,
            senderName: me.name,
            senderRole: me.role,
            content: text,
            timestamp: new Date().toISOString(),
            reactions: {},
            isAnnouncement,
        };
        saveMsg(msg);
        setMessages(getMsgs(activeRoom));
        setInput('');
    };

    const sendAIMessage = async () => {
        if (!input.trim()) return;
        const userMsg = input.trim();
        sendMessage(userMsg);
        setAiLoading(true);
        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are a helpful team assistant in the ${activeRoomData?.name} channel of SOLTOL ONE business platform. Keep responses concise and professional. Max 2-3 sentences.`,
                    max_tokens: 200,
                    messages: [{ role: 'user', content: userMsg }]
                })
            });
            if (!res.ok) {
                let detail = '';
                try { detail = (await res.json())?.detail || ''; } catch { /* not JSON */ }
                throw new Error(detail || `HTTP ${res.status}`);
            }
            const d = await res.json();
            const aiMsg: Message = {
                id: (Date.now()+1).toString(), roomId: activeRoom,
                senderId: 'ai', senderName: 'PULSE AI', senderRole: 'ai',
                content: d.reply || 'I couldn\'t process that.',
                timestamp: new Date().toISOString(), reactions: {},
            };
            saveMsg(aiMsg);
            setMessages(getMsgs(activeRoom));
        } catch {}
        finally { setAiLoading(false); }
    };

    const addReaction = (msgId: string, emoji: string) => {
        const all = JSON.parse(localStorage.getItem(MSGS_KEY) || '{}');
        const roomMsgs: Message[] = all[activeRoom] || [];
        const idx = roomMsgs.findIndex(m => m.id === msgId);
        if (idx < 0) return;
        if (!roomMsgs[idx].reactions[emoji]) roomMsgs[idx].reactions[emoji] = [];
        const arr = roomMsgs[idx].reactions[emoji];
        const myIdx = arr.indexOf(me.id);
        if (myIdx >= 0) arr.splice(myIdx, 1); else arr.push(me.id);
        if (arr.length === 0) delete roomMsgs[idx].reactions[emoji];
        all[activeRoom] = roomMsgs;
        localStorage.setItem(MSGS_KEY, JSON.stringify(all));
        setMessages(getMsgs(activeRoom));
        setShowReactionPicker(null);
    };

    const createTask = () => {
        if (!taskForm.title.trim() || !taskForm.assigneeId) return;
        const assignee = users.find(u => u.id === taskForm.assigneeId);
        const task: Task = {
            id: `TASK-${Date.now()}`,
            title: taskForm.title, description: taskForm.description,
            assigneeId: taskForm.assigneeId, assigneeName: assignee?.name || '',
            assignedById: me.id, assignedByName: me.name,
            priority: taskForm.priority, status: 'pending',
            dueDate: taskForm.dueDate, roomId: activeRoom,
            createdAt: new Date().toISOString(),
        };
        saveTask(task);
        setTasks(getTasks());
        // Post a message about the task
        sendMessage(`📋 Task assigned to @${assignee?.name}: "${taskForm.title}" · Due: ${taskForm.dueDate || 'No deadline'} · Priority: ${taskForm.priority.toUpperCase()}`);
        setTaskForm({ title:'', description:'', assigneeId:'', priority:'medium', dueDate:'', roomId: activeRoom });
        setShowTaskForm(false);
    };

    const updateTaskStatus = (taskId: string, status: Task['status']) => {
        const task = getTasks().find(t => t.id === taskId);
        if (!task) return;
        const updated = { ...task, status, completedAt: status === 'done' ? new Date().toISOString() : undefined };
        saveTask(updated);
        setTasks(getTasks());
        if (status === 'done') sendMessage(`✅ Task completed: "${task.title}" by @${me.name}`);
    };

    const createRoom = () => {
        if (!newRoomName.trim()) return;
        const room: Room = {
            id: `room-${Date.now()}`, name: newRoomName, emoji: newRoomEmoji,
            description: '', type: 'room', members: [], createdBy: me.id, unread: 0,
        };
        const updated = [...rooms, room];
        saveRooms(updated); setRooms(updated);
        setActiveRoom(room.id); setShowNewRoom(false); setNewRoomName('');
    };

    // TC-16 — Rename / delete is now allowed on ALL rooms (the tester
    // reported the action was missing on seeded ones). System rooms get
    // an extra confirmation so users understand they're modifying a
    // shared default; the seed list reappears for any user who clears
    // their localStorage.
    const renameRoom = (room: Room) => {
        const next = window.prompt(`Rename "${room.name}" to:`, room.name);
        if (!next || !next.trim() || next.trim() === room.name) return;
        const updated = rooms.map(r => r.id === room.id ? { ...r, name: next.trim() } : r);
        saveRooms(updated); setRooms(updated);
    };

    const deleteRoom = (room: Room) => {
        const systemWarn = room.createdBy === 'system'
            ? `\n\nNote: "${room.name}" is a default room. Deleting only affects YOUR view — other users still see it.`
            : '';
        if (!window.confirm(`Delete "${room.name}"?  This cannot be undone.${systemWarn}`)) return;
        const updated = rooms.filter(r => r.id !== room.id);
        saveRooms(updated); setRooms(updated);
        // If the deleted room was active, fall back to General (or first remaining).
        if (activeRoom === room.id) setActiveRoom(updated[0]?.id || 'general');
    };

    // When the room has no stored messages, render the hardcoded
    // sample log so the chat doesn't look dead.  As soon as the user
    // posts a real message, `messages.length > 0` and the sample
    // fallback drops away.
    const baseMsgs = messages.length === 0
        ? (SAMPLE_MESSAGES_BY_ROOM[activeRoom] || [])
        : messages;
    const filteredMsgs = search ? baseMsgs.filter(m => m.content.toLowerCase().includes(search.toLowerCase())) : baseMsgs;
    // Same fallback for the Tasks / Board views.
    const displayTasks = tasks.length === 0 ? SAMPLE_TASKS : tasks;
    const myTasks = tasks.filter(t => t.assigneeId === me.id && t.status !== 'done');

    const timeAgo = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
        return new Date(iso).toLocaleDateString();
    };

    return (
        <div className="flex h-[calc(100vh-112px)] bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm animate-in fade-in duration-300">

            {/* ── LEFT SIDEBAR ── */}
            <div className="w-56 bg-gray-900 flex flex-col flex-shrink-0">
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black text-white uppercase tracking-widest">PULSE</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">Team Communication</p>
                        </div>
                        {myTasks.length > 0 && (
                            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-[9px] font-black text-white">{myTasks.length}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Nav tabs */}
                <div className="flex border-b border-white/10">
                    {(['chat','tasks','board'] as const).map(v => (
                        <button key={v} onClick={() => setView(v)}
                            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${view === v ? 'text-white border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-300'}`}>
                            {v === 'chat' ? '💬' : v === 'tasks' ? '✅' : '📋'} {v}
                        </button>
                    ))}
                </div>

                {/* Rooms list */}
                <div className="flex-1 overflow-y-auto py-2 px-2">
                    <div className="flex items-center justify-between px-2 mb-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Rooms</p>
                        <button onClick={() => setShowNewRoom(true)} className="w-4 h-4 text-gray-500 hover:text-white transition-all"><Plus size={12} /></button>
                    </div>
                    {rooms.filter(r => r.type === 'room').map(room => {
                        // Sample-data unread override — sales=3 (red), drivers=1
                        // (amber). Falls back to room.unread for non-seed rooms.
                        const ov = ROOM_UNREAD_OVERRIDE[room.id];
                        const unreadCount = ov ? ov.count : room.unread;
                        const unreadColor = ov ? ov.color : '#F97316';
                        return (
                        <div key={room.id} className="group/room relative flex items-center">
                            <button onClick={() => { setActiveRoom(room.id); setView('chat'); }}
                                className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all mb-0.5 ${activeRoom === room.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
                                <span className="text-sm flex-shrink-0">{room.emoji}</span>
                                <span className="text-xs font-bold truncate">{room.name}</span>
                                {unreadCount > 0 && (
                                    <span
                                        className="ml-auto w-4 h-4 rounded-full text-[9px] font-black text-white flex items-center justify-center flex-shrink-0"
                                        style={{ background: unreadColor }}
                                    >
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                            {/* TC-16 — Edit / delete shown for ALL rooms (was previously
                                gated on createdBy !== 'system'). Hover-fade keeps the
                                sidebar uncluttered. Seeded rooms get a stronger confirm
                                inside deleteRoom(). */}
                            <div className="opacity-0 group-hover/room:opacity-100 transition-opacity flex items-center gap-0.5 ml-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); renameRoom(room); }}
                                    aria-label={`Rename ${room.name}`}
                                    title="Rename room"
                                    className="p-1 text-gray-500 hover:text-white"
                                >
                                    <Edit2 size={10} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteRoom(room); }}
                                    aria-label={`Delete ${room.name}`}
                                    title="Delete room"
                                    className="p-1 text-gray-500 hover:text-rose-400"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        </div>
                        );
                    })}

                    <div className="flex items-center justify-between px-2 mb-1 mt-3">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Team ({users.length})</p>
                    </div>
                    {users.map(u => {
                        // Sample-data online override per teammate name —
                        // SA/Waqas green, Leo amber (on route), Khalid grey
                        // (offline).  Names not in the map fall back to the
                        // real u.isActive flag.
                        const status = USER_ONLINE_STATUS[u.name] ?? (u.isActive ? 'online' : 'offline');
                        const dotColor = status === 'online' ? '#10B981' : status === 'busy' ? '#F59E0B' : '#6B7280';
                        return (
                        <button key={u.id} onClick={() => {
                            const dmId = `dm-${[me.id, u.id].sort().join('-')}`;
                            if (!rooms.find(r => r.id === dmId)) {
                                const dm: Room = { id: dmId, name: u.name, emoji: '💬', description: '', type: 'direct', members: [me.id, u.id], createdBy: me.id, unread: 0 };
                                const updated = [...rooms, dm]; saveRooms(updated); setRooms(updated);
                            }
                            setActiveRoom(dmId); setView('chat');
                        }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all mb-0.5 ${activeRoom === `dm-${[me.id, u.id].sort().join('-')}` ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                            <span className="text-xs font-bold truncate">{u.name}</span>
                        </button>
                        );
                    })}
                </div>

                {/* Me */}
                <div className="px-3 py-2 border-t border-white/10 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
                        {me.name[0]}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-black text-white truncate">{me.name}</p>
                        <p className={`text-[9px] font-bold capitalize ${ROLE_COLORS[me.role] || 'text-gray-400'}`}>{me.role.replace('_',' ')}</p>
                    </div>
                </div>
            </div>

            {/* ── MAIN AREA ── */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Room header */}
                <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">{activeRoomData?.emoji || '💬'}</span>
                        <div>
                            <p className="text-sm font-black text-gray-900">{activeRoomData?.name || 'General'}</p>
                            <p className="text-[10px] text-gray-400">{activeRoomData?.type === 'direct' ? 'Direct Message' : activeRoomData?.description || ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                            <Search size={12} className="text-gray-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages..."
                                className="text-xs bg-transparent focus:outline-none text-gray-600 w-28" />
                        </div>
                        {me.role === 'owner' || me.role === 'manager' ? (
                            <button onClick={() => sendMessage(input || '📢 Announcement from management', true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-[10px] font-black rounded-xl hover:bg-orange-600 transition-all">
                                📢 Announce
                            </button>
                        ) : null}
                        <button onClick={() => setShowTaskForm(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-black rounded-xl hover:bg-gray-700 transition-all">
                            <Plus size={12} /> Task
                        </button>
                    </div>
                </div>

                {/* CHAT VIEW */}
                {view === 'chat' && (
                    <>
                        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                            {filteredMsgs.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <p className="text-3xl mb-2">{activeRoomData?.emoji || '💬'}</p>
                                    <p className="text-sm font-bold">Start the conversation in {activeRoomData?.name}</p>
                                    <p className="text-xs mt-1">Messages appear here</p>
                                </div>
                            )}
                            {filteredMsgs.map((msg, i) => {
                                const isMe = msg.senderId === me.id;
                                const isAI = msg.senderId === 'ai';
                                const showHeader = i === 0 || filteredMsgs[i-1].senderId !== msg.senderId;
                                // Sample-message tint: when the sender name has a
                                // pre-assigned brand colour, use it as the avatar
                                // background.  Real users without a match keep the
                                // existing gray avatar.
                                const tint = !isAI && !isMe ? USER_COLORS[msg.senderName] : undefined;
                                return (
                                    <div key={msg.id} className={`group flex gap-3 ${isMe ? 'flex-row-reverse' : ''} ${msg.isAnnouncement ? 'bg-orange-50 rounded-2xl px-4 py-3 border border-orange-100' : ''}`}>
                                        {showHeader && (
                                            <div
                                                className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 mt-1 ${isAI ? 'bg-orange-500 text-white' : isMe ? 'bg-gray-900 text-white' : tint ? 'text-white' : 'bg-gray-200 text-gray-700'}`}
                                                style={tint ? { background: tint } : undefined}
                                            >
                                                {isAI ? 'AI' : msg.senderName[0]}
                                            </div>
                                        )}
                                        {!showHeader && <div className="w-8 flex-shrink-0" />}
                                        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                                            {showHeader && (
                                                <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                    <span className="text-[11px] font-black text-gray-700">{msg.senderName}</span>
                                                    <span className={`text-[9px] font-bold ${ROLE_COLORS[msg.senderRole] || 'text-gray-400'}`}>{msg.senderRole?.replace('_',' ')}</span>
                                                    <span className="text-[9px] text-gray-300">{msg.displayTime || timeAgo(msg.timestamp)}</span>
                                                </div>
                                            )}
                                            <div className={`relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                                isAI ? 'bg-orange-50 border border-orange-100 text-orange-900' :
                                                isMe ? 'bg-gray-900 text-white' :
                                                msg.isAnnouncement ? 'bg-orange-500 text-white' :
                                                'bg-white border border-gray-100 text-gray-800 shadow-sm'
                                            }`}>
                                                {msg.content}
                                                {/* Reaction button */}
                                                <button onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                                                    className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 w-6 h-6 bg-white border border-gray-200 rounded-full text-xs flex items-center justify-center shadow-sm hover:shadow transition-all">
                                                    😊
                                                </button>
                                                {showReactionPicker === msg.id && (
                                                    <div className="absolute bottom-6 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 flex gap-1 z-50">
                                                        {REACTIONS.map(r => (
                                                            <button key={r} onClick={() => addReaction(msg.id, r)}
                                                                className="text-lg hover:scale-125 transition-transform px-1">{r}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Reactions display */}
                                            {Object.keys(msg.reactions).length > 0 && (
                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                    {Object.entries(msg.reactions).map(([emoji, users2]) => (
                                                        <button key={emoji} onClick={() => addReaction(msg.id, emoji)}
                                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-all ${users2.includes(me.id) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                            {emoji} {users2.length}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {aiLoading && (
                                <div className="flex gap-3 items-center">
                                    <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-xs font-black text-white">AI</div>
                                    <div className="flex gap-1 bg-orange-50 px-4 py-3 rounded-2xl">
                                        {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Input */}
                        <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5">
                                <input value={input} onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                    placeholder={`Message ${activeRoomData?.name || 'team'}...`}
                                    className="flex-1 bg-transparent text-sm focus:outline-none text-gray-800 placeholder-gray-400" />
                                <button onClick={sendAIMessage} disabled={!input.trim() || aiLoading}
                                    className="text-[10px] font-black text-orange-500 hover:text-orange-700 disabled:opacity-40 flex items-center gap-1 transition-all flex-shrink-0">
                                    <Zap size={12} /> AI
                                </button>
                                <button onClick={() => sendMessage()} disabled={!input.trim()}
                                    className="w-8 h-8 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0">
                                    <Send size={14} />
                                </button>
                            </div>
                            <p className="text-[9px] text-gray-300 mt-1 ml-2">Enter to send · ⚡ AI to get AI reply</p>
                        </div>
                    </>
                )}

                {/* TASKS VIEW */}
                {view === 'tasks' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Mission Board — All Tasks</p>
                            <button onClick={() => setShowTaskForm(true)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-xs font-black rounded-xl hover:bg-gray-700 transition-all">
                                <Plus size={14} /> Assign Task
                            </button>
                        </div>
                        {(['pending','in_progress','review','done'] as const).map(status => {
                            const statusTasks = displayTasks.filter(t => t.status === status);
                            if (statusTasks.length === 0 && status === 'done') return null;
                            const StatusIcon = STATUS_ICON[status];
                            return (
                                <div key={status} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                                        <StatusIcon size={14} className="text-gray-500" />
                                        <span className="text-xs font-black text-gray-700 uppercase tracking-widest">{status.replace('_',' ')}</span>
                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{statusTasks.length}</span>
                                    </div>
                                    {statusTasks.length === 0 ? (
                                        <p className="text-xs text-gray-300 px-4 py-3">No tasks</p>
                                    ) : statusTasks.map(task => (
                                        <div key={task.id} className="px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-all">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[task.priority]}`}>{task.priority}</span>
                                                        <span className="text-xs font-black text-gray-900">{task.title}</span>
                                                    </div>
                                                    {task.description && <p className="text-xs text-gray-500 mb-1">{task.description}</p>}
                                                    <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
                                                        <span>👤 {task.assigneeName}</span>
                                                        <span>📌 by {task.assignedByName}</span>
                                                        {task.dueDate && <span>📅 {task.dueDate}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1 flex-shrink-0">
                                                    {status !== 'done' && (
                                                        <select value={task.status}
                                                            onChange={e => updateTaskStatus(task.id, e.target.value as Task['status'])}
                                                            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none bg-white">
                                                            <option value="pending">Pending</option>
                                                            <option value="in_progress">In Progress</option>
                                                            <option value="review">Review</option>
                                                            <option value="done">Done ✅</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* BOARD VIEW - Kanban style */}
                {view === 'board' && (
                    <div className="flex-1 overflow-x-auto p-4">
                        <div className="flex gap-3 h-full min-w-max">
                            {(['pending','in_progress','review','done'] as const).map(status => {
                                const statusTasks = displayTasks.filter(t => t.status === status);
                                const StatusIcon = STATUS_ICON[status];
                                return (
                                    <div key={status} className="w-64 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
                                        <div className={`px-4 py-3 flex items-center gap-2 ${status==='done'?'bg-emerald-50':status==='in_progress'?'bg-blue-50':status==='review'?'bg-purple-50':'bg-gray-50'}`}>
                                            <StatusIcon size={14} className="text-gray-600" />
                                            <span className="text-xs font-black text-gray-700 uppercase tracking-wider">{status.replace('_',' ')}</span>
                                            <span className="ml-auto text-[10px] font-black text-gray-400">{statusTasks.length}</span>
                                        </div>
                                        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                            {statusTasks.map(task => (
                                                <div key={task.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 hover:shadow-sm transition-all">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLE[task.priority]}`}>{task.priority}</span>
                                                        {status !== 'done' && (
                                                            <button onClick={() => updateTaskStatus(task.id, 'done')}
                                                                className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center justify-center">
                                                                <Check size={10} className="text-gray-400" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-black text-gray-900 mb-1 leading-tight">{task.title}</p>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="w-5 h-5 rounded-lg bg-gray-300 flex items-center justify-center text-[9px] font-black text-gray-700">
                                                            {task.assigneeName[0]}
                                                        </div>
                                                        {task.dueDate && <span className="text-[9px] text-gray-400">{task.dueDate}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                            <button onClick={() => { setShowTaskForm(true); setTaskForm(p => ({...p, status: status as any})); }}
                                                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all flex items-center justify-center gap-1">
                                                <Plus size={12} /> Add task
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── TASK FORM MODAL ── */}
            {showTaskForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">📋 Assign New Task</h2>
                            <button onClick={() => setShowTaskForm(false)} className="w-7 h-7 bg-gray-100 hover:bg-red-50 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"><X size={14} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Task Title *</label>
                                <input value={taskForm.title} onChange={e => setTaskForm(p => ({...p, title: e.target.value}))}
                                    placeholder="e.g. Prepare monthly invoice report"
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Description</label>
                                <textarea value={taskForm.description} onChange={e => setTaskForm(p => ({...p, description: e.target.value}))}
                                    placeholder="Details about this task..." rows={2}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Assign To *</label>
                                    <select value={taskForm.assigneeId} onChange={e => setTaskForm(p => ({...p, assigneeId: e.target.value}))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                                        <option value="">Select person</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Priority</label>
                                    <select value={taskForm.priority} onChange={e => setTaskForm(p => ({...p, priority: e.target.value as Task['priority']}))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                                        <option value="low">🟢 Low</option>
                                        <option value="medium">🟡 Medium</option>
                                        <option value="high">🟠 High</option>
                                        <option value="urgent">🔴 Urgent</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Due Date</label>
                                <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({...p, dueDate: e.target.value}))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={createTask} disabled={!taskForm.title.trim() || !taskForm.assigneeId}
                                className="flex-1 py-2.5 bg-gray-900 text-white text-sm font-black rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all">
                                Assign Task
                            </button>
                            <button onClick={() => setShowTaskForm(false)} className="px-4 text-sm font-black text-gray-400 hover:text-gray-700">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── NEW ROOM MODAL ── */}
            {showNewRoom && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-black text-gray-900">Create New Room</h2>
                            <button onClick={() => setShowNewRoom(false)} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"><X size={14} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input value={newRoomEmoji} onChange={e => setNewRoomEmoji(e.target.value)}
                                    placeholder="😀" className="w-14 border border-gray-200 rounded-xl px-3 py-2.5 text-center text-lg focus:outline-none" />
                                <input value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                                    placeholder="Room name e.g. Marketing"
                                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
                            </div>
                            <button onClick={createRoom} disabled={!newRoomName.trim()}
                                className="w-full py-2.5 bg-gray-900 text-white text-sm font-black rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all">
                                Create Room
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
