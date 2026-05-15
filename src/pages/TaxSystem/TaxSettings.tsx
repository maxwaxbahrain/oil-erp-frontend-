// Tax Management — minimal landing page.
//
// Per user request: keep only the "Open Tax Engine" action and remove
// every other option (Setup / Provider, Tax Calculator, Nexus States,
// Cached Rates, Save / Tax Collection toggle, etc.). All of the tax
// configuration now lives inside the Tax Engine module at /tax/engine.
//
// NOTE: this file previously exported getTaxConfig() and calculateTax()
// helpers. Nothing else in the codebase imports them (verified with
// `grep -rn "from.*TaxSettings"` — only routes.tsx imports the default
// component), so removing them is safe. Future code should import from
// pages/TaxSystem/engine/ + pages/TaxSystem/integrations/ instead.

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Zap, ArrowRight } from 'lucide-react';

export default function TaxSettings() {
    const navigate = useNavigate();
    return (
        <div className="space-y-5 max-w-[800px] mx-auto pb-10 animate-in fade-in duration-300">
            <div>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 transition-all"
                >
                    <ArrowLeft size={14} /> Back
                </button>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-10 shadow-sm">
                <div className="flex items-start gap-5 mb-8">
                    <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Calculator size={28} className="text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Tax Management</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Sales-tax rules, jurisdictions, and rate computation are managed inside the Tax Engine.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/tax/engine')}
                    className="w-full flex items-center justify-between gap-3 px-6 py-5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-md group"
                >
                    <span className="flex items-center gap-3">
                        <Zap size={18} className="text-orange-400" />
                        Open Tax Engine
                    </span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
}
