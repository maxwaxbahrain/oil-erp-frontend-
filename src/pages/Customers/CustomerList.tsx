import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Customer, getCustomers } from '../../services/customerService';
import DataTable from '../../components/tables/DataTable';
import { Plus } from 'lucide-react';

interface CustomerListProps {
  onEdit?: (customer: Customer) => void;
  onLedger?: (customer: Customer) => void;
  onReceipt?: (customer: Customer) => void;
  refreshTrigger?: number;
}

export default function CustomerList({ refreshTrigger }: CustomerListProps) {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadRegistry() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCustomers();
        if (cancelled) return;
        // Use the server-side balance directly. The backend now maintains it
        // correctly: invoice POST increments, payment POST decrements. We reset
        // historical balances to the BETTANO 'Owes:' baseline via a one-shot script.
        setCustomers(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unable to load customers. Start the API (port 8000) and refresh.'
          );
          setLoading(false);
        }
      }
    }

    void loadRegistry();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError(err instanceof Error ? err.message : 'Unable to load customers. Start the API (port 8000) and refresh.');
    } finally {
      setLoading(false);
    }
  }

  const q = searchTerm.toLowerCase();
  const filteredCustomers = customers.filter((customer) => {
    const name = (customer.name ?? '').toLowerCase();
    const idStr = String(customer.id ?? '').toLowerCase();
    const addr = (customer.address ?? '').toLowerCase();
    return name.includes(q) || idStr.includes(q) || addr.includes(q);
  });

  const tableHead = 'bg-blue-950 text-white border-r border-blue-900/40 last:border-r-0';

  const columns = [
    {
      header: 'Legal Entity Name',
      headerClassName: tableHead,
      accessor: (c: Customer) => (
        <div className="flex flex-col">
          <span className="text-redwood-text-main font-black uppercase tracking-tight">{c.name}</span>
          <span className="text-[10px] text-redwood-text-muted font-bold tracking-widest">
            {String(c.id ?? '').slice(-8) || 'LEGACY-ID'}
          </span>
        </div>
      )
    },
    {
      header: 'Classification',
      headerClassName: tableHead,
      accessor: (c: Customer) => (
        <span className="text-[11px] font-black bg-redwood-bg-light border border-redwood-border px-2 py-1 rounded-sm uppercase tracking-widest">
          {c.category || 'RETAIL'}
        </span>
      )
    },
    {
      header: 'Nexus Location',
      headerClassName: tableHead,
      accessor: (c: Customer) => {
        // Prefer the stored address. If empty, try to pull the location half
        // out of the BETTANO-style name (split on " - " or first comma).
        const fromField = (c.address || '').trim();
        let addr = fromField;
        if (!addr) {
          const name = (c.name || '').trim();
          if (name.includes(' - ')) addr = name.split(' - ').slice(1).join(' - ').trim();
          else if (name.includes(',')) addr = name.split(',').slice(1).join(',').trim();
        }
        if (!addr) {
          return <span className="text-xs text-gray-400">—</span>;
        }
        const shown = addr.length > 40 ? `${addr.slice(0, 40)}…` : addr;
        return <span className="text-xs text-gray-500">{shown}</span>;
      }
    },
    {
      header: 'Outstanding Balance',
      headerClassName: tableHead,
      accessor: (c: Customer) => {
        const bal = Number(c.balance || 0);
        const owes = bal > 0;
        return (
          <div className="flex flex-col items-end w-full">
            <span className={`text-[13px] font-black font-mono ${owes ? 'text-rose-500' : 'text-emerald-600'}`}>
              ${bal.toLocaleString()}
            </span>
            <span className="text-[9px] text-redwood-text-muted/80 font-bold tracking-widest">OUTSTANDING BALANCE</span>
          </div>
        );
      },
      className: 'text-right'
    }
  ];

  if (error) {
    return (
      <div className="p-10 bg-red-50 border border-red-200 rounded-sm text-center">
        <p className="text-red-700 font-bold text-sm">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-redwood-brand text-white rounded-sm text-sm font-bold hover:brightness-95"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-redwood-border rounded-sm shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <input
              type="text"
              autoComplete="off"
              placeholder="Search customers by name, ID, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-sm text-sm focus:border-redwood-brand focus:outline-none focus:ring-0"
              style={{
                WebkitAppearance: 'none' as const,
                MozAppearance: 'none' as const,
                appearance: 'none' as const
              }}
            />
          </div>
          <button
            onClick={() => navigate('/customers/new')}
            className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-sm font-bold hover:brightness-95 flex items-center gap-2 shadow-md"
          >
            <Plus size={16} />
            Add New Customer
          </button>
        </div>
      </div>

      {!loading && customers.length === 0 && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
          <strong className="font-black uppercase tracking-wide">No rows returned from the API.</strong>{' '}
          Confirm FastAPI is running with your database (e.g.{' '}
          <code className="rounded bg-white px-1 font-mono text-[11px]">uvicorn app.main:app --reload --port 8000</code> in{' '}
          <code className="rounded bg-white px-1 font-mono text-[11px]">oil-erp-backend</code>
          ). The app loads customers from <code className="font-mono text-[11px]">GET /api/customers/</code>, proxied from this dev
          server.
        </div>
      )}

      {!loading && customers.length > 0 && filteredCustomers.length === 0 && (
        <div className="rounded-sm border border-gray-200 bg-white px-4 py-2 text-[12px] text-redwood-text-muted">
          No rows match your search — clear the search box to see all {customers.length} customers.
        </div>
      )}

      <DataTable
        title="Global Entity Registry"
        subtitle="Master database of authorized partners and commercial interests"
        data={filteredCustomers}
        columns={columns as any}
        loading={loading}
        onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
      />
    </div>
  );
}
