// ─── STEP 8 — Mileage Tracker page ──────────────────────────────────
// New route: /finance/expenses/mileage
//
// Form to log a mileage trip + AI distance estimator + submit for
// reimbursement via backend trip log.  Below: table of this month's trips.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, MapPin, Route, Loader2, CheckCircle, AlertTriangle, Car, Trash2,
} from 'lucide-react';
import {
    estimateMileage,
    getMileageSettings,
    listMileageTrips,
    createMileageTrip,
    deleteMileageTrip,
    type MileageTrip,
    type MileageEstimate,
    type DistanceUnit,
    type MileageSettings,
} from '../../services/expenseService';
import { localIsoDate } from '../../utils/localDate';

function currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function unitShort(unit: DistanceUnit): string {
    return unit === 'km' ? 'km' : 'mi';
}

export default function ExpenseMileageTracker() {
    const navigate = useNavigate();
    const [fromLocation, setFromLocation] = useState('');
    const [toLocation, setToLocation] = useState('');
    const [distance, setDistance] = useState<number>(0);
    const [rate, setRate] = useState<number>(0.7);
    const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('miles');
    const [purpose, setPurpose] = useState('');
    const [date, setDate] = useState(localIsoDate());
    const [roundTrip, setRoundTrip] = useState(false);

    const [estimating, setEstimating] = useState(false);
    const [estimate, setEstimate] = useState<MileageEstimate | null>(null);

    const [saving, setSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [trips, setTrips] = useState<MileageTrip[]>([]);
    const [monthTotals, setMonthTotals] = useState({ count: 0, total_distance: 0, total_amount: 0 });
    const [loadingTrips, setLoadingTrips] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const unitLabel = unitShort(distanceUnit);
    const effectiveDistance = roundTrip ? distance * 2 : distance;
    const computedAmount = +(effectiveDistance * rate).toFixed(2);

    const reloadTrips = useCallback(async () => {
        setLoadingTrips(true);
        try {
            const list = await listMileageTrips(currentMonthKey());
            setTrips(list.items);
            setMonthTotals({
                count: list.count,
                total_distance: list.total_distance,
                total_amount: list.total_amount,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load trips.');
        } finally {
            setLoadingTrips(false);
        }
    }, []);

    useEffect(() => {
        void (async () => {
            try {
                const settings: MileageSettings = await getMileageSettings();
                setDistanceUnit(settings.distance_unit);
                setRate(settings.mileage_rate);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load mileage settings.');
            } finally {
                setLoadingSettings(false);
            }
            await reloadTrips();
        })();
    }, [reloadTrips]);

    const handleEstimate = async () => {
        setEstimating(true);
        setEstimate(null);
        setError(null);
        try {
            const r = await estimateMileage(fromLocation, toLocation, distanceUnit);
            setEstimate(r);
            setDistance(r.distance);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Estimate failed.');
        } finally {
            setEstimating(false);
        }
    };

    const handleSaveTrip = async () => {
        if (!fromLocation.trim() || !toLocation.trim()) { setError('Enter From and To.'); return; }
        if (!distance || distance <= 0) { setError('Distance must be greater than zero.'); return; }
        setSaving(true);
        setError(null);
        try {
            await createMileageTrip({
                date,
                origin: fromLocation.trim(),
                destination: toLocation.trim(),
                distance,
                roundTrip,
                purpose: purpose.trim() || undefined,
                createExpense: true,
            });

            setSavedFlash('Submitted for approval');
            setFromLocation('');
            setToLocation('');
            setDistance(0);
            setPurpose('');
            setRoundTrip(false);
            setEstimate(null);
            await reloadTrips();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTrip = async (trip: MileageTrip) => {
        if (trip.expense_id != null) return;
        setDeletingId(trip.id);
        setError(null);
        try {
            await deleteMileageTrip(trip.id);
            await reloadTrips();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10 animate-in fade-in duration-300">
            <div>
                <button
                    onClick={() => navigate('/finance/expenses')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 transition-all"
                >
                    <ArrowLeft size={14} /> Back to Expenses
                </button>
            </div>

            {/* Header */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <Route size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Mileage Tracker</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Log a trip, let AI estimate the distance, submit for reimbursement.
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                {loadingSettings && (
                    <div className="text-xs text-gray-400">Loading tenant mileage settings…</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">From <span className="text-rose-500">*</span></label>
                        <div className="relative">
                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={fromLocation}
                                onChange={e => setFromLocation(e.target.value)}
                                placeholder="e.g. 5th Ave Manhattan"
                                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">To <span className="text-rose-500">*</span></label>
                        <div className="relative">
                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={toLocation}
                                onChange={e => setToLocation(e.target.value)}
                                placeholder="e.g. JFK Airport"
                                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900"
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleEstimate}
                    disabled={estimating || !fromLocation || !toLocation}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
                >
                    {estimating ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
                    {estimating ? 'Asking AI…' : 'Calculate Distance with AI'}
                </button>

                {estimate && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-800">
                        AI estimate: <strong>{estimate.distance.toFixed(1)} {unitLabel}</strong> · confidence {estimate.confidence}
                        {estimate.note && <span className="block mt-1 text-purple-700">{estimate.note}</span>}
                        <span className="block mt-1 text-[10px] text-purple-600 uppercase tracking-widest">You can override below if your odometer disagrees.</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Distance ({unitLabel})</label>
                        <input
                            type="number"
                            step="0.1"
                            value={distance || ''}
                            onChange={e => setDistance(Number(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-gray-900"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900"
                        />
                    </div>
                </div>

                {!loadingSettings && (
                    <p className="text-xs text-gray-600">
                        Rate: <span className="font-mono font-bold">${rate.toFixed(2)}</span> / {unitLabel} · set in Expense settings
                    </p>
                )}

                <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Trip purpose</label>
                    <input
                        type="text"
                        value={purpose}
                        onChange={e => setPurpose(e.target.value)}
                        placeholder="e.g. Client visit, equipment pickup, delivery"
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900"
                    />
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <input
                        type="checkbox"
                        checked={roundTrip}
                        onChange={e => setRoundTrip(e.target.checked)}
                        className="w-4 h-4"
                    />
                    Round trip (doubles distance)
                </label>

                {/* Live total */}
                <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">
                        Total: {effectiveDistance.toFixed(1)} {unitLabel} × ${rate.toFixed(2)}/{unitLabel}
                    </span>
                    <span className="text-2xl font-black text-emerald-800 font-mono">${computedAmount.toFixed(2)}</span>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle size={14} className="text-rose-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-700">{error}</p>
                    </div>
                )}
                {savedFlash && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
                        <CheckCircle size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-emerald-700">{savedFlash}</p>
                    </div>
                )}

                <button
                    onClick={handleSaveTrip}
                    disabled={saving || !fromLocation || !toLocation || !distance}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Car size={14} />}
                    {saving ? 'Saving…' : 'Save trip & submit expense'}
                </button>
            </div>

            {/* Month log */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">This month&apos;s trips</h2>
                    <span className="text-xs font-black text-gray-600">
                        {monthTotals.count} trip{monthTotals.count === 1 ? '' : 's'} · {monthTotals.total_distance.toFixed(1)} {unitLabel} · <span className="text-emerald-700">${monthTotals.total_amount.toFixed(2)}</span>
                    </span>
                </div>
                {loadingTrips ? (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">Loading…</div>
                ) : trips.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">No trips logged this month yet.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                <th className="px-4 py-2 text-left">Date</th>
                                <th className="px-4 py-2 text-left">From → To</th>
                                <th className="px-4 py-2 text-left">Purpose</th>
                                <th className="px-4 py-2 text-right">{unitLabel === 'mi' ? 'Mi' : 'Km'}</th>
                                <th className="px-4 py-2 text-right">Rate</th>
                                <th className="px-4 py-2 text-right">Amount</th>
                                <th className="px-4 py-2 text-right" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {trips.map(t => (
                                <tr key={t.id}>
                                    <td className="px-4 py-2 text-xs text-gray-700">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="px-4 py-2 text-xs text-gray-900 font-bold">{t.origin} → {t.destination}{t.round_trip ? ' ↻' : ''}</td>
                                    <td className="px-4 py-2 text-xs text-gray-500">{t.purpose || '—'}</td>
                                    <td className="px-4 py-2 text-xs text-right font-mono">{t.distance.toFixed(1)}</td>
                                    <td className="px-4 py-2 text-xs text-right font-mono">${t.rate.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-xs text-right font-mono font-black text-emerald-700">${t.amount.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-xs text-right">
                                        {t.expense_id == null ? (
                                            <button
                                                type="button"
                                                disabled={deletingId === t.id}
                                                onClick={() => void handleDeleteTrip(t)}
                                                className="text-rose-600 hover:text-rose-800 disabled:opacity-40"
                                                title="Delete trip"
                                            >
                                                {deletingId === t.id ? <Loader2 size={14} className="animate-spin inline" /> : <Trash2 size={14} className="inline" />}
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-gray-400 uppercase">Linked</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
