import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ImagePlus, RefreshCw, Send, Sparkles, Wand2 } from 'lucide-react';
import {
    deleteMarketingPost,
    deleteMarketingPostMedia,
    editMarketingPostImage,
    generateMarketingPostImage,
    listMarketingConnections,
    listMarketingPosts,
    publishMarketingPost,
    updateMarketingPost,
    uploadMarketingPostMedia,
    type MarketingConnection,
    type MarketingPost,
} from '../../services/api';

type StatusTab = 'all' | 'draft' | 'approved' | 'archived' | 'posted';

const TABS: { id: StatusTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Draft' },
    { id: 'approved', label: 'Approved' },
    { id: 'posted', label: 'Posted' },
    { id: 'archived', label: 'Archived' },
];

const STATUS_STYLE: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    approved: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-amber-100 text-amber-700',
    scheduled: 'bg-blue-100 text-blue-700',
    posted: 'bg-purple-100 text-purple-700',
};

const LOAD_ERROR = "Couldn't load posts. Check your connection and try again.";
const ACTION_ERROR = "Couldn't update the post. Try again.";
const DELETE_ERROR = "Couldn't delete the post. Try again.";
const COPY_ERROR = "Couldn't copy to the clipboard.";
const NO_CONNECTIONS_ERROR = 'No social accounts connected yet.';

function formatCreatedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function mapPublishError(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    const lower = text.toLowerCase();
    if (lower.includes('not configured')) {
        return 'Publishing is not configured on this server.';
    }
    if (text.includes('Already')) {
        return 'This post was already published.';
    }
    if (lower.includes('approved')) {
        return 'Only approved posts can be published.';
    }
    return 'Publishing failed. Try again.';
}

function mapMediaError(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    const lower = text.toLowerCase();
    if (lower.includes('too small')) {
        return text;
    }
    if (lower.includes('at least 256')) {
        return text;
    }
    if (lower.includes('too large')) {
        return text;
    }
    if (text.includes('10 MB') || lower.includes('too large')) {
        return 'Image is too large (max 10 MB).';
    }
    if (lower.includes('does not match')) {
        return "That file doesn't look like a real image.";
    }
    if (lower.includes('unsupported')) {
        return 'Only JPG, PNG and WebP images are supported.';
    }
    if (lower.includes('not configured')) {
        return 'Image storage is not set up on this server.';
    }
    if (lower.includes('published')) {
        return "A published post can't be changed.";
    }
    return "Couldn't upload the image. Try again.";
}

function mapGenerateImageError(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    const lower = text.toLowerCase();
    if (lower.includes('too small')) {
        return text;
    }
    if (lower.includes('at least 256')) {
        return text;
    }
    if (lower.includes('too large')) {
        return text;
    }
    if (lower.includes('not configured')) {
        return 'Image generation is not set up on this server.';
    }
    if (lower.includes('rate') || text.includes('429')) {
        return "You've hit the AI limit for now. Try again in a couple of hours.";
    }
    if (lower.includes('published')) {
        return "A published post can't be changed.";
    }
    if (lower.includes('no image')) {
        return 'The image service returned nothing. Try a different prompt.';
    }
    return "Couldn't generate the image. Try again.";
}

function mapEditImageError(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    const lower = text.toLowerCase();
    if (lower.includes('no image to edit')) {
        return 'Upload or generate an image first.';
    }
    if (lower.includes('not configured')) {
        return 'Image editing is not set up on this server.';
    }
    if (lower.includes('rate') || text.includes('429')) {
        return "You've hit the AI limit for now. Try again in a couple of hours.";
    }
    if (lower.includes('published')) {
        return "A published post can't be changed.";
    }
    if (lower.includes('returned no image')) {
        return 'The image service returned nothing. Try a different prompt.';
    }
    return "Couldn't edit the image. Try again.";
}

function truncateBody(body: string, limit = 200): { text: string; truncated: boolean } {
    if (body.length <= limit) return { text: body, truncated: false };
    return { text: body.slice(0, limit).trimEnd() + '…', truncated: true };
}

