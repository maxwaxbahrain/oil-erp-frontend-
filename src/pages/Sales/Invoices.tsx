import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  FileText,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { getInvoices, type Invoice } from '../../services/api';
import { getCustomers, type Customer } from '../../services/customerService';
import { getCompanySettings, type CompanySettings } from '../../services/settingsService';
import {
  downloadInvoicePDF,
  downloadInvoiceWord,
  shareInvoicePDF,
  type SharePdfResult,
} from '../../services/invoiceDocumentService';

const THEME_PRIMARY = '#800020';
const THEME_OVERDUE = '#5c0015';

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalDay(raw: string | undefined): Date | null {
  if (raw == null || raw === '') return null;
  try {
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  } catch {
    return null;
  }
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function parseSalesmanFromNotes(notes: string | undefined): string {
  if (!notes?.trim()) return '';
  const m = notes.match(/Salesman:\s*([^\n]+)/i);
  return (m?.[1] ?? '').trim();
}

function displayCustomerName(inv: Invoice, customerById: Map<string, string>): string {
  if (inv.customerName?.trim()) return inv.customerName.trim();
  const n = customerById.get(String(inv.customerId));
  return n?.trim() ? n : `Customer #${inv.customerId}`;
}

function outstandingAmount(inv: Invoice): number {
  if (inv.remaining_balance != null) return Math.max(0, inv.remaining_balance);
  const paid = inv.amount_paid ?? 0;
  return Math.max(0, inv.grandTotal - paid);
}

function isOverdue(inv: Invoice, today: Date): boolean {
  if (inv.status === 'Overdue') return true;
  if (inv.status === 'Paid') return false;
  const due = toLocalDay(inv.dueDate);
  if (!due) return false;
  return due.getTime() < today.getTime();
}

type FilterTab = 'all' | 'today' | 'unpaid' | 'paid' | 'overdue';

function statusBadgeClass(status: Invoice['status']): string {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    case 'Unpaid':
      return 'bg-red-50 text-red-800 border border-red-200';
    case 'Partial':
      return 'bg-orange-50 text-orange-900 border border-orange-200';
    case 'Overdue':
      return 'text-white border border-transparent';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
}

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [salesmanFilter, setSalesmanFilter] = useState<string>('all');

  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [shareMenuInvoiceId, setShareMenuInvoiceId] = useState<string | null>(null);
  const [shareMenuPos, setShareMenuPos] = useState<{ top: number; left: number } | null>(null);
  const shareButtonRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const [shareAttachModal, setShareAttachModal] = useState<{
    channel: 'whatsapp' | 'sms' | 'email';
    fileName: string;
  } | null>(null);

  const customerById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) {
      m.set(String(c.id), c.name ?? '');
    }
    return m;
  }, [customers]);

  const companyForShare = company ?? getCompanySettings();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invList, custList] = await Promise.all([getInvoices(), getCustomers()]);
      setInvoices(invList);
      setCustomers(custList);
      setCompany(getCompanySettings());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = useMemo(() => startOfToday(), []);

  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  const stats = useMemo(() => {
    const createdToday = invoices.filter((inv) => sameDay(toLocalDay(inv.createdAt), today));
    const invoicedTodayTotal = createdToday.reduce((s, inv) => s + inv.grandTotal, 0);
    const collectedToday = createdToday.filter((inv) => inv.status === 'Paid').reduce((s, inv) => s + inv.grandTotal, 0);
    const outstanding = invoices.reduce((s, inv) => {
      if (inv.status === 'Paid') return s;
      return s + outstandingAmount(inv);
    }, 0);
    const invoicesTodayCount = createdToday.length;

    return { invoicedTodayTotal, collectedToday, outstanding, invoicesTodayCount };
  }, [invoices, today]);

  const salesmenOptions = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invoices) {
      const s = parseSalesmanFromNotes(inv.notes);
      if (s) set.add(s);
    }
    return ['all', ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...invoices];

    if (q) {
      list = list.filter((inv) => {
        const name = displayCustomerName(inv, customerById).toLowerCase();
        return inv.invoiceNumber.toLowerCase().includes(q) || name.includes(q);
      });
    }

    if (filterTab === 'today') {
      list = list.filter((inv) => sameDay(toLocalDay(inv.createdAt), today));
    } else if (filterTab === 'unpaid') {
      list = list.filter((inv) => inv.status === 'Unpaid' || inv.status === 'Partial' || inv.status === 'Overdue');
    } else if (filterTab === 'paid') {
      list = list.filter((inv) => inv.status === 'Paid');
    } else if (filterTab === 'overdue') {
      list = list.filter((inv) => isOverdue(inv, today));
    }

    if (dateFrom) {
      const from = toLocalDay(dateFrom);
      if (from) {
        list = list.filter((inv) => {
          const d = toLocalDay(inv.invoiceDate);
          return d && d.getTime() >= from.getTime();
        });
      }
    }
    if (dateTo) {
      const toD = toLocalDay(dateTo);
      if (toD) {
        list = list.filter((inv) => {
          const d = toLocalDay(inv.invoiceDate);
          return d && d.getTime() <= toD.getTime();
        });
      }
    }

    if (salesmanFilter !== 'all') {
      list = list.filter((inv) => parseSalesmanFromNotes(inv.notes) === salesmanFilter);
    }

    return list.sort((a, b) => {
      const da = toLocalDay(b.invoiceDate)?.getTime() ?? 0;
      const db = toLocalDay(a.invoiceDate)?.getTime() ?? 0;
      return da - db;
    });
  }, [invoices, search, filterTab, dateFrom, dateTo, salesmanFilter, customerById, today]);

  const closeShareMenu = () => {
    setShareMenuInvoiceId(null);
    setShareMenuPos(null);
  };

  const finishShare = (res: SharePdfResult) => {
    closeShareMenu();
    if (res.showAttachModal) {
      setShareAttachModal({
        channel: res.channel,
        fileName: res.fileName,
      });
    }
  };

  const openShareMenu = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (shareMenuInvoiceId === invoiceId) {
      closeShareMenu();
      return;
    }
    const btn = shareButtonRef.current[invoiceId];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dropdownHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow > dropdownHeight ? rect.bottom + 4 : rect.top - dropdownHeight - 4;
    const left = Math.min(rect.left, window.innerWidth - 220);
    setShareMenuPos({ top, left });
    setShareMenuInvoiceId(invoiceId);
  };

  const filterChips: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
  ];

  const shareMenuPortal =
    shareMenuInvoiceId &&
    shareMenuPos &&
    (() => {
      const portalInv = invoices.find((i) => String(i.id) === shareMenuInvoiceId);
      if (!portalInv) return null;

      const shareOptClass =
        'w-full flex items-center gap-3 text-left text-[#1a1a1a] hover:bg-[#f3f4f6] cursor-pointer border-0 bg-transparent rounded-none';
      const shareOptStyle = { padding: '10px 16px', fontSize: '14px' } as const;

      return createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99997 }}
            onClick={closeShareMenu}
            aria-hidden
          />
          <div
            style={{
              position: 'fixed',
              top: shareMenuPos.top,
              left: shareMenuPos.left,
              zIndex: 99999,
              background: '#FFFFFF',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              minWidth: '200px',
              overflow: 'hidden',
            }}
            onClick={(ev) => ev.stopPropagation()}
            role="menu"
          >
            <button
              type="button"
              className={shareOptClass}
              style={shareOptStyle}
              onClick={() => {
                void downloadInvoicePDF(portalInv, companyForShare).finally(closeShareMenu);
              }}
            >
              <FileDown className="shrink-0 text-red-600" size={18} />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              className={shareOptClass}
              style={shareOptStyle}
              onClick={async () => {
                await downloadInvoiceWord(portalInv, companyForShare);
                closeShareMenu();
              }}
            >
              <FileText className="shrink-0 text-blue-600" size={18} />
              <span>Download Word</span>
            </button>
            <button
              type="button"
              className={shareOptClass}
              style={shareOptStyle}
              onClick={() => {
                void shareInvoicePDF(portalInv, companyForShare, 'whatsapp').then(finishShare);
              }}
            >
              <MessageCircle className="shrink-0 text-emerald-600" size={18} />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              className={shareOptClass}
              style={shareOptStyle}
              onClick={() => {
                void shareInvoicePDF(portalInv, companyForShare, 'sms').then(finishShare);
              }}
            >
              <Smartphone className="shrink-0 text-orange-600" size={18} />
              <span>SMS / Text</span>
            </button>
            <button
              type="button"
              className={shareOptClass}
              style={shareOptStyle}
              onClick={() => {
                void shareInvoicePDF(portalInv, companyForShare, 'email').then(finishShare);
              }}
            >
              <Mail className="shrink-0 text-gray-600" size={18} />
              <span>Email</span>
            </button>
            <button
              type="button"
              className={shareOptClass}
              style={shareOptStyle}
              onClick={() => {
                void shareInvoicePDF(portalInv, companyForShare, 'copy').then(() => closeShareMenu());
              }}
            >
              <Link2 className="shrink-0 text-violet-700" size={18} />
              <span>Copy link</span>
            </button>
          </div>
        </>,
        document.body
      );
    })();

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 md:pb-10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 space-y-6">
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-[0.06] pointer-events-none">
            <FileText size={160} className="text-gray-900" />
          </div>
          <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex items-start gap-5">
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                style={{ backgroundColor: THEME_PRIMARY }}
              >
                <FileText size={34} strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight uppercase">Invoices</h1>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em] mt-2">
                  Daily overview & invoice management
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Calendar size={18} className="text-gray-400 shrink-0" />
                  <span className="text-base md:text-lg" style={{ color: THEME_PRIMARY }}>
                    {todayFormatted}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => load()}
              className="shrink-0 self-start p-3 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Invoiced Today</p>
            <p className="text-3xl md:text-4xl font-black tabular-nums" style={{ color: THEME_PRIMARY }}>
              ${formatMoney(stats.invoicedTodayTotal)}
            </p>
            <p className="text-xs font-semibold text-gray-500 mt-2">Today&apos;s total</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Collected Today</p>
            <p className="text-3xl md:text-4xl font-black text-emerald-600 tabular-nums">
              ${formatMoney(stats.collectedToday)}
            </p>
            <p className="text-xs font-semibold text-gray-500 mt-2">Paid invoices created today</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Outstanding</p>
            <p
              className={clsx(
                'text-3xl md:text-4xl font-black tabular-nums',
                stats.outstanding > 0 ? 'text-red-600' : 'text-gray-400'
              )}
            >
              ${formatMoney(stats.outstanding)}
            </p>
            <p className="text-xs font-semibold text-gray-500 mt-2">Unpaid / partial balance</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Invoices Today</p>
            <p className="text-3xl md:text-4xl font-black text-gray-900 tabular-nums">{stats.invoicesTodayCount}</p>
            <p className="text-xs font-semibold text-gray-500 mt-2">Created today</p>
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <input
            type="search"
            placeholder="Search invoice # or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#800020]/25 focus:border-[#800020]"
          />

          <div className="flex flex-wrap gap-2">
            {filterChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilterTab(c.key)}
                className={clsx(
                  'shrink-0 px-4 sm:px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all',
                  filterTab === c.key
                    ? 'text-white shadow-lg shadow-gray-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                )}
                style={filterTab === c.key ? { backgroundColor: THEME_PRIMARY } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row md:flex-wrap gap-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <label className="flex flex-col gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                From
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                To
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest md:min-w-[200px]">
              Salesman
              <select
                value={salesmanFilter}
                onChange={(e) => setSalesmanFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold bg-white"
              >
                {salesmenOptions.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All salesmen' : s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 text-red-800 text-sm font-bold px-4 py-3 border border-red-100">{error}</div>
        )}

        {loading && invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3 rounded-2xl bg-white border border-gray-100">
            <Loader2 className="animate-spin" style={{ color: THEME_PRIMARY }} size={36} />
            <span className="text-sm font-bold">Loading invoices…</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
            <p className="text-gray-800 font-black uppercase tracking-wide text-sm">No invoices in this view</p>
            <p className="text-sm text-gray-500 font-semibold mt-2">Adjust filters or refresh.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden -mx-1 sm:mx-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 sm:px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Invoice
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Customer
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Date
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Salesman
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">
                      Items
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">
                      Amount
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">
                      Status
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.map((inv) => {
                    const itemsCount = inv.lineItems?.length ?? 0;
                    const sm = parseSalesmanFromNotes(inv.notes) || '—';
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-3 sm:px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDetailInvoice(inv)}
                            className="font-mono font-black text-left hover:underline text-sm sm:text-base"
                            style={{ color: THEME_PRIMARY }}
                          >
                            {inv.invoiceNumber}
                          </button>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold text-gray-900 max-w-[140px] sm:max-w-none truncate sm:whitespace-normal">
                          {displayCustomerName(inv, customerById)}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold text-gray-600 whitespace-nowrap">
                          {inv.invoiceDate
                            ? new Date(
                                inv.invoiceDate.includes('T') ? inv.invoiceDate : `${inv.invoiceDate}T12:00:00`
                              ).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-xs font-bold text-gray-600 max-w-[100px] truncate">
                          {sm}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center text-sm font-black text-gray-800">{itemsCount}</td>
                        <td className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-black text-gray-900 font-mono tabular-nums whitespace-nowrap">
                          ${formatMoney(inv.grandTotal)}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <span
                            className={clsx(
                              'inline-block px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wide',
                              statusBadgeClass(inv.status)
                            )}
                            style={inv.status === 'Overdue' ? { backgroundColor: THEME_OVERDUE } : undefined}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <div className="flex items-center justify-center gap-0.5 sm:gap-1 flex-nowrap">
                            <button
                              type="button"
                              title="View"
                              onClick={() => setDetailInvoice(inv)}
                              className="p-1.5 sm:p-2 rounded-lg text-blue-700 hover:bg-blue-50 transition-colors"
                            >
                              <Eye size={17} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                            <button
                              type="button"
                              ref={(el) => {
                                shareButtonRef.current[String(inv.id)] = el;
                              }}
                              title="Share"
                              onClick={(e) => openShareMenu(String(inv.id), e)}
                              className="p-1.5 sm:p-2 rounded-lg flex items-center gap-0.5 text-[#800020] hover:bg-red-50 transition-colors"
                            >
                              <Share2 size={15} className="sm:w-4 sm:h-4" />
                              <ChevronDown size={12} className="opacity-70 sm:w-[14px] sm:h-[14px]" />
                            </button>
                            <button
                              type="button"
                              title="Download PDF"
                              onClick={() => void downloadInvoicePDF(inv, companyForShare)}
                              className="p-1.5 sm:p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <Download size={17} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                            {inv.status !== 'Paid' && (
                              <button
                                type="button"
                                title="Apply Credit"
                                onClick={() => navigate('/sales/credit-notes/new', { state: { customerId: inv.customerId, invoiceId: inv.id, reason: 'price_adjustment' } })}
                                className="px-2 py-1 rounded-md text-[10px] font-black uppercase text-white"
                                style={{ backgroundColor: THEME_PRIMARY }}
                              >
                                Apply Credit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {shareMenuPortal}

      {detailInvoice && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="px-6 py-4 flex items-center justify-between shrink-0 text-white"
              style={{ backgroundColor: THEME_PRIMARY }}
            >
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <FileText size={22} />
                  Invoice
                </h2>
                <p className="text-[11px] font-bold opacity-90 font-mono">{detailInvoice.invoiceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailInvoice(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 md:p-8 space-y-6 flex-1">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-4 border-b border-gray-100 pb-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer</p>
                  <p className="text-xl font-black text-gray-900">
                    {displayCustomerName(detailInvoice, customerById)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2 font-semibold">
                    Date:{' '}
                    {detailInvoice.invoiceDate
                      ? new Date(
                          detailInvoice.invoiceDate.includes('T')
                            ? detailInvoice.invoiceDate
                            : `${detailInvoice.invoiceDate}T12:00:00`
                        ).toLocaleDateString()
                      : '—'}
                    {detailInvoice.dueDate && (
                      <>
                        {' '}
                        · Due:{' '}
                        {new Date(
                          detailInvoice.dueDate.includes('T')
                            ? detailInvoice.dueDate
                            : `${detailInvoice.dueDate}T12:00:00`
                        ).toLocaleDateString()}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-semibold">
                    Salesman: {parseSalesmanFromNotes(detailInvoice.notes) || '—'}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-3xl font-black font-mono tabular-nums" style={{ color: THEME_PRIMARY }}>
                    ${formatMoney(detailInvoice.grandTotal)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Payment summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Status</p>
                    <p className="font-black text-gray-900">{detailInvoice.payment_status ?? detailInvoice.status}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Amount paid</p>
                    <p className="font-black text-emerald-700 font-mono tabular-nums">
                      ${formatMoney(detailInvoice.amount_paid ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Balance due</p>
                    <p className="font-black text-gray-900 font-mono tabular-nums">
                      ${formatMoney(outstandingAmount(detailInvoice))}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-medium pt-2 border-t border-gray-200">
                  Detailed payment history is available on the customer ledger when payments are recorded there.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">
                  Line items
                </h3>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-[10px] font-black text-gray-500 uppercase">Product</th>
                        <th className="px-3 py-2 text-[10px] font-black text-gray-500 uppercase text-center w-16">Qty</th>
                        <th className="px-3 py-2 text-[10px] font-black text-gray-500 uppercase text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(detailInvoice.lineItems ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-gray-500 font-semibold">
                            No line items
                          </td>
                        </tr>
                      ) : (
                        detailInvoice.lineItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-3">
                              <p className="font-bold text-gray-900">{item.product}</p>
                              {item.description ? (
                                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-gray-700">{item.quantity}</td>
                            <td className="px-3 py-3 text-right font-mono font-black text-gray-900">
                              ${formatMoney(item.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end flex-wrap">
                  <button
                    type="button"
                    onClick={() => void shareInvoicePDF(detailInvoice, companyForShare, 'whatsapp').then(finishShare)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wide hover:bg-emerald-700"
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareInvoicePDF(detailInvoice, companyForShare, 'sms').then(finishShare)}
                    className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black uppercase tracking-wide hover:bg-orange-700"
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareInvoicePDF(detailInvoice, companyForShare, 'email').then(finishShare)}
                    className="px-4 py-2 rounded-xl bg-gray-800 text-white text-xs font-black uppercase tracking-wide hover:bg-gray-900"
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareInvoicePDF(detailInvoice, companyForShare, 'copy').then(() => {})}
                    className="px-4 py-2 rounded-xl border-2 border-gray-200 text-xs font-black uppercase text-gray-800 hover:bg-gray-50"
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadInvoicePDF(detailInvoice, companyForShare)}
                    className="px-4 py-2 rounded-xl text-white text-xs font-black uppercase tracking-wide"
                    style={{ backgroundColor: THEME_PRIMARY }}
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              {detailInvoice.notes ? (
                <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <p className="text-[10px] font-black text-amber-800 uppercase mb-1">Notes</p>
                  <p className="text-sm text-gray-800 font-medium whitespace-pre-wrap">{detailInvoice.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-[10px] font-semibold text-gray-500">
              Created {new Date(detailInvoice.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {shareAttachModal && (
        <div
          className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={() => setShareAttachModal(null)}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                {shareAttachModal.channel === 'whatsapp' && 'Share Invoice on WhatsApp'}
                {shareAttachModal.channel === 'sms' && 'Share Invoice via SMS'}
                {shareAttachModal.channel === 'email' && 'Share Invoice via Email'}
              </h2>
            </div>
            <div className="px-6 py-5 text-sm text-gray-700 leading-relaxed space-y-4">
              {shareAttachModal.channel === 'whatsapp' && (
                <p className="whitespace-pre-line">
                  {`Your PDF has been downloaded as:\n${shareAttachModal.fileName}\n\nAttach it in WhatsApp using the paperclip, then send.`}
                </p>
              )}
              {shareAttachModal.channel === 'sms' && (
                <p className="whitespace-pre-line">
                  {`Your PDF has been downloaded as:\n${shareAttachModal.fileName}\n\nAttach it in your SMS app from Downloads or Files.`}
                </p>
              )}
              {shareAttachModal.channel === 'email' && (
                <p className="whitespace-pre-line">
                  {`Your PDF has been downloaded as:\n${shareAttachModal.fileName}\n\nAttach it to your email draft.`}
                </p>
              )}
              <button
                type="button"
                onClick={() => setShareAttachModal(null)}
                className="w-full py-2.5 rounded-lg font-black uppercase text-sm text-white"
                style={{ backgroundColor: THEME_PRIMARY }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
