// Calculator — full invoice-shaped tax calculator (Session 1E).
//
// Distinct from the Quick Calculator on /tax/engine.  That one is a
// single-amount real-time toy for exploring rules.  This is the
// dedicated calculator the prompt asked for:
//   - Seller-state + buyer-state dropdowns (with live combined-rate
//     display under the buyer)
//   - Add/remove line items, each with category + qty + unit price
//     + taxable toggle
//   - Optional exemption-cert toggle + cert-number input
//   - Calculate Tax button — POSTs to /api/v1/tax/calculate
//   - Results panel with full per-line breakdown + summary
//
// All money values are in font-mono per the prompt's UX spec.
// Badges colour-coded: green = exempt, amber = taxable.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Calculator as CalculatorIcon,
    Plus,
    Trash2,
    FileCheck,
    Sparkles,
    AlertCircle,
} from 'lucide-react';
import { US_STATES, PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABEL } from './data/constants';
import {
    calculateTaxApi,
    type CalculateLineBreakdown,
    type CalculateRequest,
    type CalculateResponse,
} from './integrations/taxEngineApi';
import { formatCurrency } from '../../services/settingsService';

// ─── Line-item shape used in the form (pre-submit) ───────────────────

interface LineItemForm {
    description: string;
    category: string;
    quantity: string;
    unitPrice: string;
    taxable: boolean;
}

const EMPTY_LINE: LineItemForm = {
    description: '',
    category: 'GENERAL',
    quantity: '1',
    unitPrice: '',
    taxable: true,
};

// US state dropdown options — sorted by 2-letter code (alphabetical) so
// the order is predictable for keyboard users.
const STATE_OPTIONS = Object.values(US_STATES).sort((a, b) =>
    a.stateCode.localeCompare(b.stateCode),
);

