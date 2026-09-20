import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AdPanel from './AdPanel';
import VideoPanel from './VideoPanel';
import {
    listMarketingPostAds,
    listMarketingPostVideos,
    type MarketingAd,
    type MarketingPost,
    type MarketingVideo,
} from '../../services/api';
import { formatDateTime } from '../../utils/formatters';

/** Staging ad 5 presigned URL placeholder — render example row only when non-empty. */
export const EXAMPLE_AD_URL = '';

const POLL_INTERVAL_MS = 5000;
const MAX_LIST_ROWS = 10;

const CLIP_STATUS_STYLE: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-600',
    rendering: 'bg-blue-100 text-blue-700',
    ready: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
};

const AD_STATUS_STYLE: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    approved: 'bg-amber-100 text-amber-800',
    rendering: 'bg-blue-100 text-blue-700',
    assembling: 'bg-blue-100 text-blue-700',
    ready: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
};

const CLIP_PRICE_PER_SECOND: Record<string, number> = {
    '480p': 0.04,
    '580p': 0.06,
    '720p': 0.08,
};

const LIPSYNC_COST_PER_MINUTE_USD = 0.70;

type StudioChoice = 'clip' | 'ad' | null;

type UnifiedRow =
    | { kind: 'clip'; createdAt: string; row: MarketingVideo }
    | { kind: 'ad'; createdAt: string; row: MarketingAd };

function lipsyncCost(duration: number): number {
    return (LIPSYNC_COST_PER_MINUTE_USD * duration) / 60;
}

function clipCostLabel(row: MarketingVideo): string {
    const rate = CLIP_PRICE_PER_SECOND[row.resolution] ?? 0.08;
    const base = rate * row.duration_seconds;
    const extra = row.lipsync ? lipsyncCost(row.duration_seconds) : 0;
    return `$${(base + extra).toFixed(2)}`;
}

function clipSummary(row: MarketingVideo): string {
    if (row.custom_prompt?.trim()) return 'Custom prompt';
    const parts = [row.camera, row.scene, row.mood].filter(Boolean);
    if (parts.length === 0 && row.preset) return row.preset;
    return parts.join(' · ') || 'Quick clip';
}

function adProgressLine(ad: MarketingAd): string | null {
    if (!['approved', 'rendering', 'assembling'].includes(ad.status)) return null;
    const idx = ad.scenes.findIndex((scene) => scene.status !== 'ready');
    const current = idx === -1 ? ad.scene_count : idx + 1;
    return `Scene ${current} of ${ad.scene_count}`;
}

function clipProgress(row: MarketingVideo): string | null {
    if (row.status === 'queued') return 'Queued…';
    if (row.status === 'rendering') return 'Rendering…';
    return null;
}

function productHintFromPost(post: MarketingPost): string | undefined {
    const hint = (post as MarketingPost & { product_hint?: string }).product_hint;
    if (hint?.trim()) return hint.trim();
    const products = post.source_context?.products;
    if (products?.[0]?.trim()) return products[0].trim();
    return undefined;
}

function buildUnifiedRows(videos: MarketingVideo[], ads: MarketingAd[]): UnifiedRow[] {
    const draftId = ads.find((row) => row.status === 'draft')?.id;
    const adRows = draftId ? ads.filter((row) => row.id !== draftId) : ads;
    const merged: UnifiedRow[] = [
        ...videos.map((row) => ({ kind: 'clip' as const, createdAt: row.created_at, row })),
        ...adRows.map((row) => ({ kind: 'ad' as const, createdAt: row.created_at, row })),
    ];
    merged.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return merged.slice(0, MAX_LIST_ROWS);
}

function VideoThumb({ url }: { url: string | null }) {
    if (!url) {
        return (
            <div className="w-11 h-[4.875rem] rounded bg-[#E5E7EB] shrink-0" aria-hidden />
        );
    }
    return (
        <video
            src={url}
            preload="metadata"
            muted
            playsInline
            className="w-11 h-[4.875rem] rounded bg-black object-cover shrink-0"
        />
    );
}

