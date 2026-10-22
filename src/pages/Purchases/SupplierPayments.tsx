import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DollarSign, Loader2 } from 'lucide-react';
import SearchableSelect from '../../components/common/SearchableSelect';
import { getGLAccounts, type GLAccount } from '../../services/glService';
import {
  getAllSupplierPayments,
  getSuppliers,
  type Supplier,
  type SupplierPaymentRow,
  type SupplierPaymentsPage,
} from '../../services/purchasesService';
import { formatLocalDate } from '../../utils/dates';
import { formatCurrency } from '../../utils/formatters';

const PAGE_LIMIT = 100;

const EMPTY_PAGE: SupplierPaymentsPage = { total: 0, sum_amount: 0, items: [] };

function accountLabel(row: SupplierPaymentRow): string {
  if (row.account_code == null || row.account_name == null) return '—';
  return `${row.account_code} — ${row.account_name}`;
}

function purchaseOrderLabel(row: SupplierPaymentRow): string {
  const numbers = (row.allocations || [])
    .map((entry) => entry.po_number)
    .filter((number): number is string => typeof number === 'string' && number.trim() !== '');
  if (!row.allocations?.length || numbers.length === 0) return 'Not allocated';
  return numbers.join(', ');
}

export default function SupplierPayments() {
  const navigate = useNavigate();
  const [page, setPage] = useState<SupplierPaymentsPage>(EMPTY_PAGE);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [accountId, setAccountId] = useState('');
  const [offset, setOffset] = useState(0);
  const [pickingSupplier, setPickingSupplier] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllSupplierPayments({
        supplier_id: supplierId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        account_id: accountId ? Number(accountId) : undefined,
        limit: PAGE_LIMIT,
        offset,
      });
      setPage(data);
    } catch (e) {
      setPage(EMPTY_PAGE);
      setError(e instanceof Error ? e.message : 'Failed to load supplier payments');
    } finally {
      setLoading(false);
    }
  }, [supplierId, dateFrom, dateTo, accountId, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    getSuppliers()
      .then((data) => {
        if (!cancelled) setSuppliers(data);
      })
      .catch(() => {
        if (!cancelled) setSuppliers([]);
      });
    getGLAccounts()
      .then((data) => {
        if (!cancelled) setAccounts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, code: supplier.code })),
    [suppliers],
  );
  const supplierFilterOptions = useMemo(
    () => [{ id: '', name: 'All suppliers', code: '' }, ...supplierOptions],
    [supplierOptions],
  );
  const accountOptions = useMemo(
    () => [
      { id: '', name: 'All accounts', code: '' },
      ...accounts.map((account) => ({
        id: String(account.id),
        name: `${account.code} — ${account.name}`,
        code: account.code,
      })),
    ],
    [accounts],
  );

  const suppliersPaid = useMemo(() => {
    const names = new Set(page.items.map((row) => row.supplier_name).filter((name) => name.trim() !== ''));
    return names.size;
  }, [page.items]);
  const unallocatedPage = useMemo(
    () => page.items.reduce((sum, row) => sum + (Number(row.unallocated) || 0), 0),
    [page.items],
  );

  const rangeStart = page.total === 0 ? 0 : offset + 1;
  const rangeEnd = page.total === 0 ? 0 : Math.min(offset + page.items.length, page.total);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <DollarSign size={22} />
          Supplier payments
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPickingSupplier((open) => !open)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-black"
            style={{ backgroundColor: '#800020' }}
          >
            <DollarSign size={16} />
            Record payment
          </button>
          {pickingSupplier && (
            <div className="min-w-[16rem]">
              <SearchableSelect
                options={supplierOptions}
                value=""
                onChange={(id) => {
                  if (id) navigate(`/suppliers/${id}?tab=payments`);
                }}
                placeholder="Choose a supplier"
                displayKey="name"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div data-tile="total-paid" className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">Total paid</div>
          <div data-tile-value className="text-lg font-black text-gray-900 font-mono">{formatCurrency(page.sum_amount)}</div>
        </div>
        <div data-tile="payments" className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">Payments</div>
          <div data-tile-value className="text-lg font-black text-gray-900 font-mono">{page.total}</div>
        </div>
        <div data-tile="suppliers-paid" className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">Suppliers paid (this page)</div>
          <div data-tile-value className="text-lg font-black text-gray-900 font-mono">{suppliersPaid}</div>
        </div>
        <div data-tile="unallocated" className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">Unallocated (this page)</div>
          <div data-tile-value className="text-lg font-black text-gray-900 font-mono">{formatCurrency(unallocatedPage)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-bold text-gray-600 min-w-[12rem]">
          Supplier
          <div className="mt-1">
            <SearchableSelect
              options={supplierFilterOptions}
              value={supplierId}
              onChange={(id) => {
                setSupplierId(id);
                setOffset(0);
              }}
              placeholder="All suppliers"
              displayKey="name"
            />
          </div>
        </label>
        <label className="text-xs font-bold text-gray-600">
          Date from
          <input
            aria-label="Date from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setOffset(0);
            }}
            className="mt-1 block border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
        <label className="text-xs font-bold text-gray-600">
          Date to
          <input
            aria-label="Date to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setOffset(0);
            }}
            className="mt-1 block border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
        <label className="text-xs font-bold text-gray-600 min-w-[12rem]">
          Account
          <div className="mt-1">
            <SearchableSelect
              options={accountOptions}
              value={accountId}
              onChange={(id) => {
                setAccountId(id);
                setOffset(0);
              }}
              placeholder="All accounts"
              displayKey="name"
            />
          </div>
        </label>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {loading && page.total === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-gray-500">
          <Loader2 className="inline animate-spin" size={18} /> Loading supplier payments…
        </div>
      ) : page.total === 0 && !error ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-gray-500">
          No supplier payments yet.
        </div>
      ) : page.total === 0 ? null : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Allocated</th>
                <th className="px-4 py-3 text-right">Unallocated</th>
                <th className="px-4 py-3">Purchase orders</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((row) => {
                const orders = purchaseOrderLabel(row);
                const unallocatedOrders = orders === 'Not allocated';
                return (
                  <tr key={String(row.id)} className="border-t border-gray-100">
                    <td className="px-4 py-3">{formatLocalDate(row.date) || '—'}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/suppliers/${row.supplierId}?tab=payments`}
                        className="font-bold text-gray-900 underline"
                      >
                        {row.supplier_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono">{row.reference || '—'}</td>
                    <td className="px-4 py-3">{row.paymentMethod}</td>
                    <td className="px-4 py-3">{accountLabel(row)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.allocated_total)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.unallocated)}</td>
                    <td className={`px-4 py-3 ${unallocatedOrders ? 'text-gray-400' : ''}`}>{orders}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {page.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <span>Showing {rangeStart}–{rangeEnd} of {page.total}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((current) => Math.max(0, current - PAGE_LIMIT))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={offset + PAGE_LIMIT >= page.total}
              onClick={() => setOffset((current) => current + PAGE_LIMIT)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
