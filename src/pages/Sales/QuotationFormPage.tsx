import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, FileText, UserPlus, X } from 'lucide-react';
import { getCustomers, getProducts, type Customer, type Product } from '../../services/api';
import SearchableSelect from '../../components/common/SearchableSelect';
import InvoiceLineRow, { type InvoiceLineItem } from './InvoiceLineRow';
import { getSalesmen, addSalesman, type Salesman } from '../../constants/data';
import { formatDateOnly } from '../../utils/formatters';
import {
    createQuotation,
    getQuotation,
    updateQuotation,
    type QuotationStatus,
} from '../../services/quotationService';

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

function toQuoteItems(lines: InvoiceLineItem[]) {
    return lines.map((l) => ({
        product_id: l.productId || '',
        product_name: l.product,
        quantity: Number(l.quantity) || 0,
        unit_price: Number(l.rate) || 0,
        total: Number(l.amount) || 0,
        description: l.description || '',
    }));
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
    const [salesmen, setSalesmen] = useState<Salesman[]>(() => getSalesmen());
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);

    const [customerId, setCustomerId] = useState('');
    const [salesmanId, setSalesmanId] = useState('');
    const [showNewSalesman, setShowNewSalesman] = useState(false);
    const [newSalesmanName, setNewSalesmanName] = useState('');
    const [newSalesmanPhone, setNewSalesmanPhone] = useState('');
    const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
    const [expiryDate, setExpiryDate] = useState('');
    const [status, setStatus] = useState<QuotationStatus>('draft');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState<InvoiceLineItem[]>([newLine()]);
    const [taxRate, setTaxRate] = useState(0);

    useEffect(() => {
        void (async () => {
            try {
                const [cust, prods] = await Promise.all([getCustomers(), getProducts()]);
                setCustomers(cust);
                setProducts(prods);
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
                const q = await getQuotation(id);
                setCustomerId(String(q.customer_id));
                setQuoteDate(q.date.slice(0, 10));
                setExpiryDate(q.expiry_date?.slice(0, 10) ?? '');
                setStatus(q.status);
                setNotes(q.notes ?? '');
                if (q.salesman_id) {
                    setSalesmanId(q.salesman_id);
                } else if (q.salesman_name) {
                    const match = getSalesmen().find((s) => s.name === q.salesman_name);
                    if (match) setSalesmanId(match.id);
                }
                setLines(q.items.length ? fromQuoteItems(q.items as unknown as Array<Record<string, unknown>>) : [newLine()]);
                const sub = q.subtotal || 0;
                setTaxRate(sub > 0 ? (q.tax / sub) * 100 : 0);
            } finally {
                setLoading(false);
            }
        })();
    }, [id, isEdit]);

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
        if (!salesmanId) {
            alert('Select a salesman');
            return;
        }
        if (!lines.some((l) => l.product && Number(l.quantity) > 0)) {
            alert('Add at least one line item');
            return;
        }
        const salesmanName = salesmen.find((s) => s.id === salesmanId)?.name;
        if (!salesmanName) {
            alert('Select a valid salesman');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                customer_id: Number(customerId),
                date: quoteDate,
                expiry_date: expiryDate || null,
                items: toQuoteItems(lines),
                subtotal,
                tax: taxAmount,
                total: grandTotal,
                discount: 0,
                notes,
                status,
                salesman_id: salesmanId,
                salesman_name: salesmanName,
            };
            if (isEdit && id) {
                await updateQuotation(id, payload);
            } else {
                await createQuotation(payload);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button type="button" onClick={() => navigate('/sales/quotations')} style={{ background: 'none', border: 'none', color: 'var(--color-redwood-text-muted)', cursor: 'pointer' }}>
                    <ArrowLeft size={20} />
                </button>
                <FileText size={22} style={{ color: '#4F8EF7' }} />
                <div>
                    <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 600, color: 'var(--color-brand-blue)', margin: 0 }}>
                        {isEdit ? 'Edit Quotation' : 'New Quotation'}
                    </h1>
                    {isEdit && quoteDate && (
                        <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)', margin: '4px 0 0' }}>
                            Quote date {formatDateOnly(quoteDate)}
                            {expiryDate ? ` · Expires ${formatDateOnly(expiryDate)}` : ''}
                        </p>
                    )}
                </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ ...labelStyle, marginBottom: 0 }}>Salesman *</span>
                            <button
                                type="button"
                                onClick={() => setShowNewSalesman(true)}
                                className="flex items-center gap-1 text-xs font-black text-orange-600 hover:text-orange-800 transition-all"
                            >
                                <UserPlus size={12} /> New Salesman
                            </button>
                        </div>
                        <SearchableSelect
                            options={salesmen}
                            value={salesmanId}
                            onChange={setSalesmanId}
                            placeholder="Search and select salesman..."
                            displayKey="name"
                            theme="dark"
                        />
                        {showNewSalesman && (
                            <div
                                className="mt-2 p-3 rounded-xl space-y-2"
                                style={{
                                    background: 'var(--color-redwood-bg-surface, #0f1f33)',
                                    border: '0.5px solid var(--color-redwood-border, rgba(255,255,255,0.12))',
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-black uppercase" style={{ color: 'var(--color-redwood-text-main, #EEF2FF)' }}>
                                        New Salesman
                                    </p>
                                    <button type="button" onClick={() => setShowNewSalesman(false)} className="text-gray-400 hover:text-gray-600">
                                        <X size={14} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Salesman Name *"
                                    value={newSalesmanName}
                                    onChange={(e) => setNewSalesmanName(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                                />
                                <input
                                    type="text"
                                    placeholder="Phone (optional)"
                                    value={newSalesmanPhone}
                                    onChange={(e) => setNewSalesmanPhone(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!newSalesmanName.trim()) return;
                                        try {
                                            const created = addSalesman({ name: newSalesmanName, phone: newSalesmanPhone });
                                            setSalesmen((prev) => [...prev, created]);
                                            setSalesmanId(created.id);
                                            setShowNewSalesman(false);
                                            setNewSalesmanName('');
                                            setNewSalesmanPhone('');
                                        } catch {
                                            alert('Failed to create salesman.');
                                        }
                                    }}
                                    disabled={!newSalesmanName.trim()}
                                    className="w-full py-2 bg-orange-500 text-white text-xs font-black rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-all"
                                >
                                    Create &amp; Select Salesman
                                </button>
                            </div>
                        )}
                    </div>
                    <div>
                        <span style={labelStyle}>Status</span>
                        <select value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)} style={inputStyle} disabled={status === 'converted' || status === 'expired'}>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="accepted">Accepted</option>
                        </select>
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
                    <button type="button" onClick={() => void handleSave()} disabled={saving || status === 'converted'} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#4F8EF7', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                        <Save size={14} /> {saving ? 'Saving…' : 'Save quotation'}
                    </button>
                </div>
            </div>
        </div>
    );
}
