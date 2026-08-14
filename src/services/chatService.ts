import { authFetch } from '../api/axios';
import { getOilErpApiBase } from '../config/apiBase';

const CHAT_API = `${getOilErpApiBase()}/chat`;

export interface ChatChannel {
    id: number;
    name: string;
    type: 'channel' | 'dm';
    is_default: boolean;
    unread_count: number;
    other_user_id: number | null;
    other_username: string | null;
}

export interface ChatMessage {
    id: number;
    sender_user_id: number;
    sender_username: string;
    body: string;
    created_at: string;
    edited_at: string | null;
}

export interface MessageList {
    messages: ChatMessage[];
    latest_id: number | null;
}

export interface CreateChannelResponse {
    id: number;
    name: string;
    type: string;
    is_default: boolean;
}

export interface SendMessageResponse {
    id: number;
    channel_id: number;
    sender_user_id: number;
    sender_username: string;
    body: string;
    created_at: string;
}

export interface CreateDmResponse {
    id: number;
    type: string;
    other_user_id: number;
    other_username: string;
    unread_count: number;
}

export interface MarkReadResponse {
    ok: boolean;
    last_read_message_id: number | null;
}

function fromApiChannel(raw: Record<string, unknown>): ChatChannel {
    return {
        id: Number(raw.id),
        name: String(raw.name ?? ''),
        type: raw.type === 'dm' ? 'dm' : 'channel',
        is_default: Boolean(raw.is_default),
        unread_count: Number(raw.unread_count ?? 0),
        other_user_id: raw.other_user_id != null ? Number(raw.other_user_id) : null,
        other_username: raw.other_username != null ? String(raw.other_username) : null,
    };
}

function fromApiMessage(raw: Record<string, unknown>): ChatMessage {
    return {
        id: Number(raw.id),
        sender_user_id: Number(raw.sender_user_id),
        sender_username: String(raw.sender_username ?? ''),
        body: String(raw.body ?? ''),
        created_at: String(raw.created_at ?? ''),
        edited_at: raw.edited_at != null ? String(raw.edited_at) : null,
    };
}

export async function getChannels(): Promise<ChatChannel[]> {
    const r = await authFetch(`${CHAT_API}/channels`);
    if (!r.ok) throw new Error(`Failed to load chat channels (${r.status})`);
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) =>
        fromApiChannel(row as Record<string, unknown>),
    );
}

export async function createChannel(name: string): Promise<CreateChannelResponse> {
    const r = await authFetch(`${CHAT_API}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error(`Failed to create channel (${r.status})`);
    return (await r.json()) as CreateChannelResponse;
}

export async function getMessages(
    channelId: number,
    opts?: { after?: number; limit?: number },
): Promise<MessageList> {
    const params = new URLSearchParams();
    if (opts?.after != null) params.set('after', String(opts.after));
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const url = `${CHAT_API}/channels/${encodeURIComponent(String(channelId))}/messages${qs ? `?${qs}` : ''}`;
    const r = await authFetch(url);
    if (!r.ok) throw new Error(`Failed to load messages (${r.status})`);
    const raw = (await r.json()) as Record<string, unknown>;
    const messages = Array.isArray(raw.messages)
        ? raw.messages.map((row) => fromApiMessage(row as Record<string, unknown>))
        : [];
    return {
        messages,
        latest_id: raw.latest_id != null ? Number(raw.latest_id) : null,
    };
}

export async function sendMessage(channelId: number, body: string): Promise<SendMessageResponse> {
    const r = await authFetch(`${CHAT_API}/channels/${encodeURIComponent(String(channelId))}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    });
    if (!r.ok) throw new Error(`Failed to send message (${r.status})`);
    return (await r.json()) as SendMessageResponse;
}

export async function markRead(
    channelId: number,
    lastReadMessageId: number,
): Promise<MarkReadResponse> {
    const r = await authFetch(`${CHAT_API}/channels/${encodeURIComponent(String(channelId))}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_read_message_id: lastReadMessageId }),
    });
    if (!r.ok) throw new Error(`Failed to mark channel read (${r.status})`);
    return (await r.json()) as MarkReadResponse;
}

export async function createOrGetDm(userId: number): Promise<CreateDmResponse> {
    const r = await authFetch(`${CHAT_API}/dms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
    });
    if (!r.ok) throw new Error(`Failed to open direct message (${r.status})`);
    return (await r.json()) as CreateDmResponse;
}

export type ChatTaskStatus = 'open' | 'in_progress' | 'done';

export interface ChatTask {
    id: number;
    title: string;
    description: string | null;
    assigned_to_user_id: number;
    assigned_to_username: string;
    created_by_user_id: number;
    created_by_username: string;
    channel_id: number | null;
    status: ChatTaskStatus;
    due_date: string | null;
    created_at: string;
    updated_at: string | null;
    completed_at: string | null;
}

function fromApiTask(raw: Record<string, unknown>): ChatTask {
    const status = String(raw.status ?? 'open');
    const normalizedStatus: ChatTaskStatus =
        status === 'in_progress' || status === 'done' ? status : 'open';
    return {
        id: Number(raw.id),
        title: String(raw.title ?? ''),
        description: raw.description != null ? String(raw.description) : null,
        assigned_to_user_id: Number(raw.assigned_to_user_id),
        assigned_to_username: String(raw.assigned_to_username ?? ''),
        created_by_user_id: Number(raw.created_by_user_id),
        created_by_username: String(raw.created_by_username ?? ''),
        channel_id: raw.channel_id != null ? Number(raw.channel_id) : null,
        status: normalizedStatus,
        due_date: raw.due_date != null ? String(raw.due_date) : null,
        created_at: String(raw.created_at ?? ''),
        updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
        completed_at: raw.completed_at != null ? String(raw.completed_at) : null,
    };
}

export async function getTasks(opts?: {
    status?: ChatTaskStatus;
    assigned_to_user_id?: number;
}): Promise<ChatTask[]> {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.assigned_to_user_id != null) {
        params.set('assigned_to_user_id', String(opts.assigned_to_user_id));
    }
    const qs = params.toString();
    const url = `${CHAT_API}/tasks${qs ? `?${qs}` : ''}`;
    const r = await authFetch(url);
    if (!r.ok) throw new Error(`Failed to load tasks (${r.status})`);
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) =>
        fromApiTask(row as Record<string, unknown>),
    );
}

export async function createTask(body: {
    title: string;
    description?: string;
    assigned_to_user_id: number;
    channel_id?: number;
    due_date?: string;
}): Promise<ChatTask> {
    const r = await authFetch(`${CHAT_API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Failed to create task (${r.status})`);
    return fromApiTask((await r.json()) as Record<string, unknown>);
}

export async function updateTaskStatus(
    taskId: number,
    status: ChatTaskStatus,
): Promise<ChatTask> {
    const r = await authFetch(`${CHAT_API}/tasks/${encodeURIComponent(String(taskId))}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    if (!r.ok) throw new Error(`Failed to update task status (${r.status})`);
    return fromApiTask((await r.json()) as Record<string, unknown>);
}
