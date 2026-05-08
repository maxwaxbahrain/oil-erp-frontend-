import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ExternalLink, MapPin, Pencil, Phone, Route, Star, UserPlus, X } from 'lucide-react';
import {
  createRouteStop,
  getRoutes,
  getRouteStops,
  searchRouteCustomers,
  updateRouteStop,
  type RouteDay,
  type RouteStop,
} from '../../services/routeService';
import { getCustomers, syncRoutePriorityToCustomers } from '../../services/customerService';

export default function RouteNavigator() {
  const [days, setDays] = useState<RouteDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeListError, setRouteListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncingPriority, setSyncingPriority] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const autoSyncedRef = useRef(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    address: '',
    business_type: 'Auto Repair',
    phone: '',
    neighborhood: 'General',
    opening_balance: 0,
    credit_limit: 0,
    is_priority: false,
    notes: '',
    gps_location: '',
  });
  const [stopsListVersion, setStopsListVersion] = useState(0);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    phone: '',
    business_type: '',
    neighborhood: '',
    is_priority: false,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  /** When `route_customers` has no rows, show the main Customers registry so the page is not empty. */
  const [useRegistryFallback, setUseRegistryFallback] = useState(false);

  const loadRegistryAsStops = async () => {
    setLoading(true);
    try {
      const customers = await getCustomers();
      const mapped: RouteStop[] = customers.map((c, i) => {
        const numId = parseInt(String(c.id), 10);
        const safeId = Number.isFinite(numId) ? -Math.abs(numId) : -(i + 1);
        return {
          id: safeId,
          name: c.name || '—',
          address: c.address || '—',
          business_type: (c.category || 'Customer').replace(/_/g, ' '),
          phone: c.phone || null,
          day_id: 0,
          day_name: 'Customer registry',
          neighborhood: '—',
          is_priority: false,
          stop_order: i + 1,
        };
      });
      setStops(mapped);
      setUseRegistryFallback(true);
      setSelectedDay(null);
      setRouteListError(null);
    } catch (e) {
      console.error(e);
      setStops([]);
      setRouteListError(
        'Unable to load route days or customer list. Start the FastAPI backend on port 8000 and use npm dev with /api proxy (see vite.config).'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadDays = async () => {
      try {
        setRouteListError(null);
        const data = await getRoutes();
        setDays(data);
        if (data.length > 0) {
          setUseRegistryFallback(false);
          setSelectedDay(data[0].day_id);
        } else {
          await loadRegistryAsStops();
        }
      } catch (err) {
        console.error(err);
        await loadRegistryAsStops();
      }
    };
    loadDays();
  }, []);

  // Push every ★ priority route stop into the global Customers registry (same as opening the Customer list).
  useEffect(() => {
    if (import.meta.env.VITE_CUSTOMER_MOCK === 'true' || autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    let alive = true;
    (async () => {
      try {
        const result = await syncRoutePriorityToCustomers();
        if (!alive) return;
        if (result.created > 0) {
          setSyncMessage(
            `Customer registry: added ${result.created} priority stop(s). ${result.skipped_existing} already matched.`
          );
        }
      } catch {
        /* Backend offline or mock — user can use manual sync */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const loadStops = async () => {
      if (!selectedDay) return;
      setLoading(true);
      setRouteListError(null);
      try {
        const data = query.trim()
          ? await searchRouteCustomers({
              q: query.trim(),
              day_id: selectedDay,
              priority_only: priorityOnly,
              limit: 2000,
            })
          : await getRouteStops(selectedDay);
        setStops(priorityOnly ? data.filter((s) => s.is_priority) : data);
      } catch (err) {
        console.error(err);
        setRouteListError('Unable to load route stops. Check API base URL and CORS (backend must allow this origin).');
      } finally {
        setLoading(false);
      }
    };
    loadStops();
  }, [selectedDay, query, priorityOnly, stopsListVersion]);

  /** Client-side filter when showing the customer registry fallback (no `route_customers` rows). */
  const displayStops = useMemo(() => {
    if (!useRegistryFallback) {
      return stops;
    }
    let list = stops;
    if (priorityOnly) {
      list = list.filter((s) => s.is_priority);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          (s.phone && String(s.phone).toLowerCase().includes(q)) ||
          s.business_type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [useRegistryFallback, stops, query, priorityOnly]);

  const openEditStop = (stop: RouteStop) => {
    if (stop.id < 0) return;
    setEditError(null);
    setEditingStop(stop);
    setEditForm({
      name: stop.name,
      address: stop.address,
      phone: stop.phone ?? '',
      business_type: stop.business_type,
      neighborhood: stop.neighborhood,
      is_priority: stop.is_priority,
    });
  };

  const closeEditStop = () => {
    setEditingStop(null);
    setEditError(null);
  };

  const handleSaveEditStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay || !editingStop) return;
    if (!editForm.name.trim() || !editForm.address.trim()) {
      setEditError('Name and address are required.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await updateRouteStop(selectedDay, editingStop.id, {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        phone: editForm.phone.trim() || null,
        business_type: editForm.business_type.trim() || editingStop.business_type,
        neighborhood: editForm.neighborhood.trim() || 'General',
        is_priority: editForm.is_priority,
      });
      const updatedDays = await getRoutes();
      setDays(updatedDays);
      setStopsListVersion((v) => v + 1);
      closeEditStop();
    } catch (err) {
      console.error(err);
      setEditError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const activeDay = useMemo(() => days.find((d) => d.day_id === selectedDay) || null, [days, selectedDay]);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );
  const priorityCount = useMemo(() => displayStops.filter((s) => s.is_priority).length, [displayStops]);
  const estimatedRemaining = useMemo(
    () => Math.max(0, (activeDay?.total_stops ?? displayStops.length) - displayStops.length),
    [activeDay, displayStops.length]
  );

  const handleSyncPriorityToCustomers = async () => {
    setSyncingPriority(true);
    setSyncMessage(null);
    try {
      const result = await syncRoutePriorityToCustomers();
      setSyncMessage(
        `Synced priority (★) stops: ${result.created} new customers in registry, ${result.skipped_existing} already existed (name/address/phone match). Total ★ stops: ${result.total_priority_stops}.`
      );
    } catch (e) {
      console.error(e);
      setSyncMessage(
        e instanceof Error
          ? e.message
          : 'Could not sync. Use live API (not customer mock) and ensure the backend is running.'
      );
    } finally {
      setSyncingPriority(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay || !newCustomer.name.trim() || !newCustomer.address.trim()) {
      setFormError('Customer / business name and service address are required.');
      return;
    }
    try {
      setSubmitting(true);
      setFormError(null);
      await createRouteStop(selectedDay, {
        ...newCustomer,
        name: newCustomer.name.trim(),
        address: newCustomer.address.trim(),
        phone: newCustomer.phone.trim() || undefined,
        notes: newCustomer.notes.trim() || undefined,
        gps_location: newCustomer.gps_location.trim() || undefined,
      });
      setNewCustomer({
        name: '',
        address: '',
        business_type: 'Auto Repair',
        phone: '',
        neighborhood: newCustomer.neighborhood || 'General',
        opening_balance: 0,
        credit_limit: 0,
        is_priority: false,
        notes: '',
        gps_location: '',
      });

      const [updatedDays, updatedStops] = await Promise.all([getRoutes(), getRouteStops(selectedDay)]);
      setDays(updatedDays);
      setStops(updatedStops);
    } catch (err) {
      console.error(err);
      setFormError('Failed to save. Check the API and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 bg-[#fcfaf8] min-h-full">
      <div className="bg-white rounded-xl border border-redwood-border/70 shadow-sm p-5 md:p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full text-white flex items-center justify-center shrink-0" style={{ backgroundColor: '#800020' }}>
            <Route size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-redwood-text-main uppercase tracking-tight">NYC ROUTE NAVIGATOR</h1>
            <p className="text-sm text-redwood-text-muted mt-1">Plan and manage daily delivery routes</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <CalendarDays size={16} className="text-[#800020]" />
          {todayLabel}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-redwood-border/70 shadow-sm p-4 md:p-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col items-stretch gap-2 min-w-[280px]">
          <button
            type="button"
            onClick={handleSyncPriorityToCustomers}
            disabled={syncingPriority}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg text-sm font-black disabled:opacity-50"
            style={{ backgroundColor: '#800020' }}
          >
            <UserPlus size={18} />
            {syncingPriority ? 'Syncing…' : 'Send all ★ priority stops to Customers'}
          </button>
          <p className="text-[11px] text-gray-600 leading-snug">
            Creates a <strong>customer</strong> record for every starred route stop that does not already exist (same name and address).
          </p>
          {syncMessage && <div className="text-xs text-[#800020] bg-[#fdf2f7] border border-[#f5c7d8] rounded-lg px-3 py-2">{syncMessage}</div>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-redwood-border/70 shadow-sm p-4">
        {useRegistryFallback && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            No route schedule found in <code className="text-xs">route_customers</code>. Showing the same customers as <strong>Customers</strong> (registry).
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {days.map((day) => (
            <button
              key={day.day_id}
              type="button"
              onClick={() => setSelectedDay(day.day_id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all duration-200 ${
                selectedDay === day.day_id
                  ? 'text-white border-[#800020]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
              }`}
              style={selectedDay === day.day_id ? { backgroundColor: '#800020' } : undefined}
            >
              <span>{day.day_name}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-black ${selectedDay === day.day_id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {day.total_stops}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-redwood-border/70 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, address, phone, or type..."
          className="border border-redwood-border rounded-lg px-3 py-2.5 text-sm min-w-[280px] md:min-w-[320px] focus:outline-none focus:ring-2 focus:ring-[#800020]/20"
        />
        <label className="text-sm font-semibold flex items-center gap-2 text-gray-700">
          <span className="relative inline-flex items-center">
            <input type="checkbox" checked={priorityOnly} onChange={(e) => setPriorityOnly(e.target.checked)} className="peer sr-only" />
            <span className="w-10 h-6 rounded-full bg-gray-200 peer-checked:bg-[#800020] transition-colors" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
          </span>
          Priority only
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-redwood-border/60 rounded-xl px-4 py-3 shadow-sm">
          <div className="text-[11px] uppercase text-gray-500 font-black">Total stops today</div>
          <div className="text-lg font-black text-redwood-text-main">{displayStops.length}</div>
        </div>
        <div className="bg-white border border-redwood-border/60 rounded-xl px-4 py-3 shadow-sm">
          <div className="text-[11px] uppercase text-gray-500 font-black">Priority stops</div>
          <div className="text-lg font-black text-amber-600">{priorityCount}</div>
        </div>
        <div className="bg-white border border-redwood-border/60 rounded-xl px-4 py-3 shadow-sm">
          <div className="text-[11px] uppercase text-gray-500 font-black">Estimated stops remaining</div>
          <div className="text-lg font-black text-redwood-text-main">{estimatedRemaining}</div>
        </div>
      </div>

      <form onSubmit={handleAddCustomer} className="bg-white rounded-xl border border-redwood-border/70 shadow-sm p-5 space-y-5">
        <header className="border-b border-redwood-border pb-4">
          <h2 className="text-lg font-black text-redwood-text-main uppercase tracking-tight">Add new stop &amp; accounting customer</h2>
          <p className="text-sm text-redwood-text-muted mt-2 max-w-3xl leading-relaxed">
            Use this section to register a <strong>route stop</strong> on the day selected above and the same <strong>customer record</strong> in Accounts Receivable.
          </p>
        </header>

        <div>
          <h3 className="text-xs font-black uppercase text-gray-500 mb-2">Customer &amp; route fields</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Customer / business name" value={newCustomer.name} onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))} className="border border-redwood-border rounded-lg px-3 py-2.5 text-sm" required />
            <input type="text" placeholder="Street address (for route &amp; maps)" value={newCustomer.address} onChange={(e) => setNewCustomer((p) => ({ ...p, address: e.target.value }))} className="border border-redwood-border rounded-lg px-3 py-2.5 text-sm" required />
            <input type="text" placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))} className="border border-redwood-border rounded-lg px-3 py-2.5 text-sm" />
            <input type="text" placeholder="Business type (e.g. Auto Repair)" value={newCustomer.business_type} onChange={(e) => setNewCustomer((p) => ({ ...p, business_type: e.target.value }))} className="border border-redwood-border rounded-lg px-3 py-2.5 text-sm" />
            <input type="text" placeholder="Neighborhood" value={newCustomer.neighborhood} onChange={(e) => setNewCustomer((p) => ({ ...p, neighborhood: e.target.value }))} className="border border-redwood-border rounded-lg px-3 py-2.5 text-sm" />
            <input type="text" placeholder="GPS (lat, lng — optional)" value={newCustomer.gps_location} onChange={(e) => setNewCustomer((p) => ({ ...p, gps_location: e.target.value }))} className="border border-redwood-border rounded-lg px-3 py-2.5 text-sm" />
            <div className="md:col-span-3">
              <textarea placeholder="Notes for customer file (gate codes, delivery notes)" value={newCustomer.notes} onChange={(e) => setNewCustomer((p) => ({ ...p, notes: e.target.value }))} rows={3} className="w-full border border-redwood-border rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div className="md:col-span-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50/70 p-3">
              <div className="text-xs font-black uppercase text-gray-600 tracking-wide">Customer ledger (synced to Sales &amp; Accounts)</div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-700">
                  Opening balance
                  <input type="number" value={newCustomer.opening_balance} onChange={(e) => setNewCustomer((p) => ({ ...p, opening_balance: Number(e.target.value) || 0 }))} className="border border-redwood-border rounded-lg px-3 py-2 text-sm w-[200px] font-normal" />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-700">
                  Credit limit
                  <input type="number" value={newCustomer.credit_limit} onChange={(e) => setNewCustomer((p) => ({ ...p, credit_limit: Number(e.target.value) || 0 }))} className="border border-redwood-border rounded-lg px-3 py-2 text-sm w-[200px] font-normal" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="text-sm font-semibold flex items-center gap-2">
            <input type="checkbox" checked={newCustomer.is_priority} onChange={(e) => setNewCustomer((p) => ({ ...p, is_priority: e.target.checked }))} />
            Priority stop (★)
          </label>
          <button type="submit" disabled={submitting || !selectedDay} className="px-4 py-2.5 text-white rounded-lg text-sm font-bold disabled:opacity-50" style={{ backgroundColor: '#800020' }}>
            {submitting ? 'Saving…' : 'Save to route & customers'}
          </button>
        </div>
        {formError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}
      </form>

      {activeDay && !useRegistryFallback && (
        <div className="bg-white rounded-xl border border-redwood-border/70 shadow-sm p-4 text-sm">
          <span className="font-black">{activeDay.day_name}</span> - {activeDay.total_stops} stops, {activeDay.priority_stops} priority
        </div>
      )}
      {useRegistryFallback && (
        <div className="bg-white rounded-xl border border-redwood-border/70 shadow-sm p-4 text-sm">
          <span className="font-black">Customer registry</span> — {displayStops.length} shown
          {query.trim() || priorityOnly ? ` (filtered)` : ''}
        </div>
      )}

      {routeListError && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">{routeListError}</div>}

      <div className="bg-white rounded-xl border border-redwood-border/70 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-redwood-border">
          <div className="font-black text-sm uppercase">Route stops for selected day {loading ? '(Loading...)' : `(${displayStops.length})`}</div>
        </div>
        <div className="max-h-[65vh] overflow-y-auto bg-[#fffefd]">
          {displayStops.map((stop) => (
            <div key={stop.id} className="px-4 py-3 border-b border-gray-100 hover:bg-[#fdf9fb] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[11px] font-black" style={{ backgroundColor: '#800020' }}>
                      {stop.stop_order}
                    </span>
                    <span className="text-[15px] font-black text-gray-900">{stop.name}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {stop.neighborhood} / {stop.business_type}
                    </span>
                    {stop.is_priority && <Star size={14} className="text-amber-500 fill-amber-500" />}
                  </div>
                  <div className="text-xs text-gray-600 mt-2 flex items-center gap-2">
                    <MapPin size={13} /> {stop.address}
                  </div>
                  {stop.phone && (
                    <a href={`tel:${stop.phone.replace(/[^0-9+]/g, '')}`} className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-2">
                      <Phone size={12} /> {stop.phone}
                    </a>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditStop(stop)}
                    disabled={stop.id < 0}
                    title={stop.id < 0 ? 'Edit route stop after it exists in route_customers' : undefined}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-redwood-border text-xs font-bold text-redwood-text-main bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-xs font-semibold hover:bg-sky-100"
                  >
                    <MapPin size={12} /> Map <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>
          ))}
          {!loading && displayStops.length === 0 && <div className="p-6 text-sm text-gray-500">No stops or customers to show.</div>}
        </div>
      </div>

      {editingStop && selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="presentation" onClick={closeEditStop}>
          <form
            role="dialog"
            aria-labelledby="edit-stop-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveEditStop}
            className="bg-white rounded-xl border border-redwood-border shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-redwood-border pb-3">
              <div>
                <h2 id="edit-stop-title" className="text-lg font-black text-redwood-text-main uppercase tracking-tight">Edit route stop</h2>
                <p className="text-xs text-gray-500 mt-1">Updates this row in <strong>route_customers</strong> (Route Navigator).</p>
              </div>
              <button type="button" onClick={closeEditStop} className="p-1 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-[11px] font-bold uppercase text-gray-600">
                Name
                <input type="text" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full border border-redwood-border rounded-lg px-3 py-2 text-sm font-normal" required />
              </label>
              <label className="text-[11px] font-bold uppercase text-gray-600">
                Address
                <input type="text" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} className="mt-1 w-full border border-redwood-border rounded-lg px-3 py-2 text-sm font-normal" required />
              </label>
              <label className="text-[11px] font-bold uppercase text-gray-600">
                Phone
                <input type="text" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Optional — leave blank to clear" className="mt-1 w-full border border-redwood-border rounded-lg px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-[11px] font-bold uppercase text-gray-600">
                Business type
                <input type="text" value={editForm.business_type} onChange={(e) => setEditForm((p) => ({ ...p, business_type: e.target.value }))} className="mt-1 w-full border border-redwood-border rounded-lg px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-[11px] font-bold uppercase text-gray-600">
                Neighborhood
                <input type="text" value={editForm.neighborhood} onChange={(e) => setEditForm((p) => ({ ...p, neighborhood: e.target.value }))} className="mt-1 w-full border border-redwood-border rounded-lg px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-sm font-semibold flex items-center gap-2">
                <input type="checkbox" checked={editForm.is_priority} onChange={(e) => setEditForm((p) => ({ ...p, is_priority: e.target.checked }))} />
                Priority stop (★)
              </label>
            </div>
            {editError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeEditStop} className="px-4 py-2 rounded-lg text-sm font-bold border border-redwood-border bg-white text-redwood-text-main">
                Cancel
              </button>
              <button type="submit" disabled={editSaving} className="px-4 py-2 text-white rounded-lg text-sm font-bold disabled:opacity-50" style={{ backgroundColor: '#800020' }}>
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
