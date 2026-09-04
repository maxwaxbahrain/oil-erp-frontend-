import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import AutoGrowTextarea from '../../components/AutoGrowTextarea';
import {
    approveMarketingAd,
    createMarketingPostAd,
    deleteMarketingAd,
    getBrandKit,
    listMarketingPostAds,
    patchMarketingAdScene,
    updateBrandKit,
    uploadBrandKitProduct,
    type BrandKit,
    type MarketingAd,
    type MarketingAdResolution,
    type MarketingAdVoice,
} from '../../services/api';
import { formatDateTime } from '../../utils/formatters';

const POLL_INTERVAL_MS = 15000;
const MAX_AD_ROWS = 5;
const IDEA_MIN = 5;
const IDEA_MAX = 500;
const VOICE_MIN = 42;
const VOICE_MAX = 60;

const LOAD_ERROR = "Couldn't load ads. Check your connection and try again.";
const CREATE_ERROR = "Couldn't write the storyboard. Try again.";
const DELETE_ERROR = "Couldn't delete the ad. Try again.";
const APPROVE_ERROR = "Couldn't start the render. Try again.";
const BRAND_KIT_ERROR = "Couldn't load Brand Kit. Try again.";
const SESSION_EXPIRED_ERROR = 'Your session expired. Refresh the page and sign in again.';
const REJECTED_ERROR = 'That request was rejected. Check the settings and try again.';
const NO_PRODUCT_HINT = 'Add your product photo to the Brand Kit first';

const STATUS_STYLE: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    approved: 'bg-amber-100 text-amber-800',
    rendering: 'bg-blue-100 text-blue-700',
    assembling: 'bg-blue-100 text-blue-700',
    ready: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
};

const VEO_PRICE_PER_SECOND: Record<MarketingAdResolution, number> = {
    '720p': 0.1,
    '1080p': 0.2,
};

const VOICE_OPTIONS: { id: MarketingAdVoice; label: string }[] = [
    { id: 'Sarah (en)', label: 'Sarah' },
    { id: 'Ashley (en)', label: 'Ashley' },
    { id: 'Craig (en)', label: 'Craig' },
    { id: 'Mark (en)', label: 'Mark' },
];

function voiceShortName(voice: string | null | undefined): string {
    if (!voice) return '—';
    return VOICE_OPTIONS.find((option) => option.id === voice)?.label ?? voice.replace(' (en)', '');
}

function veoPreviewUsd(sceneCount: number, resolution: MarketingAdResolution): string {
    return `$${(sceneCount * 8 * VEO_PRICE_PER_SECOND[resolution]).toFixed(2)}`;
}

function formatCost(usd: number): string {
    return `$${usd.toFixed(2)}`;
}

function isUnauthorizedMessage(text: string): boolean {
    const lower = text.toLowerCase();
    return (
        lower.includes('unauthorized') ||
        lower.includes('not authenticated') ||
        /\b401\b/.test(text)
    );
}

function mapApiError(err: unknown, fallback: string): string {
    const text = err instanceof Error ? err.message : String(err);
    if (isUnauthorizedMessage(text)) {
        return SESSION_EXPIRED_ERROR;
    }
    const trimmed = text.trim();
    const isClientError = /\b(400|409|502)\b/.test(trimmed);
    const bareStatus = /^HTTP (400|409|502)$/.test(trimmed);
    const genericDetail =
        !trimmed || trimmed === 'Request failed' || trimmed === '[object Object]';
    if (isClientError) {
        if (!bareStatus && !genericDetail) {
            return trimmed;
        }
        return REJECTED_ERROR;
    }
    if (!genericDetail && !/^HTTP \d{3}$/.test(trimmed)) {
        return trimmed;
    }
    return fallback;
}

function hasInProgressAds(rows: MarketingAd[]): boolean {
    return rows.some((row) =>
        ['approved', 'rendering', 'assembling'].includes(row.status),
    );
}

function isDeleteDisabled(status: string): boolean {
    return status === 'rendering' || status === 'assembling';
}

function sceneProgressLine(ad: MarketingAd): string | null {
    if (!['approved', 'rendering', 'assembling'].includes(ad.status)) {
        return null;
    }
    const idx = ad.scenes.findIndex((scene) => scene.status !== 'ready');
    const current = idx === -1 ? ad.scene_count : idx + 1;
    return `Scene ${current} of ${ad.scene_count}`;
}

function truncateIdea(idea: string, max = 48): string {
    const trimmed = idea.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
}

const fieldLabelClassName =
    'block text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mb-1';
