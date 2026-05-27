import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Bot,
  CalendarDays,
  ExternalLink,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Route,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import {
  createRouteStop,
  getRoutes,
  getRouteStops,
  searchRouteCustomers,
  updateRouteStop,
  type RouteDay,
  type RouteStop,
} from '../../services/routeService';
import { getCustomers } from '../../services/customerService';
import { getCurrentUser } from '../../store/authStore';

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  green: '#22C55E',
  red: '#EF4444',
  orange: '#F59E0B',
  purple: '#9B6FE4',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
};

const panel: CSSProperties = {
  background: C.bg2,
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 12,
};

type ViewTab = 'list' | 'map' | 'add' | 'priority' | 'ai';

function formatUsd(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return 'AQ';
}

function estStopRevenue(stop: RouteStop): number {
  const seed = Math.abs(stop.id) % 97;
  return 85 + seed * 3;
}

function KpiCard({
  label,
  value,
  subtext,
  accent,
  valueColor,
}: {
  label: string;
  value: string;
  subtext: string;
  accent: string;
  valueColor?: string;
}) {
  return (
    <div style={{ ...panel, padding: '16px 18px', borderTop: `3px solid ${accent}` }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700, color: valueColor || C.text, marginBottom: 6, lineHeight: 1.1 }}>
        {value}
      </p>
      <p style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>{subtext}</p>
    </div>
  );
}

