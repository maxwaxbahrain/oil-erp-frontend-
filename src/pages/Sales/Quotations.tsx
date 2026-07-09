import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, RefreshCw, Search } from 'lucide-react';
import { getCustomers, type Customer } from '../../services/api';
import { getSalesmen } from '../../services/employeeService';
import { getQuotations, type Quotation, type QuotationStatus } from '../../services/quotationService';
import { formatDateOnly } from '../../utils/formatters';
import { buildSalesmanNameById, resolveSalesmanDisplayName } from '../../utils/salesmanDisplay';
import QuotationStatusActions from './QuotationStatusActions';

const panelStyle: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '14px',
    padding: '14px 16px',
};

type StatusFilter = 'All' | QuotationStatus;

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
    { key: 'All', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'expired', label: 'Expired' },
    { key: 'converted', label: 'Converted' },
];

function statusBadge(status: QuotationStatus): CSSProperties {
    const map: Record<string, CSSProperties> = {
        draft: { background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-muted)' },
        sent: { background: 'var(--color-badge-blue-bg)', color: 'var(--color-brand-blue-tint)' },
        accepted: { background: 'rgba(34,197,94,.12)', color: 'var(--color-brand-green-tint)' },
        rejected: { background: 'rgba(239,68,68,.12)', color: '#FCA5A5' },
        expired: { background: 'rgba(239,68,68,.12)', color: '#FCA5A5' },
        converted: { background: 'rgba(124,58,237,.12)', color: '#C4B5FD' },
    };
    return {
        fontSize: 10,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 20,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        ...(map[status] ?? map.draft),
    };
}

function formatMoney(n: number): string {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Quotations() {
    const navigate = useNavigate();
    const [quotes, setQuotes] = useState<Quotation[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [salesmanById, setSalesmanById] = useState<Map<string, string>>(() => new Map());

    const customerName = useCallback(
        (id: number) => customers.find((c) => Number(c.id) === id)?.name ?? `Customer #${id}`,
        [customers],
    );

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const [rows, cust, salesmen] = await Promise.all([
                getQuotations(),
                getCustomers(),
                getSalesmen().catch(() => []),
            ]);
            setQuotes(rows);
            setCustomers(cust);
            setSalesmanById(buildSalesmanNameById(salesmen));
        } catch (e) {
            console.error('Failed to load quotations', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const quotationSalesman = useCallback(
        (row: Quotation) =>
            resolveSalesmanDisplayName({
                salesmanEmployeeId: row.salesman_employee_id,
                legacyName: row.salesman_name,
                notes: row.notes,
                salesmanById,
            }),
        [salesmanById],
    );

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return quotes.filter((row) => {
            const matchesSearch =
                !q ||
                row.quote_number.toLowerCase().includes(q) ||
                customerName(row.customer_id).toLowerCase().includes(q);
            const matchesStatus = statusFilter === 'All' || row.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [quotes, searchTerm, statusFilter, customerName]);

    if (loading) {
        return (
            <div style={{ padding: 80, textAlign: 'center', color: 'var(--color-redwood-text-muted)' }}>
                Loading quotations…
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FileText size={22} style={{ color: '#4F8EF7' }} />
                    <div>
                        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 600, color: 'var(--color-brand-blue)', margin: 0 }}>Quotations</h1>
                        <p style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', margin: '2px 0 0' }}>Draft → Sent → Accepted → Converted</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => void load(true)} disabled={refreshing} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'transparent', color: 'var(--color-redwood-text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button type="button" onClick={() => navigate('/sales/quotations/new')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#4F8EF7', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus size={14} /> New quotation
                    </button>
                </div>
            </div>

            <div style={{ ...panelStyle, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {STATUS_CHIPS.map((chip) => (
                    <button
                        key={chip.key}
                        type="button"
                        onClick={() => setStatusFilter(chip.key)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 700,
                            border: statusFilter === chip.key ? '1px solid #4F8EF7' : '1px solid var(--color-redwood-border)',
                            background: statusFilter === chip.key ? 'rgba(79,142,247,.12)' : 'transparent',
                            color: statusFilter === chip.key ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                            cursor: 'pointer',
                        }}
                    >
                        {chip.label}
                    </button>
                ))}
                <div style={{ marginLeft: 'auto', position: 'relative', minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-redwood-text-muted)' }} />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search quote # or customer…"
                        style={{ ...panelStyle, padding: '8px 12px 8px 32px', width: '100%', fontSize: 12, background: 'var(--color-redwood-midnight)', color: 'var(--color-redwood-text-main)' }}
                    />
                </div>
            </div>

            <div style={panelStyle}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-redwood-text-muted)' }}>
                        <p style={{ marginBottom: 12 }}>No quotations yet.</p>
                        <button type="button" onClick={() => navigate('/sales/quotations/new')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#4F8EF7', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                            Create first quotation
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filtered.map((row) => (
                            <div
                                key={row.id}
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '12px 14px',
                                    borderRadius: 10,
                                    border: '1px solid var(--color-redwood-border)',
                                    background: 'var(--color-redwood-midnight)',
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 180 }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-redwood-text-main)', fontSize: 14 }}>{row.quote_number}</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)', marginTop: 2 }}>
                                        {customerName(row.customer_id)} · {formatDateOnly(row.date)}
                                        {row.expiry_date ? ` · Expires ${formatDateOnly(row.expiry_date)}` : ''}
                                        {' · Salesman: '}
                                        {quotationSalesman(row)}
                                    </div>
                                </div>
                                <span style={statusBadge(row.status)}>{row.status}</span>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-redwood-text-main)', minWidth: 90, textAlign: 'right' }}>
                                    ${formatMoney(row.total)}
                                </div>
                                <QuotationStatusActions quote={row} onUpdated={() => load(true)} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
