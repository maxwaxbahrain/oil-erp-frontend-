import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, MapPin, Truck } from 'lucide-react';
import { createInvoice, createPayment, getCustomers, getVans, type Van } from '../../services/api';
import { getRoutes, getRouteStops, type RouteStop } from '../../services/routeService';
import { getSalesOrders } from '../../services/api';
import { patchSalesOrder } from '../../services/salesService';

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
  const [step, setStep] = useState<DriverStep>('van-select');
  const [vans, setVans] = useState<Van[]>([]);
  const [selectedVan, setSelectedVan] = useState<Van | null>(null);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<DeliveryStop | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode>('CASH');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [signatureData, setSignatureData] = useState<string>('');
  const [isSigning, setIsSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [successInfo, setSuccessInfo] = useState<{ customer: string; invoice: string; amount: number } | null>(null);
  const [driverName, setDriverName] = useState('Driver');

  useEffect(() => {
    loadVans();
  }, []);

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
    try {
      const list = await getVans();
      setVans(list);
    } catch (e) {
      console.error(e);
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
    setSignatureData('');
    setIsSigning(false);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 50);
    setStep('confirm');
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
    try {
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

      setStops((prev) => prev.map((s) => (s.id === selectedStop.id ? { ...s, status: 'DELIVERED' } : s)));
      setSuccessInfo({
        customer: selectedStop.customerName,
        invoice: invoice.invoiceNumber,
        amount: selectedStop.amount,
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
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-black text-[#800020] mb-2">Select Van</h1>
          <p className="text-base text-gray-600 mb-5">Choose your delivery van</p>
          <div className="space-y-3">
            {vans.map((van) => (
              <button
                key={van.id}
                onClick={() => selectVan(van)}
                className="w-full min-h-12 bg-white border border-gray-200 rounded-xl shadow-sm p-4 text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Truck size={22} className="text-[#800020]" />
                  <div>
                    <div className="text-lg font-black text-gray-900">{van.van_number}</div>
                    <div className="text-base text-gray-600">{van.driver_name || 'Driver'}</div>
                    <div className="text-xs font-bold text-gray-500 uppercase">
                      {String(van.status).toLowerCase() === 'active' ? 'AVAILABLE' : 'IN USE'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-400" />
              </button>
            ))}
            {!loading && vans.length === 0 && <div className="text-base text-gray-500">No vans found.</div>}
          </div>
        </div>
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
            <textarea
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-base"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
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
