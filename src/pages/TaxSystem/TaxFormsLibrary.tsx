// TaxFormsLibrary — /tax/forms.  Session 3A.
//
// Browse the 96-form IRS catalog.  Live search, category filter,
// grouped by section.  "Auto-File →" deep-links into the wizard for
// the 4 supported forms; other 92 get a disabled "Coming Soon" badge.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, BookOpen, Search, RefreshCw, ExternalLink,
    AlertCircle, Loader2, Sparkles, X,
} from 'lucide-react';
import {
    getFormCatalog,
    type CatalogForm,
    type FormCategory,
    type FormTag,
} from './services/filingApi';


const CATEGORY_LABELS: Record<FormCategory, string> = {
    INCOME:  'Income Tax',
    ENTITY:  'Entity & Info',
    PAYROLL: 'Payroll',
    IMPORT:  'Import / Export',
    EXCISE:  'Excise',
    CREDIT:  'Credits',
    DEDUCT:  'Deductions',
    INFO:    'Info Returns',
    INTL:    'International',
    EXT:     'Extensions',
};


const TAG_STYLES: Record<FormTag, { bg: string; text: string; label: string }> = {
    blue:   { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Income' },
    teal:   { bg: 'bg-teal-100',    text: 'text-teal-700',    label: 'Entity' },
    purple: { bg: 'bg-purple-100',  text: 'text-purple-700',  label: 'Payroll' },
    coral:  { bg: 'bg-orange-100',  text: 'text-orange-700',  label: 'Customs' },
    amber:  { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'Excise / Info' },
    green:  { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Credit' },
    gray:   { bg: 'bg-gray-100',    text: 'text-gray-700',    label: 'Deduction' },
    red:    { bg: 'bg-rose-100',    text: 'text-rose-700',    label: 'HIGH PENALTY' },
};


export default function TaxFormsLibrary() {
    const navigate = useNavigate();
    const [allForms, setAllForms] = useState<CatalogForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<FormCategory | 'ALL'>('ALL');
    const [total, setTotal] = useState(0);

    useEffect(() => { reload(); }, []);

    const reload = async () => {
        setLoading(true);
        setError(null);
        const { data, error: apiError } = await getFormCatalog();
        setLoading(false);
        if (apiError || !data) {
            setError(apiError || 'Failed to load forms catalog.');
            return;
        }
        setAllForms(data.forms);
        setTotal(data.total);
    };

    // Client-side filter — instant response on typing, no extra API call.
    const filtered = useMemo(() => {
        let out = allForms;
        if (activeCategory !== 'ALL') {
            out = out.filter(f => f.category === activeCategory);
        }
        const q = search.trim().toLowerCase();
        if (q) {
            out = out.filter(f =>
                f.form_id.toLowerCase().includes(q) ||
                f.name.toLowerCase().includes(q) ||
                f.full_name.toLowerCase().includes(q) ||
                f.purpose.toLowerCase().includes(q) ||
                f.who_needs_it.toLowerCase().includes(q),
            );
        }
        return out;
    }, [allForms, search, activeCategory]);

    // Group filtered results by section for the table headers.
    const grouped = useMemo(() => {
        const map = new Map<string, CatalogForm[]>();
        for (const f of filtered) {
            const arr = map.get(f.section) || [];
            arr.push(f);
            map.set(f.section, arr);
        }
        // Preserve section order by min sort_order within each section.
        return Array.from(map.entries()).sort((a, b) =>
            Math.min(...a[1].map(f => f.sort_order)) - Math.min(...b[1].map(f => f.sort_order)),
        );
    }, [filtered]);

    const categoryCounts = useMemo(() => {
        const counts: Partial<Record<FormCategory | 'ALL', number>> = { ALL: allForms.length };
        for (const f of allForms) {
            counts[f.category] = (counts[f.category] || 0) + 1;
        }
        return counts;
    }, [allForms]);

    return (
        <div className="space-y-5 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button
                    onClick={() => navigate('/tax')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3"
                >
                    <ArrowLeft size={14} /> Back to Tax
                </button>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                            <BookOpen size={22} className="text-purple-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                Forms Library
                            </h1>
                            <p className="text-xs text-gray-500 mt-1">
                                Browse all <span className="font-mono font-black text-gray-700">96 IRS forms</span> and tax filing requirements.
                                Auto-file is available for {' '}
                                <span className="font-mono font-black text-emerald-700">4 forms</span> (1120, 1040, Schedule C, 941).
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={reload}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wide"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Search bar */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by form number, name, purpose, or who needs it…"
                        className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-gray-400"
                            title="Clear search"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Category buttons */}
                <div className="flex flex-wrap gap-2">
                    <CategoryButton
                        active={activeCategory === 'ALL'}
                        label="All"
                        count={categoryCounts.ALL || 0}
                        onClick={() => setActiveCategory('ALL')}
                    />
                    {(Object.keys(CATEGORY_LABELS) as FormCategory[]).map(cat => (
                        <CategoryButton
                            key={cat}
                            active={activeCategory === cat}
                            label={CATEGORY_LABELS[cat]}
                            count={categoryCounts[cat] || 0}
                            onClick={() => setActiveCategory(cat)}
                        />
                    ))}
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400">
                    <Loader2 size={28} className="animate-spin mx-auto mb-2" />
                    <p className="font-bold text-sm">Loading 96 IRS forms…</p>
                </div>
            ) : error ? (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-3">
                    <AlertCircle size={20} className="text-rose-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <h2 className="text-sm font-black text-rose-900 uppercase mb-1">Could not load catalog</h2>
                        <p className="text-sm text-rose-700">{error}</p>
                    </div>
                    <button onClick={reload} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-black uppercase">
                        Retry
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
                    <BookOpen size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-bold uppercase text-sm">No forms match</p>
                    <p className="text-gray-400 text-xs mt-1">
                        {search ? `No matches for "${search}"` : 'No forms in this category'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Showing count */}
                    <div className="text-xs text-gray-500 px-1">
                        Showing <span className="font-mono font-black text-gray-700">{filtered.length}</span> of {total} forms
                    </div>

                    {/* Grouped sections */}
                    {grouped.map(([section, forms]) => (
                        <FormSection key={section} title={section} forms={forms} />
                    ))}
                </>
            )}
        </div>
    );
}


