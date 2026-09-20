import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AutoGrowTextarea from '../../components/AutoGrowTextarea';
import {
    deleteMarketingPostVideo,
    generateMarketingPostVideo,
    listMarketingPostVideos,
    type MarketingVideo,
    type MarketingVideoCamera,
    type MarketingVideoCaptionPosition,
    type MarketingVideoDuration,
    type MarketingVideoVoice,
    type MarketingVideoMood,
    type MarketingVideoResolution,
    type MarketingVideoScene,
} from '../../services/api';
import { formatDateTime } from '../../utils/formatters';

const POLL_INTERVAL_MS = 5000;
const PROMPT_MAX = 1000;

const LOAD_ERROR = "Couldn't load videos. Check your connection and try again.";
const GENERATE_ERROR = "Couldn't start the render. Try again.";
const DELETE_ERROR = "Couldn't delete the video. Try again.";
const IN_PROGRESS_ERROR = 'A render is already in progress';
const NOT_CONFIGURED_ERROR = 'Video generation is not configured on this server.';
const DELETE_IN_PROGRESS_ERROR = 'Wait for the render to finish first.';
const SESSION_EXPIRED_ERROR = 'Your session expired. Refresh the page and sign in again.';
const REJECTED_ERROR = 'That request was rejected. Check the settings and try again.';
const NO_IMAGE_HINT = 'Add an image to the post first';

const STATUS_STYLE: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-600',
    rendering: 'bg-blue-100 text-blue-700',
    ready: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
};

const CAMERA_OPTIONS: { id: MarketingVideoCamera; label: string }[] = [
    { id: 'push_in', label: 'Slow push in' },
    { id: 'arc', label: 'Gentle arc' },
    { id: 'pan', label: 'Slow pan' },
    { id: 'locked', label: 'Locked still' },
];

const SCENE_OPTIONS: { id: MarketingVideoScene; label: string }[] = [
    { id: 'lights', label: 'Lights and glow' },
    { id: 'breeze', label: 'Soft breeze' },
    { id: 'particles', label: 'Drifting particles' },
    { id: 'minimal', label: 'Minimal' },
];

const MOOD_OPTIONS: { id: MarketingVideoMood; label: string }[] = [
    { id: 'warm', label: 'Warm' },
    { id: 'cool', label: 'Cool' },
    { id: 'neutral', label: 'Neutral' },
];

const PRICE_PER_SECOND: Record<MarketingVideoResolution, number> = {
    '480p': 0.04,
    '580p': 0.06,
    '720p': 0.08,
};
const RESOLUTION_OPTIONS: MarketingVideoResolution[] = ['480p', '580p', '720p'];
const DURATION_OPTIONS: MarketingVideoDuration[] = [5, 8, 10];
const CHARS_PER_SECOND = 9;
const DIGIT_WEIGHT = 3;
const LIPSYNC_COST_PER_MINUTE_USD = 0.70;
function lipsyncCost(duration: MarketingVideoDuration): number {
    return (LIPSYNC_COST_PER_MINUTE_USD * duration) / 60;
}
function speechWeight(script: string): number {
    const s = script.trim();
    let n = s.length;
    for (const ch of s) if (ch >= '0' && ch <= '9') n += DIGIT_WEIGHT - 1;
    return n;
}
const VOICE_OPTIONS: { id: MarketingVideoVoice; label: string }[] = [
    { id: 'Sarah (en)', label: 'Sarah' },
    { id: 'Ashley (en)', label: 'Ashley' },
    { id: 'Craig (en)', label: 'Craig' },
    { id: 'Mark (en)', label: 'Mark' },
];
const MAX_ROWS = 15;

function priceLabel(r: MarketingVideoResolution, d: MarketingVideoDuration): string {
    return `$${(PRICE_PER_SECOND[r] * d).toFixed(2)}`;
}

function optionLabel<T extends string>(
    value: string | null | undefined,
    options: { id: T; label: string }[],
): string {
    if (!value) return value ?? '—';
    return options.find((option) => option.id === value)?.label ?? value;
}

const LEGACY_PRESET_LABELS: Record<string, string> = {
    slow_push_in: 'Slow push in',
    light_drift: 'Light drift',
    particle_float: 'Particle float',
};

function clipLookSummary(row: MarketingVideo): string {
    if (row.custom_prompt?.trim()) {
        return 'Custom prompt';
    }
    if (row.camera == null && row.preset) {
        return LEGACY_PRESET_LABELS[row.preset] ?? row.preset;
    }
    return [
        optionLabel(row.camera, CAMERA_OPTIONS),
        optionLabel(row.scene, SCENE_OPTIONS),
        optionLabel(row.mood, MOOD_OPTIONS),
    ].join(' · ');
}

