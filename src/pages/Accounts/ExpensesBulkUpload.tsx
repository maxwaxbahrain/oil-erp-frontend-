// ─── STEP 6 — AI Bulk Upload page for the Expenses module ───────────
// New route: /finance/expenses/bulk-upload
//
// Four input modes: Image of expense list, CSV file, PDF / bank
// statement, pasted text.  AI parses → review table with editable
// cells + per-row duplicate / policy flags + confidence indicators.
// User can delete any row and import "Ready" (no flags) or "All".

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Upload, FileText, ClipboardPaste, Image as ImageIcon,
    Loader2, Trash2, AlertTriangle, CheckCircle, ShieldAlert,
} from 'lucide-react';
import {
    parseBulkExpenses,
    saveExpense,
    type ParsedExpenseRow,
    type BulkInput,
} from '../../services/expenseService';

type Tab = 'image' | 'csv' | 'pdf' | 'text';

export default function ExpensesBulkUpload() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<Tab>('image');
    const [rows, setRows] = useState<ParsedExpenseRow[]>([]);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [textInput, setTextInput] = useState('');
    const [importStats, setImportStats] = useState<string | null>(null);

    const handleParse = async (input: BulkInput) => {
        setProcessing(true);
        setError(null);
        setRows([]);
        setImportStats(null);
        try {
            const parsed = await parseBulkExpenses(input);
            setRows(parsed);
            if (parsed.length === 0) setError('AI did not find any expense rows in this input.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not parse the input.');
        } finally {
            setProcessing(false);
        }
    };

    const handleFile = (kind: 'image' | 'pdf') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) void handleParse({ kind, file });
    };

    const handleCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result || '');
            void handleParse({ kind: 'csv', text });
        };
        reader.onerror = () => setError('Could not read the CSV file.');
        reader.readAsText(file);
    };

    const handleTextParse = () => {
        const text = textInput.trim();
        if (!text) { setError('Paste some text first.'); return; }
        void handleParse({ kind: 'text', text });
    };

    const updateCell = <K extends keyof ParsedExpenseRow>(id: string, key: K, value: ParsedExpenseRow[K]) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));
    };

    const deleteRow = (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const importRows = async (rowsToImport: ParsedExpenseRow[]) => {
        if (rowsToImport.length === 0) return;
        setProcessing(true);
        setError(null);
        try {
            for (const r of rowsToImport) {
                await saveExpense({
                    vendor: r.vendor,
                    amount: r.amount,
                    currency: r.currency || 'USD',
                    date: r.date,
                    category: r.category,
                    description: r.description,
                    paymentMethod: 'Card',
                    isRecurring: false,
                    status: 'Draft',
                    is_duplicate_flag: r.isDuplicate,
                    duplicate_of_id: r.duplicateOfId,
                    policy_flags: r.policyFlags.length > 0 ? r.policyFlags : undefined,
                    aiExtracted: true,
                    aiConfidence: r.extractionConfidence,
                });
            }
            const skipped = rows.length - rowsToImport.length;
            setImportStats(`✓ Imported ${rowsToImport.length} expense${rowsToImport.length === 1 ? '' : 's'}${skipped > 0 ? ` · ${skipped} flagged row${skipped === 1 ? '' : 's'} skipped` : ''}`);
            setRows([]);
            setTextInput('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Some rows failed to save.');
        } finally {
            setProcessing(false);
        }
    };

    const ready = rows.filter(r => !r.isDuplicate && r.policyFlags.length === 0);

    return (
        <div className="space-y-5 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/finance/expenses')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 transition-all"
                >
                    <ArrowLeft size={14} /> Back to Expenses
                </button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <Upload size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">AI Bulk Upload</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Upload many expenses at once.  AI extracts vendor, date, amount, and category for every row.  Review and edit before importing.
                    </p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex gap-1">
                {([
                    { id: 'image' as const, icon: ImageIcon, label: 'Image' },
                    { id: 'csv'   as const, icon: FileText,  label: 'CSV File' },
                    { id: 'pdf'   as const, icon: FileText,  label: 'PDF / Bank Statement' },
                    { id: 'text'  as const, icon: ClipboardPaste, label: 'Paste Text' },
                ]).map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            <Icon size={14} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Input area per tab */}
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                {tab === 'image' && (
                    <label className="block border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-gray-400 transition-colors cursor-pointer">
                        <input type="file" accept="image/*" onChange={handleFile('image')} className="hidden" disabled={processing} />
                        <ImageIcon size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Drop photo of an expense list or receipts</p>
                        <p className="text-xs text-gray-400 mt-2">JPG, PNG · up to 5 MB</p>
                    </label>
                )}
                {tab === 'csv' && (
                    <label className="block border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-gray-400 transition-colors cursor-pointer">
                        <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={handleCsv} className="hidden" disabled={processing} />
                        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Drop CSV / TSV file</p>
                        <p className="text-xs text-gray-400 mt-2">For .xlsx, export as CSV first</p>
                    </label>
                )}
                {tab === 'pdf' && (
                    <label className="block border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-gray-400 transition-colors cursor-pointer">
                        <input type="file" accept="application/pdf" onChange={handleFile('pdf')} className="hidden" disabled={processing} />
                        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Drop PDF / Bank Statement</p>
                        <p className="text-xs text-gray-400 mt-2">Up to 5 MB</p>
                    </label>
                )}
                {tab === 'text' && (
                    <div className="space-y-3">
                        <textarea
                            value={textInput}
                            onChange={e => setTextInput(e.target.value)}
                            placeholder="Paste expense rows, bank-statement lines, email content, etc."
                            rows={8}
                            disabled={processing}
                            className="w-full border-2 border-gray-200 rounded-2xl p-4 text-sm focus:outline-none focus:border-gray-900 disabled:opacity-50"
                        />
                        <button
                            onClick={handleTextParse}
                            disabled={processing || !textInput.trim()}
                            className="w-full py-3 bg-gray-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-black disabled:opacity-50"
                        >
                            {processing ? 'Parsing…' : 'Parse with AI'}
                        </button>
                    </div>
                )}
            </div>

            {/* Status / error */}
            {processing && (
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center gap-3 text-gray-700">
                    <Loader2 size={20} className="animate-spin text-purple-600" />
                    <span className="text-sm font-bold uppercase tracking-widest">AI processing — extracting + categorizing rows…</span>
                </div>
            )}
            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <AlertTriangle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700">{error}</p>
                </div>
            )}
            {importStats && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <CheckCircle size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-emerald-700">{importStats}</p>
                </div>
            )}

            {/* Review table */}
            {rows.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <div>
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Review {rows.length} extracted row{rows.length === 1 ? '' : 's'}</h2>
                            <p className="text-xs text-gray-500 mt-0.5">{ready.length} ready · {rows.length - ready.length} flagged</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    <th className="px-3 py-3 text-left">#</th>
                                    <th className="px-3 py-3 text-left">Date</th>
                                    <th className="px-3 py-3 text-left">Vendor</th>
                                    <th className="px-3 py-3 text-right">Amount</th>
                                    <th className="px-3 py-3 text-left">Cur.</th>
                                    <th className="px-3 py-3 text-left">Category (AI)</th>
                                    <th className="px-3 py-3 text-center">Confidence</th>
                                    <th className="px-3 py-3 text-left">Flags</th>
                                    <th className="px-3 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.map((r, idx) => {
                                    const flagged = r.isDuplicate || r.policyFlags.length > 0;
                                    const rowBg =
                                        r.isDuplicate           ? 'bg-amber-50/50' :
                                        r.policyFlags.length > 0 ? 'bg-rose-50/50'  :
                                                                   '';
                                    return (
                                        <tr key={r.id} className={rowBg}>
                                            <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="date"
                                                    value={r.date}
                                                    onChange={e => updateCell(r.id, 'date', e.target.value)}
                                                    className="text-xs bg-transparent border-b border-gray-200 focus:border-gray-900 outline-none"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={r.vendor}
                                                    onChange={e => updateCell(r.id, 'vendor', e.target.value)}
                                                    className="text-xs w-full bg-transparent border-b border-gray-200 focus:border-gray-900 outline-none"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={r.amount}
                                                    onChange={e => updateCell(r.id, 'amount', Number(e.target.value) || 0)}
                                                    className="text-xs w-24 text-right font-mono bg-transparent border-b border-gray-200 focus:border-gray-900 outline-none"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-xs text-gray-500">{r.currency}</td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={r.category}
                                                    onChange={e => updateCell(r.id, 'category', e.target.value)}
                                                    className="text-xs w-full bg-transparent border-b border-gray-200 focus:border-gray-900 outline-none"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                                    r.extractionConfidence >= 90 ? 'bg-emerald-100 text-emerald-700' :
                                                    r.extractionConfidence >= 60 ? 'bg-amber-100 text-amber-700' :
                                                                                   'bg-rose-100 text-rose-700'
                                                }`}>{r.extractionConfidence}%</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-col gap-1">
                                                    {r.isDuplicate && (
                                                        <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                                                            <ShieldAlert size={11} /> duplicate
                                                        </span>
                                                    )}
                                                    {r.policyFlags.map((f, i) => (
                                                        <span key={i} className="text-[10px] font-bold text-rose-700" title={f.message}>
                                                            ⚠ {f.rule}
                                                        </span>
                                                    ))}
                                                    {!flagged && (
                                                        <span className="text-[10px] font-bold text-emerald-700">ready</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <button
                                                    onClick={() => deleteRow(r.id)}
                                                    aria-label="Delete row"
                                                    className="p-1 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Action buttons */}
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3 flex-wrap">
                        <button
                            onClick={() => void importRows(ready)}
                            disabled={processing || ready.length === 0}
                            className="flex-1 min-w-[180px] py-3 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 disabled:opacity-40"
                        >
                            Import {ready.length} Ready
                        </button>
                        <button
                            onClick={() => void importRows(rows)}
                            disabled={processing || rows.length === 0}
                            className="flex-1 min-w-[180px] py-3 bg-gray-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-black disabled:opacity-40"
                        >
                            Import All ({rows.length})
                        </button>
                        <button
                            onClick={() => setRows([])}
                            disabled={processing}
                            className="px-6 py-3 bg-white border border-gray-200 text-xs font-black uppercase tracking-widest text-gray-600 rounded-xl hover:bg-gray-100 disabled:opacity-40"
                        >
                            Discard All
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
