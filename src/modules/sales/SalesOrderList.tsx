import { useEffect, useState } from 'react';
import { getSalesOrders, type SalesOrder } from '../../services/salesService';
import DataTable from '../../components/tables/DataTable';
// import { ShoppingCart } from 'lucide-react'; // Removed unused

export default function SalesOrderList() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const data = await getSalesOrders();
      setOrders(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    {
      header: 'Consignment ID',
      accessor: (o: SalesOrder) => (
        <div className="flex flex-col">
          <span className="text-redwood-text-main font-black font-mono">{o.so_number || `#${o.id.slice(0, 8)}`}</span>
          <span className="text-[10px] text-redwood-text-muted font-bold uppercase tracking-widest mt-0.5">Flow: {o.status}</span>
        </div>
      )
    },
    {
      header: 'Terminal & Client',
      accessor: (o: SalesOrder) => (
        <div className="flex flex-col">
          <span className="text-redwood-text-main font-bold uppercase tracking-tight truncate max-w-[200px]">Node: {o.customer_id}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] bg-redwood-bg-light border border-redwood-border px-1.5 py-0.5 rounded-sm font-black text-redwood-text-muted uppercase italic">
              Customer: {o.customer_id}
              {o.van_id ? ` · Van: ${o.van_id}` : ''}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Fulfillment State',
      accessor: (o: SalesOrder) => (
        <span className={`text-[10px] font-black px-3 py-1 rounded-sm uppercase tracking-widest border ${
          o.status === 'delivered' || o.status === 'invoiced'
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
            : o.status === 'confirmed'
              ? 'bg-blue-50 text-blue-700 border-blue-100'
              : 'bg-redwood-brand/5 text-redwood-brand border-redwood-brand/20'
          }`}>
          {o.status}
        </span>
      )
    },
    {
      header: 'Fiscal Value',
      accessor: (o: SalesOrder) => (
        <div className="text-right">
          <div className="text-[14px] font-black text-redwood-text-main font-mono">{o.total_amount.toLocaleString()}</div>
          <div className="text-[9px] text-redwood-text-muted font-black uppercase tracking-widest mt-0.5">{o.items.length} Units Manifested</div>
        </div>
      ),
      className: 'text-right'
    }
  ];

  return (
    <DataTable
      title="Global Revenue Ledger"
      subtitle="Comprehensive manifest of validated order intake and fiscal transfers"
      data={orders}
      columns={columns as any}
      loading={loading}
    />
  );
}