function isUnauthorizedMessage(text: string): boolean {
    const lower = text.toLowerCase();
    return (
        lower.includes('unauthorized') ||
        lower.includes('not authenticated') ||
        /\b401\b/.test(text)
    );
}

function mapGenerateError(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    if (text.includes('already in progress')) {
        return IN_PROGRESS_ERROR;
    }
    if (text.toLowerCase().includes('not configured')) {
        return NOT_CONFIGURED_ERROR;
    }
    if (isUnauthorizedMessage(text)) {
        return SESSION_EXPIRED_ERROR;
    }
    const trimmed = text.trim();
    const is400or422 = /\b400\b/.test(trimmed) || /\b422\b/.test(trimmed);
    const bareStatus = /^HTTP (400|422)$/.test(trimmed);
    const genericDetail = !trimmed || trimmed === 'Request failed' || trimmed === '[object Object]';
    if (is400or422) {
        if (!bareStatus && !genericDetail) {
            return trimmed;
        }
        return REJECTED_ERROR;
    }
    if (!genericDetail && !/^HTTP \d{3}$/.test(trimmed)) {
        return trimmed;
    }
    return GENERATE_ERROR;
}

function mapDeleteError(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    if (text.includes('render in progress') || text.includes('Cannot delete')) {
        return DELETE_IN_PROGRESS_ERROR;
    }
    if (isUnauthorizedMessage(text)) {
        return SESSION_EXPIRED_ERROR;
    }
    return DELETE_ERROR;
}

function hasPendingVideos(rows: MarketingVideo[]): boolean {
    return rows.some((row) => row.status === 'queued' || row.status === 'rendering');
}

