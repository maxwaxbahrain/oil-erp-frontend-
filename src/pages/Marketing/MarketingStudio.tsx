import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type MouseEvent as ReactMouseEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import AutoGrowTextarea from '../../components/AutoGrowTextarea';
import { getCurrentUser } from '../../store/authStore';
import {
    discardMarketingCandidates,
    editMarketingPostImage,
    downloadMarketingPostMedia,
    generateMarketingPostImage,
    getMarketingPost,
    isMarketingCandidateBatch,
    listMarketingCandidates,
    listMarketingConnections,
    pickMarketingCandidate,
    publishMarketingPost,
    revertMarketingPostImage,
    updateMarketingPost,
    uploadMarketingPostMedia,
    type MarketingCandidateBatch,
    type MarketingConnection,
    type MarketingImageCount,
    type MarketingImageQuality,
    type MarketingImageShape,
    type MarketingPost,
} from '../../services/api';
import {
    mapEditImageError,
    mapGenerateImageError,
    mapMediaError,
    mapPublishError,
} from './MarketingQueue';
import VideoPanel from './VideoPanel';

type StudioMode = 'generate' | 'edit';
type CanvasView = 'current' | 'compare' | 'sheet';
type CaptionSaveState = 'saved' | 'unsaved' | 'saving';

const PROMPT_MAX = 1000;
const CAPTION_MAX = 3000;
const BRANDING_SUFFIX = ', keep the product and all branding exactly as it is';

const IMAGE_RATES = {
    standard: { generate: 0.035, edit: 0.035 },
    quality: { generate: 0.03, edit: 0.045 },
} as const;

const COUNT_OPTIONS: MarketingImageCount[] = [1, 2, 4];

const QUALITY_OPTIONS: {
    id: MarketingImageQuality;
    label: string;
    sub: string;
}[] = [
    { id: 'standard', label: 'Standard', sub: 'Products, labels, text' },
    { id: 'quality', label: 'Quality', sub: 'Faces and hands' },
];

const SHAPES: {
    id: MarketingImageShape;
    label: string;
    sub: string;
    boxClass: string;
}[] = [
    { id: 'square', label: 'Square', sub: '1080', boxClass: 'w-[19px] h-[19px]' },
    { id: 'portrait', label: 'Portrait', sub: '4:5', boxClass: 'w-[15px] h-[19px]' },
    { id: 'landscape', label: 'Feed', sub: '1.91:1', boxClass: 'w-[23px] h-[13px]' },
    { id: 'story', label: 'Story', sub: '9:16', boxClass: 'w-[11px] h-[20px]' },
];

const PRESETS: { title: string; body: string }[] = [
    {
        title: 'Trade show counter',
        body: 'Display counter, blurred visitors, exhibition lighting',
    },
    {
        title: 'Workshop bench',
        body: 'Repair bay, mechanic behind, warm work light',
    },
    {
        title: 'Studio white',
        body: 'Seamless backdrop, soft shadow, catalogue style',
    },
    {
        title: 'Delivery van',
        body: 'On a tailgate, city street, morning light',
    },
];

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatUsd(amount: number): string {
    return `$${amount.toFixed(2)}`;
}

function actionButtonLabel(
    mode: StudioMode,
    quality: MarketingImageQuality,
    count: MarketingImageCount,
): { main: string; cost: string } {
    const rate = IMAGE_RATES[quality][mode === 'generate' ? 'generate' : 'edit'];
    const total = rate * count;
    if (count === 1) {
        return {
            main: mode === 'generate' ? 'Generate image' : 'Edit photo',
            cost: formatUsd(total),
        };
    }
    const noun = mode === 'generate' ? 'versions' : 'edits';
    return { main: `Make ${count} ${noun}`, cost: formatUsd(total) };
}

function workingLabelFor(mode: StudioMode, count: MarketingImageCount): string {
    if (count === 1) return mode === 'edit' ? 'Editing…' : 'Generating…';
    const noun = mode === 'generate' ? 'versions' : 'edits';
    return `Making ${count} ${noun}…`;
}

function candidateNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
}

