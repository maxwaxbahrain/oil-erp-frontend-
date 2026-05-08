import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, FileText, Check, AlertCircle } from 'lucide-react';
import {
  type Customer,
  createPayment,
  getUnpaidInvoices,
  updateInvoicePayment,
  getCustomerAdvanceBalance,
  type Invoice
} from '../../services/api';
import SearchableSelect from '../../components/common/SearchableSelect';

interface PaymentReceiptProps {
  customer: Customer;
  onBack: () => void;
}

export default function PaymentReceipt({ customer, onBack }: PaymentReceiptProps) {
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Invoice linking
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInvoices();
    loadAdvanceBalance();
  }, [customer.id]);

  useEffect(() => {
    if (selectedInvoiceId) {
      const invoice = unpaidInvoices.find(inv => inv.id === selectedInvoiceId);
      setSelectedInvoice(invoice || null);
      if (invoice) {
        // Auto-fill amount with remaining balance
        setAmount(invoice.remaining_balance || invoice.grandTotal);
      }
    } else {
      setSelectedInvoice(null);
    }
  }, [selectedInvoiceId, unpaidInvoices]);

  async function loadInvoices() {
    try {
      const invoices = await getUnpaidInvoices(customer.id);
      setUnpaidInvoices(invoices);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    }
  }

  async function loadAdvanceBalance() {
    try {
      const balance = await getCustomerAdvanceBalance(customer.id);
      setAdvanceBalance(balance);
    } catch (error) {
      console.error('Failed to load advance balance:', error);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (!isAdvancePayment && !selectedInvoiceId) {
      alert('Please select an invoice or mark as advance payment');
      return;
    }

    // Validate payment doesn't exceed invoice balance
    if (!isAdvancePayment && selectedInvoice) {
      const invoiceBalance = selectedInvoice.remaining_balance || selectedInvoice.grandTotal;
      if (amount > invoiceBalance) {
        const proceed = confirm(
          `Payment amount (${amount}) exceeds invoice balance (${invoiceBalance}).\n\n` +
          `The excess amount will be recorded as advance payment.\n\nContinue?`
        );
        if (!proceed) return;
      }
    }

    try {
      setLoading(true);

      // Create payment record
      const paymentData = {
        customer_id: customer.id,
        amount,
        payment_method: paymentMethod,
        reference,
        notes,
        payment_date: paymentDate,
        invoice_id: isAdvancePayment ? undefined : selectedInvoiceId,
        is_advance: isAdvancePayment
      };

      await createPayment(paymentData);

      // Update invoice if linked
      if (!isAdvancePayment && selectedInvoiceId) {
        await updateInvoicePayment(selectedInvoiceId, amount);
      }

      setSuccess(true);
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (error) {
      console.error('Failed to record payment:', error);
      alert('Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const paymentMethods = ['Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'Debit Card', 'Mobile Payment'];

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={48} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Recorded!</h2>
          <p className="text-gray-600 font-medium">
            Payment of <span className="font-black text-green-600">${amount.toLocaleString()}</span> has been successfully recorded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - QuickBooks Style */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-[#45B854] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#45B854] rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Receive Payment</h1>
              <p className="text-sm text-gray-600 font-semibold mt-1">Record customer payment</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Customer Information</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer Name</label>
            <div className="text-lg font-black text-gray-900 mt-1">{customer.name}</div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer Code</label>
            <div className="text-lg font-mono font-black text-gray-700 mt-1">{customer.id}</div>
          </div>
          {advanceBalance > 0 && (
            <div className="col-span-2 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-700 uppercase">Available Advance Balance</span>
                <span className="text-2xl font-mono font-black text-blue-900">${advanceBalance.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-8 space-y-8">
        {/* Payment Type Toggle */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={isAdvancePayment}
              onChange={(e) => {
                setIsAdvancePayment(e.target.checked);
                if (e.target.checked) {
                  setSelectedInvoiceId('');
                  setAmount(0);
                }
              }}
              className="w-5 h-5 rounded border-2 border-gray-300 text-[#45B854] focus:ring-2 focus:ring-[#45B854] focus:ring-offset-2"
            />
            <div>
              <span className="text-sm font-black text-gray-900 group-hover:text-[#45B854] transition-colors">
                Advance Payment (No Invoice)
              </span>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Record payment without linking to a specific invoice
              </p>
            </div>
          </label>
        </div>

        {/* Invoice Selection */}
        {!isAdvancePayment && (
          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
              Select Invoice <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={unpaidInvoices.map(inv => ({
                id: inv.id,
                name: `${inv.invoiceNumber} - ${inv.customerName} - Due: $${(inv.remaining_balance || inv.grandTotal).toLocaleString()}`
              }))}
              value={selectedInvoiceId}
              onChange={setSelectedInvoiceId}
              placeholder="Search and select invoice..."
              displayKey="name"
            />

            {selectedInvoice && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-blue-600" />
                  <span className="text-xs font-black text-blue-900 uppercase">Invoice Details</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase block">Invoice Date</span>
                    <span className="font-black text-blue-900">{new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase block">Due Date</span>
                    <span className="font-black text-blue-900">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase block">Total Amount</span>
                    <span className="font-mono font-black text-blue-900">${selectedInvoice.grandTotal.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase block">Balance Due</span>
                    <span className="font-mono font-black text-red-600">${(selectedInvoice.remaining_balance || selectedInvoice.grandTotal).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
              Payment Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                className="w-full pl-4 pr-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-mono font-black focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none transition-all"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-bold focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none transition-all bg-white"
            >
              {paymentMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
              Reference / Cheque No.
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Enter reference number..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-3">
          <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">
            Notes / Memo
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any additional notes about this payment..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-[#45B854] focus:ring-4 focus:ring-[#45B854]/10 outline-none resize-none transition-all"
          />
        </div>

        {/* Validation Warning */}
        {!isAdvancePayment && selectedInvoice && amount > (selectedInvoice.remaining_balance || selectedInvoice.grandTotal) && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-900">Payment exceeds invoice balance</p>
              <p className="text-xs text-amber-700 font-medium mt-1">
                The excess amount of ${(amount - (selectedInvoice.remaining_balance || selectedInvoice.grandTotal)).toLocaleString()} will be recorded as advance payment.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-6 border-t-2 border-gray-200">
          <button
            type="button"
            onClick={onBack}
            className="px-8 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-12 py-3 bg-[#45B854] text-white rounded-lg text-sm font-black uppercase tracking-widest hover:bg-[#3A9D47] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3"
          >
            <CreditCard size={18} />
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
