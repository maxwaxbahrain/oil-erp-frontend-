// Tax Management — landing page with the four entry points to the
// tax module's sub-pages.  Session 1E adds three new cards:
//   - Calculator (full invoice-shaped calc, persists drafts)
//   - Transactions (saved calc history + CSV export)
//   - Rates (read-only 51-state rate table)
// in addition to the existing Tax Engine (rules / nexus / providers /
// exemptions configuration).

import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Calculator,
    Receipt,
    Sparkles,
    MapPin,
    Zap,
    FileText,
    BookOpen,
    MessageSquare,
} from 'lucide-react';

interface TaxEntryCard {
    path: string;
    icon: typeof Zap;
    title: string;
    blurb: string;
    accent: string;
    primary?: boolean;
}

const ENTRIES: TaxEntryCard[] = [
    {
        path: '/tax/engine',
        icon: Zap,
        title: 'Tax Engine',
        blurb: 'Configure tax rules, nexus jurisdictions, providers (TaxJar / Avalara), and exemption certificates.  Quick calculator at the top.',
        accent: 'orange',
        primary: true,
    },
    {
        path: '/tax/calculator',
        icon: Sparkles,
        title: 'Calculator',
        blurb: 'Full invoice-shaped tax calculator — seller/buyer state, multi-line items, category-aware, exemption certs.  Persists every result.',
        accent: 'orange',
    },
    {
        path: '/tax/transactions',
        icon: Receipt,
        title: 'Transactions',
        blurb: 'Every saved tax calculation.  Filter by state, date, customer, or category.  Export to CSV for audits or filing.',
        accent: 'blue',
    },
    {
        path: '/tax/rates',
        icon: MapPin,
        title: 'US State Rates',
        blurb: 'Read-only table of all 50 states + DC.  Combined state + average local rates, with no-tax states highlighted.',
        accent: 'purple',
    },
    {
        // Session 2F — 5th card: federal income tax filings (Form 1120 / 1040 / Schedule C / 941).
        path: '/tax/filing',
        icon: FileText,
        title: 'Tax Filings',
        blurb: 'File and manage your federal tax returns.  AI-driven wizard pulls from your ERP and walks you through Form 1120, 1040, Schedule C, and 941.',
        accent: 'emerald',
    },
    {
        // Session 3A — 6th card: 96-form IRS catalog (browse + auto-file 4).
        path: '/tax/forms',
        icon: BookOpen,
        title: 'Forms Library',
        blurb: 'Browse all 96 IRS forms and tax filing requirements.  Search by name, filter by category (income / payroll / customs / etc.), and auto-file the 4 supported returns.',
        accent: 'indigo',
    },
    {
        // Session 3B — 7th card: AI tax advisor chat with SSE streaming.
        path: '/tax/advisor',
        icon: MessageSquare,
        title: 'Tax Advisor',
        blurb: 'Ask our AI tax advisor anything about forms, deductions, deadlines, and tax strategy.  Powered by Claude, grounded in your filings — educational use only.',
        accent: 'violet',
    },
];

const ACCENT_CLASSES: Record<string, { bg: string; icon: string }> = {
    orange:  { bg: 'bg-orange-50',  icon: 'text-orange-600' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600' },
    purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600' },
    violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600' },
};

export default function TaxSettings() {
    const navigate = useNavigate();
    const primaryEntry = ENTRIES.find(e => e.primary)!;
    const secondaryEntries = ENTRIES.filter(e => !e.primary);

    return (
        <div className="space-y-5 max-w-[1000px] mx-auto pb-10 animate-in fade-in duration-300">
            <div>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 transition-all"
                >
                    <ArrowLeft size={14} /> Back
                </button>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
                <div className="flex items-start gap-5 mb-8">
                    <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Calculator size={28} className="text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Tax Management</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Sales-tax rules, calculations, transactions, and rate references — all in one place.
                        </p>
                    </div>
                </div>

                {/* Primary entry — Tax Engine (the configuration hub) */}
                <button
                    onClick={() => navigate(primaryEntry.path)}
                    className="w-full flex items-center justify-between gap-3 px-6 py-5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-md group mb-4"
                >
                    <span className="flex items-center gap-3">
                        <Zap size={18} className="text-orange-400" />
                        Open Tax Engine
                    </span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Secondary entries — Calculator / Transactions / Rates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {secondaryEntries.map(entry => {
                        const accent = ACCENT_CLASSES[entry.accent] || ACCENT_CLASSES.orange;
                        const Icon = entry.icon;
                        return (
                            <button
                                key={entry.path}
                                onClick={() => navigate(entry.path)}
                                className="text-left bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md rounded-2xl p-5 transition-all group"
                            >
                                <div className={`w-10 h-10 ${accent.bg} rounded-xl flex items-center justify-center mb-3`}>
                                    <Icon size={18} className={accent.icon} />
                                </div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <p className="text-sm font-black text-gray-900 uppercase tracking-tight">
                                        {entry.title}
                                    </p>
                                    <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">{entry.blurb}</p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
