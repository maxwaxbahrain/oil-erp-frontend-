// Rates — read-only table of all 51 US state combined rates (Session 1E).
//
// Data source: the frontend's US_STATES constant (data/constants.ts).
// The backend also has these in the tax_rates DB table, but the
// frontend has a perfectly current copy and using it here avoids one
// network round-trip on every page view.
//
// "No-tax states" — those with combinedRate === 0 (DE, MT, NH, OR) —
// are highlighted in green per the prompt's UX spec.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Search, X } from 'lucide-react';
import { US_STATES, type USStateInfo } from './data/constants';

export default function Rates() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [destFilter, setDestFilter] = useState<'all' | 'destination' | 'origin'>('all');

    const allStates = useMemo<USStateInfo[]>(
        () => Object.values(US_STATES).sort((a, b) => a.stateName.localeCompare(b.stateName)),
        [],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allStates.filter(s => {
            if (destFilter === 'destination' && !s.destinationBased) return false;
            if (destFilter === 'origin' && s.destinationBased) return false;
            if (q && !s.stateName.toLowerCase().includes(q) && !s.stateCode.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [allStates, search, destFilter]);

    const noTaxCount = allStates.filter(s => s.combinedRate === 0).length;
    const originCount = allStates.filter(s => !s.destinationBased).length;

    return (
        <div className="space-y-6 max-w-[1100px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all"
                >
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                        <MapPin size={22} className="text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                            US State Tax Rates
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            50 states + DC.  Combined rate = state + average local.  No-tax states highlighted in green.
                        </p>
                    </div>
                </div>

                {/* Summary stats */}
                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatPill label="Total" value={`${allStates.length}`} />
                    <StatPill label="No-tax states" value={`${noTaxCount}`} accent="emerald" />
                    <StatPill label="Origin-based" value={`${originCount}`} accent="indigo" />
                    <StatPill label="Destination-based" value={`${allStates.length - originCount}`} accent="orange" />
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by state name or 2-letter code…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400"
                    />
                </div>
                <select
                    value={destFilter}
                    onChange={e => setDestFilter(e.target.value as typeof destFilter)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                >
                    <option value="all">All sourcing types</option>
                    <option value="destination">Destination-based only</option>
                    <option value="origin">Origin-based only</option>
                </select>
                {(search || destFilter !== 'all') && (
                    <button
                        onClick={() => { setSearch(''); setDestFilter('all'); }}
                        className="md:col-span-3 inline-flex items-center justify-center gap-1.5 text-xs font-black text-gray-500 hover:text-gray-800 uppercase tracking-wider"
                    >
                        <X size={12} /> Clear filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                        Showing {filtered.length} of {allStates.length}
                    </p>
                </div>
                {filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-400 font-bold uppercase text-sm">No states match the filters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Code', 'State', 'State Rate', 'Avg Local', 'Combined', 'Sourcing'].map(h => (
                                        <th key={h} className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(s => {
                                    const noTax = s.combinedRate === 0;
                                    return (
                                        <tr
                                            key={s.stateCode}
                                            className={noTax ? 'bg-emerald-50/40 hover:bg-emerald-50' : 'hover:bg-gray-50'}
                                        >
                                            <td className="px-4 py-3 font-mono font-black text-gray-900">
                                                {s.stateCode}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">{s.stateName}</td>
                                            <td className="px-4 py-3 font-mono text-gray-700 text-right">
                                                {s.stateRate.toFixed(3)}%
                                            </td>
                                            <td className="px-4 py-3 font-mono text-gray-500 text-right">
                                                {s.avgLocalRate.toFixed(3)}%
                                            </td>
                                            <td className="px-4 py-3 font-mono font-black text-right">
                                                <span className={noTax ? 'text-emerald-700' : 'text-orange-700'}>
                                                    {s.combinedRate.toFixed(3)}%
                                                </span>
                                                {noTax && (
                                                    <span className="ml-2 inline-block text-[9px] font-black uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                                                        No tax
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${s.destinationBased ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                    {s.destinationBased ? 'Destination' : 'Origin'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer note about source */}
            <p className="text-xs text-gray-400 text-center">
                Source: built-in <code className="font-mono">US_STATES</code> table seeded from the Session 1B retrofit's 2025 averages.
                Real-time rooftop-accurate rates come from TaxJar / Avalara via the Providers tab.
            </p>
        </div>
    );
}

// Small stat tile used at the top of the page.
function StatPill({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'orange' | 'indigo' }) {
    const cls = accent === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : accent === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-100'
        : accent === 'indigo' ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
        : 'bg-gray-50 text-gray-700 border-gray-100';
    return (
        <div className={`rounded-xl border px-4 py-3 ${cls}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-0.5">{label}</p>
            <p className="font-mono text-lg font-black">{value}</p>
        </div>
    );
}