export default function MarketingQueue() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<StatusTab>('all');
    const [posts, setPosts] = useState<MarketingPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const [busyId, setBusyId] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [connections, setConnections] = useState<MarketingConnection[] | null>(null);
    const [pickerPostId, setPickerPostId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);
    const [promptBoxPostId, setPromptBoxPostId] = useState<number | null>(null);
    const [promptDraft, setPromptDraft] = useState('');
    const [generatingImage, setGeneratingImage] = useState(false);
    const [editPromptBoxPostId, setEditPromptBoxPostId] = useState<number | null>(null);
    const [editPromptDraft, setEditPromptDraft] = useState('');
    const [editingImage, setEditingImage] = useState(false);

    const fetchPosts = useCallback(async (statusTab: StatusTab) => {
        setLoading(true);
        setError(null);
        try {
            const rows = await listMarketingPosts(
                statusTab === 'all'
                    ? { limit: 200 }
                    : { status: statusTab, limit: 200 },
            );
            setPosts(rows);
        } catch {
            setError(LOAD_ERROR);
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchPosts(tab);
    }, [tab, fetchPosts]);

    const total = posts.length;
    const drafts = posts.filter((p) => p.status === 'draft').length;
    const approved = posts.filter((p) => p.status === 'approved').length;

    const runAction = async (id: number, fn: () => Promise<void>, failMessage: string) => {
        if (busyId !== null) return;
        setBusyId(id);
        setError(null);
        try {
            await fn();
        } catch {
            setError(failMessage);
        } finally {
            setBusyId(null);
        }
    };

    const loadConnections = async (): Promise<MarketingConnection[]> => {
        if (connections !== null) return connections;
        const rows = await listMarketingConnections();
        setConnections(rows);
        return rows;
    };

    const runPublish = (postId: number, platformId: string) => {
        if (busyId !== null) return;
        setBusyId(postId);
        setError(null);
        void (async () => {
            try {
                await publishMarketingPost(postId, platformId);
                setPickerPostId(null);
                await fetchPosts(tab);
            } catch (err) {
                setError(mapPublishError(err));
            } finally {
                setBusyId(null);
            }
        })();
    };

    const onPublishClick = (post: MarketingPost) => {
        if (busyId !== null) return;
        setBusyId(post.id);
        setError(null);
        setPickerPostId(null);
        void (async () => {
            try {
                const conns = await loadConnections();
                if (conns.length === 0) {
                    setError(NO_CONNECTIONS_ERROR);
                    return;
                }
                if (conns.length === 1) {
                    await publishMarketingPost(post.id, conns[0].platform_id);
                    await fetchPosts(tab);
                    return;
                }
                setPickerPostId(post.id);
            } catch (err) {
                setError(mapPublishError(err));
            } finally {
                setBusyId(null);
            }
        })();
    };

    const applyStatus = (id: number, status: 'draft' | 'approved' | 'archived') => {
        void runAction(id, async () => {
            const updated = await updateMarketingPost(id, { status });
            setPosts((prev) => {
                if (tab !== 'all' && updated.status !== tab) {
                    return prev.filter((p) => p.id !== id);
                }
                return prev.map((p) => (p.id === id ? updated : p));
            });
        }, ACTION_ERROR);
    };

    const onDelete = (post: MarketingPost) => {
        if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
        void runAction(post.id, async () => {
            await deleteMarketingPost(post.id);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
        }, DELETE_ERROR);
    };

    const onCopy = async (post: MarketingPost) => {
        try {
            await navigator.clipboard.writeText(post.body);
            setCopiedId(post.id);
            window.setTimeout(() => setCopiedId((cur) => (cur === post.id ? null : cur)), 1500);
        } catch {
            setError(COPY_ERROR);
        }
    };

    const onAddImageClick = (postId: number) => {
        if (busyId !== null) return;
        setUploadTargetId(postId);
        fileInputRef.current?.click();
    };

    const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        const postId = uploadTargetId;
        setUploadTargetId(null);
        if (!file || postId === null || busyId !== null) return;

        setBusyId(postId);
        setError(null);
        void (async () => {
            try {
                await uploadMarketingPostMedia(postId, file);
                await fetchPosts(tab);
            } catch (err) {
                setError(mapMediaError(err));
            } finally {
                setBusyId(null);
            }
        })();
    };

    const onRemoveImage = (postId: number) => {
        if (busyId !== null) return;
        setBusyId(postId);
        setError(null);
        void (async () => {
            try {
                await deleteMarketingPostMedia(postId);
                await fetchPosts(tab);
            } catch (err) {
                setError(mapMediaError(err));
            } finally {
                setBusyId(null);
            }
        })();
    };

    const onGenerateImageClick = (postId: number) => {
        if (busyId !== null) return;
        setEditPromptBoxPostId(null);
        setEditPromptDraft('');
        setPromptBoxPostId(postId);
        setPromptDraft('');
        setError(null);
    };

    const onCancelGenerate = () => {
        if (busyId !== null) return;
        setPromptBoxPostId(null);
        setPromptDraft('');
    };

    const onEditImageClick = (postId: number) => {
        if (busyId !== null) return;
        setPromptBoxPostId(null);
        setPromptDraft('');
        setEditPromptBoxPostId(postId);
        setEditPromptDraft('');
        setError(null);
    };

    const onCancelEdit = () => {
        if (busyId !== null) return;
        setEditPromptBoxPostId(null);
        setEditPromptDraft('');
    };

    const onSubmitGenerate = (postId: number) => {
        const prompt = promptDraft.trim();
        if (prompt.length < 3 || busyId !== null) return;
        setBusyId(postId);
        setGeneratingImage(true);
        setError(null);
        void (async () => {
            try {
                await generateMarketingPostImage(postId, prompt);
                setPromptBoxPostId(null);
                setPromptDraft('');
                await fetchPosts(tab);
            } catch (err) {
                setError(mapGenerateImageError(err));
            } finally {
                setBusyId(null);
                setGeneratingImage(false);
            }
        })();
    };

    const onSubmitEdit = (postId: number) => {
        const prompt = editPromptDraft.trim();
        if (prompt.length < 3 || busyId !== null) return;
        setBusyId(postId);
        setEditingImage(true);
        setError(null);
        void (async () => {
            try {
                await editMarketingPostImage(postId, prompt);
                setEditPromptBoxPostId(null);
                setEditPromptDraft('');
                await fetchPosts(tab);
            } catch (err) {
                setError(mapEditImageError(err));
            } finally {
                setBusyId(null);
                setEditingImage(false);
            }
        })();
    };

    const actionButtons = (post: MarketingPost) => {
        const disabled = busyId === post.id;
        const btn = 'text-xs font-black px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50';
        const items: { label: string; onClick: () => void; className: string }[] = [];

        if (post.status === 'draft') {
            items.push({
                label: 'Approve',
                onClick: () => applyStatus(post.id, 'approved'),
                className: `${btn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`,
            });
        }
        if (post.status === 'approved') {
            items.push({
                label: 'Publish',
                onClick: () => onPublishClick(post),
                className: `${btn} border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100`,
            });
            items.push({
                label: 'Back to draft',
                onClick: () => applyStatus(post.id, 'draft'),
                className: `${btn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`,
            });
            items.push({
                label: 'Archive',
                onClick: () => applyStatus(post.id, 'archived'),
                className: `${btn} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`,
            });
        }
        if (post.status === 'archived') {
            items.push({
                label: 'Back to draft',
                onClick: () => applyStatus(post.id, 'draft'),
                className: `${btn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`,
            });
        }

        if (post.status !== 'posted') {
            items.push({
                label: 'Add image',
                onClick: () => onAddImageClick(post.id),
                className: `${btn} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`,
            });
            items.push({
                label: 'Generate image',
                onClick: () => onGenerateImageClick(post.id),
                className: `${btn} border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100`,
            });
            if (post.media_url) {
                items.push({
                    label: 'Edit image',
                    onClick: () => onEditImageClick(post.id),
                    className: `${btn} border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100`,
                });
            }
        }

        items.push({
            label: copiedId === post.id ? 'Copied' : 'Copy',
            onClick: () => { void onCopy(post); },
            className: `${btn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`,
        });
        items.push({
            label: 'Delete',
            onClick: () => onDelete(post),
            className: `${btn} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`,
        });

        return (
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                        <button key={item.label === 'Copied' ? 'Copy' : item.label} type="button" disabled={disabled} onClick={item.onClick} className={item.className}>
                            {item.label === 'Copy' || item.label === 'Copied' ? (
                                <span className="inline-flex items-center gap-1"><Copy size={12} /> {item.label}</span>
                            ) : item.label === 'Add image' ? (
                                <span className="inline-flex items-center gap-1"><ImagePlus size={12} /> {item.label}</span>
                            ) : item.label === 'Generate image' ? (
                                <span className="inline-flex items-center gap-1"><Sparkles size={12} /> {item.label}</span>
                            ) : item.label === 'Edit image' ? (
                                <span className="inline-flex items-center gap-1"><Wand2 size={12} /> {item.label}</span>
                            ) : item.label}
                        </button>
                    ))}
                </div>
                {post.status !== 'posted' && (
                    <p className="text-[11px] text-gray-500 leading-snug">
                        Images: JPG, PNG or WebP · under 10 MB · at least 256x256, and 1024px or larger gives much better AI results
                    </p>
                )}
                {pickerPostId === post.id && connections && connections.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Publish to</span>
                        {connections.map((conn) => (
                            <button
                                key={conn.platform_id}
                                type="button"
                                disabled={disabled}
                                onClick={() => runPublish(post.id, conn.platform_id)}
                                className={`${btn} border-purple-200 bg-white text-purple-800 hover:bg-purple-50`}
                            >
                                {conn.platform}
                                {conn.username ? ` · ${conn.username}` : ''}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => setPickerPostId(null)}
                            className={`${btn} border-gray-200 bg-white text-gray-600 hover:bg-gray-50`}
                        >
                            Cancel
                        </button>
                    </div>
                )}
                {promptBoxPostId === post.id && (
                    <div className="pt-2 p-3 rounded-xl border border-violet-200 bg-violet-50/40 space-y-2">
                        {generatingImage && busyId === post.id ? (
                            <p className="text-xs font-bold text-violet-700 inline-flex items-center gap-2">
                                <RefreshCw size={12} className="animate-spin shrink-0" />
                                Generating image…
                            </p>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={promptDraft}
                                    onChange={(e) => setPromptDraft(e.target.value)}
                                    placeholder="Describe the image, e.g. busy auto workshop, mechanic changing oil"
                                    maxLength={1000}
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                                />
                                <p className="text-[11px] text-gray-500 leading-snug">
                                    Generated images are best for scenes and backgrounds. Upload a real photo
                                    when the actual product must be shown.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={disabled || promptDraft.trim().length < 3}
                                        onClick={() => onSubmitGenerate(post.id)}
                                        className={`${btn} border-violet-300 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50`}
                                    >
                                        Generate
                                    </button>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={onCancelGenerate}
                                        className={`${btn} border-gray-200 bg-white text-gray-600 hover:bg-gray-50`}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
                {editPromptBoxPostId === post.id && (
                    <div className="pt-2 p-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 space-y-2">
                        {editingImage && busyId === post.id ? (
                            <p className="text-xs font-bold text-fuchsia-700 inline-flex items-center gap-2">
                                <RefreshCw size={12} className="animate-spin shrink-0" />
                                Editing image…
                            </p>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={editPromptDraft}
                                    onChange={(e) => setEditPromptDraft(e.target.value)}
                                    placeholder="Describe the scene, e.g. product on a busy workshop bench at golden hour"
                                    maxLength={1000}
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-fuchsia-200 bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                                />
                                <p className="text-[11px] text-gray-500 leading-snug">
                                    Uses your uploaded photo as the product — the real label stays visible.
                                    Editing replaces the current image; download it first if you need to keep the original.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={disabled || editPromptDraft.trim().length < 3}
                                        onClick={() => onSubmitEdit(post.id)}
                                        className={`${btn} border-fuchsia-300 bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50`}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={onCancelEdit}
                                        className={`${btn} border-gray-200 bg-white text-gray-600 hover:bg-gray-50`}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFileInputChange}
            />
            <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate('/marketing')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3"><ArrowLeft size={14} /> Marketing Hub</button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black uppercase">Queue</h1>
                        <p className="text-gray-400 text-xs mt-0.5">Review, approve, and archive generated posts</p>
                    </div>
                    <button onClick={() => navigate('/marketing/studio')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl text-sm font-black transition-all shadow-lg">
                        Open Content Studio →
                    </button>
                </div>
            </div>

            {tab === 'all' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                    { label: 'Total', value: loading ? '...' : total, color: 'text-gray-900' },
                    { label: 'Drafts', value: loading ? '...' : drafts, color: 'text-gray-600' },
                    { label: 'Approved', value: loading ? '...' : approved, color: 'text-emerald-600' },
                ].map((s) => (
                    <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>
            )}

            <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            tab === t.id
                                ? 'bg-gray-900 text-white'
                                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start justify-between gap-4">
                    <p className="text-sm font-bold text-red-800">{error}</p>
                    <button
                        type="button"
                        onClick={() => void fetchPosts(tab)}
                        className="flex items-center gap-1 shrink-0 px-3 py-1.5 bg-white border border-red-300 rounded-lg text-xs font-black text-red-700 hover:bg-red-100"
                    >
                        <RefreshCw size={12} /> Retry
                    </button>
                </div>
            )}

            {loading && (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                    <RefreshCw size={28} className="mx-auto text-gray-300 mb-3 animate-spin" />
                    <p className="text-gray-500 font-black">Loading posts…</p>
                </div>
            )}

            {!loading && !error && posts.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                    <Send size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-500 font-black text-lg">No posts yet</p>
                    <p className="text-gray-400 text-sm mt-1">Generate drafts in the AI Content Studio, then approve them here.</p>
                    <button onClick={() => navigate('/marketing/studio')} className="mt-4 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-black">
                        Open Content Studio →
                    </button>
                </div>
            )}

            {!loading && posts.length > 0 && (
                <div className="space-y-3">
                    {posts.map((post) => {
                        const { text, truncated } = truncateBody(post.body);
                        const isOpen = !!expanded[post.id];
                        return (
                            <div key={post.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <p className="text-base font-black text-gray-900">{post.title}</p>
                                        {post.trigger_reason && (
                                            <p className="text-xs italic text-gray-500 mt-0.5">{post.trigger_reason}</p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{post.platform}</span>
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${STATUS_STYLE[post.status] || 'bg-gray-100 text-gray-600'}`}>
                                                {post.status}
                                            </span>
                                            <span className="text-xs font-mono text-gray-400">{formatCreatedAt(post.created_at)}</span>
                                            {post.status === 'posted' && post.posted_at && (
                                                <span className="text-xs font-mono text-gray-400">
                                                    Posted {formatCreatedAt(post.posted_at)}
                                                </span>
                                            )}
                                        </div>
                                        {post.publish_error && (
                                            <p className="text-xs text-amber-700 mt-1">{post.publish_error}</p>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 mt-3 leading-relaxed whitespace-pre-wrap">
                                    {isOpen ? post.body : text}
                                </p>
                                {truncated && (
                                    <button
                                        type="button"
                                        onClick={() => setExpanded((prev) => ({ ...prev, [post.id]: !isOpen }))}
                                        className="mt-1 text-xs font-black text-purple-700 hover:text-purple-900"
                                    >
                                        {isOpen ? 'Show less' : 'Show more'}
                                    </button>
                                )}
                                {post.media_url && (
                                    <div className="mt-3 flex items-start gap-3 flex-wrap">
                                        <img
                                            src={post.media_url}
                                            alt={post.media_file_name || 'Post image'}
                                            className="max-h-[120px] rounded-xl border border-gray-100 object-contain bg-gray-50"
                                        />
                                        <div className="flex flex-col gap-2 min-w-0">
                                            {post.media_file_name && (
                                                <p className="text-xs font-bold text-gray-600 truncate max-w-[240px]">
                                                    {post.media_file_name}
                                                </p>
                                            )}
                                            {post.status !== 'posted' && (
                                                <button
                                                    type="button"
                                                    disabled={busyId === post.id}
                                                    onClick={() => onRemoveImage(post.id)}
                                                    className="text-xs font-black px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all disabled:opacity-50 w-fit"
                                                >
                                                    Remove image
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="mt-4">{actionButtons(post)}</div>
                            </div>
                        );
                    })}
                    {posts.length === 200 && (
                        <p className="text-xs text-gray-400 text-center">Showing the 200 most recent posts.</p>
                    )}
                </div>
            )}
        </div>
    );
}
