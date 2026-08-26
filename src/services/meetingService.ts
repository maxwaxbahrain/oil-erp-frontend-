import { authFetch } from '../api/axios';
import { getOilErpApiBase } from '../config/apiBase';

const MEETINGS_API = `${getOilErpApiBase()}/meetings`;
const MEETING_PROCESS_API = `${getOilErpApiBase()}/ai/meeting/process`;

export interface MeetingDecision {
    decision: string;
    context: string;
}

export interface MeetingActionItem {
    task: string;
    owner: string;
    deadline: string;
}

/** Full record from POST/GET/PATCH /api/meetings/{id}. Includes transcript. */
export interface Meeting {
    id: number;
    title: string;
    meeting_date: string;
    duration_seconds: number;
    transcript: string;
    summary: string;
    decisions: MeetingDecision[];
    action_items: MeetingActionItem[];
    key_topics: string[];
    members: string[];
    shared_message_id: number | null;
    created_at: string;
    updated_at: string | null;
}

/**
 * List row from GET /api/meetings.
 * Has transcript_preview + has_transcript — not the full transcript.
 */
export interface MeetingListItem {
    id: number;
    title: string;
    meeting_date: string;
    duration_seconds: number;
    summary: string;
    decisions: MeetingDecision[];
    action_items: MeetingActionItem[];
    key_topics: string[];
    members: string[];
    shared_message_id: number | null;
    created_at: string;
    updated_at: string | null;
    transcript_preview: string;
    has_transcript: boolean;
}

export interface CreateMeetingBody {
    title: string;
    meeting_date: string;
    duration_seconds: number;
    transcript: string;
    summary?: string;
    decisions?: MeetingDecision[];
    action_items?: MeetingActionItem[];
    key_topics?: string[];
    members?: string[];
}

export interface UpdateMeetingBody {
    title?: string;
    summary?: string;
    decisions?: MeetingDecision[];
    action_items?: MeetingActionItem[];
    key_topics?: string[];
}

export interface MeetingProcessResult {
    summary: string;
    decisions: MeetingDecision[];
    action_items: MeetingActionItem[];
    key_topics: string[];
}

function asRecord(raw: unknown): Record<string, unknown> {
    return raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function parseStringList(raw: unknown): string[] {
    return Array.isArray(raw) ? raw.map((item) => String(item ?? '')) : [];
}

function parseDecisions(raw: unknown): MeetingDecision[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
        const row = asRecord(item);
        return {
            decision: String(row.decision ?? ''),
            context: String(row.context ?? ''),
        };
    });
}

function parseActionItems(raw: unknown): MeetingActionItem[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
        const row = asRecord(item);
        return {
            task: String(row.task ?? ''),
            owner: String(row.owner ?? ''),
            deadline: String(row.deadline ?? ''),
        };
    });
}

function parseId(raw: unknown): number {
    const id = Number(raw);
    if (!Number.isFinite(id)) {
        throw new Error('Meeting response missing a numeric id');
    }
    return id;
}

function parseSharedListFields(raw: Record<string, unknown>) {
    return {
        title: String(raw.title ?? ''),
        meeting_date: String(raw.meeting_date ?? ''),
        duration_seconds: Number(raw.duration_seconds ?? 0),
        summary: String(raw.summary ?? ''),
        decisions: parseDecisions(raw.decisions),
        action_items: parseActionItems(raw.action_items),
        key_topics: parseStringList(raw.key_topics),
        members: parseStringList(raw.members),
        shared_message_id: raw.shared_message_id != null ? Number(raw.shared_message_id) : null,
        created_at: String(raw.created_at ?? ''),
        updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

function fromApiMeeting(raw: unknown): Meeting {
    const row = asRecord(raw);
    return {
        id: parseId(row.id),
        ...parseSharedListFields(row),
        transcript: String(row.transcript ?? ''),
    };
}

function fromApiMeetingListItem(raw: unknown): MeetingListItem {
    const row = asRecord(raw);
    return {
        id: parseId(row.id),
        ...parseSharedListFields(row),
        transcript_preview: String(row.transcript_preview ?? ''),
        has_transcript: Boolean(row.has_transcript),
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

export async function createMeeting(body: CreateMeetingBody): Promise<Meeting> {
    const r = await authFetch(MEETINGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        throw new Error((await readErrorDetail(r)) || `Failed to save meeting (${r.status})`);
    }
    return fromApiMeeting(await r.json());
}

export async function listMeetings(limit = 50): Promise<MeetingListItem[]> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    const r = await authFetch(`${MEETINGS_API}?${params.toString()}`);
    if (!r.ok) {
        throw new Error((await readErrorDetail(r)) || `Failed to load meetings (${r.status})`);
    }
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map(fromApiMeetingListItem);
}

export async function getMeeting(id: number): Promise<Meeting> {
    const r = await authFetch(`${MEETINGS_API}/${encodeURIComponent(String(id))}`);
    if (!r.ok) {
        throw new Error((await readErrorDetail(r)) || `Failed to load meeting (${r.status})`);
    }
    return fromApiMeeting(await r.json());
}

export async function updateMeeting(id: number, body: UpdateMeetingBody): Promise<Meeting> {
    const r = await authFetch(`${MEETINGS_API}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        throw new Error((await readErrorDetail(r)) || `Failed to update meeting (${r.status})`);
    }
    return fromApiMeeting(await r.json());
}

export async function deleteMeeting(id: number): Promise<void> {
    const r = await authFetch(`${MEETINGS_API}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!r.ok) {
        throw new Error((await readErrorDetail(r)) || `Failed to delete meeting (${r.status})`);
    }
}

export function parseMeetingProcessResult(raw: unknown): MeetingProcessResult {
    const row = asRecord(raw);
    return {
        summary: String(row.summary ?? ''),
        decisions: parseDecisions(row.decisions),
        action_items: parseActionItems(row.action_items),
        key_topics: parseStringList(row.key_topics),
    };
}

export async function processMeetingTranscript(
    transcript: string,
    meetingTitle: string,
): Promise<MeetingProcessResult> {
    const r = await authFetch(MEETING_PROCESS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transcript,
            meeting_title: meetingTitle,
        }),
    });
    if (!r.ok) {
        throw new Error((await readErrorDetail(r)) || `Failed to process meeting notes (${r.status})`);
    }
    return parseMeetingProcessResult(await r.json());
}
