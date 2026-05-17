// FilingWizardStart — form picker (wizard Step 1, before /wizard/:id exists).
// On submit, POST /api/v2/filing/start, then navigate to
// /tax/filing/wizard/:newFilingId so FilingWizard takes over.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { startFiling } from '../services/filingApi';


const FORM_OPTIONS = [
    { value: '1120',       label: 'Form 1120 — U.S. Corporation Income Tax Return',         entity: 'C-Corp' },
    { value: '1040',       label: 'Form 1040 — Individual Income Tax Return',               entity: 'Individual' },
    { value: 'schedule_c', label: 'Schedule C — Profit or Loss From Business (Sole Prop)',  entity: 'Sole Proprietor' },
    { value: '941',        label: "Form 941 — Employer's Quarterly Federal Tax Return",     entity: 'Employer' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR];


export default function FilingWizardStart() {
    const navigate = useNavigate();
    const [formType, setFormType] = useState('1120');
    const [taxYear, setTaxYear] = useState(CURRENT_YEAR - 1);  // most-recent completed year
    const [entityEin, setEntityEin] = useState('');
    const [entityName, setEntityName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const valid = /^\d{2}-?\d{7}$/.test(entityEin.trim());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid) {
            setError('Enter a valid EIN in format XX-XXXXXXX (9 digits, optional hyphen).');
            return;
        }
        setBusy(true);
        setError(null);
        const { data, error: apiError } = await startFiling(
            formType, taxYear, entityEin.trim(), entityName.trim() || undefined,
        );
        setBusy(false);
        if (apiError || !data) {
            setError(apiError || 'Could not start filing.');
            return;
        }
        navigate(`/tax/filing/wizard/${data.filing_id}`);
    };

    const selected = FORM_OPTIONS.find(o => o.value === formType);

    return (
        <div className="space-y-5 max-w-2xl mx-auto pb-10 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/tax/filing')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 transition-all"
                >
                    <ArrowLeft size={14} /> Back to filings
                </button>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
                <div className="flex items-start gap-5 mb-8">
                    <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Sparkles size={28} className="text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Start a New Filing</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Pick the form and tax year.  We'll pull what we can from your ERP and walk you through the rest.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Form type */}
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                            Form Type
                        </label>
                        <div className="space-y-2">
                            {FORM_OPTIONS.map(opt => {
                                const checked = opt.value === formType;
                                return (
                                    <label
                                        key={opt.value}
                                        className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                                            checked
                                                ? 'border-orange-400 bg-orange-50'
                                                : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="formType"
                                            value={opt.value}
                                            checked={checked}
                                            onChange={() => setFormType(opt.value)}
                                            className="mt-1 accent-orange-500"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-black text-gray-900">{opt.label}</p>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                                                Entity type: {opt.entity}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tax year */}
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                            Tax Year
                        </label>
                        <select
                            value={taxYear}
                            onChange={e => setTaxYear(Number(e.target.value))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                        >
                            {YEAR_OPTIONS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* EIN */}
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                            Employer Identification Number (EIN) *
                        </label>
                        <input
                            type="text"
                            value={entityEin}
                            onChange={e => setEntityEin(e.target.value)}
                            placeholder="XX-XXXXXXX"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                            required
                        />
                        <p className="text-[10px] text-gray-400 mt-1">9-digit federal EIN, e.g. 12-3456789</p>
                    </div>

                    {/* Entity name (optional) */}
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                            Company Name (optional)
                        </label>
                        <input
                            type="text"
                            value={entityName}
                            onChange={e => setEntityName(e.target.value)}
                            placeholder="e.g. Acme Industries Inc."
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                        />
                    </div>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm font-bold text-rose-700 flex items-center gap-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={busy || !entityEin}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white rounded-xl text-sm font-black uppercase tracking-wide transition-all shadow-md"
                    >
                        {busy
                            ? <><Loader2 size={16} className="animate-spin" /> Starting…</>
                            : <><FileText size={16} /> Start Filing — {selected?.value.toUpperCase()}</>
                        }
                    </button>
                </form>
            </div>
        </div>
    );
}