function CategoryButton({
    active, label, count, onClick,
}: {
    active: boolean; label: string; count: number; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                active
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
        >
            <span>{label}</span>
            <span className={`font-mono text-[10px] ${active ? 'text-orange-300' : 'text-gray-400'}`}>
                {count}
            </span>
        </button>
    );
}


function FormSection({ title, forms }: { title: string; forms: CatalogForm[] }) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                    {title} <span className="ml-2 text-xs font-mono text-gray-400">{forms.length}</span>
                </h3>
            </div>
            <div className="divide-y divide-gray-50">
                {forms.map(f => (
                    <FormRow key={f.form_id} form={f} />
                ))}
            </div>
        </div>
    );
}


function FormRow({ form }: { form: CatalogForm }) {
    const navigate = useNavigate();
    const tag = TAG_STYLES[form.tag];

    return (
        <div className="px-5 py-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
            {/* Form number — monospace */}
            <div className="flex-shrink-0 min-w-[120px]">
                <p className="font-mono font-black text-sm text-gray-900 uppercase">{form.name}</p>
                <a
                    href={form.irs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-purple-600 mt-0.5"
                    title="View on irs.gov"
                >
                    irs.gov <ExternalLink size={9} />
                </a>
            </div>

            {/* Middle — purpose + who + tag + penalty + deadline */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm text-gray-800 font-bold">{form.purpose}</p>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${tag.bg} ${tag.text}`}>
                        {tag.label}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{form.who_needs_it}</p>
                <div className="flex items-center gap-3 text-[11px] flex-wrap">
                    <span className="text-rose-600 font-bold">
                        ⚠ {form.penalty}
                    </span>
                    <span className="text-gray-500">
                        📅 {form.deadline}
                    </span>
                </div>
            </div>

            {/* Action button */}
            <div className="flex-shrink-0">
                {form.can_auto_file ? (
                    <button
                        onClick={() => navigate(`/tax/filing/new?form_type=${encodeURIComponent(form.form_id)}&tax_year=2024`)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all shadow-sm"
                    >
                        <Sparkles size={12} /> Auto-File →
                    </button>
                ) : (
                    <span
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-xl text-xs font-black uppercase tracking-wide cursor-not-allowed"
                        title="Auto-filing not yet supported for this form"
                    >
                        Coming Soon
                    </span>
                )}
            </div>
        </div>
    );
}
