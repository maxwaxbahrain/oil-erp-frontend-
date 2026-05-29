import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, ChevronRight, MapPin, Plus, Truck, RefreshCw, AlertTriangle } from 'lucide-react';
import { createInvoice, createPayment, getCustomers, getVans, type Van } from '../../services/api';
import { getRoutes, getRouteStops, type RouteStop } from '../../services/routeService';
import { getSalesOrders } from '../../services/api';
import { patchSalesOrder } from '../../services/salesService';
import { getCurrentUser } from '../../store/authStore';
import { completeDeliveryNote, createDeliveryNote, toDriverDeliveryStatus } from '../../services/deliveryService';
import { compressImage } from '../../utils/imageCompression';
import { buildCompleteDeliveryPayload, buildDeliveryNotePayload } from './driverPodMapping';

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  green: '#22C55E',
  amber: '#F59E0B',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
};

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return 'AQ';
}

function formatCompactUsd(n: number): string {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatVanCapacity(liters?: number): string {
  if (!liters) return '800 kg';
  if (liters >= 1000) return `${(liters / 1000).toFixed(1)}T`;
  return `${liters} L`;
}

function vanDisplayStats(van: Van, index: number) {
  const seed = van.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const stops = 3 + (seed % 5);
  const orderValue = 40000 + (seed % 210) * 1000;
  const isLoaded = index === 0 || String(van.status).toLowerCase() === 'active';
  return { stops, orderValue, isLoaded };
}

function driverRole(index: number): string {
  return index === 0 ? 'Senior driver' : 'Driver';
}

function vanDisplayLabel(vanNumber: string): string {
  return vanNumber.startsWith('Van') ? vanNumber : `Van ${vanNumber}`;
}

function driverTenure(createdAt?: string): string {
  if (!createdAt) return '1 yr';
  const years = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / (365.25 * 86400000)));
  return years === 1 ? '1 yr' : `${years} yrs`;
}

function formatDriverShort(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  return parts[0] || 'Driver';
}

type DriverStep = 'van-select' | 'dashboard' | 'confirm' | 'success';
type PaymentMode = 'CASH' | 'CREDIT' | 'CHEQUE';

type DeliveryItem = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

type DeliveryStop = {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  items: DeliveryItem[];
  amount: number;
  paymentMethod: PaymentMode;
  status: 'PENDING' | 'ON THE WAY' | 'DELIVERED' | 'FAILED';
  orderId?: string;
};

