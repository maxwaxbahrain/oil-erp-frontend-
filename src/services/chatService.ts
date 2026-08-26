import { authFetch } from '../api/axios';
import { getOilErpApiBase } from '../config/apiBase';

const CHAT_API = `${getOilErpApiBase()}/chat`;

export interface ChatChannel {
    id: number;
    name: string;
    type: 'channel' | 'dm';
    is_default: boolean;
    unread_count: number;
    has_unread_mention: boolean;
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
    member_user_ids: number[];
}

export interface ChannelMember {
    id: number;
    username: string;
    full_name: string | null;
    is_active: boolean;
    joined_at: string;
}

export interface ChannelMembersMutationResponse {
    member_user_ids: number[];
}

export interface LeaveChannelResponse {
    ok: boolean;
}

export interface SendMessageResponse {
    id: number;
    channel_id: number;
    sender_user_id: number;
    sender_username: string;
    body: string;
    created_at: string;
    mentioned_user_ids: number[];
}

export interface MentionableUser {
    id: number;
    username: string;
    full_name: string | null;
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
        has_unread_mention: Boolean(raw.has_unread_mention),
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

function parseMemberUserIds(raw: unknown): number[] {
    return Array.isArray(raw) ? raw.map((id) => Number(id)) : [];
}

function fromApiChannelMember(raw: Record<string, unknown>): ChannelMember {
    return {
        id: Number(raw.id),
        username: String(raw.username ?? ''),
        full_name: raw.full_name != null ? String(raw.full_name) : null,
        is_active: Boolean(raw.is_active),
        joined_at: String(raw.joined_at ?? ''),
    };
}

async function readErrorDetail(r: Response): Promise<string | null> {
    try {
        const body = (await r.json()) as Record<string, unknown>;
        if (typeof body.detail === 'string' && body.detail.trim()) {
            return body.detail.trim();
        }
        if (Array.isArray(body.detail)) {
            const first = body.detail[0] as Record<string, unknown> | undefined;
            if (first && typeof first.msg === 'string' && first.msg.trim()) {
                return first.msg.trim();
            }
        }
    } catch {
        /* ignore unreadable error bodies */
    }
    return null;
}

function chatRequestError(status: number, message: string): Error {
    const err = new Error(message);
    (err as Error & { status: number }).status = status;
    return err;
}

export function getChatErrorStatus(err: unknown): number | null {
    if (typeof err === 'object' && err !== null && 'status' in err) {
        const status = Number((err as { status: unknown }).status);
        return Number.isFinite(status) ? status : null;
    }
    return null;
}

export function mapChannelWriteError(err: unknown, fallback: string): string {
    const status = getChatErrorStatus(err);
    const raw = err instanceof Error && err.message.trim() ? err.message.trim() : fallback;
    if (status === 409) return 'A channel with that name already exists';
    if (status === 403) return "You don't have permission";
    if (status === 400 || status === 404) return raw;
    return raw;
}

export async function getChannels(): Promise<ChatChannel[]> {
    const r = await authFetch(`${CHAT_API}/channels`);
    if (!r.ok) throw new Error(`Failed to load chat channels (${r.status})`);
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) =>
        fromApiChannel(row as Record<string, unknown>),
    );
}

export async function createChannel(
    name: string,
    memberUserIds: number[],
): Promise<CreateChannelResponse> {
    const r = await authFetch(`${CHAT_API}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, member_user_ids: memberUserIds }),
    });
    if (!r.ok) {
        throw chatRequestError(
            r.status,
            (await readErrorDetail(r)) || 'Failed to create channel',
        );
    }
    const raw = (await r.json()) as Record<string, unknown>;
    return {
        id: Number(raw.id),
        name: String(raw.name ?? ''),
        type: String(raw.type ?? 'channel'),
        is_default: Boolean(raw.is_default),
        member_user_ids: parseMemberUserIds(raw.member_user_ids),
    };
}

export async function getChannelMembers(channelId: number): Promise<ChannelMember[]> {
    const r = await authFetch(
        `${CHAT_API}/channels/${encodeURIComponent(String(channelId))}/members`,
    );
    if (!r.ok) {
        throw chatRequestError(
            r.status,
            (await readErrorDetail(r)) || 'Failed to load channel members',
        );
    }
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) =>
        fromApiChannelMember(row as Record<string, unknown>),
    );
}

export async function addChannelMembers(
    channelId: number,
    userIds: number[],
): Promise<ChannelMembersMutationResponse> {
    const r = await authFetch(
        `${CHAT_API}/channels/${encodeURIComponent(String(channelId))}/members`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_ids: userIds }),
        },
    );
    if (!r.ok) {
        throw chatRequestError(
            r.status,
            (await readErrorDetail(r)) || 'Failed to add channel members',
        );
    }
    const raw = (await r.json()) as Record<string, unknown>;
    return { member_user_ids: parseMemberUserIds(raw.member_user_ids) };
}

export async function removeChannelMember(
    channelId: number,
    userId: number,
): Promise<ChannelMembersMutationResponse> {
    const r = await authFetch(
        `${CHAT_API}/channels/${encodeURIComponent(String(channelId))}/members/${encodeURIComponent(String(userId))}`,
        { method: 'DELETE' },
    );
    if (!r.ok) {
        throw chatRequestError(
            r.status,
            (await readErrorDetail(r)) || 'Failed to remove channel member',
        );
    }
    const raw = (await r.json()) as Record<string, unknown>;
    return { member_user_ids: parseMemberUserIds(raw.member_user_ids) };
}

export async function leaveChannel(channelId: number): Promise<LeaveChannelResponse> {
    const r = await authFetch(
        `${CHAT_API}/channels/${encodeURIComponent(String(channelId))}/leave`,
        { method: 'POST' },
    );
    if (!r.ok) {
        throw chatRequestError(
            r.status,
            (await readErrorDetail(r)) || 'Failed to leave channel',
        );
    }
    const raw = (await r.json()) as Record<string, unknown>;
    return { ok: Boolean(raw.ok) };
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

export async function getMentionableUsers(channelId?: number): Promise<MentionableUser[]> {
    const qs =
        channelId != null
            ? `?channel_id=${encodeURIComponent(String(channelId))}`
            : '';
    const r = await authFetch(`${CHAT_API}/mentionable-users${qs}`);
    if (!r.ok) throw new Error(`Failed to load mentionable users (${r.status})`);
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => {
        const raw = row as Record<string, unknown>;
        return {
            id: Number(raw.id),
            username: String(raw.username ?? ''),
            full_name: raw.full_name != null ? String(raw.full_name) : null,
        };
    });
}

export async function sendMessage(
    channelId: number,
    body: string,
    mentionedUserIds: number[] = [],
): Promise<SendMessageResponse> {
    const r = await authFetch(`${CHAT_API}/channels/${encodeURIComponent(String(channelId))}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            body,
            mentioned_user_ids: mentionedUserIds,
        }),
    });
    if (!r.ok) throw new Error(`Failed to send message (${r.status})`);
    const raw = (await r.json()) as Record<string, unknown>;
    return {
        id: Number(raw.id),
        channel_id: Number(raw.channel_id),
        sender_user_id: Number(raw.sender_user_id),
        sender_username: String(raw.sender_username ?? ''),
        body: String(raw.body ?? ''),
        created_at: String(raw.created_at ?? ''),
        mentioned_user_ids: Array.isArray(raw.mentioned_user_ids)
            ? raw.mentioned_user_ids.map((id) => Number(id))
            : [],
    };
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