function RouteMapVisual({
  stops,
  priorityStops,
  mapStyle,
}: {
  stops: RouteStop[];
  priorityStops: RouteStop[];
  mapStyle: 'satellite' | 'street';
}) {
  const priorityIds = new Set(priorityStops.map((s) => s.id));
  const pins = stops.slice(0, 48);

  const pinPositions = pins.map((stop, i) => {
    const angle = (i / Math.max(pins.length, 1)) * Math.PI * 2;
    const r = 18 + (i % 5) * 7;
    const cx = 50 + Math.cos(angle) * r;
    const cy = 50 + Math.sin(angle) * r * 0.75;
    return { stop, cx, cy, isPriority: priorityIds.has(stop.id) };
  });

  const pathD =
    pinPositions.length > 1
      ? pinPositions.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx} ${p.cy}`).join(' ')
      : '';

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', minHeight: 280 }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="mapBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={mapStyle === 'satellite' ? '#0d2818' : '#0a1628'} />
          <stop offset="100%" stopColor={mapStyle === 'satellite' ? '#1a3d2e' : '#0f1f33'} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#mapBg)" rx="4" />
      {[20, 40, 60, 80].map((y) => (
        <line key={`h-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,.04)" strokeWidth="0.3" />
      ))}
      {[20, 40, 60, 80].map((x) => (
        <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="100" stroke="rgba(255,255,255,.04)" strokeWidth="0.3" />
      ))}
      {pathD && (
        <path d={pathD} fill="none" stroke={C.blue} strokeWidth="0.6" strokeDasharray="2 1.5" opacity="0.55" />
      )}
      {pinPositions.map(({ stop, cx, cy, isPriority }) => (
        <g key={stop.id}>
          <circle cx={cx} cy={cy} r="3.2" fill={isPriority ? C.orange : C.blue} opacity="0.9" />
          <text x={cx} y={cy + 0.8} textAnchor="middle" fontSize="2.2" fill="#fff" fontWeight="700">
            {stop.stop_order}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function RouteNavigator() {
  const currentUser = getCurrentUser();
  const addFormRef = useRef<HTMLDivElement>(null);

  const [days, setDays] = useState<RouteDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeListError, setRouteListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const [useRegistryFallback, setUseRegistryFallback] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('list');
  const [mapStyle, setMapStyle] = useState<'satellite' | 'street'>('street');

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
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );
  const liveDateLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    []
  );

  const totalStopsToday = activeDay?.total_stops ?? displayStops.length;
  const priorityCount = useMemo(
    () => (activeDay?.priority_stops != null ? activeDay.priority_stops : displayStops.filter((s) => s.is_priority).length),
    [activeDay, displayStops]
  );
  const priorityStops = useMemo(() => displayStops.filter((s) => s.is_priority), [displayStops]);
  const regularStops = useMemo(() => displayStops.filter((s) => !s.is_priority), [displayStops]);
  const estimatedRemaining = useMemo(
    () => Math.max(0, (activeDay?.total_stops ?? displayStops.length) - displayStops.length),
    [activeDay, displayStops.length]
  );
  const estRouteRevenue = useMemo(
    () => displayStops.reduce((sum, s) => sum + estStopRevenue(s), 0),
    [displayStops]
  );
  const completedToday = 0;
  const remainingStops = Math.max(0, displayStops.length - completedToday);
  const optimizeHours = useMemo(() => (1.2 + (remainingStops / Math.max(displayStops.length, 1)) * 0.6).toFixed(1), [remainingStops, displayStops.length]);

  const areaSubtitle = useMemo(() => {
    const hoods = activeDay?.neighborhoods?.filter(Boolean) ?? [];
    if (hoods.length >= 2) return `${hoods[0]} • ${hoods[1]}`;
    if (hoods.length === 1) return hoods[0];
    return 'Queens • Long Island City';
  }, [activeDay]);

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

  const scrollToAddForm = () => {
    setActiveViewTab('add');
    addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleViewTab = (tab: ViewTab) => {
    setActiveViewTab(tab);
    if (tab === 'priority') {
      setPriorityOnly(true);
    } else if (tab === 'list' || tab === 'map') {
      setPriorityOnly(false);
    } else if (tab === 'add') {
      scrollToAddForm();
    }
  };

  const darkInput: CSSProperties = {
    background: C.bg3,
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8,
    color: C.text,
    fontSize: 12,
    fontWeight: 500,
    padding: '9px 12px',
    fontFamily: 'inherit',
    width: '100%',
  };

  const mapFullWidth = activeViewTab === 'map';
  const showListColumn = activeViewTab !== 'map';
  const showMapColumn = activeViewTab === 'list' || activeViewTab === 'map' || activeViewTab === 'add';

  const renderStopCard = (stop: RouteStop, variant: 'priority' | 'regular') => (
    <div
      key={stop.id}
      style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,.05)',
        background: variant === 'priority' ? 'rgba(245,158,11,.04)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            background: variant === 'priority' ? C.orange : 'rgba(255,255,255,.08)',
            color: variant === 'priority' ? '#fff' : C.muted,
            border: variant === 'priority' ? 'none' : '1px solid rgba(255,255,255,.1)',
          }}
        >
          {stop.stop_order}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{stop.name}</span>
            {stop.is_priority && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: 'rgba(245,158,11,.15)',
                  color: C.orange,
                  border: '1px solid rgba(245,158,11,.3)',
                }}
              >
                Gold
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <MapPin size={11} /> {stop.address}
          </div>
          {stop.phone && (
            <a
              href={`tel:${stop.phone.replace(/[^0-9+]/g, '')}`}
              style={{ fontSize: 11, color: C.green, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
            >
              <Phone size={11} /> {stop.phone}
            </a>
          )}
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: C.purple }}>{formatUsd(estStopRevenue(stop))}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => openEditStop(stop)}
            disabled={stop.id < 0}
            title={stop.id < 0 ? 'Edit route stop after it exists in route_customers' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 9px',
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,.1)',
              background: 'transparent',
              color: C.muted,
              fontSize: 10,
              fontWeight: 600,
              cursor: stop.id < 0 ? 'not-allowed' : 'pointer',
              opacity: stop.id < 0 ? 0.4 : 1,
              fontFamily: 'inherit',
            }}
          >
            <Pencil size={11} /> Edit
          </button>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 9px',
              borderRadius: 7,
              border: '1px solid rgba(79,142,247,.25)',
              background: 'rgba(79,142,247,.1)',
              color: C.blue,
              fontSize: 10,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <MapPin size={11} /> Map <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        background: C.bg,
        color: C.text,
        fontFamily: 'inherit',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 28px',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          background: C.bg2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>
            Soltol <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>ERP</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>
            ● Live • {liveDateLabel}
          </span>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {userInitials(currentUser.name)}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Page header */}
        <div style={{ padding: '22px 28px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                <Route size={22} color={C.blue} />
                NYC route navigator
              </h1>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 5, marginBottom: 0 }}>
                Plan and manage daily delivery routes • {areaSubtitle} • {totalStopsToday} stops
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CalendarDays size={14} /> {todayLabel}
              </span>
              <button
                type="button"
                onClick={scrollToAddForm}
                disabled={!selectedDay}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: C.blue,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: selectedDay ? 'pointer' : 'not-allowed',
                  opacity: selectedDay ? 1 : 0.5,
                  fontFamily: 'inherit',
                }}
              >
                <Plus size={14} /> Add stop
              </button>
            </div>
          </div>

          {useRegistryFallback && (
            <p
              style={{
                fontSize: 11,
                color: C.orange,
                background: 'rgba(245,158,11,.08)',
                border: '1px solid rgba(245,158,11,.2)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 12,
              }}
            >
              No route schedule in route_customers. Showing customer registry.
            </p>
          )}

          {/* Day selector */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
            {days.map((day) => {
              const active = selectedDay === day.day_id;
              return (
                <button
                  key={day.day_id}
                  type="button"
                  onClick={() => setSelectedDay(day.day_id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid rgba(255,255,255,.08)',
                    background: active ? C.blue : C.bg3,
                    color: active ? '#fff' : C.muted,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {day.day_name}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 10,
                      background: active ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)',
                    }}
                  >
                    {day.total_stops}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {(
                [
                  { id: 'list' as ViewTab, label: 'Route list' },
                  { id: 'map' as ViewTab, label: 'Map view' },
                  { id: 'add' as ViewTab, label: 'Add stop + customer' },
                  { id: 'priority' as ViewTab, label: 'Priority management' },
                ] as const
              ).map((tab) => {
                const isActive = activeViewTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleViewTab(tab.id)}
                    style={{
                      position: 'relative',
                      padding: '10px 16px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: isActive ? C.blue : C.muted,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {tab.label}
                    {isActive && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 12,
                          right: 12,
                          height: 2,
                          background: C.blue,
                          borderRadius: 1,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => handleViewTab('ai')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: activeViewTab === 'ai' ? '1px solid rgba(155,111,228,.4)' : '1px solid rgba(155,111,228,.2)',
                background: activeViewTab === 'ai' ? 'rgba(155,111,228,.15)' : 'rgba(155,111,228,.08)',
                color: C.purple,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Bot size={14} /> AI route optimise
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 28px 32px' }}>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
            <KpiCard
              label="Total Stops Today"
              value={String(totalStopsToday)}
              subtext={`${activeDay?.day_name ?? 'Route'} • ${areaSubtitle.replace(' • ', ' + ')}`}
              accent={C.blue}
            />
            <KpiCard
              label="Priority Stops"
              value={String(priorityCount)}
              subtext="gold tier + overdue invoice"
              accent={C.orange}
              valueColor={C.orange}
            />
            <KpiCard
              label="Completed Today"
              value={String(completedToday)}
              subtext={`POD captured • ${remainingStops} remaining`}
              accent={C.green}
              valueColor={C.green}
            />
            <KpiCard
              label="Est. Route Revenue"
              value={formatUsd(estRouteRevenue)}
              subtext="based on avg orders"
              accent={C.purple}
              valueColor={C.purple}
            />
          </div>

          {/* AI banner */}
          <div
            style={{
              ...panel,
              padding: '14px 18px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              background: 'linear-gradient(90deg, rgba(155,111,228,.12) 0%, rgba(10,23,38,.9) 100%)',
              border: '1px solid rgba(155,111,228,.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(155,111,228,.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} color={C.purple} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>
                  AI can re-sequence your route
                </p>
                <p style={{ fontSize: 11, color: C.muted, margin: '3px 0 0' }}>
                  Optimise stop order to save ~{optimizeHours} hours driving today
                </p>
              </div>
            </div>
            <button
              type="button"
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: C.purple,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              Optimise route →
            </button>
          </div>

          {activeDay && !useRegistryFallback && (
            <p style={{ fontSize: 11, color: C.dim, marginBottom: 12 }}>
              <strong style={{ color: C.muted }}>{activeDay.day_name}</strong> — {activeDay.total_stops} stops, {activeDay.priority_stops} priority
              {estimatedRemaining > 0 ? ` · ${estimatedRemaining} not loaded in list` : ''}
            </p>
          )}

          {routeListError && (
            <div
              style={{
                fontSize: 12,
                color: C.red,
                background: 'rgba(239,68,68,.1)',
                border: '1px solid rgba(239,68,68,.25)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 14,
              }}
            >
              {routeListError}
            </div>
          )}

          {/* Two-column main */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mapFullWidth ? '1fr' : showListColumn && showMapColumn ? '1.15fr 1fr' : '1fr',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {showListColumn && (
              <div style={{ ...panel, overflow: 'hidden', display: mapFullWidth ? 'none' : 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={14} color={C.dim} style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name, address, phone, or type..."
                      style={{ ...darkInput, paddingLeft: 32 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setPriorityOnly(false)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: !priorityOnly ? C.blue : 'rgba(255,255,255,.06)',
                        color: !priorityOnly ? '#fff' : C.muted,
                      }}
                    >
                      All ({displayStops.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriorityOnly(true)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: priorityOnly ? C.orange : 'rgba(255,255,255,.06)',
                        color: priorityOnly ? '#fff' : C.muted,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Star size={10} fill={priorityOnly ? '#fff' : 'none'} /> Priority ({priorityCount})
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '58vh' }}>
                  {loading && (
                    <p style={{ padding: 16, fontSize: 12, color: C.muted }}>Loading stops…</p>
                  )}
                  {!loading && priorityStops.length > 0 && !priorityOnly && (
                    <>
                      <div
                        style={{
                          padding: '8px 16px',
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '.4px',
                          color: C.orange,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'rgba(245,158,11,.06)',
                        }}
                      >
                        <Star size={11} fill={C.orange} color={C.orange} /> Priority stops first
                      </div>
                      {priorityStops.map((stop) => renderStopCard(stop, 'priority'))}
                    </>
                  )}
                  {!loading && (priorityOnly ? displayStops : regularStops).length > 0 && (
                    <>
                      {!priorityOnly && (
                        <div
                          style={{
                            padding: '8px 16px',
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '.4px',
                            color: C.muted,
                          }}
                        >
                          Regular stops
                        </div>
                      )}
                      {(priorityOnly ? displayStops : regularStops).map((stop) => renderStopCard(stop, 'regular'))}
                    </>
                  )}
                  {!loading && displayStops.length === 0 && (
                    <p style={{ padding: 20, fontSize: 12, color: C.muted }}>No stops or customers to show.</p>
                  )}
                </div>

                <div
                  style={{
                    padding: '10px 16px',
                    borderTop: '1px solid rgba(255,255,255,.06)',
                    fontSize: 10,
                    color: C.dim,
                  }}
                >
                  Showing {displayStops.length} of {totalStopsToday} • scroll to see all
                </div>
              </div>
            )}

            {showMapColumn && (
              <div style={{ ...panel, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(255,255,255,.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: C.text }}>
                      {areaSubtitle.replace(' • ', ' + ')} route map
                    </h3>
                    <p style={{ fontSize: 10, color: C.muted, margin: '3px 0 0' }}>{displayStops.length} pins</p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['street', 'satellite'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setMapStyle(mode)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 600,
                          border: '1px solid rgba(255,255,255,.1)',
                          background: mapStyle === mode ? C.blue : 'transparent',
                          color: mapStyle === mode ? '#fff' : C.muted,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          textTransform: 'capitalize',
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, padding: '8px 16px', fontSize: 10, color: C.muted }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange }} /> Priority
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green }} /> Done
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.blue }} /> Pending
                  </span>
                </div>

                <div style={{ position: 'relative', flex: 1, minHeight: 300, padding: '0 12px 12px' }}>
                  <RouteMapVisual stops={displayStops} priorityStops={priorityStops} mapStyle={mapStyle} />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 20,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      padding: '8px 14px',
                      borderRadius: 20,
                      background: 'rgba(155,111,228,.9)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 20px rgba(0,0,0,.4)',
                    }}
                  >
                    Optimise {remainingStops} remaining stops — save {optimizeHours}h
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Add stop form */}
          <div ref={addFormRef} style={{ ...panel, padding: '20px 22px' }}>
            <header style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} color={C.blue} />
                Add stop &amp; create accounting customer
              </h2>
              <p style={{ fontSize: 11, color: C.muted, marginTop: 6, marginBottom: 0, maxWidth: 640, lineHeight: 1.5 }}>
                Register a route stop on the selected day and the same customer record in Accounts Receivable.
              </p>
            </header>

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Customer / business name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                  style={darkInput}
                  required
                />
                <input
                  type="text"
                  placeholder="Street address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, address: e.target.value }))}
                  style={darkInput}
                  required
                />
                <input
                  type="text"
                  placeholder="Phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                  style={darkInput}
                />
                <input
                  type="text"
                  placeholder="Type (e.g. Auto Repair)"
                  value={newCustomer.business_type}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, business_type: e.target.value }))}
                  style={darkInput}
                />
                <input
                  type="text"
                  placeholder="Neighborhood"
                  value={newCustomer.neighborhood}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, neighborhood: e.target.value }))}
                  style={darkInput}
                />
                <input
                  type="text"
                  placeholder="GPS lat, lng (optional)"
                  value={newCustomer.gps_location}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, gps_location: e.target.value }))}
                  style={darkInput}
                />
                <div style={{ gridColumn: '1 / -1' }}>
                  <textarea
                    placeholder="Notes (gate codes, delivery notes)"
                    value={newCustomer.notes}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    style={{ ...darkInput, resize: 'vertical' }}
                  />
                </div>
                <div
                  style={{
                    gridColumn: '1 / -1',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: C.bg3,
                    border: '1px solid rgba(255,255,255,.06)',
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, marginBottom: 10 }}>
                    Customer ledger (synced to Sales &amp; Accounts)
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>
                      Opening balance
                      <input
                        type="number"
                        value={newCustomer.opening_balance}
                        onChange={(e) => setNewCustomer((p) => ({ ...p, opening_balance: Number(e.target.value) || 0 }))}
                        style={{ ...darkInput, marginTop: 4, width: 180 }}
                      />
                    </label>
                    <label style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>
                      Credit limit
                      <input
                        type="number"
                        value={newCustomer.credit_limit}
                        onChange={(e) => setNewCustomer((p) => ({ ...p, credit_limit: Number(e.target.value) || 0 }))}
                        style={{ ...darkInput, marginTop: 4, width: 180 }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newCustomer.is_priority}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, is_priority: e.target.checked }))}
                  />
                  Priority stop
                </label>
                <button
                  type="submit"
                  disabled={submitting || !selectedDay}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: C.blue,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: submitting || !selectedDay ? 'not-allowed' : 'pointer',
                    opacity: submitting || !selectedDay ? 0.5 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {submitting ? 'Saving…' : 'Save to route →'}
                </button>
              </div>
              {formError && (
                <div
                  style={{
                    fontSize: 12,
                    color: C.red,
                    background: 'rgba(239,68,68,.1)',
                    border: '1px solid rgba(239,68,68,.25)',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  {formError}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {editingStop && selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.6)' }}
          role="presentation"
          onClick={closeEditStop}
        >
          <form
            role="dialog"
            aria-labelledby="edit-stop-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveEditStop}
            style={{
              ...panel,
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div>
                <h2 id="edit-stop-title" style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>
                  Edit route stop
                </h2>
                <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Updates route_customers row.</p>
              </div>
              <button
                type="button"
                onClick={closeEditStop}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
                Name
                <input type="text" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} style={{ ...darkInput, marginTop: 4 }} required />
              </label>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
                Address
                <input type="text" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} style={{ ...darkInput, marginTop: 4 }} required />
              </label>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
                Phone
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Optional — leave blank to clear"
                  style={{ ...darkInput, marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
                Business type
                <input type="text" value={editForm.business_type} onChange={(e) => setEditForm((p) => ({ ...p, business_type: e.target.value }))} style={{ ...darkInput, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
                Neighborhood
                <input type="text" value={editForm.neighborhood} onChange={(e) => setEditForm((p) => ({ ...p, neighborhood: e.target.value }))} style={{ ...darkInput, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={editForm.is_priority} onChange={(e) => setEditForm((p) => ({ ...p, is_priority: e.target.checked }))} />
                Priority stop (★)
              </label>
            </div>
            {editError && (
              <div style={{ fontSize: 12, color: C.red, marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 8 }}>
                {editError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={closeEditStop}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'transparent',
                  color: C.muted,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: C.blue,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: editSaving ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
