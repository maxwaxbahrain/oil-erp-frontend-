// TaxEngine — landing page for the Tax Engine module (Session 1A).
//
// What this page shows today:
//   - Health badge (live backend health + rule count)
//   - The engine version
//   - A tiny calculator demo wired to engine/calculator.ts
//   - List of currently configured rules from the backend
//
// Sessions 1B–1F will add: rule editor UI, jurisdiction setup, nexus
// management, exemption certificates, filing periods, etc.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator } from 'lucide-react';
import { HealthBadge } from './components/HealthBadge';
import { listTaxRules } from './integrations/taxEngineApi';
import { calculateTax } from './engine';
import { TAX_ENGINE_VERSION } from './data/constants';
import type { TaxRule } from './data/types';
import { formatCurrency } from '../../services/settingsService';

export default function TaxEngine() {
    const navigate = useNavigate();
    const [rules, setRules] = useState<TaxRule[]>([]);
    const [loading, setLoading] = useState(true);

    const [demoAmount, setDemoAmount] = useState('1000');
    const [demoJurisdiction, setDemoJurisdiction] = useState('US-NY');

    useEffect(() => {
        listTaxRules().then(rs => { setRules(rs); setLoading(false); });
    }, []);

    const amt = parseFloat(demoAmount) || 0;
    const result = calculateTax(amt, demoJurisdiction, rules);

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                            <Calculator size={22} className="text-orange-500" />
                            Tax Engine
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Foundation module · version {TAX_ENGINE_VERSION}
                        </p>
                    </div>
                    <HealthBadge />
                </div>
            </div>

            {/* Quick calculator */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">Quick Calculator</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Amount</label>
                        <input
                            type="number"
                            value={demoAmount}
                            onChange={e => setDemoAmount(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Jurisdiction</label>
                        <input
                            type="text"
                            value={demoJurisdiction}
                            onChange={e => setDemoJurisdiction(e.target.value)}
                            placeholder="e.g. US-NY, US-CA, BH"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                        />
                    </div>
                    <div className="flex flex-col justify-end">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Computed Tax</label>
                        <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-2.5">
                            <p className="text-lg font-black font-mono text-orange-700">
                                {formatCurrency(result.taxAmount)}
                            </p>
                            <p className="text-[10px] text-orange-600 font-bold">
                                {result.rate.toFixed(3)}% · source: {result.source}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rules table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                        Configured Rules · {rules.length}
                    </p>
                </div>
                {loading ? (
                    <div className="p-12 text-center text-gray-400 font-bold">Loading…</div>
                ) : rules.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-400 font-bold uppercase text-sm">No tax rules configured yet</p>
                        <p className="text-gray-300 text-xs mt-1">Session 1B will add the rule editor. For now you can POST to <code className="bg-gray-100 px-1.5 py-0.5 rounded">/api/tax-engine/rules</code>.</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {['Jurisdiction', 'Name', 'Type', 'Rate', 'Category', 'Status'].map(h => (
                                    <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {rules.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-sm font-bold text-gray-900 font-mono">{r.jurisdiction}</td>
                                    <td className="px-5 py-3 text-sm text-gray-700">{r.name}</td>
                                    <td className="px-5 py-3">
                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{r.taxType}</span>
                                    </td>
                                    <td className="px-5 py-3 text-sm font-mono font-bold text-orange-600">{r.rate.toFixed(3)}%</td>
                                    <td className="px-5 py-3 text-xs text-gray-500">{r.productCategory || '—'}</td>
                                    <td className="px-5 py-3">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {r.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <p className="text-xs text-gray-400 text-center">
                Tax Engine v{TAX_ENGINE_VERSION} · Session 1A: project setup + health endpoint + foundation models
            </p>
        </div>
    );
}
