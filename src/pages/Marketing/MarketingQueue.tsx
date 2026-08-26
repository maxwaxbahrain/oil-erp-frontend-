import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, RefreshCw, Send } from 'lucide-react';
import {
    deleteMarketingPost,
    listMarketingPosts,
    updateMarketingPost,
    type MarketingPost,
} from '../../services/api';

type StatusTab = 'all' | 'draft' | 'approved' | 'archived';

const TABS: { id: StatusTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Draft' },
    { id: 'approved', label: 'Approved' },
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
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <button key={item.label === 'Copied' ? 'Copy' : item.label} type="button" disabled={disabled} onClick={item.onClick} className={item.className}>
                        {item.label === 'Copy' || item.label === 'Copied' ? (
                            <span className="inline-flex items-center gap-1"><Copy size={12} /> {item.label}</span>
                        ) : item.label}
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10">
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
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{post.platform}</span>
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${STATUS_STYLE[post.status] || 'bg-gray-100 text-gray-600'}`}>
                                                {post.status}
                                            </span>
                                            <span className="text-xs font-mono text-gray-400">{formatCreatedAt(post.created_at)}</span>
                                        </div>
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