function newestReadyWithSeed(rows: MarketingVideo[]): MarketingVideo | undefined {
    return rows
        .filter((row) => row.status === 'ready' && row.seed != null)
        .sort(
            (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0];
}

export default function VideoPanel({
    postId,
    hasImage,
    showList = true,
}: {
    postId: number;
    hasImage: boolean;
    showList?: boolean;
}) {
    const [videos, setVideos] = useState<MarketingVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [camera, setCamera] = useState<MarketingVideoCamera>('push_in');
    const [scene, setScene] = useState<MarketingVideoScene>('lights');
    const [mood, setMood] = useState<MarketingVideoMood>('neutral');
    const [resolution, setResolution] = useState<MarketingVideoResolution>('720p');
    const [duration, setDuration] = useState<MarketingVideoDuration>(5);
    const [customPrompt, setCustomPrompt] = useState('');
    const [matchPreviousSeed, setMatchPreviousSeed] = useState(false);
    const [caption, setCaption] = useState('');
    const [captionPosition, setCaptionPosition] = useState<MarketingVideoCaptionPosition>('bottom');
    const [captionOn, setCaptionOn] = useState(false);
    const [voiceOn, setVoiceOn] = useState(false);
    const [voiceScript, setVoiceScript] = useState('');
    const [voiceName, setVoiceName] = useState<MarketingVideoVoice>('Sarah (en)');
    const [lipsync, setLipsync] = useState(false);

    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const prevLengthRef = useRef(0);

    const seedSource = useMemo(() => newestReadyWithSeed(videos), [videos]);
    const canMatchPreviousSeed = seedSource != null;
    const displayedVideos = useMemo(
        () => [...videos.slice(0, MAX_ROWS)].reverse(),
        [videos],
    );

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    const syncPolling = useCallback(
        (rows: MarketingVideo[]) => {
            if (hasPendingVideos(rows)) {
                if (!pollTimerRef.current) {
                    pollTimerRef.current = setInterval(() => {
                        void listMarketingPostVideos(postId)
                            .then((updated) => {
                                setVideos(updated);
                                if (!hasPendingVideos(updated)) {
                                    stopPolling();
                                }
                            })
                            .catch(() => {
                                /* keep polling on transient errors */
                            });
                    }, POLL_INTERVAL_MS);
                }
            } else {
                stopPolling();
            }
        },
        [postId, stopPolling],
    );

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        void listMarketingPostVideos(postId)
            .then((rows) => {
                if (cancelled) return;
                setVideos(rows);
                syncPolling(rows);
            })
            .catch(() => {
                if (!cancelled) setError(LOAD_ERROR);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
            stopPolling();
        };
    }, [postId, stopPolling, syncPolling]);

    useEffect(() => {
        if (!canMatchPreviousSeed) {
            setMatchPreviousSeed(false);
        }
    }, [canMatchPreviousSeed]);

    useEffect(() => {
        if (!voiceOn) {
            setLipsync(false);
        }
    }, [voiceOn]);

    useEffect(() => {
        if (videos.length > prevLengthRef.current && videos.length > 0) {
            document
                .getElementById(`video-row-${videos[0].id}`)
                ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        prevLengthRef.current = videos.length;
    }, [videos.length]);

    const runGenerate = async (body: {
        camera?: MarketingVideoCamera;
        scene?: MarketingVideoScene;
        mood?: MarketingVideoMood;
        resolution?: MarketingVideoResolution;
        duration_seconds?: MarketingVideoDuration;
        custom_prompt?: string | null;
        seed?: number | null;
        caption?: string | null;
        caption_position?: MarketingVideoCaptionPosition;
        voice_script?: string | null;
        voice_name?: MarketingVideoVoice;
        lipsync?: boolean;
    }) => {
        setBusy(true);
        setError(null);
        try {
            const created = await generateMarketingPostVideo(postId, body);
            setVideos((prev) => {
                const next = [created, ...prev.filter((row) => row.id !== created.id)];
                syncPolling(next);
                return next;
            });
        } catch (err) {
            setError(mapGenerateError(err));
        } finally {
            setBusy(false);
        }
    };

    const onGenerate = () => {
        void runGenerate({
            camera,
            scene,
            mood,
            resolution,
            duration_seconds: duration,
            custom_prompt: customPrompt.trim() ? customPrompt.trim() : null,
            ...(matchPreviousSeed && seedSource?.seed != null
                ? { seed: seedSource.seed }
                : {}),
            ...(captionOn && caption.trim()
                ? { caption: caption.trim(), caption_position: captionPosition }
                : {}),
            ...(voiceOn && voiceScript.trim()
                ? { voice_script: voiceScript.trim(), voice_name: voiceName }
                : {}),
            ...(voiceOn && voiceScript.trim() && lipsync ? { lipsync: true } : {}),
        });
    };

    const onTryAgain = (row: MarketingVideo) => {
        void runGenerate({
            camera: row.camera as MarketingVideoCamera,
            scene: row.scene as MarketingVideoScene,
            mood: row.mood as MarketingVideoMood,
            resolution: row.resolution as MarketingVideoResolution,
            duration_seconds: row.duration_seconds as MarketingVideoDuration,
            custom_prompt: row.custom_prompt ?? undefined,
            seed: row.seed ?? undefined,
            caption: row.caption ?? undefined,
            caption_position: (row.caption_position as MarketingVideoCaptionPosition) ?? undefined,
            voice_script: row.voice_script ?? undefined,
            voice_name: (row.voice_name as MarketingVideoVoice) ?? undefined,
            lipsync: row.lipsync || undefined,
        });
    };

    const onDelete = async (videoId: number) => {
        setBusy(true);
        setError(null);
        try {
            await deleteMarketingPostVideo(postId, videoId);
            setVideos((prev) => {
                const next = prev.filter((row) => row.id !== videoId);
                syncPolling(next);
                return next;
            });
        } catch (err) {
            setError(mapDeleteError(err));
        } finally {
            setBusy(false);
        }
    };

    const voiceCharCap = duration * CHARS_PER_SECOND;
    const voiceCharCount = speechWeight(voiceScript);
    const voiceOverCap = voiceOn && voiceCharCount > voiceCharCap;
    const generateDisabled = !hasImage || busy || voiceOverCap;
    const selectClassName =
        'w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#111827] disabled:opacity-40';
    const fieldLabelClassName =
        'block text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mb-1.5';

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
                    {error}
                </div>
            )}

            {showList && loading ? (
                <p className="text-xs text-gray-400 inline-flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Loading videos…
                </p>
            ) : showList && videos.length === 0 ? (
                <p className="text-xs text-gray-400">No videos yet.</p>
            ) : showList ? (
                <>
                    {videos.length > MAX_ROWS && (
                        <p className="text-[10px] text-[#9CA3AF]">
                            Showing the 15 most recent of {videos.length} videos
                        </p>
                    )}
                    <ul className="space-y-3">
                        {displayedVideos.map((row) => (
                            <li
                                key={row.id}
                                id={`video-row-${row.id}`}
                                className="rounded-lg border border-[#E4E7EC] bg-white p-3"
                            >
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span
                                        className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${
                                            STATUS_STYLE[row.status] ?? STATUS_STYLE.queued
                                        }`}
                                    >
                                        {row.status}
                                    </span>
                                    <span className="text-xs font-bold text-[#111827]">
                                        {clipLookSummary(row)}
                                    </span>
                                    <span className="text-xs text-[#6B7280]">
                                        {row.resolution} · {row.duration_seconds}s
                                    </span>
                                    {row.caption ? (
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                            Caption
                                        </span>
                                    ) : null}
                                    {row.voice_script ? (
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                            Voice
                                        </span>
                                    ) : null}
                                    {row.lipsync ? (
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                            Lip-sync
                                        </span>
                                    ) : null}
                                    <span className="text-[10px] font-mono text-[#9CA3AF] ml-auto">
                                        {formatDateTime(row.created_at)}
                                    </span>
                                </div>

                                {row.status === 'ready' && row.url && (
                                    <div className="space-y-2">
                                        <video
                                            controls
                                            preload="metadata"
                                            src={row.url}
                                            className="w-full rounded-md bg-black max-h-48"
                                        />
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void onDelete(row.id)}
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-[#6B7280] hover:bg-[#F1F3F6] disabled:opacity-40"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}

                                {row.status === 'failed' && (
                                    <div className="space-y-2">
                                        {row.error_message && (
                                            <p className="text-xs text-red-700 leading-snug">
                                                {row.error_message}
                                            </p>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={busy || !hasImage}
                                                onClick={() => onTryAgain(row)}
                                                className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-40"
                                            >
                                                Try again
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => void onDelete(row.id)}
                                                className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-[#6B7280] hover:bg-[#F1F3F6] disabled:opacity-40"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {(row.status === 'queued' || row.status === 'rendering') && (
                                    <p className="text-xs text-[#6B7280] inline-flex items-center gap-2">
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        {row.status === 'queued' ? 'Queued…' : 'Rendering…'}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}

            <div className="rounded-lg border border-[#E4E7EC] bg-[#F7F8FA] p-3 space-y-3">
                {!hasImage && (
                    <p className="text-xs font-semibold text-[#6B7280]">{NO_IMAGE_HINT}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className={fieldLabelClassName}>Camera</label>
                        <select
                            value={camera}
                            disabled={generateDisabled}
                            onChange={(e) => setCamera(e.target.value as MarketingVideoCamera)}
                            className={selectClassName}
                        >
                            {CAMERA_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={fieldLabelClassName}>Scene</label>
                        <select
                            value={scene}
                            disabled={generateDisabled}
                            onChange={(e) => setScene(e.target.value as MarketingVideoScene)}
                            className={selectClassName}
                        >
                            {SCENE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={fieldLabelClassName}>Mood</label>
                        <select
                            value={mood}
                            disabled={generateDisabled}
                            onChange={(e) => setMood(e.target.value as MarketingVideoMood)}
                            className={selectClassName}
                        >
                            {MOOD_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className={fieldLabelClassName}>Resolution</label>
                    <select
                        value={resolution}
                        disabled={generateDisabled}
                        onChange={(e) => setResolution(e.target.value as MarketingVideoResolution)}
                        className={selectClassName}
                    >
                        {RESOLUTION_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                                {r} · {priceLabel(r, duration)}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={fieldLabelClassName}>Duration</label>
                    <select
                        value={duration}
                        disabled={generateDisabled}
                        onChange={(e) =>
                            setDuration(Number(e.target.value) as MarketingVideoDuration)
                        }
                        className={selectClassName}
                    >
                        {DURATION_OPTIONS.map((d) => (
                            <option key={d} value={d}>
                                {d} seconds
                            </option>
                        ))}
                    </select>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-[#374151] cursor-pointer">
                    <input
                        type="checkbox"
                        checked={captionOn}
                        disabled={generateDisabled}
                        onChange={(e) => setCaptionOn(e.target.checked)}
                        className="rounded border-[#D1D5DB] text-violet-600 focus:ring-violet-200 disabled:opacity-40"
                    />
                    Add a caption
                </label>
                {captionOn && (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                        <div>
                            <label className={fieldLabelClassName}>Caption</label>
                            <input
                                type="text"
                                value={caption}
                                maxLength={60}
                                disabled={generateDisabled}
                                placeholder="e.g. Bettano 20W-50 — same-day delivery"
                                onChange={(e) => setCaption(e.target.value.slice(0, 60))}
                                className={selectClassName}
                            />
                            <p className="mt-1 text-[10px] text-[#9CA3AF] text-right">
                                {caption.length}/60
                            </p>
                        </div>
                        <div>
                            <label className={fieldLabelClassName}>Position</label>
                            <select
                                value={captionPosition}
                                disabled={generateDisabled}
                                onChange={(e) =>
                                    setCaptionPosition(e.target.value as MarketingVideoCaptionPosition)
                                }
                                className={selectClassName}
                            >
                                <option value="bottom">Bottom</option>
                                <option value="top">Top</option>
                            </select>
                        </div>
                    </div>
                )}

                <label className="flex items-center gap-2 text-xs font-semibold text-[#374151] cursor-pointer">
                    <input
                        type="checkbox"
                        checked={voiceOn}
                        disabled={!hasImage || busy}
                        onChange={(e) => setVoiceOn(e.target.checked)}
                        className="rounded border-[#D1D5DB] text-violet-600 focus:ring-violet-200 disabled:opacity-40"
                    />
                    Add a voiceover
                </label>
                {voiceOn && (
                    <div className="space-y-3">
                        <div>
                            <label className={fieldLabelClassName}>Script</label>
                            <AutoGrowTextarea
                                value={voiceScript}
                                onChange={(e) => setVoiceScript(e.target.value.slice(0, 200))}
                                maxLength={200}
                                maxHeight={160}
                                disabled={!hasImage || busy}
                                placeholder="e.g. Bettano 20W-50. Same-day delivery across Queens."
                                className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs leading-relaxed resize-none outline-none min-h-[72px] focus:border-violet-300 focus:ring-[3px] focus:ring-violet-100 disabled:opacity-40"
                            />
                            <p
                                className={`mt-1 text-[10px] ${
                                    voiceOverCap ? 'text-red-700' : 'text-[#9CA3AF]'
                                }`}
                            >
                                {voiceCharCount}/{voiceCharCap} · about{' '}
                                {(voiceCharCount / CHARS_PER_SECOND).toFixed(1)}s of speech
                                {voiceOverCap
                                    ? ' — choose a longer clip or shorten the script'
                                    : ''}
                            </p>
                        </div>
                        <div>
                            <label className={fieldLabelClassName}>Voice</label>
                            <select
                                value={voiceName}
                                disabled={!hasImage || busy}
                                onChange={(e) =>
                                    setVoiceName(e.target.value as MarketingVideoVoice)
                                }
                                className={selectClassName}
                            >
                                {VOICE_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {voiceOn && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#374151] cursor-pointer">
                        <input
                            type="checkbox"
                            checked={lipsync}
                            disabled={!hasImage || busy}
                            onChange={(e) => setLipsync(e.target.checked)}
                            className="rounded border-[#D1D5DB] text-violet-600 focus:ring-violet-200 disabled:opacity-40"
                        />
                        Make the person&apos;s lips move
                        <span className="text-[10px] font-semibold text-[#9CA3AF]">{`+$${lipsyncCost(duration).toFixed(2)}`}</span>
                    </label>
                )}

                {canMatchPreviousSeed && (
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#374151] cursor-pointer">
                        <input
                            type="checkbox"
                            checked={matchPreviousSeed}
                            disabled={generateDisabled}
                            onChange={(e) => setMatchPreviousSeed(e.target.checked)}
                            className="rounded border-[#D1D5DB] text-violet-600 focus:ring-violet-200 disabled:opacity-40"
                        />
                        Match previous clip&apos;s look
                    </label>
                )}

                <details className="group">
                    <summary className="cursor-pointer text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] list-none">
                        Advanced
                    </summary>
                    <div className="mt-2 space-y-1">
                        <AutoGrowTextarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value.slice(0, PROMPT_MAX))}
                            maxLength={PROMPT_MAX}
                            maxHeight={160}
                            disabled={generateDisabled}
                            placeholder="Optional custom motion prompt…"
                            className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs leading-relaxed resize-none outline-none min-h-[72px] focus:border-violet-300 focus:ring-[3px] focus:ring-violet-100 disabled:opacity-40"
                        />
                        <p className="text-[10px] text-[#9CA3AF]">
                            Overrides the composed look when filled.
                        </p>
                    </div>
                </details>

                <button
                    type="button"
                    disabled={generateDisabled}
                    onClick={onGenerate}
                    className="w-full rounded-lg border-none py-2.5 cursor-pointer text-white text-xs font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40"
                >
                    {busy ? 'Starting…' : 'Generate video'}
                </button>
                <p className="text-[10px] text-[#9CA3AF] leading-relaxed">
                    {lipsync
                        ? `This render costs $${(PRICE_PER_SECOND[resolution] * duration + lipsyncCost(duration)).toFixed(2)} from your AI budget.`
                        : `This render costs ${priceLabel(resolution, duration)} from your AI budget.`}
                </p>
            </div>
        </div>
    );
}