const selectClassName =
    'w-full text-xs font-semibold rounded-md border border-[#E4E7EC] bg-white px-2 py-1.5 text-[#111827] disabled:opacity-40';
const inputClassName =
    'w-full text-xs font-semibold rounded-md border border-[#E4E7EC] bg-white px-2 py-1.5 text-[#111827] disabled:opacity-40';

type SavedField = 'description' | 'voice_line';

function DraftSceneFields({
    scene,
    disabled,
    onSaveDescription,
    onSaveVoiceLine,
    savedDescription,
    savedVoiceLine,
}: {
    scene: MarketingAd['scenes'][number];
    disabled: boolean;
    onSaveDescription: (value: string) => void;
    onSaveVoiceLine: (value: string) => void;
    savedDescription: boolean;
    savedVoiceLine: boolean;
}) {
    const [description, setDescription] = useState(scene.description);
    const [voiceLine, setVoiceLine] = useState(scene.voice_line ?? '');

    useEffect(() => {
        setDescription(scene.description);
        setVoiceLine(scene.voice_line ?? '');
    }, [scene.description, scene.voice_line, scene.id]);

    const voiceLen = voiceLine.length;
    const voiceCounterBad = voiceLen > 0 && (voiceLen < VOICE_MIN || voiceLen > VOICE_MAX);

    return (
        <div className="rounded-md border border-[#E4E7EC] bg-white p-3 space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF]">
                    Scene {scene.position + 1}
                </span>
                {savedDescription && (
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-label="Saved" />
                )}
            </div>
            <AutoGrowTextarea
                value={description}
                disabled={disabled}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                    const value = description.trim();
                    if (value && value !== scene.description) {
                        onSaveDescription(value);
                    }
                }}
                className={inputClassName}
            />
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={voiceLine}
                    maxLength={VOICE_MAX}
                    disabled={disabled}
                    onChange={(e) => setVoiceLine(e.target.value)}
                    onBlur={() => {
                        const value = voiceLine.trim();
                        if (value !== (scene.voice_line ?? '').trim()) {
                            onSaveVoiceLine(value);
                        }
                    }}
                    className={`${inputClassName} flex-1`}
                    placeholder="Voice line for this scene"
                />
                <span
                    className={`text-[10px] font-mono shrink-0 ${
                        voiceCounterBad ? 'text-red-600 font-bold' : 'text-[#9CA3AF]'
                    }`}
                >
                    {voiceLen}/{VOICE_MAX}
                </span>
                {savedVoiceLine && (
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-label="Saved" />
                )}
            </div>
        </div>
    );
}

