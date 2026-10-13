import { useState, useEffect } from 'react';
import { Save, X, Info } from 'lucide-react';
import { createCustomer, updateCustomer, type Customer } from '../../services/customerService';
import { localIsoDate } from '../../utils/localDate';

interface CustomerFormProps {
  editingCustomer: Customer | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function CustomerForm({ editingCustomer, onSave, onCancel }: CustomerFormProps) {
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    category: 'retail',
    credit_limit: undefined,
    opening_balance: undefined,
    gps_location: '',
    notes: '',
  });
  const [openingSide, setOpeningSide] = useState<'debit' | 'credit'>('debit');
  const [openingAsOf, setOpeningAsOf] = useState(localIsoDate);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCustomer) {
      setFormData(editingCustomer);
    }
  }, [editingCustomer]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'credit_limit' || name === 'opening_balance')
        ? (value === '' ? undefined : parseFloat(value))
        : value
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!formData.name) {
      setError('Customer Name is required');
      return;
    }

    try {
      setSaving(true);
      const typedOpening = Number(formData.opening_balance);
      if (!editingCustomer && Number.isFinite(typedOpening) && typedOpening < 0) {
        setError('Opening balance amount must be greater than zero. Choose Credit if the customer is in credit.');
        setSaving(false);
        return;
      }
      const openingAmount = Number.isFinite(typedOpening) ? Math.abs(typedOpening) : 0;
      const payload: Partial<Customer> = {
        ...formData,
        credit_limit: formData.credit_limit || 0,
      };

      if (editingCustomer && editingCustomer.id) {
        delete payload.opening_balance;
        delete payload.opening_side;
        delete payload.opening_as_of;
        await updateCustomer(editingCustomer.id, payload);
      } else {
        payload.opening_balance = openingAmount;
        payload.opening_side = openingSide;
        payload.opening_as_of = openingAmount > 0 ? openingAsOf : undefined;
        await createCustomer(payload);
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save customer data');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300 max-w-2xl mx-auto">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          {editingCustomer ? 'Edit Customer' : 'New Customer'}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm font-medium rounded-md flex items-center gap-2">
            <Info size={16} /> {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="123 Main St, City, State ZIP"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
            <select
              name="category"
              value={formData.category || 'retail'}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
            >
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="partner">Partner</option>
              <option value="other">Other</option>
            </select>
          </div>
          {/* Hidden GPS if not needed, or simplified */}
          <div className="hidden">
            <input name="gps_location" value={formData.gps_location} onChange={handleChange} />
          </div>
        </div>

        {/* Financials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Credit Limit</label>
            <input
              type="number"
              name="credit_limit"
              value={formData.credit_limit === undefined ? '' : formData.credit_limit}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Amount"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Opening Balance</label>
            {editingCustomer ? (
              <div className="space-y-2">
                <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700">
                  {Math.abs(Number(editingCustomer.opening_balance) || 0) <= 0.005
                    ? 'None'
                    : `${(Number(editingCustomer.opening_balance) || 0) < 0 ? 'Cr' : 'Dr'} ${Math.abs(Number(editingCustomer.opening_balance) || 0).toFixed(2)}`}
                </div>
                <p className="text-xs text-gray-500">
                  Opening balance cannot be edited. To correct it, reverse the opening journal, then post a journal voucher.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setOpeningSide('debit')}
                    className={`flex-1 px-3 py-2 ${openingSide === 'debit' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                  >
                    Dr — customer owes us
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpeningSide('credit')}
                    className={`flex-1 px-3 py-2 ${openingSide === 'credit' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                  >
                    Cr — customer is in credit
                  </button>
                </div>
                <input
                  type="number"
                  name="opening_balance"
                  min="0"
                  step="0.01"
                  value={formData.opening_balance === undefined ? '' : formData.opening_balance}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Amount"
                />
                <label className="block text-xs font-semibold text-gray-600">As of</label>
                <input
                  type="date"
                  value={openingAsOf}
                  onChange={(e) => setOpeningAsOf(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
          <textarea
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
            placeholder="Add any notes here..."
          />
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? 'Saving...' : (
              <>
                <Save size={16} />
                Save Customer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

