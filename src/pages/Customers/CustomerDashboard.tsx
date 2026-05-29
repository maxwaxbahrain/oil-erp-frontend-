import { useEffect, useState } from 'react';
import { Users, Plus, FileText, Receipt, AlertCircle, Filter, ArrowLeft, Download } from 'lucide-react';
import { type Customer, getCustomers } from '../../services/customerService';
import { getInvoices, getPayments } from '../../services/api';
import { calculateReceivables } from '../../utils/arMetrics';
import CustomerListPage from './CustomerList';  // ← FIXED: Changed from CustomerList to CustomerListPage
import CustomerForm from './CustomerForm';
import CustomerLedger from './CustomerLedger';
import PaymentReceipt from './PaymentReceipt';
import OverdueReports from './OverdueReports';

type ViewMode = 'list' | 'form' | 'ledger' | 'receipt' | 'overdue';

export default function CustomerDashboard() {
  const [view, setView] = useState<ViewMode>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [metrics, setMetrics] = useState({
    receivables: null as number | null,
    overLimit: null as number | null,
    collected: null as number | null,
    customers: null as number | null,
  });

  useEffect(() => {
    Promise.all([getInvoices(), getPayments(), getCustomers()])
      .then(([invoices, payments, customers]) => {
        const receivables = calculateReceivables(invoices, payments).total;
        const overLimit = customers.filter((c: any) => {
          const balance = Number(c?.balance) || 0;
          const limit = Number(c?.credit_limit ?? c?.creditLimit) || 0;
          return limit > 0 && balance > limit;
        }).length;
        const collected = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        setMetrics({ receivables, overLimit, collected, customers: customers.length });
      })
      .catch(() => setMetrics({ receivables: null, overLimit: null, collected: null, customers: null }));
  }, []);

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setView('form');
  };

  const handleLedger = (customer: Customer) => {
    setSelectedCustomer(customer);
    setView('ledger');
  };

  const handleReceipt = (customer: Customer) => {
    setSelectedCustomer(customer);
    setView('receipt');
  };

  const goBack = () => {
    setSelectedCustomer(null);
    setView('list');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-10">
      {/* Strategic Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-redwood-text-main tracking-tighter uppercase">Customer Relationship Hub</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black text-redwood-brand uppercase tracking-[0.2em] px-2 py-0.5 bg-redwood-brand/10 rounded-sm">Master Data Registry</span>
            <span className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Global Entities: {metrics.customers == null ? '—' : metrics.customers} Active</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view === 'list' ? (
            <>
              <button
                onClick={() => setView('overdue')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-redwood-border text-[11px] font-black text-redwood-brand rounded-sm hover:bg-redwood-brand/5 transition-all shadow-sm"
              >
                <AlertCircle size={14} /> OVERDUE MONITOR
              </button>
              <button
                onClick={() => { setSelectedCustomer(null); setView('form'); }}
                className="flex items-center gap-2 px-6 py-2.5 bg-redwood-brand border border-transparent text-[11px] font-black text-white rounded-sm hover:brightness-90 transition-all shadow-lg uppercase tracking-widest"
              >
                <Plus size={16} /> REGISTER ENTITY
              </button>
            </>
          ) : (
            <button
              onClick={goBack}
              className="px-5 py-2.5 bg-white border border-redwood-border rounded-sm text-[11px] font-black text-redwood-text-muted hover:bg-redwood-bg-light transition-all flex items-center gap-2 shadow-sm uppercase tracking-widest"
            >
              <ArrowLeft size={16} /> RETURN TO REGISTRY
            </button>
          )}
        </div>
      </div>

      {/* Metrics Array - Only in List View */}
      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm group">
            <div className="flex justify-between items-start mb-4">
              <div className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Total Receivables</div>
              <Download size={16} className="text-redwood-brand" />
            </div>
            <div className="text-2xl font-black text-redwood-text-main tracking-tight">{metrics.receivables == null ? '—' : metrics.receivables.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-redwood-brand bg-redwood-brand/5 w-fit px-2 py-0.5 rounded-sm uppercase tracking-widest">Global Float</div>
          </div>
          <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Outstanding Risk</div>
              <AlertCircle size={16} className="text-redwood-brand" />
            </div>
            <div className="text-2xl font-black text-redwood-text-main tracking-tight">{metrics.overLimit == null ? '—' : `${metrics.overLimit} Accounts`}</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-redwood-brand bg-redwood-brand/5 w-fit px-2 py-0.5 rounded-sm uppercase tracking-widest">Over Credit Limit</div>
          </div>
          <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Liquidity Velocity</div>
              <Receipt size={16} className="text-redwood-primary" />
            </div>
            <div className="text-2xl font-black text-redwood-text-main tracking-tight">{metrics.collected == null ? '—' : metrics.collected.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-sm uppercase tracking-widest">Recovered (Period)</div>
          </div>
          <div className="bg-redwood-midnight p-6 border border-white/5 rounded-sm shadow-2xl group">
            <div className="flex justify-between items-start mb-4">
              <div className="text-redwood-secondary text-[10px] font-black uppercase tracking-[0.2em]">Active Portfolios</div>
              <Users size={16} className="text-redwood-brand" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight">{metrics.customers == null ? '—' : `${metrics.customers} Cases`}</div>
            <div className="mt-4 flex gap-1 h-3 items-end">
              <div className="text-[10px] font-black text-redwood-secondary uppercase tracking-widest">No trend data</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white border border-redwood-border rounded-sm shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        {view === 'list' && (
          <div className="px-6 py-5 border-b border-redwood-bg-light flex justify-between items-center bg-white">
            <div className="relative group w-96">
              <input
                type="text"
                placeholder="Query Global Customer Registry..."
                className="w-full pr-4 py-2.5 bg-redwood-bg-light border border-redwood-border rounded-sm text-[12px] font-semibold focus:bg-white focus:border-redwood-brand focus:ring-4 focus:ring-redwood-brand/5 outline-none transition-all"
              />
            </div>
            <div className="flex gap-4">
              <button className="flex items-center gap-2 text-[11px] font-black text-redwood-primary hover:underline uppercase tracking-wider">
                <FileText size={14} /> EXPORT LEDGER
              </button>
              <button className="flex items-center gap-2 text-[11px] font-black text-redwood-primary hover:underline uppercase tracking-wider">
                <Filter size={14} /> FILTER BY REGION
              </button>
            </div>
          </div>
        )}

        <div className="p-0">
          {view === 'list' && (
            <div className="p-6">
              <CustomerListPage
                onEdit={handleEdit}
                onLedger={handleLedger}
                onReceipt={handleReceipt}
                refreshTrigger={0}
              />
            </div>
          )}

          {view === 'form' && (
            <div className="p-8 max-w-4xl mx-auto">
              <CustomerForm
                editingCustomer={selectedCustomer}
                onSave={goBack}
                onCancel={goBack}
              />
            </div>
          )}

          {view === 'ledger' && selectedCustomer && (
            <div className="p-8">
              <CustomerLedger customer={selectedCustomer} onBack={goBack} />
            </div>
          )}

          {view === 'receipt' && selectedCustomer && (
            <div className="p-8">
              <PaymentReceipt customer={selectedCustomer} onBack={goBack} />
            </div>
          )}

          {view === 'overdue' && (
            <div className="p-8">
              <OverdueReports />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