export default function AdPanel({
    postId,
    hasImage: _hasImage,
}: {
    postId: number;
    hasImage: boolean;
}) {
    const [ads, setAds] = useState<MarketingAd[]>([]);
    const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [brandKitExpanded, setBrandKitExpanded] = useState(false);
    const [editSpokenName, setEditSpokenName] = useState('');
    const [editVoice, setEditVoice] = useState<MarketingAdVoice>('Sarah (en)');
    const [brandKitBusy, setBrandKitBusy] = useState(false);
    const [brandKitError, setBrandKitError] = useState<string | null>(null);

    const [idea, setIdea] = useState('');
    const [sceneCount, setSceneCount] = useState<3 | 6>(3);
    const [resolution, setResolution] = useState<MarketingAdResolution>('1080p');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [savedFields, setSavedFields] = useState<Record<string, SavedField | undefined>>({});

    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const hasProductPhoto = !!brandKit?.product_url;
    const draftAd = useMemo(
        () => ads.find((row) => row.status === 'draft'),
        [ads],
    );
    const listedAds = useMemo(() => {
        const rows = draftAd ? ads.filter((row) => row.id !== draftAd.id) : ads;
        return rows.slice(0, MAX_AD_ROWS);
    }, [ads, draftAd]);

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    const syncPolling = useCallback(
        (rows: MarketingAd[]) => {
            if (hasInProgressAds(rows)) {
                if (!pollTimerRef.current) {
                    pollTimerRef.current = setInterval(() => {
                        void listMarketingPostAds(postId)
                            .then((updated) => {
                                setAds(updated);
                                if (!hasInProgressAds(updated)) {
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

    const refreshAds = useCallback(async () => {
        const rows = await listMarketingPostAds(postId);
        setAds(rows);
        syncPolling(rows);
        return rows;
    }, [postId, syncPolling]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        void Promise.all([listMarketingPostAds(postId), getBrandKit()])
            .then(([rows, kit]) => {
                if (cancelled) return;
                setAds(rows);
                setBrandKit(kit);
                setEditSpokenName(kit.spoken_name ?? '');
                setEditVoice((kit.voice_name as MarketingAdVoice) ?? 'Sarah (en)');
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

    const markSaved = (sceneId: number, field: SavedField) => {
        const key = `${sceneId}:${field}`;
        setSavedFields((prev) => ({ ...prev, [key]: field }));
        window.setTimeout(() => {
            setSavedFields((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }, 2000);
    };

    const onSaveBrandKit = async () => {
        setBrandKitBusy(true);
        setBrandKitError(null);
        try {
            const updated = await updateBrandKit({
                spoken_name: editSpokenName.trim() || null,
                voice_name: editVoice,
            });
            setBrandKit(updated);
            setBrandKitExpanded(false);
        } catch (err) {
            setBrandKitError(mapApiError(err, BRAND_KIT_ERROR));
        } finally {
            setBrandKitBusy(false);
        }
    };

    const onUploadProduct = async (file: File | null) => {
        if (!file) return;
        setBrandKitBusy(true);
        setBrandKitError(null);
        try {
            const updated = await uploadBrandKitProduct(file);
            setBrandKit(updated);
        } catch (err) {
            setBrandKitError(mapApiError(err, BRAND_KIT_ERROR));
        } finally {
            setBrandKitBusy(false);
        }
    };

    const onCreateStoryboard = async () => {
        const trimmed = idea.trim();
        if (trimmed.length < IDEA_MIN || trimmed.length > IDEA_MAX || !hasProductPhoto) {
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            await createMarketingPostAd(postId, {
                idea: trimmed,
                scene_count: sceneCount,
                resolution,
                presenter_mode: 'none',
            });
            setIdea('');
            await refreshAds();
        } catch (err) {
            setCreateError(mapApiError(err, CREATE_ERROR));
        } finally {
            setCreating(false);
        }
    };

    const onPatchScene = async (
        ad: MarketingAd,
        sceneId: number,
        body: { description?: string; voice_line?: string },
        field: SavedField,
    ) => {
        try {
            const updated = await patchMarketingAdScene(postId, ad.id, sceneId, body);
            setAds((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
            markSaved(sceneId, field);
        } catch (err) {
            setError(mapApiError(err, CREATE_ERROR));
        }
    };

    const onApprove = async (ad: MarketingAd) => {
        const cost = formatCost(ad.estimated_cost_usd);
        const ok = window.confirm(
            `Rendering takes about 6 minutes and charges ${cost}. Continue?`,
        );
        if (!ok) return;
        setBusy(true);
        setError(null);
        try {
            await approveMarketingAd(postId, ad.id);
            await refreshAds();
        } catch (err) {
            setError(mapApiError(err, APPROVE_ERROR));
        } finally {
            setBusy(false);
        }
    };

    const onDelete = async (adId: number) => {
        setBusy(true);
        setError(null);
        try {
            await deleteMarketingAd(postId, adId);
            await refreshAds();
        } catch (err) {
            setError(mapApiError(err, DELETE_ERROR));
        } finally {
            setBusy(false);
        }
    };

    const onRetry = async (ad: MarketingAd) => {
        setBusy(true);
        setError(null);
        try {
            await approveMarketingAd(postId, ad.id);
            await refreshAds();
        } catch (err) {
            setError(mapApiError(err, APPROVE_ERROR));
        } finally {
            setBusy(false);
        }
    };

    const createDisabled =
        creating || busy || !hasProductPhoto || idea.trim().length < IDEA_MIN;

    if (loading) {
        return <p className="text-xs text-[#6B7280]">Loading ads…</p>;
    }

    return (
        <div className="space-y-4">
            {error && (
                <p className="text-xs text-red-700 leading-snug" role="alert">
                    {error}
                </p>
            )}

            {/* Brand Kit strip */}
            <div className="rounded-lg border border-[#E4E7EC] bg-white p-3">
                {!brandKitExpanded ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#374151]">
                        <span>
                            Product photo:{' '}
                            <strong>{hasProductPhoto ? '✓ set' : 'not set'}</strong>
                        </span>
                        <span className="text-[#D1D5DB]">·</span>
                        <span>
                            Spoken as:{' '}
                            <strong>{brandKit?.spoken_name?.trim() || '—'}</strong>
                        </span>
                        <span className="text-[#D1D5DB]">·</span>
                        <span>
                            Voice: <strong>{voiceShortName(brandKit?.voice_name)}</strong>
                        </span>
                        <button
                            type="button"
                            className="ml-auto text-[11px] font-bold text-violet-700 hover:text-violet-900"
                            onClick={() => setBrandKitExpanded(true)}
                        >
                            Edit
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className={fieldLabelClassName}>Brand Kit</span>
                            <button
                                type="button"
                                className="text-[11px] font-bold text-[#6B7280] hover:text-[#111827]"
                                onClick={() => setBrandKitExpanded(false)}
                            >
                                Collapse
                            </button>
                        </div>
                        <div>
                            <label className={fieldLabelClassName}>Product photo</label>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                disabled={brandKitBusy}
                                onChange={(e) => void onUploadProduct(e.target.files?.[0] ?? null)}
                                className="block w-full text-xs text-[#374151]"
                            />
                        </div>
                        <div>
                            <label className={fieldLabelClassName}>Spoken name</label>
                            <input
                                type="text"
                                maxLength={120}
                                value={editSpokenName}
                                disabled={brandKitBusy}
                                onChange={(e) => setEditSpokenName(e.target.value)}
                                className={inputClassName}
                                placeholder="How the company name is said aloud"
                            />
                        </div>
                        <div>
                            <label className={fieldLabelClassName}>Voice</label>
                            <select
                                value={editVoice}
                                disabled={brandKitBusy}
                                onChange={(e) => setEditVoice(e.target.value as MarketingAdVoice)}
                                className={selectClassName}
                            >
                                {VOICE_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {brandKitError && (
                            <p className="text-xs text-red-700">{brandKitError}</p>
                        )}
                        <button
                            type="button"
                            disabled={brandKitBusy}
                            onClick={() => void onSaveBrandKit()}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-40"
                        >
                            Save
                        </button>
                    </div>
                )}
            </div>

            {/* Storyboard editor — newest draft, above list */}
            {draftAd && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#111827]">
                            Storyboard draft
                        </span>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onDelete(draftAd.id)}
                            className="text-[11px] font-bold text-[#6B7280] hover:text-red-700 disabled:opacity-40"
                        >
                            Discard
                        </button>
                    </div>
                    <p className="text-xs text-[#6B7280] leading-snug">{draftAd.idea}</p>
                    {draftAd.scenes
                        .slice()
                        .sort((a, b) => a.position - b.position)
                        .map((scene) => (
                            <DraftSceneFields
                                key={scene.id}
                                scene={scene}
                                disabled={busy}
                                savedDescription={savedFields[`${scene.id}:description`] === 'description'}
                                savedVoiceLine={savedFields[`${scene.id}:voice_line`] === 'voice_line'}
                                onSaveDescription={(value) =>
                                    void onPatchScene(
                                        draftAd,
                                        scene.id,
                                        { description: value },
                                        'description',
                                    )
                                }
                                onSaveVoiceLine={(value) =>
                                    void onPatchScene(
                                        draftAd,
                                        scene.id,
                                        { voice_line: value },
                                        'voice_line',
                                    )
                                }
                            />
                        ))}
                    <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-violet-100">
                        <p className="text-xs font-semibold text-[#374151]">
                            This ad costs{' '}
                            <strong>{formatCost(draftAd.estimated_cost_usd)}</strong> from your
                            AI budget
                        </p>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onApprove(draftAd)}
                            className="text-[11px] font-extrabold px-3 py-2 rounded-md border border-violet-600 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
                        >
                            Approve and render — {formatCost(draftAd.estimated_cost_usd)}
                        </button>
                    </div>
                </div>
            )}

            {/* Existing ads list */}
            {listedAds.length > 0 && (
                <ul className="space-y-3">
                    {listedAds.map((row) => {
                        const progress = sceneProgressLine(row);
                        return (
                            <li
                                key={row.id}
                                className="rounded-lg border border-[#E4E7EC] bg-white p-3"
                            >
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span
                                        className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${
                                            STATUS_STYLE[row.status] ?? STATUS_STYLE.draft
                                        }`}
                                    >
                                        {row.status}
                                    </span>
                                    <span className="text-xs font-bold text-[#111827]">
                                        {truncateIdea(row.idea)}
                                    </span>
                                    <span className="text-xs text-[#6B7280]">
                                        {row.scene_count} × 8s · {row.resolution}
                                    </span>
                                    <span className="text-xs text-[#6B7280]">
                                        {formatCost(row.estimated_cost_usd)}
                                    </span>
                                    <span className="text-[10px] font-mono text-[#9CA3AF] ml-auto">
                                        {formatDateTime(row.created_at)}
                                    </span>
                                </div>

                                {progress && (
                                    <p className="text-xs text-[#6B7280] inline-flex items-center gap-2 mb-2">
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        {progress}
                                    </p>
                                )}

                                {row.status === 'ready' && row.url && (
                                    <div className="space-y-2">
                                        <video
                                            controls
                                            preload="metadata"
                                            src={row.url}
                                            className="w-full rounded-md bg-black max-h-48"
                                        />
                                        <div className="flex gap-2">
                                            <a
                                                href={row.url}
                                                download
                                                className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-[#374151] hover:bg-[#F1F3F6]"
                                            >
                                                Download
                                            </a>
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
                                                disabled={busy}
                                                onClick={() => void onRetry(row)}
                                                className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-40"
                                            >
                                                Retry
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

                                {row.status === 'draft' && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void onDelete(row.id)}
                                        className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-[#6B7280] hover:bg-[#F1F3F6] disabled:opacity-40"
                                    >
                                        Delete
                                    </button>
                                )}

                                {!['ready', 'failed', 'draft'].includes(row.status) && (
                                    <button
                                        type="button"
                                        disabled={busy || isDeleteDisabled(row.status)}
                                        onClick={() => void onDelete(row.id)}
                                        className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-[#6B7280] hover:bg-[#F1F3F6] disabled:opacity-40"
                                    >
                                        Delete
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Create form */}
            <div className="rounded-lg border border-[#E4E7EC] bg-[#F7F8FA] p-3 space-y-3">
                {!hasProductPhoto && (
                    <p className="text-xs font-semibold text-[#6B7280]">{NO_PRODUCT_HINT}</p>
                )}

                <div>
                    <label className={fieldLabelClassName}>Ad idea</label>
                    <AutoGrowTextarea
                        value={idea}
                        disabled={createDisabled}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder="e.g. Bettano 20W-50 for workshops in Queens that need same-day delivery"
                        className={inputClassName}
                    />
                    <p className="text-[10px] text-[#9CA3AF] mt-1 text-right">
                        {idea.trim().length}/{IDEA_MAX}
                    </p>
                </div>

                <div>
                    <span className={fieldLabelClassName}>Length</span>
                    <div className="grid grid-cols-2 gap-2">
                        {(
                            [
                                { count: 3 as const, label: '24 seconds · 3 scenes' },
                                { count: 6 as const, label: '48 seconds · 6 scenes' },
                            ] as const
                        ).map((option) => (
                            <label
                                key={option.count}
                                className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-xs font-semibold ${
                                    sceneCount === option.count
                                        ? 'border-violet-500 bg-violet-50 text-violet-900'
                                        : 'border-[#E4E7EC] bg-white text-[#374151]'
                                } ${createDisabled ? 'opacity-40 pointer-events-none' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="ad-scene-count"
                                    value={option.count}
                                    checked={sceneCount === option.count}
                                    disabled={createDisabled}
                                    onChange={() => setSceneCount(option.count)}
                                    className="sr-only"
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <span className={fieldLabelClassName}>Quality</span>
                    <div className="grid grid-cols-2 gap-2">
                        {(
                            [
                                { res: '720p' as const, label: 'Standard · 720p' },
                                { res: '1080p' as const, label: 'Studio · 1080p' },
                            ] as const
                        ).map((option) => (
                            <label
                                key={option.res}
                                className={`flex flex-col rounded-md border px-3 py-2 cursor-pointer ${
                                    resolution === option.res
                                        ? 'border-violet-500 bg-violet-50 text-violet-900'
                                        : 'border-[#E4E7EC] bg-white text-[#374151]'
                                } ${createDisabled ? 'opacity-40 pointer-events-none' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="ad-resolution"
                                    value={option.res}
                                    checked={resolution === option.res}
                                    disabled={createDisabled}
                                    onChange={() => setResolution(option.res)}
                                    className="sr-only"
                                />
                                <span className="text-xs font-semibold">{option.label}</span>
                                <span className="text-[10px] font-mono text-[#6B7280]">
                                    {veoPreviewUsd(sceneCount, option.res)}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {createError && (
                    <p className="text-xs text-red-700 leading-snug" role="alert">
                        {createError}
                    </p>
                )}

                <button
                    type="button"
                    disabled={createDisabled}
                    onClick={() => void onCreateStoryboard()}
                    className="w-full text-[11px] font-extrabold px-3 py-2 rounded-md border border-violet-600 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
                >
                    {creating ? 'Writing…' : 'Write the storyboard'}
                </button>
            </div>
        </div>
    );
}