export default function Calculator() {
    const navigate = useNavigate();

    // Form state.
    const [sellerState, setSellerState] = useState<string>('');
    const [buyerState, setBuyerState] = useState<string>('CA');
    const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...EMPTY_LINE }]);
    const [customerId, setCustomerId] = useState('');
    const [useExemptionCert, setUseExemptionCert] = useState(false);
    const [exemptCertNum, setExemptCertNum] = useState('');

    // Result + loading state.
    const [result, setResult] = useState<CalculateResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Live rate display under the buyer-state dropdown (from US_STATES
    // constant — no backend call needed for the headline number).
    const buyerStateInfo = useMemo(() => US_STATES[buyerState], [buyerState]);

    // ─── Line-item handlers ──────────────────────────────────────────

    const addLine = () => setLineItems([...lineItems, { ...EMPTY_LINE }]);

    const removeLine = (idx: number) => {
        if (lineItems.length <= 1) {
            // Always keep at least one line — replace with blank instead of removing.
            setLineItems([{ ...EMPTY_LINE }]);
            return;
        }
        setLineItems(lineItems.filter((_, i) => i !== idx));
    };

    const updateLine = (idx: number, patch: Partial<LineItemForm>) => {
        setLineItems(lineItems.map((li, i) => (i === idx ? { ...li, ...patch } : li)));
    };

    // ─── Submit ──────────────────────────────────────────────────────

    const handleCalculate = async () => {
        setError(null);
        setResult(null);

        // Quick client-side validation before round-tripping.
        if (!buyerState) {
            setError('Pick a buyer state.');
            return;
        }
        if (lineItems.length === 0) {
            setError('Add at least one line item.');
            return;
        }
        const parsedLines = lineItems.map((li, idx) => ({
            description: li.description.trim() || `Line ${idx + 1}`,
            category: li.category || undefined,
            quantity: parseFloat(li.quantity) || 0,
            unitPrice: parseFloat(li.unitPrice) || 0,
            taxable: li.taxable,
            lineId: `l${idx}`,
        }));
        if (parsedLines.every(li => li.quantity * li.unitPrice === 0)) {
            setError('Every line has zero amount. Fill in at least one quantity × unit price.');
            return;
        }

        const payload: CalculateRequest = {
            buyerState,
            sellerState: sellerState || undefined,
            customerId: customerId.trim() || undefined,
            exemptCertNum: useExemptionCert ? exemptCertNum.trim() || undefined : undefined,
            lineItems: parsedLines,
        };

        setLoading(true);
        try {
            const { result: r, error: err } = await calculateTaxApi(payload);
            if (err || !r) {
                setError(err || 'Calculation failed');
            } else {
                setResult(r);
            }
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setLineItems([{ ...EMPTY_LINE }]);
        setCustomerId('');
        setUseExemptionCert(false);
        setExemptCertNum('');
        setResult(null);
        setError(null);
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all"
                >
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                            <CalculatorIcon size={22} className="text-orange-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                Tax Calculator
                            </h1>
                            <p className="text-xs text-gray-500 mt-1">
                                Full invoice-shaped tax calculation. Persists every result as a draft transaction.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={resetForm}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* States row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seller state */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                        Seller State (origin)
                    </label>
                    <select
                        value={sellerState}
                        onChange={e => setSellerState(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                    >
                        <option value="">— Optional —</option>
                        {STATE_OPTIONS.map(s => (
                            <option key={s.stateCode} value={s.stateCode}>
                                {s.stateCode} — {s.stateName}
                            </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                        Recorded for audit. Calculation is destination-based on the buyer state.
                    </p>
                </div>

                {/* Buyer state + live rate */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                        Buyer State (destination) *
                    </label>
                    <select
                        value={buyerState}
                        onChange={e => setBuyerState(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                    >
                        {STATE_OPTIONS.map(s => (
                            <option key={s.stateCode} value={s.stateCode}>
                                {s.stateCode} — {s.stateName}
                            </option>
                        ))}
                    </select>
                    {buyerStateInfo && (
                        <div className="mt-3 flex items-center gap-2 text-xs">
                            <span className="text-gray-400 font-bold uppercase tracking-wider">Live rate:</span>
                            <span className="font-mono font-black text-orange-700">
                                {buyerStateInfo.combinedRate.toFixed(3)}%
                            </span>
                            <span className="text-gray-400 font-mono">
                                ({buyerStateInfo.stateRate.toFixed(2)}% state + {buyerStateInfo.avgLocalRate.toFixed(2)}% avg local)
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Line items */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                            Line Items · {lineItems.length}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Each row is one taxable line. Add as many as the invoice has.
                        </p>
                    </div>
                    <button
                        onClick={addLine}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                    >
                        <Plus size={14} /> Add Line
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {['Description', 'Category', 'Qty', 'Unit Price', 'Taxable', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {lineItems.map((li, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <input
                                            type="text"
                                            value={li.description}
                                            onChange={e => updateLine(idx, { description: e.target.value })}
                                            placeholder={`Line ${idx + 1}`}
                                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-orange-400"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={li.category}
                                            onChange={e => updateLine(idx, { category: e.target.value })}
                                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-orange-400"
                                        >
                                            {PRODUCT_CATEGORIES.map(c => (
                                                <option key={c.code} value={c.code}>{c.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={li.quantity}
                                            onChange={e => updateLine(idx, { quantity: e.target.value })}
                                            className="w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-right focus:outline-none focus:border-orange-400"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={li.unitPrice}
                                            onChange={e => updateLine(idx, { unitPrice: e.target.value })}
                                            placeholder="0.00"
                                            className="w-28 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-right focus:outline-none focus:border-orange-400"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => updateLine(idx, { taxable: !li.taxable })}
                                            className={`relative w-9 h-5 rounded-full transition-all ${li.taxable ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            title={li.taxable ? 'Taxable — click to mark exempt' : 'Marked non-taxable — click to mark taxable'}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${li.taxable ? 'left-4' : 'left-0.5'}`} />
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => removeLine(idx)}
                                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-all"
                                            title="Remove line"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Customer + exemption cert */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                        Customer ID (optional)
                    </label>
                    <input
                        type="text"
                        value={customerId}
                        onChange={e => setCustomerId(e.target.value)}
                        placeholder="e.g. ACME-CORP"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        Used to look up a customer-level TaxExemption.
                    </p>
                </div>
                <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                        <input
                            type="checkbox"
                            checked={useExemptionCert}
                            onChange={e => setUseExemptionCert(e.target.checked)}
                            className="w-4 h-4 accent-purple-600"
                        />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <FileCheck size={11} /> Apply Exemption Certificate
                        </span>
                    </label>
                    {useExemptionCert && (
                        <input
                            type="text"
                            value={exemptCertNum}
                            onChange={e => setExemptCertNum(e.target.value)}
                            placeholder="Cert number (e.g. ST-119-001)"
                            className="w-full border border-purple-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-purple-400"
                        />
                    )}
                </div>
            </div>

            {/* Calculate button + errors */}
            <div className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={handleCalculate}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl text-sm font-black uppercase tracking-wide transition-all shadow-md"
                >
                    <Sparkles size={16} />
                    {loading ? 'Calculating…' : 'Calculate Tax'}
                </button>
                {error && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}
            </div>

            {/* Results */}
            {result && <ResultsPanel result={result} />}
        </div>
    );
}

// ─── Results panel ───────────────────────────────────────────────────

function ResultsPanel({ result }: { result: CalculateResponse }) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                    <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                        Result · {result.transactionId}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Saved as draft. View on the Transactions page.
                    </p>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    result.status === 'committed' ? 'bg-emerald-100 text-emerald-700'
                        : result.status === 'cancelled' ? 'bg-rose-100 text-rose-700'
                        : 'bg-gray-100 text-gray-700'
                }`}>
                    {result.status}
                </span>
            </div>

            {/* Per-line breakdown */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            {['#', 'Description', 'Category', 'Line Total', 'Rate', 'State Tax', 'Local Tax', 'Total Tax', 'Status'].map(h => (
                                <th key={h} className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {result.lineBreakdown.map((line: CalculateLineBreakdown, idx: number) => (
                            <tr key={line.lineId ?? idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{line.description || `Line ${idx + 1}`}</td>
                                <td className="px-4 py-3 text-xs text-gray-500">
                                    {line.category ? PRODUCT_CATEGORY_LABEL[line.category] || line.category : '—'}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-gray-900 text-right">{formatCurrency(line.lineTotal)}</td>
                                <td className="px-4 py-3 text-sm font-mono text-orange-600">{line.rate.toFixed(3)}%</td>
                                <td className="px-4 py-3 text-sm font-mono text-gray-700 text-right">{formatCurrency(line.stateTax)}</td>
                                <td className="px-4 py-3 text-sm font-mono text-gray-700 text-right">{formatCurrency(line.localTax)}</td>
                                <td className="px-4 py-3 text-sm font-mono font-black text-gray-900 text-right">{formatCurrency(line.totalTax)}</td>
                                <td className="px-4 py-3">
                                    <SourceBadge source={line.source} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            <div className="border-t border-gray-100 bg-gray-50 p-5">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <SummaryStat label="Subtotal" value={formatCurrency(result.subtotal)} />
                    <SummaryStat label="State Tax" value={formatCurrency(result.stateTax)} />
                    <SummaryStat label="Local Tax" value={formatCurrency(result.localTax)} />
                    <SummaryStat
                        label="Effective Rate"
                        value={`${result.effectiveRate.toFixed(3)}%`}
                        accent="orange"
                    />
                    <SummaryStat label="Grand Total" value={formatCurrency(result.grandTotal)} accent="orange-bold" />
                </div>
            </div>
        </div>
    );
}

function SourceBadge({ source }: { source: string }) {
    // Color-code per the prompt spec: green for any exempt source, amber
    // for anything that was actually taxed.  Other sources (no-rate,
    // no-nexus) get a neutral gray.
    const isExempt = source === 'exempt' || source === 'category-exempt' || source === 'non-taxable';
    const isTaxed = source === 'rule' || source === 'us-state-default' || source === 'provider';
    const cls = isExempt
        ? 'bg-emerald-100 text-emerald-700'
        : isTaxed
            ? 'bg-amber-100 text-amber-700'
            : 'bg-gray-100 text-gray-600';
    return (
        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cls}`}>
            {isExempt ? 'Exempt' : isTaxed ? 'Taxable' : source}
        </span>
    );
}

function SummaryStat({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent?: 'orange' | 'orange-bold';
}) {
    const valueClass =
        accent === 'orange-bold'
            ? 'text-orange-700 font-black text-lg'
            : accent === 'orange'
                ? 'text-orange-600 font-black'
                : 'text-gray-900 font-bold';
    return (
        <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <p className={`font-mono ${valueClass}`}>{value}</p>
        </div>
    );
}