export default function MarketingStudio() {
    const { postId: postIdParam } = useParams<{ postId: string }>();
    const postId = Number(postIdParam);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const compareRef = useRef<HTMLDivElement>(null);

    const [post, setPost] = useState<MarketingPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<StudioMode>('edit');
    const [shape, setShape] = useState<MarketingImageShape>('square');
    const [quality, setQuality] = useState<MarketingImageQuality>('standard');
    const [count, setCount] = useState<MarketingImageCount>(1);
    const [prompt, setPrompt] = useState('');
    const [caption, setCaption] = useState('');
    const [captionSave, setCaptionSave] = useState<CaptionSaveState>('saved');
    const [canvasView, setCanvasView] = useState<CanvasView>('current');
    const [candidateBatch, setCandidateBatch] = useState<MarketingCandidateBatch | null>(null);
    const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
    const [comparePos, setComparePos] = useState(52);
    const [dragging, setDragging] = useState(false);
    const [working, setWorking] = useState(false);
    const [workingLabel, setWorkingLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [connections, setConnections] = useState<MarketingConnection[] | null>(null);
    const [showPublishPicker, setShowPublishPicker] = useState(false);

    const user = getCurrentUser();

    const loadPost = useCallback(async (opts?: { silent?: boolean }) => {
        if (!Number.isFinite(postId) || postId <= 0) {
            setError('Invalid post.');
            if (!opts?.silent) setLoading(false);
            return false;
        }
        if (!opts?.silent) {
            setLoading(true);
            setError(null);
        }
        try {
            const [row, batch] = await Promise.all([
                getMarketingPost(postId),
                listMarketingCandidates(postId),
            ]);
            setPost(row);
            setCaption(row.body);
            setCaptionSave('saved');
            if (!row.media_url) setMode('generate');
            if (batch.candidates.length > 0) {
                setCandidateBatch(batch);
                setSelectedCandidateId((prev) => {
                    if (prev !== null && batch.candidates.some((c) => c.id === prev)) {
                        return prev;
                    }
                    return batch.candidates[0]?.id ?? null;
                });
            } else {
                setCandidateBatch(null);
                setSelectedCandidateId(null);
            }
            return batch.candidates.length > 0;
        } catch {
            if (!opts?.silent) {
                setError("Couldn't load this post. Check your connection and try again.");
                setPost(null);
            }
            return false;
        } finally {
            if (!opts?.silent) setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        void (async () => {
            const hasBatch = await loadPost();
            if (hasBatch) setCanvasView('sheet');
        })();
    }, [loadPost]);

    useEffect(() => {
        if (!candidateBatch?.candidates.length && canvasView === 'sheet') {
            setCanvasView('current');
        }
    }, [candidateBatch, canvasView]);

    const canCompare =
        !!post?.original_media_url &&
        !!post?.media_url &&
        post.original_media_url !== post.media_url;

    const canRevert = canCompare;

    useEffect(() => {
        if (!canCompare && canvasView === 'compare') {
            setCanvasView('current');
        }
    }, [canCompare, canvasView]);

    const onCompareMove = (clientX: number) => {
        const el = compareRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
        setComparePos(x);
    };

    const onCompareMouseDown = (e: ReactMouseEvent) => {
        e.preventDefault();
        setDragging(true);
    };

    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: MouseEvent) => onCompareMove(e.clientX);
        const onUp = () => setDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [dragging]);

    const onReplaceClick = () => {
        if (busy || working || post?.status === 'posted') return;
        fileInputRef.current?.click();
    };

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !post) return;
        setBusy(true);
        setError(null);
        void (async () => {
            try {
                const updated = await uploadMarketingPostMedia(post.id, file);
                setPost(updated);
                setMode('edit');
                await loadPost({ silent: true });
            } catch (err) {
                setError(mapMediaError(err));
            } finally {
                setBusy(false);
            }
        })();
    };

    const onMakeImage = () => {
        const trimmed = prompt.trim();
        if (trimmed.length < 3 || !post || working || busy) return;

        const isEdit = mode === 'edit';
        if (isEdit && !post.media_url) {
            setError('Upload or generate an image first.');
            return;
        }

        setWorking(true);
        setWorkingLabel(workingLabelFor(mode, count));
        setError(null);
        void (async () => {
            try {
                const apiPrompt = isEdit ? `${trimmed}${BRANDING_SUFFIX}` : trimmed;
                const result = isEdit
                    ? await editMarketingPostImage(post.id, apiPrompt, shape, quality, count)
                    : await generateMarketingPostImage(post.id, apiPrompt, shape, quality, count);
                if (isMarketingCandidateBatch(result)) {
                    setCandidateBatch(result);
                    setSelectedCandidateId(result.candidates[0]?.id ?? null);
                    setCanvasView('sheet');
                } else {
                    setPost(result);
                    setCandidateBatch(null);
                    setSelectedCandidateId(null);
                    setCanvasView('current');
                }
            } catch (err) {
                setError(isEdit ? mapEditImageError(err) : mapGenerateImageError(err));
            } finally {
                setWorking(false);
                setWorkingLabel('');
            }
        })();
    };

    const onPickCandidate = () => {
        if (!post || selectedCandidateId === null || busy || working || posted) return;
        setBusy(true);
        setError(null);
        void (async () => {
            try {
                await pickMarketingCandidate(post.id, selectedCandidateId);
                setCanvasView('current');
                await loadPost({ silent: true });
            } catch {
                setError("Couldn't apply that image. Try again.");
            } finally {
                setBusy(false);
            }
        })();
    };

    const onDiscardCandidates = () => {
        if (!post || !candidateBatch?.candidates.length || busy || working || posted) return;
        setBusy(true);
        setError(null);
        void (async () => {
            try {
                await discardMarketingCandidates(post.id);
                setCanvasView('current');
                await loadPost({ silent: true });
            } catch {
                setError("Couldn't discard the versions. Try again.");
            } finally {
                setBusy(false);
            }
        })();
    };

    const onRevert = () => {
        if (!post || !canRevert || busy || working) return;
        setBusy(true);
        setError(null);
        void (async () => {
            try {
                const updated = await revertMarketingPostImage(post.id);
                setPost(updated);
                setCanvasView('current');
                await loadPost({ silent: true });
            } catch (err) {
                const text = err instanceof Error ? err.message : String(err);
                if (text.includes('Nothing to revert')) {
                    setError('Nothing to revert to.');
                } else if (text.toLowerCase().includes('published')) {
                    setError("A published post can't be changed.");
                } else {
                    setError("Couldn't revert the image. Try again.");
                }
            } finally {
                setBusy(false);
            }
        })();
    };

    const onDownload = () => {
        if (!post?.media_url || downloading) return;
        setDownloading(true);
        setError(null);
        void (async () => {
            try {
                const blob = await downloadMarketingPostMedia(post.id);
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = post.media_file_name || 'image.png';
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(url);
            } catch {
                setError("Couldn't download the image. Try again.");
            } finally {
                setDownloading(false);
            }
        })();
    };

    const onCaptionBlur = () => {
        if (!post || post.status === 'posted') return;
        if (caption === post.body) {
            setCaptionSave('saved');
            return;
        }
        setCaptionSave('saving');
        void (async () => {
            try {
                const updated = await updateMarketingPost(post.id, { body: caption });
                setPost(updated);
                setCaptionSave('saved');
            } catch {
                setCaptionSave('unsaved');
                setError("Couldn't save the caption. Try again.");
            }
        })();
    };

    const loadConnections = async (): Promise<MarketingConnection[]> => {
        if (connections !== null) return connections;
        const rows = await listMarketingConnections();
        setConnections(rows);
        return rows;
    };

    const runPublish = (platformId: string) => {
        if (!post) return;
        setBusy(true);
        setError(null);
        setShowPublishPicker(false);
        void (async () => {
            try {
                const updated = await publishMarketingPost(post.id, platformId);
                setPost(updated);
                await loadPost({ silent: true });
            } catch (err) {
                setError(mapPublishError(err));
            } finally {
                setBusy(false);
            }
        })();
    };

    const onApproveAndPublish = () => {
        if (!post || busy || working) return;
        setBusy(true);
        setError(null);
        setShowPublishPicker(false);
        void (async () => {
            try {
                let current = post;
                if (current.status === 'draft') {
                    current = await updateMarketingPost(current.id, { status: 'approved' });
                    setPost(current);
                }
                if (current.status !== 'approved') return;

                const conns = await loadConnections();
                if (conns.length === 0) {
                    setError('No social accounts connected yet.');
                    return;
                }
                if (conns.length === 1) {
                    const updated = await publishMarketingPost(current.id, conns[0].platform_id);
                    setPost(updated);
                    return;
                }
                setShowPublishPicker(true);
            } catch (err) {
                setError(mapPublishError(err));
            } finally {
                setBusy(false);
            }
        })();
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#F7F8FA]">
                <RefreshCw size={28} className="text-gray-300 animate-spin" />
            </div>
        );
    }

    if (!post) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-[#F7F8FA] gap-4 p-6">
                <p className="text-sm font-bold text-red-800">{error || 'Post not found.'}</p>
                <Link to="/marketing/campaigns" className="text-sm font-bold text-violet-700 hover:text-violet-900">
                    ← Back to Queue
                </Link>
            </div>
        );
    }

    const shapeLabel = SHAPES.find((s) => s.id === shape)?.label ?? 'Square';
    const makeDisabled = working || busy || prompt.trim().length < 3 || (mode === 'edit' && !post.media_url);
    const posted = post.status === 'posted';
    const hasBatch = (candidateBatch?.candidates.length ?? 0) > 0;
    const actionLabel = actionButtonLabel(mode, quality, count);
    const batchCount = candidateBatch?.candidates.length ?? 0;

    return (
        <div className="h-screen overflow-hidden bg-[#F7F8FA] text-[#111827] text-sm flex flex-col">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFileChange}
            />

            {/* top chrome */}
            <div className="h-[50px] bg-[#111827] flex items-center px-4 gap-3.5 shrink-0">
                <Link
                    to="/marketing/campaigns"
                    className="text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10 px-2 py-1.5 rounded-md"
                >
                    ← Queue
                </Link>
                <div className="w-[23px] h-[23px] rounded-md bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center text-[11px] font-black text-white">
                    S
                </div>
                <div>
                    <div className="text-xs font-black uppercase tracking-widest text-white">Soltol One</div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Studio</div>
                </div>
                <div className="ml-auto text-[11px] text-gray-500 font-mono truncate max-w-[240px]">
                    {post.title}
                </div>
            </div>

            {/* gradient band */}
            <div className="bg-gradient-to-r from-purple-900 to-pink-900 px-[18px] py-3 flex items-center shrink-0">
                <div>
                    <h2 className="text-[19px] font-black uppercase tracking-wide text-white leading-none">Studio</h2>
                    <p className="text-[11.5px] text-white/60 mt-0.5">Make the picture, write the post, publish it</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm font-bold text-red-800 shrink-0">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-[344px_1fr_352px] flex-1 min-h-0 max-xl:grid-cols-[320px_1fr_330px] max-lg:grid-cols-[300px_1fr]">

                {/* LEFT */}
                <div className="border-r border-[#E4E7EC] bg-white flex flex-col min-h-0 overflow-hidden">
                    <div className="flex px-3.5 pt-3 gap-0.5 border-b border-[#EDEFF3]">
                        {(['generate', 'edit'] as StudioMode[]).map((m) => (
                            <button
                                key={m}
                                type="button"
                                disabled={posted}
                                onClick={() => setMode(m)}
                                className={`flex-1 py-2 border-none bg-transparent cursor-pointer text-[11px] font-extrabold uppercase tracking-widest border-b-2 -mb-px ${
                                    mode === m
                                        ? 'text-[#111827] border-violet-600'
                                        : 'text-[#9CA3AF] border-transparent'
                                } disabled:opacity-40`}
                            >
                                {m === 'generate' ? 'Generate' : 'Edit a photo'}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto px-3.5 py-4">
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mb-2">
                            Working from
                        </div>
                        <div className="flex gap-2.5 items-center bg-[#F1F3F6] border border-[#E4E7EC] rounded-lg p-2 mb-4">
                            <div className="w-[42px] h-[42px] rounded-md bg-gradient-to-br from-red-700 to-red-900 shrink-0 grid place-items-center overflow-hidden">
                                {post.media_url ? (
                                    <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-[6px] font-black text-white">IMG</span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold truncate">
                                    {post.media_file_name || (post.media_url ? 'Current image' : 'No image yet')}
                                </div>
                                <div className="text-[10px] text-[#9CA3AF] mt-0.5">
                                    {post.media_url ? 'Ready for editing' : 'Upload or generate first'}
                                </div>
                            </div>
                            {!posted && (
                                <button
                                    type="button"
                                    onClick={onReplaceClick}
                                    disabled={busy || working}
                                    className="text-[11px] font-bold text-violet-600 shrink-0 disabled:opacity-40"
                                >
                                    Replace
                                </button>
                            )}
                        </div>

                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mb-2">
                            {mode === 'generate' ? 'Describe the scene' : 'What should change'}
                        </div>
                        <div className="border border-[#E4E7EC] rounded-[11px] bg-white focus-within:border-violet-300 focus-within:ring-[3px] focus-within:ring-violet-100">
                            <AutoGrowTextarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                maxLength={PROMPT_MAX}
                                maxHeight={240}
                                disabled={posted || working}
                                placeholder={
                                    mode === 'generate'
                                        ? 'A modern warehouse with oil drums on pallets…'
                                        : 'Place this product on a busy workshop bench…'
                                }
                                className="w-full bg-transparent border-none resize-none text-[13.5px] leading-relaxed px-3 pt-3 pb-1 min-h-[84px] outline-none disabled:opacity-50"
                            />
                            <div className="flex items-center px-2.5 pb-2 pl-3">
                                <span className="text-[10.5px] text-[#9CA3AF] font-mono">
                                    {prompt.length} / {PROMPT_MAX}
                                </span>
                            </div>
                        </div>

                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mt-4 mb-2">
                            Size it for
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {SHAPES.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    disabled={posted || working}
                                    onClick={() => setShape(s.id)}
                                    className={`rounded-lg border px-1 py-2 flex flex-col items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                                        shape === s.id
                                            ? 'border-violet-600 bg-violet-50 text-violet-700'
                                            : 'border-[#E4E7EC] text-[#9CA3AF] hover:border-gray-300 hover:text-[#6B7280]'
                                    }`}
                                >
                                    <span className={`border-[1.5px] border-current rounded-sm ${s.boxClass}`} />
                                    <span className="text-[9px] font-extrabold uppercase leading-none">{s.label}</span>
                                    <span className="text-[8.5px] text-[#9CA3AF] font-mono">{s.sub}</span>
                                </button>
                            ))}
                        </div>

                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mt-4 mb-2">
                            Quality
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {QUALITY_OPTIONS.map((q) => (
                                <button
                                    key={q.id}
                                    type="button"
                                    disabled={posted || working}
                                    onClick={() => setQuality(q.id)}
                                    className={`rounded-lg border px-2 py-2.5 flex flex-col items-center gap-1 cursor-pointer disabled:opacity-40 ${
                                        quality === q.id
                                            ? 'border-violet-600 bg-violet-50 text-violet-700'
                                            : 'border-[#E4E7EC] text-[#9CA3AF] hover:border-gray-300 hover:text-[#6B7280]'
                                    }`}
                                >
                                    <span className="text-[9px] font-extrabold uppercase leading-none">{q.label}</span>
                                    <span className="text-[8.5px] text-center leading-tight opacity-80">{q.sub}</span>
                                </button>
                            ))}
                        </div>

                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mt-4 mb-2">
                            How many to try
                        </div>
                        <div className="flex gap-1.5">
                            {COUNT_OPTIONS.map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    disabled={posted || working}
                                    onClick={() => setCount(n)}
                                    className={`flex-1 rounded-lg border text-xs font-extrabold py-2 disabled:opacity-40 ${
                                        count === n
                                            ? 'border-violet-600 bg-violet-50 text-violet-700'
                                            : 'border-[#E4E7EC] text-[#9CA3AF] hover:border-gray-300 hover:text-[#6B7280]'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>

                        {!posted && (
                            <button
                                type="button"
                                disabled={makeDisabled}
                                onClick={onMakeImage}
                                className="w-full mt-4 border-none rounded-lg cursor-pointer bg-gradient-to-br from-violet-600 to-pink-600 text-white text-[13px] font-extrabold py-3 flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {actionLabel.main}
                                <span className="text-[10.5px] opacity-80 font-semibold">{actionLabel.cost}</span>
                            </button>
                        )}

                        {mode === 'edit' && (
                            <div className="mt-3.5 p-2.5 bg-[#FEF9EC] border border-[#FDE9C8] border-l-2 border-l-amber-700 rounded-r-lg rounded-l-sm">
                                <div className="text-[9.5px] font-extrabold uppercase tracking-widest text-amber-700 mb-1">
                                    Protecting your branding
                                </div>
                                <p className="text-[11.5px] text-amber-900 leading-snug">
                                    Every edit ends with{' '}
                                    <code className="bg-amber-100/80 px-1 rounded text-[10.5px] font-mono">
                                        keep the product and all branding exactly as it is
                                    </code>{' '}
                                    so your real label survives.
                                </p>
                            </div>
                        )}

                        <div className="mt-5">
                            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF] mb-2">
                                Start from
                            </div>
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset.title}
                                    type="button"
                                    disabled={posted || working}
                                    onClick={() => setPrompt(preset.body)}
                                    className="w-full text-left cursor-pointer bg-white border border-[#E4E7EC] rounded-lg px-3 py-2 mb-1.5 text-[11.5px] text-[#6B7280] leading-snug hover:border-gray-300 hover:bg-[#F1F3F6] disabled:opacity-40"
                                >
                                    <b className="block text-[#111827] text-[11.5px] mb-0.5">{preset.title}</b>
                                    {preset.body}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-[#EDEFF3] text-[10.5px] text-[#9CA3AF] leading-relaxed">
                            JPG, PNG or WebP · under 10 MB · at least 256×256.
                            <br />
                            1024px or larger on the long edge gives much better results.
                        </div>
                    </div>
                </div>

                {/* CENTRE */}
                <div className="flex flex-col bg-[#0C0C12] min-h-0 overflow-hidden">
                    <div className="h-[42px] border-b border-white/10 flex items-center px-4 gap-2.5 shrink-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">
                            {canvasView === 'sheet' && hasBatch ? (
                                <>
                                    Contact sheet · <b className="text-purple-500">{batchCount} versions</b> · {shapeLabel}
                                </>
                            ) : (
                                <>
                                    Preview · <b className="text-purple-500">{shapeLabel}</b>
                                </>
                            )}
                        </span>
                        <div className="ml-auto flex bg-white/5 border border-white/10 rounded-md p-0.5">
                            {hasBatch && (
                                <button
                                    type="button"
                                    onClick={() => setCanvasView('sheet')}
                                    className={`border-none cursor-pointer text-[10.5px] font-bold px-2.5 py-1 rounded ${
                                        canvasView === 'sheet' ? 'bg-white/10 text-gray-100' : 'bg-transparent text-gray-500'
                                    }`}
                                >
                                    Contact sheet
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setCanvasView('current')}
                                className={`border-none cursor-pointer text-[10.5px] font-bold px-2.5 py-1 rounded ${
                                    canvasView === 'current' ? 'bg-white/10 text-gray-100' : 'bg-transparent text-gray-500'
                                }`}
                            >
                                Current
                            </button>
                            {canCompare && (
                                <button
                                    type="button"
                                    onClick={() => setCanvasView('compare')}
                                    className={`border-none cursor-pointer text-[10.5px] font-bold px-2.5 py-1 rounded ${
                                        canvasView === 'compare' ? 'bg-white/10 text-gray-100' : 'bg-transparent text-gray-500'
                                    }`}
                                >
                                    Before / after
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-6 relative min-h-0 overflow-y-auto bg-[length:48px_48px] bg-[linear-gradient(rgba(255,255,255,0.014)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.014)_1px,transparent_1px)]">
                        {working && (
                            <div className="absolute inset-0 z-20 bg-black/50 grid place-items-center">
                                <p className="text-sm font-bold text-white inline-flex items-center gap-2">
                                    <RefreshCw size={16} className="animate-spin" />
                                    {workingLabel}
                                </p>
                            </div>
                        )}

                        {canvasView === 'sheet' && hasBatch && candidateBatch && (
                            <div className="w-full max-w-[540px] flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-3">
                                    {candidateBatch.candidates.map((cand, index) => (
                                        <button
                                            key={cand.id}
                                            type="button"
                                            onClick={() => setSelectedCandidateId(cand.id)}
                                            className={`relative aspect-square rounded overflow-hidden cursor-pointer border-2 shadow-2xl text-left p-0 ${
                                                selectedCandidateId === cand.id
                                                    ? 'border-violet-500'
                                                    : 'border-transparent hover:border-white/20'
                                            }`}
                                        >
                                            <span className="absolute top-1.5 left-2 text-[9px] font-black text-white/85 z-10 drop-shadow">
                                                {candidateNumber(index)}
                                            </span>
                                            {selectedCandidateId === cand.id && (
                                                <span className="absolute bottom-2 right-2 text-[9px] font-extrabold uppercase tracking-widest bg-violet-500 text-white px-2 py-0.5 rounded z-10">
                                                    Chosen
                                                </span>
                                            )}
                                            {cand.url ? (
                                                <img
                                                    src={cand.url}
                                                    alt={`Version ${candidateNumber(index)}`}
                                                    className="w-full h-full object-cover bg-black"
                                                />
                                            ) : (
                                                <div className="w-full h-full grid place-items-center bg-black/40 text-gray-500 text-xs font-bold">
                                                    No preview
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                {!posted && (
                                    <div className="flex gap-2 justify-center">
                                        <button
                                            type="button"
                                            disabled={selectedCandidateId === null || busy || working}
                                            onClick={onPickCandidate}
                                            className="rounded-md cursor-pointer text-[11.5px] font-extrabold px-4 py-2 border border-emerald-400 bg-emerald-400 text-emerald-950 hover:bg-emerald-300 disabled:opacity-40"
                                        >
                                            Use this one
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy || working}
                                            onClick={onDiscardCandidates}
                                            className="rounded-md cursor-pointer text-[11.5px] font-bold px-4 py-2 border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
                                        >
                                            Discard all
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {canvasView === 'current' && (
                            <div className="w-full max-w-[540px] aspect-square rounded relative overflow-hidden shadow-2xl bg-black/40">
                                {post.media_url ? (
                                    <img
                                        src={post.media_url}
                                        alt={post.media_file_name || 'Working image'}
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="w-full h-full grid place-items-center text-gray-500 text-sm font-bold">
                                        No image yet — generate or upload one
                                    </div>
                                )}
                            </div>
                        )}

                        {canvasView === 'compare' && canCompare && (
                            <div
                                ref={compareRef}
                                className="relative w-full max-w-[540px] aspect-square rounded overflow-hidden shadow-2xl select-none"
                            >
                                <img
                                    src={post.original_media_url!}
                                    alt="Original"
                                    className="absolute inset-0 w-full h-full object-contain bg-black"
                                />
                                <img
                                    src={post.media_url!}
                                    alt="Edited"
                                    className="absolute inset-0 w-full h-full object-contain bg-black"
                                    style={{ clipPath: `inset(0 0 0 ${comparePos}%)` }}
                                />
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-purple-500 z-10"
                                    style={{ left: `${comparePos}%` }}
                                />
                                <button
                                    type="button"
                                    aria-label="Drag to compare"
                                    onMouseDown={onCompareMouseDown}
                                    className="absolute top-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500 text-white text-xs font-bold grid place-items-center cursor-ew-resize z-20 border-none"
                                    style={{ left: `${comparePos}%` }}
                                >
                                    ⇄
                                </button>
                                <span className="absolute bottom-2 left-2 text-[9px] font-extrabold uppercase tracking-widest bg-black/60 text-white px-2 py-1 rounded z-10">
                                    Your photo
                                </span>
                                <span className="absolute bottom-2 right-2 text-[9px] font-extrabold uppercase tracking-widest bg-black/60 text-white px-2 py-1 rounded z-10">
                                    Edited
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-white/10 px-4 py-2.5 flex items-center gap-3 shrink-0">
                        <div className="ml-auto flex gap-2">
                            <button
                                type="button"
                                disabled={!post.media_url || busy || working || downloading}
                                onClick={onDownload}
                                className="rounded-md cursor-pointer text-[11.5px] font-bold px-3 py-2 border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
                            >
                                {downloading ? 'Downloading…' : 'Download'}
                            </button>
                            {canRevert && !posted && (
                                <button
                                    type="button"
                                    disabled={busy || working}
                                    onClick={onRevert}
                                    className="rounded-md cursor-pointer text-[11.5px] font-bold px-3 py-2 border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
                                >
                                    Revert to original
                                </button>
                            )}
                            <Link
                                to="/marketing/campaigns"
                                className="rounded-md text-[11.5px] font-extrabold px-3 py-2 border border-emerald-400 bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                            >
                                Save
                            </Link>
                        </div>
                    </div>

                    <div className="border-t border-white/10 px-4 py-4 shrink-0 overflow-y-auto max-h-[45%]">
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">
                            Video
                        </div>
                        <VideoPanel postId={post.id} hasImage={!!post.media_url} />
                    </div>
                </div>

                {/* RIGHT */}
                <div className="border-l border-[#E4E7EC] bg-white flex flex-col min-h-0 overflow-hidden max-lg:hidden">
                    <div className="flex px-3 pt-2.5 gap-0.5 border-b border-[#EDEFF3]">
                        <button type="button" className="flex-1 py-2 border-none bg-transparent text-[10.5px] font-extrabold border-b-2 border-violet-600 text-[#111827] -mb-px">
                            LinkedIn
                        </button>
                        <button type="button" disabled className="flex-1 py-2 border-none bg-transparent text-[10.5px] font-extrabold border-b-2 border-transparent text-[#9CA3AF] opacity-50">
                            Instagram <span className="block text-[8px] font-semibold normal-case">soon</span>
                        </button>
                        <button type="button" disabled className="flex-1 py-2 border-none bg-transparent text-[10.5px] font-extrabold border-b-2 border-transparent text-[#9CA3AF] opacity-50">
                            Facebook <span className="block text-[8px] font-semibold normal-case">soon</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 bg-[#F7F8FA]">
                        <div className="bg-white border border-[#E4E7EC] rounded-lg overflow-hidden">
                            <div className="flex gap-2 p-3 pb-2 items-center">
                                <div className="w-[33px] h-[33px] rounded-full bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center text-white text-xs font-black shrink-0">
                                    {initials(user.name)}
                                </div>
                                <div>
                                    <div className="text-[12.5px] font-bold leading-tight">{user.name}</div>
                                    <div className="text-[10.5px] text-[#6B7280] mt-0.5">Now</div>
                                </div>
                            </div>
                            <div className="px-3 pb-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap">
                                {caption || 'Your caption will appear here…'}
                            </div>
                            <div className="aspect-square bg-[#111] relative overflow-hidden">
                                {post.media_url ? (
                                    <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full grid place-items-center text-gray-600 text-xs">No image</div>
                                )}
                            </div>
                            <div className="flex gap-4 px-3 py-2 border-t border-[#EDEFF3] text-[11px] text-[#6B7280] font-semibold">
                                <span>Like</span>
                                <span>Comment</span>
                                <span>Repost</span>
                            </div>
                        </div>

                        <div className="mt-3.5">
                            <div className="flex items-center mb-1.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9CA3AF]">
                                    Caption
                                </span>
                                <span className="ml-auto text-[10px] text-[#9CA3AF] font-mono">
                                    {caption.length} / {CAPTION_MAX}
                                </span>
                                {captionSave === 'unsaved' && (
                                    <span className="ml-2 text-[10px] font-bold text-amber-700">Unsaved</span>
                                )}
                                {captionSave === 'saving' && (
                                    <span className="ml-2 text-[10px] font-bold text-gray-500">Saving…</span>
                                )}
                                {captionSave === 'saved' && caption === post.body && (
                                    <span className="ml-2 text-[10px] font-bold text-emerald-700">Saved</span>
                                )}
                            </div>
                            {posted ? (
                                <div>
                                    <div className="w-full bg-white border border-[#E4E7EC] rounded-lg text-[12.5px] leading-relaxed p-3 whitespace-pre-wrap text-[#6B7280] min-h-[130px]">
                                        {caption}
                                    </div>
                                    <p className="text-[10px] text-[#9CA3AF] mt-1.5">Published posts cannot be edited here.</p>
                                </div>
                            ) : (
                                <AutoGrowTextarea
                                    value={caption}
                                    onChange={(e) => {
                                        const next = e.target.value.slice(0, CAPTION_MAX);
                                        setCaption(next);
                                        setCaptionSave(next === post.body ? 'saved' : 'unsaved');
                                    }}
                                    onBlur={onCaptionBlur}
                                    maxLength={CAPTION_MAX}
                                    maxHeight={400}
                                    className="w-full bg-white border border-[#E4E7EC] rounded-lg text-[12.5px] leading-relaxed p-3 resize-none outline-none min-h-[130px] focus:border-violet-300 focus:ring-[3px] focus:ring-violet-100"
                                />
                            )}
                        </div>

                        {posted ? (
                            <p className="mt-4 text-[11px] font-bold text-purple-700">This post was published.</p>
                        ) : (
                            <>
                                {showPublishPicker && connections && connections.length > 1 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 w-full">
                                            Publish to
                                        </span>
                                        {connections.map((conn) => (
                                            <button
                                                key={conn.platform_id}
                                                type="button"
                                                disabled={busy}
                                                onClick={() => runPublish(conn.platform_id)}
                                                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 disabled:opacity-50"
                                            >
                                                {conn.platform}
                                                {conn.username ? ` · ${conn.username}` : ''}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    disabled={busy || working || post.status === 'archived'}
                                    onClick={onApproveAndPublish}
                                    className="w-full mt-3.5 bg-emerald-600 border-none rounded-lg py-3 cursor-pointer text-white text-[13px] font-extrabold disabled:opacity-50"
                                >
                                    {post.status === 'approved' ? 'Publish' : 'Approve and publish'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
