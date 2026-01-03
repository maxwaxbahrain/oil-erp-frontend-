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

export default function CustomerList({ onEdit, onLedger, onReceipt, refreshTrigger }: CustomerListProps) {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError('Unable to load customers. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      header: 'Legal Entity Name',
      headerClassName: 'bg-blue-900 text-white',
      accessor: (c: Customer) => (
        <div className="flex flex-col">
          <span className="text-redwood-text-main font-black uppercase tracking-tight">{c.name}</span>
          <span className="text-[10px] text-redwood-text-muted font-bold tracking-widest">{c.id?.slice(-8) || 'LEGACY-ID'}</span>
        </div>
      )
    },
    {
      header: 'Classification',
      headerClassName: 'bg-blue-800 text-white',
      accessor: (c: Customer) => (
        <span className="text-[11px] font-black bg-redwood-bg-light border border-redwood-border px-2 py-1 rounded-sm uppercase tracking-widest">
          {c.category || 'RETAIL'}
        </span>
      )
    },
    {
      header: 'Nexus Location',
      headerClassName: 'bg-slate-600 text-white',
      accessor: (c: Customer) => (
        <span className="text-[11px] text-redwood-text-muted font-bold tracking-tight uppercase">
          {c.address && c.address.trim() !== '' ? (c.address.length > 30 ? c.address.slice(0, 30) + '...' : c.address) : 'NOT SPECIFIED'}
        </span>
      )
    },
    {
      header: 'Fiscal Balance',
      headerClassName: 'bg-slate-500 text-white',
      accessor: (c: Customer) => (
        <div className="flex flex-col items-end w-full">
          <span className={`text-[13px] font-black font-mono ${(c.balance || 0) > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
            {(c.balance || 0).toLocaleString()}
          </span>
          <span className="text-[9px] text-redwood-text-muted font-bold uppercase tracking-widest">Sync-In-Progress</span>
        </div>
      ),
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
      {/* Header with Search and Add Button */}
      <div className="bg-white border border-redwood-border rounded-sm shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Search Box */}
          <div className="flex-1 max-w-md relative">
            {/* BUG #5 FIX: Removed magnifying glass icon */}
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

          {/* Add Customer Button */}
          <button
            onClick={() => navigate('/customers/new')}
            className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-sm font-bold hover:brightness-95 flex items-center gap-2 shadow-md"
          >
            <Plus size={16} />
            Add New Customer
          </button>
        </div>
      </div>

      {/* Data Table */}
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
#test the git hub
# i change some files in folder