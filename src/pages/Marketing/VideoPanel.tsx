import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AutoGrowTextarea from '../../components/AutoGrowTextarea';
import {
    deleteMarketingPostVideo,
    generateMarketingPostVideo,
    listMarketingPostVideos,
    type MarketingVideo,
    type MarketingVideoPreset,
    type MarketingVideoResolution,
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
const NO_IMAGE_HINT = 'Add an image to the post first';

const STATUS_STYLE: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-600',
    rendering: 'bg-blue-100 text-blue-700',
    ready: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
};

const PRESET_OPTIONS: { id: MarketingVideoPreset; label: string }[] = [
    { id: 'slow_push_in', label: 'Slow push in' },
    { id: 'light_drift', label: 'Light drift' },
    { id: 'particle_float', label: 'Particle float' },
];

const RESOLUTION_OPTIONS: { id: MarketingVideoResolution; label: string }[] = [
    { id: '580p', label: '580p · $0.20' },
    { id: '720p', label: '720p · $0.40' },
];

function presetLabel(preset: string): string {
    return PRESET_OPTIONS.find((option) => option.id === preset)?.label ?? preset;
}

function mapGenerateError(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    if (text.includes('already in progress')) {
        return IN_PROGRESS_ERROR;
    }
    if (text.toLowerCase().includes('not configured')) {
        return NOT_CONFIGURED_ERROR;
    }
    return GENERATE_ERROR;
}

function mapDeleteError(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    if (text.includes('render in progress') || text.includes('Cannot delete')) {
        return DELETE_IN_PROGRESS_ERROR;
    }
    return DELETE_ERROR;
}

function hasPendingVideos(rows: MarketingVideo[]): boolean {
    return rows.some((row) => row.status === 'queued' || row.status === 'rendering');
}

export default function VideoPanel({
    postId,
    hasImage,
}: {
    postId: number;
    hasImage: boolean;
}) {
    const [videos, setVideos] = useState<MarketingVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preset, setPreset] = useState<MarketingVideoPreset>('slow_push_in');
    const [resolution, setResolution] = useState<MarketingVideoResolution>('580p');
    const [customPrompt, setCustomPrompt] = useState('');

    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const runGenerate = async (body: {
        preset?: MarketingVideoPreset;
        resolution?: MarketingVideoResolution;
        custom_prompt?: string | null;
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
            preset,
            resolution,
            custom_prompt: customPrompt.trim() ? customPrompt.trim() : null,
        });
    };

    const onTryAgain = (row: MarketingVideo) => {
        void runGenerate({
            preset: row.preset as MarketingVideoPreset,
            resolution: row.resolution as MarketingVideoResolution,
            custom_prompt: row.custom_prompt ?? undefined,
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

    const generateDisabled = !hasImage || busy;

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-xs text-gray-400 inline-flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Loading videos…
                </p>
            ) : videos.length === 0 ? (
                <p className="text-xs text-gray-400">No videos yet.</p>
            ) : (
                <ul className="space-y-3">
                    {videos.map((row) => (
                        <li
                            key={row.id}
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
                                    {presetLabel(row.preset)}
                                </span>
                                <span className="text-xs text-[#6B7280]">{row.resolution}</span>
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
            )}

            <div className="rounded-lg border border-[#E4E7EC] bg-[#F7F8FA] p-3 space-y-3">
                {!hasImage && (
                    <p className="text-xs font-semibold text-[#6B7280]">{NO_IMAGE_HINT}</p>
                )}

                <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mb-1.5">
                        Motion preset
                    </label>
                    <select
                        value={preset}
                        disabled={generateDisabled}
                        onChange={(e) => setPreset(e.target.value as MarketingVideoPreset)}
                        className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#111827] disabled:opacity-40"
                    >
                        {PRESET_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mb-1.5">
                        Resolution
                    </label>
                    <select
                        value={resolution}
                        disabled={generateDisabled}
                        onChange={(e) => setResolution(e.target.value as MarketingVideoResolution)}
                        className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#111827] disabled:opacity-40"
                    >
                        {RESOLUTION_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

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
                            Overrides the preset when filled.
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
                    Each render costs the shown amount from your AI budget.
                </p>
            </div>
        </div>
    );
}