export default function VideoTab({ post }: { post: MarketingPost }) {
    const [choice, setChoice] = useState<StudioChoice>(null);
    const [videos, setVideos] = useState<MarketingVideo[]>([]);
    const [ads, setAds] = useState<MarketingAd[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [toast, setToast] = useState<string | null>(null);

    const hasImage = !!post.media_url;
    const productHint = productHintFromPost(post);

    const refreshList = useCallback(async () => {
        const [videoRows, adRows] = await Promise.all([
            listMarketingPostVideos(post.id),
            listMarketingPostAds(post.id),
        ]);
        setVideos(videoRows);
        setAds(adRows);
    }, [post.id]);

    useEffect(() => {
        let cancelled = false;
        setLoadingList(true);
        void refreshList()
            .catch(() => {
                /* list errors are non-blocking; panels show their own errors */
            })
            .finally(() => {
                if (!cancelled) setLoadingList(false);
            });
        const pollId = window.setInterval(() => {
            void refreshList().catch(() => {
                /* keep polling on transient errors */
            });
        }, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(pollId);
        };
    }, [refreshList]);

    const unifiedRows = useMemo(() => buildUnifiedRows(videos, ads), [videos, ads]);
    const isEmpty = videos.length === 0 && ads.length === 0;

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(null), 2500);
    };

    const onUseOnPost = async (url: string) => {
        // TODO: MarketingPost has no video_url field yet — wire when backend adds it.
        try {
            await navigator.clipboard.writeText(url);
            showToast('Copied link');
        } catch {
            showToast("Couldn't copy link");
        }
    };

    const choiceCardClass = (selected: boolean) =>
        `rounded-lg border-2 p-4 cursor-pointer text-left transition-colors ${
            selected
                ? 'border-violet-600 bg-violet-50/60'
                : 'border-[#E4E7EC] bg-white hover:border-gray-300'
        }`;

    return (
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F8FA] p-4 sm:p-6">
            {toast && (
                <div
                    role="status"
                    className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-[#111827] text-white text-xs font-bold px-4 py-2 shadow-lg"
                >
                    {toast}
                </div>
            )}

            <div className="max-w-3xl mx-auto space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setChoice('clip')}
                        className={choiceCardClass(choice === 'clip')}
                    >
                        <div className="text-sm font-extrabold text-[#111827]">Quick Clip</div>
                        <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                            For a daily post. One shot from your post image, 5–10 seconds.
                        </p>
                        <p className="text-[11px] font-semibold text-violet-700 mt-2">
                            From $0.40 · about 2 min
                        </p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setChoice('ad')}
                        className={choiceCardClass(choice === 'ad')}
                    >
                        <div className="text-sm font-extrabold text-[#111827]">Studio Ad</div>
                        <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                            For a campaign. 24 or 48 seconds, your product in every scene,
                            narrated.
                        </p>
                        <p className="text-[11px] font-semibold text-violet-700 mt-2">
                            From $2.40 · about 6 min
                        </p>
                    </button>
                </div>

                {choice === 'clip' && (
                    <VideoPanel postId={post.id} hasImage={hasImage} showList={false} />
                )}
                {choice === 'ad' && (
                    <AdPanel
                        postId={post.id}
                        hasImage={hasImage}
                        showList={false}
                        productHint={productHint}
                    />
                )}

                <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mb-3">
                        Your videos on this post
                    </div>

                    {loadingList ? (
                        <p className="text-xs text-[#6B7280] inline-flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Loading…
                        </p>
                    ) : isEmpty ? (
                        <div className="space-y-3">
                            <p className="text-xs text-[#6B7280]">
                                You haven&apos;t made a video for this post yet.
                            </p>
                            {EXAMPLE_AD_URL ? (
                                <div className="rounded-lg border border-[#E4E7EC] bg-white p-3">
                                    <div className="flex gap-3">
                                        <VideoThumb url={EXAMPLE_AD_URL} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                                    Example
                                                </span>
                                                <span className="text-xs font-bold text-[#111827]">
                                                    Example · what a Studio Ad looks like
                                                </span>
                                            </div>
                                            <video
                                                controls
                                                preload="metadata"
                                                src={EXAMPLE_AD_URL}
                                                className="mt-2 w-full max-w-xs rounded-md bg-black"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {unifiedRows.map((item) => {
                                if (item.kind === 'clip') {
                                    const row = item.row;
                                    const progress = clipProgress(row);
                                    const ready = row.status === 'ready' && row.url;
                                    return (
                                        <li
                                            key={`clip-${row.id}`}
                                            className="rounded-lg border border-[#E4E7EC] bg-white p-3"
                                        >
                                            <div className="flex gap-3">
                                                <VideoThumb url={ready ? row.url : null} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-violet-100 text-violet-800">
                                                            Quick Clip
                                                        </span>
                                                        <span
                                                            className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${
                                                                CLIP_STATUS_STYLE[row.status] ??
                                                                CLIP_STATUS_STYLE.queued
                                                            }`}
                                                        >
                                                            {row.status}
                                                        </span>
                                                        <span className="text-xs text-[#6B7280]">
                                                            {row.duration_seconds}s · {row.resolution}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-[#374151] mt-1.5 leading-snug">
                                                        {clipSummary(row)}
                                                        {' · '}
                                                        {clipCostLabel(row)}
                                                        {' · '}
                                                        {formatDateTime(row.created_at)}
                                                    </p>
                                                    {progress && (
                                                        <p className="text-xs text-[#6B7280] mt-1.5 inline-flex items-center gap-2">
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                            {progress}
                                                        </p>
                                                    )}
                                                    {ready && (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => void onUseOnPost(row.url!)}
                                                                className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                                                            >
                                                                Use on post
                                                            </button>
                                                            <a
                                                                href={row.url!}
                                                                download
                                                                className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-[#374151] hover:bg-[#F1F3F6]"
                                                            >
                                                                Download
                                                            </a>
                                                        </div>
                                                    )}
                                                    {row.status === 'failed' && row.error_message && (
                                                        <p className="text-xs text-red-700 mt-1.5">
                                                            {row.error_message}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                }

                                const row = item.row;
                                const progress = adProgressLine(row);
                                const ready = row.status === 'ready' && row.url;
                                const durationSec = row.scene_count * 8;
                                return (
                                    <li
                                        key={`ad-${row.id}`}
                                        className="rounded-lg border border-[#E4E7EC] bg-white p-3"
                                    >
                                        <div className="flex gap-3">
                                            <VideoThumb url={ready ? row.url : null} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-pink-100 text-pink-800">
                                                        Studio Ad
                                                    </span>
                                                    <span
                                                        className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${
                                                            AD_STATUS_STYLE[row.status] ??
                                                            AD_STATUS_STYLE.draft
                                                        }`}
                                                    >
                                                        {row.status}
                                                    </span>
                                                    <span className="text-xs text-[#6B7280]">
                                                        {durationSec}s · {row.resolution}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[#374151] mt-1.5 leading-snug">
                                                    {row.idea.trim()}
                                                    {' · '}$
                                                    {row.estimated_cost_usd.toFixed(2)}
                                                    {' · '}
                                                    {formatDateTime(row.created_at)}
                                                </p>
                                                {progress && (
                                                    <p className="text-xs text-[#6B7280] mt-1.5 inline-flex items-center gap-2">
                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                        {progress}
                                                    </p>
                                                )}
                                                {ready && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => void onUseOnPost(row.url!)}
                                                            className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                                                        >
                                                            Use on post
                                                        </button>
                                                        <a
                                                            href={row.url!}
                                                            download
                                                            className="text-[11px] font-bold px-3 py-1.5 rounded-md border border-[#E4E7EC] bg-white text-[#374151] hover:bg-[#F1F3F6]"
                                                        >
                                                            Download
                                                        </a>
                                                    </div>
                                                )}
                                                {row.status === 'failed' && row.error_message && (
                                                    <p className="text-xs text-red-700 mt-1.5">
                                                        {row.error_message}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
