import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, FileText } from 'lucide-react';
import { getCustomers, getProducts, type Customer, type Product } from '../../services/api';
import SearchableSelect from '../../components/common/SearchableSelect';
import InvoiceLineRow, { type InvoiceLineItem } from './InvoiceLineRow';
import { getSalesmen, type SalesmanPickerOption } from '../../services/employeeService';
import { authFetch } from '../../api/axios';
import { getOilErpApiBase } from '../../config/apiBase';
import { formatDateOnly } from '../../utils/formatters';
import {
    getQuotation,
    type Quotation,
    type QuotationStatus,
} from '../../services/quotationService';
import QuotationStatusActions from './QuotationStatusActions';

const QUOTATIONS_API = `${getOilErpApiBase()}/quotations`;

function resolveSalesmanEmployeeIdFromQuote(
    raw: Record<string, unknown> | null | undefined,
    salesmen: SalesmanPickerOption[],
): string {
    const fk = raw?.salesman_employee_id ?? raw?.salesmanEmployeeId;
    if (fk != null && String(fk).trim() !== '') return String(fk);
    const legacyName = raw?.salesman_name != null ? String(raw.salesman_name).trim() : '';
    if (!legacyName) return '';
    const norm = legacyName.toLowerCase();
    const matches = salesmen.filter((s) => s.name.trim().toLowerCase() === norm);
    return matches.length === 1 ? matches[0].id : '';
}

function mapQuotationItemsForApi(items: InvoiceLineItem[]) {
    return items.map((item) => {
        const rawPid = item.productId;
        const product_id =
            rawPid != null && String(rawPid).trim() !== '' && Number(rawPid) > 0
                ? Number(rawPid)
                : undefined;
        return {
            ...(product_id !== undefined ? { product_id } : {}),
            product_name: item.product,
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.rate) || 0,
            total: Number(item.amount) || 0,
            ...(item.description ? { description: item.description } : {}),
        };
    });
}

const panelStyle: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '14px',
    padding: '16px',
};

const inputStyle: CSSProperties = {
    border: '0.5px solid var(--color-redwood-border)',
    background: 'var(--color-redwood-midnight)',
    color: 'var(--color-redwood-text-main)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: 600,
    width: '100%',
};

const labelStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--color-redwood-text-muted)',
    marginBottom: 6,
    display: 'block',
};

/** Same Tailwind classes as InvoiceFormPage date inputs (clickable calendar). */
const DATE_INPUT_CLASS =
    'w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-[#4F8EF7] focus:outline-none transition-all';