export default function DriverApp() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [step, setStep] = useState<DriverStep>('van-select');
  const [vans, setVans] = useState<Van[]>([]);
  const [uiSelectedVanId, setUiSelectedVanId] = useState<string | null>(null);
  const [selectedVan, setSelectedVan] = useState<Van | null>(null);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<DeliveryStop | null>(null);
  // FIX: start with loading=true so the very first render (BEFORE the
  // effect fires) already shows a spinner instead of a blank panel.
  // Combined with a vansError state below, the page is never visually
  // dead — user always sees either spinner, error+retry, list, or empty.
  const [loading, setLoading] = useState(true);
  const [vansError, setVansError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode>('CASH');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [signatureData, setSignatureData] = useState<string>('');
  const [isSigning, setIsSigning] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [deliveryPhoto, setDeliveryPhoto] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'captured' | 'denied' | 'unavailable'>('idle');
  const [podWarning, setPodWarning] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [successInfo, setSuccessInfo] = useState<{ customer: string; invoice: string; amount: number; podWarning?: string | null } | null>(null);
  const [driverName, setDriverName] = useState('Driver');

  useEffect(() => {
    loadVans();
  }, []);

  useEffect(() => {
    if (vans.length > 0 && !uiSelectedVanId) {
      setUiSelectedVanId(vans[0].id);
    }
  }, [vans, uiSelectedVanId]);

  const uiSelectedVan = useMemo(
    () => vans.find((v) => v.id === uiSelectedVanId) ?? vans[0] ?? null,
    [vans, uiSelectedVanId]
  );

  const fleetSummary = useMemo(() => {
    const activeVans = vans.filter((v) => String(v.status).toLowerCase() === 'active').length;
    const totalStops = vans.reduce((sum, van, i) => sum + vanDisplayStats(van, i).stops, 0);
    const zones = Math.max(1, Math.min(vans.length, 3));
    return {
      deliveries: totalStops || 9,
      zones: zones || 3,
      activeVans: activeVans || vans.length,
    };
  }, [vans]);

  const statusBarDate = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    []
  );

  const statusBarTime = useMemo(
    () =>
      new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    []
  );

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );

  const stats = useMemo(() => {
    const delivered = stops.filter((s) => s.status === 'DELIVERED').length;
    const pending = stops.filter((s) => s.status !== 'DELIVERED').length;
    const collected = stops.filter((s) => s.status === 'DELIVERED').reduce((a, s) => a + s.amount, 0);
    return { stopsToday: stops.length, delivered, pending, collected };
  }, [stops]);

  async function loadVans() {
    setLoading(true);
    setVansError(null);
    try {
      const list = await getVans();
      setVans(Array.isArray(list) ? list : []);
    } catch (e: any) {
      console.error(e);
      // FIX: surface the failure to the user instead of silently
      // swallowing it into an empty array. Retry button below uses this.
      setVansError(e?.message || 'Could not load vans. Tap retry to try again.');
      setVans([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStopsForVan(van: Van) {
    try {
      // Primary: real sales orders for this van
      const orders = await getSalesOrders();
      const vanOrders = orders.filter(
        (o) => String(o.van || '').includes(van.van_number) || String(o.van || '') === String(van.id)
      );
      if (vanOrders.length > 0) {
        const mapped: DeliveryStop[] = vanOrders.map((o) => ({
          id: `so-${o.id}`,
          customerId: String(o.customerId),
          customerName: o.customerName,
          address: 'Customer address from order profile',
          items: o.lineItems.map((li) => ({
            description: li.product || li.description || 'Item',
            quantity: Number(li.quantity) || 0,
            rate: Number(li.rate) || 0,
            amount: Number(li.amount) || 0,
          })),
          amount: Number(o.grandTotal) || 0,
          paymentMethod: 'CASH',
          status:
            (o.workflowStatus || '').toLowerCase() === 'delivered'
              ? 'DELIVERED'
              : (o.workflowStatus || '').toLowerCase() === 'confirmed'
              ? 'ON THE WAY'
              : 'PENDING',
          orderId: o.id,
        }));
        setStops(mapped);
        return;
      }

      // Fallback: route stops
      const days = await getRoutes();
      const firstDay = days[0];
      if (!firstDay) {
        setStops([]);
        return;
      }
      const routeStops = await getRouteStops(firstDay.day_id);
      const fallbackStops: DeliveryStop[] = routeStops.slice(0, 20).map((r: RouteStop) => ({
        id: `route-${r.id}`,
        customerId: '',
        customerName: r.name,
        address: r.address,
        items: [{ description: 'Delivery items', quantity: 0, rate: 0, amount: 0 }],
        amount: 0,
        paymentMethod: 'CASH',
        status: 'PENDING',
      }));
      setStops(fallbackStops);
    } catch (e) {
      console.error(e);
      setStops([]);
    }
  }

  async function selectVan(van: Van) {
    setSelectedVan(van);
    setDriverName(van.driver_name || 'Driver');
    await loadStopsForVan(van);
    setStep('dashboard');
  }

  function openNavigate(address: string) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  }

  function openConfirm(stop: DeliveryStop) {
    setSelectedStop(stop);
    setPaymentMethod(stop.paymentMethod);
    setAmountReceived(stop.amount);
    setNotes('');
    setRecipientName(stop.customerName);
    setSignatureData('');
    setIsSigning(false);
    setDeliveryPhoto('');
    setPhotoError(null);
    setGpsLocation(null);
    setGpsStatus('idle');
    setPodWarning(null);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 50);
    setStep('confirm');
    captureGps();
  }

  function captureGps() {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGpsStatus('captured');
      },
      (error) => {
        console.warn('Could not capture POD GPS location:', error);
        setGpsStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }

  async function handlePhotoCapture(file?: File | null) {
    if (!file) return;
    setPhotoError(null);
    try {
      const compressed = await compressImage(file, { maxWidth: 900, maxHeight: 900, quality: 0.72, outputFormat: 'jpeg' });
      setDeliveryPhoto(compressed);
    } catch (e: any) {
      console.error(e);
      setPhotoError(e?.message || 'Could not process delivery photo.');
    }
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsSigning(true);
  }

  function endDraw() {
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignatureData(canvas.toDataURL());
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
    setIsSigning(false);
  }

  async function confirmDelivery() {
    if (!selectedStop || !selectedVan) return;
    setLoading(true);
    let podRecordingWarning: string | null = null;
    try {
      if (selectedStop.orderId) {
        try {
          const deliveryNote = await createDeliveryNote(
            buildDeliveryNotePayload(selectedStop, selectedVan, driverName),
          );
          await completeDeliveryNote(
            deliveryNote.id,
            buildCompleteDeliveryPayload(selectedStop, {
              signatureData,
              photoData: deliveryPhoto,
              gpsLocation,
              recipientName,
              notes,
            }),
          );
        } catch (e: any) {
          podRecordingWarning = e?.message || 'Could not record proof of delivery.';
          setPodWarning(`POD recording failed: ${podRecordingWarning}`);
          console.warn('POD recording failed; continuing delivery billing flow:', e);
        }
      } else {
        podRecordingWarning = 'No linked sales order id on this stop; POD note was not recorded.';
        setPodWarning(podRecordingWarning);
      }

      const customers = await getCustomers();
      const customer = customers.find((c) => c.name === selectedStop.customerName);
      const customerId = customer?.id || selectedStop.customerId || '0';

      const invoice = await createInvoice({
        invoiceNumber: '',
        customerId: String(customerId),
        customerName: selectedStop.customerName,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        lineItems: selectedStop.items.map((i) => ({
          product: i.description,
          description: i.description,
          quantity: i.quantity || 1,
          rate: i.rate,
          amount: i.amount || i.rate,
        })),
        subtotal: selectedStop.amount,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        grandTotal: selectedStop.amount,
        notes: (notes ? notes + ' | ' : '') + (signatureData ? 'POD_SIGNATURE:YES' : 'POD_SIGNATURE:NO') + ' | POD Driver App',
        status: 'Unpaid',
        payment_status: 'Unpaid',
        payment_method: paymentMethod,
      });

      if (selectedStop.orderId) {
        try {
          await patchSalesOrder(selectedStop.orderId, {
            status: 'delivered',
            pod_confirmed: true,
            signature_confirmed: true,
          });
        } catch (e) {
          console.warn('Could not update sales order to delivered:', e);
        }
      }

      if (Number(amountReceived) > 0 && String(customerId) !== '0') {
        await createPayment({
          customer_id: Number(customerId),
          amount: Number(amountReceived),
          payment_method: paymentMethod,
          reference: invoice.invoiceNumber,
          payment_date: new Date().toISOString().slice(0, 10),
          notes: notes || 'POD delivery payment',
        });
      }

      setStops((prev) => prev.map((s) => (s.id === selectedStop.id ? { ...s, status: toDriverDeliveryStatus('delivered') } : s)));
      setSuccessInfo({
        customer: selectedStop.customerName,
        invoice: invoice.invoiceNumber,
        amount: selectedStop.amount,
        podWarning: podRecordingWarning,
      });
      setStep('success');
    } catch (e) {
      console.error(e);
      alert('Failed to confirm delivery.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'van-select') {
    const badge = (color: string, bg: string): CSSProperties => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '.3px',
      textTransform: 'uppercase',
      color,
      background: bg,
      borderRadius: 20,
      padding: '3px 8px',
      whiteSpace: 'nowrap',
    });

    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          color: C.text,
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {/* Mobile status bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px 6px',
            fontSize: 11,
            fontWeight: 600,
            color: C.text,
          }}
        >
          <span>{statusBarTime}</span>
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>
            Soltol Field · {statusBarDate}
          </span>
          <span style={{ fontSize: 10, color: C.muted }}>81%</span>
        </div>

        {/* Header */}
        <div style={{ padding: '8px 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                background: 'transparent',
                border: 'none',
                color: C.text,
                cursor: 'pointer',
                padding: 4,
                marginTop: 2,
              }}
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(79,142,247,.18)',
                border: '1.5px solid rgba(79,142,247,.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: C.blue,
                flexShrink: 0,
              }}
              title={currentUser.name}
            >
              {userInitials(currentUser.name)}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>Select van</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.4 }}>
              Choose your delivery van for today
            </p>
          </div>
        </div>

        {/* Summary card */}
        <div style={{ padding: '0 16px 16px' }}>
          <div
            style={{
              background: C.bg2,
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{dateLabel}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
                  {fleetSummary.deliveries} deliveries scheduled today · {fleetSummary.zones} zones
                </div>
              </div>
              <span style={badge(C.green, 'rgba(34,197,94,.14)')}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', gap: 12 }}>
            <div className="w-10 h-10 border-[3px] border-[rgba(79,142,247,.25)] border-t-[#4F8EF7] rounded-full animate-spin" />
            <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Loading vans…
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && vansError && (
          <div style={{ margin: '0 16px 16px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
            <AlertTriangle size={28} style={{ color: '#EF4444', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 11, fontWeight: 800, color: '#FCA5A5', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 6px' }}>
              Could not load vans
            </p>
            <p style={{ fontSize: 12, color: '#FCA5A5', margin: '0 0 14px' }}>{vansError}</p>
            <button
              type="button"
              onClick={() => void loadVans()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                background: '#EF4444',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Van cards */}
        {!loading && !vansError && (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {vans.map((van, index) => {
              const isSelected = uiSelectedVanId === van.id;
              const stats = vanDisplayStats(van, index);
              const isAvailable = String(van.status).toLowerCase() === 'active';

              return (
                <button
                  key={van.id}
                  type="button"
                  onClick={() => setUiSelectedVanId(van.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: C.bg2,
                    border: isSelected ? `2px solid ${C.blue}` : '1px solid rgba(255,255,255,.08)',
                    borderRadius: 14,
                    padding: '14px 14px 12px',
                    cursor: 'pointer',
                    color: C.text,
                    fontFamily: 'inherit',
                    boxShadow: isSelected ? '0 0 0 1px rgba(79,142,247,.15)' : 'none',
                  }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: 'rgba(79,142,247,.12)',
                          border: '1px solid rgba(79,142,247,.22)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Truck size={18} color={C.blue} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em' }}>{vanDisplayLabel(van.van_number)}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                          {formatDriverShort(van.driver_name || 'Driver')} · {driverRole(index)} · {driverTenure(van.created_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={badge(isAvailable ? C.green : C.amber, isAvailable ? 'rgba(34,197,94,.14)' : 'rgba(245,158,11,.14)')}>
                        {isAvailable ? 'Available' : 'In use'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span
                          style={badge(
                            stats.isLoaded ? C.blue : C.dim,
                            stats.isLoaded ? 'rgba(79,142,247,.14)' : 'rgba(255,255,255,.06)'
                          )}
                        >
                          {stats.isLoaded ? 'Loaded' : 'Empty'}
                        </span>
                        <ChevronRight size={14} color={C.dim} />
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                      marginBottom: 10,
                      padding: '10px 0',
                      borderTop: '1px solid rgba(255,255,255,.06)',
                      borderBottom: '1px solid rgba(255,255,255,.06)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Stops</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: index === 0 ? C.green : C.amber }}>{stats.stops}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Order value</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.blue }}>{formatCompactUsd(stats.orderValue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Capacity</div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{formatVanCapacity(van.capacity_liters)}</div>
                    </div>
                  </div>

                  {/* Next / first stop */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                      {index === 0 ? 'Next' : 'First stop'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>
                      {index === 0 ? (
                        <>
                          Qahir Trading · Jamaica Ave ·{' '}
                          <span style={{ color: C.muted, fontWeight: 500 }}>09:45 AM</span>
                        </>
                      ) : (
                        <>Arshad R&A</>
                      )}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span
                        style={badge(
                          index === 0 ? C.green : C.amber,
                          index === 0 ? 'rgba(34,197,94,.14)' : 'rgba(245,158,11,.14)'
                        )}
                      >
                        {index === 0 ? 'On route' : 'Not started'}
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: C.dim,
                      paddingTop: 8,
                      borderTop: '1px solid rgba(255,255,255,.05)',
                    }}
                  >
                    {isSelected ? (
                      <>
                        <span>Last active today</span>
                        <span style={{ color: C.green, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} /> Selected
                        </span>
                      </>
                    ) : (
                      <span style={{ color: C.dim }}>Tap to select</span>
                    )}
                  </div>
                </button>
              );
            })}

            {vans.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                <Truck size={36} style={{ color: C.dim, margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>No vans assigned</p>
                <p style={{ fontSize: 12, color: C.muted, margin: '0 0 16px' }}>
                  Ask your dispatcher to assign a van, then tap Retry.
                </p>
                <button
                  type="button"
                  onClick={() => void loadVans()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,.06)',
                    border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 10,
                    color: C.muted,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom actions */}
        {!loading && !vansError && vans.length > 0 && uiSelectedVan && (
          <div style={{ padding: '20px 16px 28px', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => void selectVan(uiSelectedVan)}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: '2px solid rgba(255,255,255,.85)',
                background: 'transparent',
                color: C.text,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginBottom: 14,
              }}
            >
              Start delivery with {vanDisplayLabel(uiSelectedVan.van_number)}
            </button>
            <button
              type="button"
              onClick={() => navigate('/van-sales/manage-vans')}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: C.blue,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Plus size={14} /> Add a van to the fleet
            </button>
          </div>
        )}
      </div>
    );
  }

  if (step === 'confirm' && selectedStop) {
    return (
      <div className="min-h-screen bg-[#f9fafb] p-4">
        <div className="max-w-md mx-auto space-y-4">
          <button className="text-sm font-bold text-[#800020]" onClick={() => setStep('dashboard')}>
            Back
          </button>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-xl font-black text-gray-900">{selectedStop.customerName}</h2>
            <p className="text-base text-gray-600 mt-1">{selectedStop.address}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-black uppercase text-gray-500 mb-2">Products</div>
            {selectedStop.items.map((i, idx) => (
              <div key={idx} className="text-base py-1 flex justify-between">
                <span>{i.description}</span>
                <span>
                  {i.quantity} x {i.rate.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="text-lg font-black mt-3">Total: ${selectedStop.amount.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="text-sm font-black uppercase text-gray-500">Payment Method</div>
            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'CREDIT', 'CHEQUE'] as PaymentMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`min-h-12 rounded-lg border text-sm font-black ${paymentMethod === m ? 'bg-[#800020] text-white border-[#800020]' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              type="number"
              className="w-full min-h-12 border rounded-lg px-3 text-base"
              value={amountReceived}
              onChange={(e) => setAmountReceived(Number(e.target.value) || 0)}
              placeholder="Amount received"
            />
            <input
              type="text"
              className="w-full min-h-12 border rounded-lg px-3 text-base"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Recipient name"
            />
            <textarea
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-base"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery / customer notes (optional)"
            />
            {/* Signature Pad */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-black uppercase text-gray-500">Customer Signature</div>
                {isSigning && (
                  <button onClick={clearSignature} className="text-xs font-bold text-red-500 underline">Clear</button>
                )}
              </div>
              <div className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden" style={{touchAction:'none'}}>
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={150}
                  className="w-full block"
                  style={{touchAction:'none'}}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                {!isSigning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-400 text-sm font-bold">✍️ Customer signs here</p>
                  </div>
                )}
              </div>
              {!isSigning && (
                <p className="text-xs text-orange-600 font-bold mt-1">⚠️ Signature required for proof of delivery</p>
              )}
            </div>
            {/* Delivery Photo */}
            <div>
              <div className="text-sm font-black uppercase text-gray-500 mb-2">Delivery Photo</div>
              <label className="min-h-12 rounded-lg border border-gray-300 bg-gray-50 flex items-center justify-center gap-2 text-sm font-black text-gray-700 cursor-pointer">
                <Camera size={16} />
                {deliveryPhoto ? 'Retake / replace photo' : 'Capture delivery photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handlePhotoCapture(e.target.files?.[0]);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              {photoError && <p className="text-xs text-red-600 font-bold mt-1">{photoError}</p>}
              {deliveryPhoto && (
                <img src={deliveryPhoto} alt="Delivery proof" className="mt-2 w-full max-h-48 object-cover rounded-lg border border-gray-200" />
              )}
            </div>
            {/* GPS */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-black uppercase text-gray-500">GPS Location</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {gpsStatus === 'captured' && gpsLocation
                      ? `${gpsLocation.latitude.toFixed(5)}, ${gpsLocation.longitude.toFixed(5)}`
                      : gpsStatus === 'loading'
                      ? 'Capturing location...'
                      : gpsStatus === 'denied'
                      ? 'Location permission denied. Delivery can still continue.'
                      : gpsStatus === 'unavailable'
                      ? 'Location unavailable. Delivery can still continue.'
                      : 'Not captured yet.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={captureGps}
                  className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs font-black text-gray-700"
                >
                  {gpsStatus === 'loading' ? '...' : 'Retry'}
                </button>
              </div>
            </div>
            {podWarning && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-700">
                {podWarning}
              </div>
            )}
            <button
              onClick={confirmDelivery}
              disabled={loading || !signatureData}
              className="w-full min-h-12 bg-green-600 text-white rounded-lg text-lg font-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Confirming...' : !isSigning ? 'GET SIGNATURE FIRST' : 'CONFIRM DELIVERY ✓'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success' && successInfo) {
    return (
      <div className="min-h-screen bg-white p-4 flex items-center">
        <div className="max-w-md mx-auto w-full bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <CheckCircle2 size={76} className="text-green-600 mx-auto mb-4" />
          <h2 className="text-3xl font-black text-green-700">Delivery Confirmed!</h2>
          <div className="text-base text-gray-700 mt-4 space-y-1">
            <div>Customer: {successInfo.customer}</div>
            <div>Invoice: {successInfo.invoice}</div>
            <div>Amount: ${successInfo.amount.toFixed(2)}</div>
            {signatureData && (
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1 font-bold uppercase">Signature captured</p>
                <img src={signatureData} alt="Customer signature" className="border border-gray-200 rounded-lg bg-white mx-auto max-w-[200px]" />
              </div>
            )}
            {deliveryPhoto && (
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1 font-bold uppercase">Photo captured</p>
                <img src={deliveryPhoto} alt="Delivery proof" className="border border-gray-200 rounded-lg bg-white mx-auto max-w-[220px] max-h-40 object-cover" />
              </div>
            )}
            {successInfo.podWarning && (
              <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-700">
                {successInfo.podWarning}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedStop(null);
              setStep('dashboard');
            }}
            className="mt-6 w-full min-h-12 rounded-lg bg-[#800020] text-white text-lg font-black"
          >
            NEXT STOP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-[#800020] text-white rounded-xl p-4">
          <h1 className="text-2xl font-black">Good Morning, {driverName}</h1>
          <p className="text-base mt-1">
            {selectedVan?.van_number || 'Van'} | {dateLabel}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border rounded-xl p-3">
            <div className="text-xs font-black text-gray-500">STOPS TODAY</div>
            <div className="text-2xl font-black">{stats.stopsToday}</div>
          </div>
          <div className="bg-white border rounded-xl p-3">
            <div className="text-xs font-black text-gray-500">DELIVERED</div>
            <div className="text-2xl font-black text-green-600">{stats.delivered}</div>
          </div>
          <div className="bg-white border rounded-xl p-3">
            <div className="text-xs font-black text-gray-500">PENDING</div>
            <div className="text-2xl font-black text-amber-600">{stats.pending}</div>
          </div>
          <div className="bg-white border rounded-xl p-3">
            <div className="text-xs font-black text-gray-500">COLLECTED</div>
            <div className="text-2xl font-black">${stats.collected.toFixed(0)}</div>
          </div>
        </div>

        <div className="space-y-3">
          {stops.map((s, idx) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-black">#{idx + 1} {s.customerName}</h3>
                <span
                  className={`text-[10px] px-2 py-1 rounded-full font-black ${
                    s.status === 'DELIVERED'
                      ? 'bg-green-100 text-green-700'
                      : s.status === 'ON THE WAY'
                      ? 'bg-blue-100 text-blue-700'
                      : s.status === 'FAILED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {s.status}
                </span>
              </div>
              <p className="text-base text-gray-600 mt-1 flex items-center gap-1">
                <MapPin size={14} /> {s.address}
              </p>
              <p className="text-base text-gray-700 mt-2">
                📦 {s.items[0]?.quantity || 0} cases {s.items[0]?.description || 'Delivery items'}
              </p>
              <p className="text-base text-gray-700 mt-1">
                💰 ${s.amount.toFixed(2)} | {s.paymentMethod}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => openNavigate(s.address)}
                  className="min-h-12 rounded-lg border border-gray-300 text-gray-700 font-black"
                >
                  NAVIGATE
                </button>
                <button
                  onClick={() => openConfirm(s)}
                  className="min-h-12 rounded-lg bg-[#800020] text-white font-black flex items-center justify-center gap-1"
                >
                  DELIVER <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
          {!loading && stops.length === 0 && <div className="text-base text-gray-500">No stops found for today.</div>}
        </div>
      </div>
    </div>
  );
}
