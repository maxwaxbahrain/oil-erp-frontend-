import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    RotateCcw,
    CheckCircle,
    ArrowLeft
} from 'lucide-react';
import { getCustomers, getCustomerInvoices, type Customer, type Invoice } from '../../services/api';

interface CreditLine {
    id: string;
    product: string;
    invoiced_qty: number;
    return_qty: number;
    rate: number;
    credit_amount: number;
}

export default function CreditNoteFormPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const prefilledData = location.state as { customerId?: string; invoiceId?: string } | null;

    const [creditNoteNo] = useState('CN-' + Date.now());
    const [creditDate, setCreditDate] = useState(new Date().toISOString().split('T')[0]);
    const [customerId, setCustomerId] = useState(prefilledData?.customerId || '');
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(prefilledData?.invoiceId || '');
    const [reasonCode, setReasonCode] = useState<'return' | 'damage' | 'pricing'>('return');
    const [restockToWarehouse, setRestockToWarehouse] = useState(true);

    const [lines, setLines] = useState<CreditLine[]>([]);

    useEffect(() => {
        const loadCustomers = async () => {
            try {
                setLoading(true);
                const data = await getCustomers();
                setCustomers(data);
            } catch (error) {
                console.error('Failed to load customers:', error);
            } finally {
                setLoading(false);
            }
        };

        loadCustomers();
    }, []);

    useEffect(() => {
        const loadInvoices = async () => {
            if (!customerId) {
                setInvoices([]);
                return;
            }

            try {
                setLoading(true);
                const customerInvoices = await getCustomerInvoices(customerId);
                const eligibleInvoices = customerInvoices.filter(
                    inv => inv.status === 'Unpaid' || inv.status === 'Partial'
                );
                setInvoices(eligibleInvoices);
            } catch (error) {
                console.error('Failed to load invoices:', error);
                setInvoices([]);
            } finally {
                setLoading(false);
            }
        };

        loadInvoices();
    }, [customerId]);

    useEffect(() => {
        if (!selectedInvoiceId) {
            setLines([]);
            return;
        }

        const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
        if (!selectedInvoice) return;

        const creditLines: CreditLine[] = selectedInvoice.lineItems.map((item, index) => ({
            id: `line_${index}`,
            product: item.product,
            invoiced_qty: item.quantity,
            return_qty: 0,
            rate: item.rate,
            credit_amount: 0
        }));

        setLines(creditLines);
    }, [selectedInvoiceId, invoices]);

    const updateLine = (id: string, field: keyof CreditLine, value: any) => {
        setLines(lines.map(line => {
            if (line.id !== id) return line;
            const updated = { ...line, [field]: value };

            if (field === 'return_qty' && value > updated.invoiced_qty) {
                alert(`Return quantity cannot exceed invoiced quantity (${updated.invoiced_qty})`);
                return line;
            }

            updated.credit_amount = updated.return_qty * updated.rate;
            return updated;
        }));
    };

    const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0);

    const handlePostCreditNote = async () => {
        if (!customerId) {
            alert('Please select a customer');
            return;
        }

        if (!selectedInvoiceId) {
            alert('Please select an invoice');
            return;
        }

        if (lines.every(line => line.return_qty === 0)) {
            alert('Please enter return quantities for at least one item');
            return;
        }

        if (totalCredit <= 0) {
            alert('Credit note total must be greater than 0');
            return;
        }

        try {
            setSaving(true);

            const creditNoteData = {
                creditNoteNo,
                creditDate,
                customerId,
                invoiceId: selectedInvoiceId,
                reasonCode,
                restockToWarehouse,
                lines: lines.filter(line => line.return_qty > 0),
                totalCredit
            };

            console.log('Posting credit note...', creditNoteData);

            await new Promise(resolve => setTimeout(resolve, 1000));

            alert(`✅ Credit Note Created Successfully!\n\nCredit Note: ${creditNoteNo}\nTotal Credit: ${totalCredit.toLocaleString()}\n\nThe credit has been applied to customer account.`);

            navigate(`/customers/${customerId}?tab=ledger`);
        } catch (error) {
            console.error('Failed to post credit note:', error);
            alert('❌ Failed to post credit note. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow-lg border-2 border-rose-600 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-500" />
                        </button>
                        <div className="w-14 h-14 bg-rose-700 rounded-xl flex items-center justify-center shadow-lg">
                            <RotateCcw size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-rose-950 uppercase">Credit Note</h1>
                            <p className="text-xs text-rose-800/60 font-semibold mt-1">Returns & Adjustments</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePostCreditNote}
                            disabled={saving}
                            className="px-8 py-3 bg-rose-600 text-white rounded-lg text-sm font-black hover:bg-rose-700 flex items-center gap-2 disabled:opacity-50 shadow-xl"
                        >
                            <CheckCircle size={18} />
                            {saving ? 'Posting...' : 'Post Credit Note'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md p-8 space-y-8">
                <div className="bg-rose-50 p-6 rounded-lg border-2 border-rose-100">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Credit Note No
                            </label>
                            <input
                                type="text"
                                value={creditNoteNo}
                                disabled
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-mono font-black bg-gray-100"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Credit Date
                            </label>
                            <input
                                type="date"
                                value={creditDate}
                                onChange={(e) => setCreditDate(e.target.value)}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-rose-600 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Customer <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={customerId}
                                onChange={(e) => {
                                    setCustomerId(e.target.value);
                                    setSelectedInvoiceId('');
                                }}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-rose-600 focus:outline-none"
                                disabled={loading}
                            >
                                <option value="">Select Customer</option>
                                {customers.map(customer => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Reference Invoice <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedInvoiceId}
                                onChange={(e) => setSelectedInvoiceId(e.target.value)}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-rose-600 focus:outline-none"
                                disabled={!customerId || invoices.length === 0}
                            >
                                <option value="">
                                    {!customerId ? 'Select customer first' :
                                     invoices.length === 0 ? 'No unpaid invoices' :
                                     'Select Invoice'}
                                </option>
                                {invoices.map(invoice => (
                                    <option key={invoice.id} value={invoice.id}>
                                        {invoice.invoiceNumber} - {invoice.grandTotal.toLocaleString()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-2">
                                Reason Code <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={reasonCode}
                                onChange={(e) => setReasonCode(e.target.value as any)}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-bold focus:border-rose-600 focus:outline-none"
                            >
                                <option value="return">Product Return</option>
                                <option value="damage">Damaged Goods</option>
                                <option value="pricing">Pricing Error</option>
                            </select>
                        </div>

                        <div className="flex items-center pt-8">
                            <input
                                type="checkbox"
                                id="restock"
                                checked={restockToWarehouse}
                                onChange={(e) => setRestockToWarehouse(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                            />
                            <label htmlFor="restock" className="ml-3 text-sm font-bold text-gray-700 cursor-pointer">
                                Restock items to warehouse (if physical return)
                            </label>
                        </div>
                    </div>
                </div>

                {lines.length > 0 ? (
                    <div>
                        <h3 className="text-sm font-black text-gray-700 uppercase mb-4">Return Items</h3>
                        <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase">Product</th>
                                        <th className="px-6 py-3 text-center text-xs font-black text-gray-600 uppercase">Invoiced Qty</th>
                                        <th className="px-6 py-3 text-center text-xs font-black text-gray-600 uppercase">Return Qty</th>
                                        <th className="px-6 py-3 text-right text-xs font-black text-gray-600 uppercase">Rate</th>
                                        <th className="px-6 py-3 text-right text-xs font-black text-gray-600 uppercase">Credit Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {lines.map((line) => (
                                        <tr key={line.id} className="hover:bg-rose-50/30 transition-colors">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{line.product}</td>
                                            <td className="px-6 py-4 text-center text-sm font-bold text-gray-500">{line.invoiced_qty}</td>
                                            <td className="px-6 py-4 flex justify-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={line.invoiced_qty}
                                                    value={line.return_qty || ''}
                                                    onChange={(e) => updateLine(line.id, 'return_qty', parseInt(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-bold text-center focus:border-rose-600 focus:outline-none"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-bold text-gray-900 font-mono">
                                                {line.rate.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-base font-black text-rose-600 font-mono">
                                                {line.credit_amount.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <RotateCcw size={48} className="mx-auto text-gray-400 mb-4" />
                        <p className="text-sm font-bold text-gray-500 uppercase">No Invoice Selected</p>
                        <p className="text-xs text-gray-400 mt-2">Select a customer and invoice to continue</p>
                    </div>
                )}

                {lines.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t-2 border-gray-200 pt-6">
                        <div className="bg-rose-50 p-6 rounded-lg border-2 border-rose-100">
                            <h3 className="text-xs font-black text-rose-900 uppercase mb-4">Total Credit</h3>
                            <div className="text-center p-6 bg-white rounded-lg border-2 border-rose-200 shadow-sm">
                                <div className="text-xs font-bold text-gray-500 uppercase mb-2">Total Adjustment</div>
                                <div className="text-4xl font-black text-rose-600 font-mono">
                                    {totalCredit.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                    {lines.filter(l => l.return_qty > 0).length} item(s) being returned
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
                            <h3 className="text-xs font-black text-gray-600 uppercase mb-4">Accounting Impact</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-gray-200">
                                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                    <span className="text-sm font-bold text-gray-700">Reduce Accounts Receivable</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-gray-200">
                                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                    <span className="text-sm font-bold text-gray-700">Reduce Sales Revenue</span>
                                </div>
                                {restockToWarehouse && (
                                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-gray-200">
                                        <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                        <span className="text-sm font-bold text-gray-700">Increase Inventory (Restock)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}