function newLine(): InvoiceLineItem {
    return {
        id: `L-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: '',
        product: '',
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
    };
}

function fromQuoteItems(items: Array<Record<string, unknown>>): InvoiceLineItem[] {
    return items.map((it, idx) => {
        const q = Number(it.quantity ?? it.qty ?? 0);
        const r = Number(it.unit_price ?? it.rate ?? 0);
        return {
            id: `L-${idx}`,
            productId: String(it.product_id ?? ''),
            product: String(it.product_name ?? it.product ?? ''),
            description: String(it.description ?? ''),
            quantity: q,
            rate: r,
            amount: Number(it.total ?? it.amount ?? q * r),
        };
    });
}

export default function QuotationFormPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id && id !== 'new');

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [salesmen, setSalesmen] = useState<SalesmanPickerOption[]>([]);
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);

    const [customerId, setCustomerId] = useState('');
    const [salesmanEmployeeId, setSalesmanEmployeeId] = useState('');
    const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
    const [expiryDate, setExpiryDate] = useState('');
    const [status, setStatus] = useState<QuotationStatus>('draft');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState<InvoiceLineItem[]>([newLine()]);
    const [taxRate, setTaxRate] = useState(0);
    const [quoteMeta, setQuoteMeta] = useState<Pick<
        Quotation,
        'id' | 'quote_number' | 'status' | 'converted_sales_order_id' | 'converted_invoice_id'
    > | null>(null);

    const applyQuote = useCallback((q: Quotation, raw: Record<string, unknown> | undefined, sm: SalesmanPickerOption[]) => {
        setQuoteMeta({
            id: q.id,
            quote_number: q.quote_number,
            status: q.status,
            converted_sales_order_id: q.converted_sales_order_id,
            converted_invoice_id: q.converted_invoice_id,
        });
        setCustomerId(String(q.customer_id));
        setQuoteDate(q.date.slice(0, 10));
        setExpiryDate(q.expiry_date?.slice(0, 10) ?? '');
        setStatus(q.status);
        setNotes(q.notes ?? '');
        setSalesmanEmployeeId(resolveSalesmanEmployeeIdFromQuote(raw, sm));
        setLines(q.items.length ? fromQuoteItems(q.items as unknown as Array<Record<string, unknown>>) : [newLine()]);
        const sub = q.subtotal || 0;
        setTaxRate(sub > 0 ? (q.tax / sub) * 100 : 0);
    }, []);

    const reloadQuote = useCallback(async () => {
        if (!isEdit || !id) return;
        const [q, rawRes, sm] = await Promise.all([
            getQuotation(id),
            authFetch(`${QUOTATIONS_API}/${encodeURIComponent(String(id))}`),
            getSalesmen().catch(() => [] as SalesmanPickerOption[]),
        ]);
        const raw = rawRes.ok ? ((await rawRes.json()) as Record<string, unknown>) : undefined;
        setSalesmen(sm);
        applyQuote(q, raw, sm);
    }, [applyQuote, id, isEdit]);

    useEffect(() => {
        void (async () => {
            try {
                const [cust, prods, sm] = await Promise.all([
                    getCustomers(),
                    getProducts(),
                    getSalesmen().catch(() => [] as SalesmanPickerOption[]),
                ]);
                setCustomers(cust);
                setProducts(prods);
                setSalesmen(sm);
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    useEffect(() => {
        if (!isEdit || !id) return;
        void (async () => {
            setLoading(true);
            try {
                const [q, rawRes, sm] = await Promise.all([
                    getQuotation(id),
                    authFetch(`${QUOTATIONS_API}/${encodeURIComponent(String(id))}`),
                    getSalesmen().catch(() => [] as SalesmanPickerOption[]),
                ]);
                const raw = rawRes.ok ? ((await rawRes.json()) as Record<string, unknown>) : undefined;
                setSalesmen(sm);
                applyQuote(q, raw, sm);
            } finally {
                setLoading(false);
            }
        })();
    }, [id, isEdit, applyQuote]);

    const readOnly = isEdit && (status === 'converted' || status === 'expired');

    const subtotal = useMemo(
        () => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        [lines],
    );
    const taxAmount = useMemo(() => (subtotal * taxRate) / 100, [subtotal, taxRate]);
    const grandTotal = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

    const onLineChange = useCallback((lineId: string, field: keyof InvoiceLineItem, value: string | number) => {
        setLines((prev) =>
            prev.map((l) => {
                if (l.id !== lineId) return l;
                const next = { ...l, [field]: value };
                if (field === 'quantity' || field === 'rate') {
                    next.amount = (Number(next.quantity) || 0) * (Number(next.rate) || 0);
                }
                return next;
            }),
        );
    }, []);

    const onProductSelect = useCallback((lineId: string, productId: string) => {
        const prod = products.find((p) => String(p.id) === String(productId));
        setLines((prev) =>
            prev.map((l) => {
                if (l.id !== lineId) return l;
                const rate = Number(prod?.unit_price ?? 0);
                return {
                    ...l,
                    productId,
                    product: prod?.name ?? '',
                    rate,
                    amount: (Number(l.quantity) || 0) * rate,
                };
            }),
        );
    }, [products]);

    const handleSave = async () => {
        if (!customerId) {
            alert('Select a customer');
            return;
        }
        if (!lines.some((l) => l.product && Number(l.quantity) > 0)) {
            alert('Add at least one line item');
            return;
        }
        setSaving(true);
        try {
            const body: Record<string, unknown> = {
                customerId: Number(customerId),
                date: quoteDate,
                expiryDate: expiryDate || undefined,
                items: mapQuotationItemsForApi(lines),
                subtotal,
                tax: taxAmount,
                total: grandTotal,
                discount: 0,
                notes,
                ...(isEdit ? {} : { status }),
            };
            if (salesmanEmployeeId) {
                body.salesmanEmployeeId = Number(salesmanEmployeeId);
            }

            const url = isEdit && id
                ? `${QUOTATIONS_API}/${encodeURIComponent(String(id))}`
                : `${QUOTATIONS_API}/`;
            const method = isEdit && id ? 'PATCH' : 'POST';
            const r = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!r.ok) {
                const detail = await r.text();
                throw new Error(detail || `Save failed (${r.status})`);
            }
            navigate('/sales/quotations');
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div style={{ padding: 40, color: 'var(--color-redwood-text-muted)' }}>Loading quotation…</div>;
    }

    return (
        <div style={{ paddingBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button type="button" onClick={() => navigate('/sales/quotations')} style={{ background: 'none', border: 'none', color: 'var(--color-redwood-text-muted)', cursor: 'pointer' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <FileText size={22} style={{ color: '#4F8EF7' }} />
                    <div>
                        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 600, color: 'var(--color-brand-blue)', margin: 0 }}>
                            {isEdit ? (quoteMeta?.quote_number ?? 'Edit Quotation') : 'New Quotation'}
                        </h1>
                        {isEdit && quoteDate && (
                            <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', margin: '4px 0 0' }}>
                                Quote date {formatDateOnly(quoteDate)}
                                {expiryDate ? ` · Expires ${formatDateOnly(expiryDate)}` : ''}
                                {status ? ` · ${status}` : ''}
                            </p>
                        )}
                    </div>
                </div>
                {isEdit && quoteMeta && (
                    <QuotationStatusActions
                        quote={quoteMeta}
                        showEdit={false}
                        onUpdated={reloadQuote}
                    />
                )}
            </div>

            <div style={panelStyle} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <span style={labelStyle}>Customer *</span>
                        <SearchableSelect
                            options={customers.map((c) => ({ id: String(c.id), name: c.name, code: c.code ?? '' }))}
                            value={customerId}
                            onChange={setCustomerId}
                            placeholder="Select customer…"
                            displayKey="name"
                            theme="dark"
                        />
                    </div>
                    <div>
                        <span style={labelStyle}>Salesman <span style={{ fontWeight: 500, textTransform: 'none' }}>(optional)</span></span>
                        {salesmen.length === 0 ? (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                                No salesmen — add one in the Employee Portal (set employee role to salesman).
                            </p>
                        ) : (
                            <SearchableSelect
                                options={salesmen}
                                value={salesmanEmployeeId}
                                onChange={setSalesmanEmployeeId}
                                placeholder="Search and select salesman..."
                                displayKey="name"
                                theme="dark"
                            />
                        )}
                    </div>
                    <div>
                        <span style={labelStyle}>Status</span>
                        {!isEdit ? (
                            <select value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)} style={inputStyle}>
                                <option value="draft">Draft</option>
                                <option value="sent">Sent</option>
                                <option value="accepted">Accepted</option>
                            </select>
                        ) : (
                            <div style={{ ...inputStyle, opacity: 0.85, textTransform: 'capitalize' }}>{status}</div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">
                            Quote date
                        </label>
                        <input
                            type="date"
                            value={quoteDate}
                            onChange={(e) => setQuoteDate(e.target.value)}
                            className={DATE_INPUT_CLASS}
                        />
                        {quoteDate && (
                            <p className="text-xs text-gray-500 mt-1">{formatDateOnly(quoteDate)}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">
                            Expiry date
                        </label>
                        <input
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            className={DATE_INPUT_CLASS}
                        />
                        {expiryDate && (
                            <p className="text-xs text-gray-500 mt-1">{formatDateOnly(expiryDate)}</p>
                        )}
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={labelStyle}>Line items</span>
                        <button type="button" onClick={() => setLines((p) => [...p, newLine()])} style={{ fontSize: 11, fontWeight: 700, color: '#4F8EF7', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Plus size={14} /> Add line
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--color-redwood-border)' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background: 'var(--color-redwood-midnight)', color: 'var(--color-redwood-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                                    <th className="px-3 py-2 text-left">Product</th>
                                    <th className="px-3 py-2 text-left">Description</th>
                                    <th className="px-3 py-2 text-right">Qty</th>
                                    <th className="px-3 py-2 text-right">Rate</th>
                                    <th className="px-3 py-2 text-right">Amount</th>
                                    <th className="px-3 py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line) => (
                                    <InvoiceLineRow
                                        key={line.id}
                                        item={line}
                                        products={products}
                                        onProductSelect={onProductSelect}
                                        onLineItemChange={onLineChange}
                                        onRemove={(lid) => setLines((p) => (p.length <= 1 ? p : p.filter((x) => x.id !== lid)))}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <span style={labelStyle}>Subtotal</span>
                        <div style={{ ...inputStyle, opacity: 0.85 }}>${subtotal.toFixed(2)}</div>
                    </div>
                    <div>
                        <span style={labelStyle}>Tax %</span>
                        <input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                        <span style={labelStyle}>Tax amount</span>
                        <div style={{ ...inputStyle, opacity: 0.85 }}>${taxAmount.toFixed(2)}</div>
                    </div>
                    <div>
                        <span style={labelStyle}>Total</span>
                        <div style={{ ...inputStyle, fontWeight: 800, color: 'var(--color-brand-green-tint)' }}>${grandTotal.toFixed(2)}</div>
                    </div>
                </div>

                <div>
                    <span style={labelStyle}>Notes</span>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" onClick={() => navigate('/sales/quotations')} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--color-redwood-border)', background: 'transparent', color: 'var(--color-redwood-text-muted)', fontWeight: 700, fontSize: 12 }}>
                        Cancel
                    </button>
                    <button type="button" onClick={() => void handleSave()} disabled={saving || readOnly} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#4F8EF7', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: saving || readOnly ? 0.6 : 1 }}>
                        <Save size={14} /> {saving ? 'Saving…' : 'Save quotation'}
                    </button>
                </div>
            </div>
        </div>
    );
}
