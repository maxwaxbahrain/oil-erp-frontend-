/**
 * Van Sales Form Page
 * Main form for recording van sales
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, User, Calendar, FileText, ArrowLeft, Save, Loader } from 'lucide-react';
import { getCustomers, type Customer } from '../../services/api';
import { vanService, type Van } from '../../services/vanService';
import { vanSalesService } from '../../services/vanSalesService';
import type { VanSaleItem, VanSaleFormData } from '../../types/vanSales';
import ProductSelector from '../../components/VanSales/ProductSelector';
import PaymentSection, { type PaymentMethodType } from '../../components/VanSales/PaymentSection';
import ReceiptPrint from '../../components/VanSales/ReceiptPrint';
import SearchableSelect from '../../components/common/SearchableSelect';

const DEFAULT_TAX_RATE = 0.05; // 5% tax

export default function VanSalesForm() {
    const navigate = useNavigate();

    // Form State
    const [vanId, setVanId] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [items, setItems] = useState<VanSaleItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
    const [amountReceived, setAmountReceived] = useState(0);
    const [notes, setNotes] = useState('');

    // Data State
    const [vans, setVans] = useState<Van[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedVan, setSelectedVan] = useState<Van | null>(null);

    // UI State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [completedSale, setCompletedSale] = useState<any>(null);

    // Calculations
    const [subtotal, setSubtotal] = useState(0);
    const [taxAmount, setTaxAmount] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);

    // Load initial data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [vansData, customersData] = await Promise.all([
                vanService.getAll(),
                getCustomers()
            ]);
            setVans(vansData);
            setCustomers(customersData);
        } catch (error) {
            console.error('Failed to load data:', error);
            alert('Failed to load data. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    // Update selected van when vanId changes
    useEffect(() => {
        const van = vans.find(v => v.id === vanId);
        setSelectedVan(van || null);
    }, [vanId, vans]);


    // Calculate totals when items change
    useEffect(() => {
        const calculated = vanSalesService.calculateTotals(items, DEFAULT_TAX_RATE);
        setSubtotal(calculated.subtotal);
        setTaxAmount(calculated.taxAmount);
        setTotalAmount(calculated.total);
    }, [items]);

    // Handle item operations
    const handleAddItem = (item: VanSaleItem) => {
        setItems([...items, item]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, updatedItem: VanSaleItem) => {
        const newItems = [...items];
        newItems[index] = updatedItem;
        setItems(newItems);
    };

    // Validation with ERP-grade payment rules
    const validateForm = (): string | null => {
        if (!vanId) return 'Please select a van';
        if (!customerId) return 'Please select a customer';
        if (items.length === 0) return 'Please add at least one product';

        // Payment method specific validation
        switch (paymentMethod) {
            case 'cash':
                if (amountReceived < totalAmount) {
                    return 'Cash payment requires full amount or more';
                }
                break;

            case 'card':
            case 'digital':
                if (amountReceived !== totalAmount) {
                    return 'Card/Digital payment must be exact amount (no change given)';
                }
                break;

            case 'credit_no_advance':
                if (amountReceived !== 0) {
                    return 'Full credit sales must have 0 amount received';
                }
                break;

            case 'credit_with_advance':
                if (amountReceived <= 0) {
                    return 'Advance payment must be greater than 0';
                }
                if (amountReceived >= totalAmount) {
                    return 'Advance must be less than total. Use full payment method instead';
                }
                break;

            case 'cash_credit_split':
                if (amountReceived < 0 || amountReceived > totalAmount) {
                    return 'Cash amount must be between 0 and total';
                }
                break;

            default:
                return 'Invalid payment method selected';
        }

        // Amount cannot be negative
        if (amountReceived < 0) {
            return 'Amount received cannot be negative';
        }

        return null;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        const validationError = validateForm();
        if (validationError) {
            alert(validationError);
            return;
        }

        setSaving(true);
        try {
            const formData: VanSaleFormData = {
                van_id: vanId,
                customer_id: customerId,
                items,
                payment_method: paymentMethod,
                amount_received: amountReceived,
                tax_rate: DEFAULT_TAX_RATE,
                notes: notes.trim() || undefined
            };

            const sale = await vanSalesService.create(formData);
            setCompletedSale(sale);
            setShowReceipt(true);

            // Show success message
            console.log('Sale completed:', sale);
        } catch (error) {
            console.error('Failed to create sale:', error);
            alert('Failed to create sale. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Handle receipt close
    const handleReceiptClose = () => {
        setShowReceipt(false);
        // Reset form or navigate
        if (window.confirm('Would you like to create another sale?')) {
            // Reset form
            setVanId('');
            setCustomerId('');
            setItems([]);
            setPaymentMethod('cash');
            setAmountReceived(0);
            setNotes('');
            setCompletedSale(null);
        } else {
            // Navigate to history
            navigate('/van-sales/history');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <Loader className="spinner" size={48} />
            </div>
        );
    }

    return (
        <div className="van-sales-form-page">
            {/* Header */}
            <div className="page-header" style={{
                marginBottom: '2rem',
                paddingBottom: '1rem',
                borderBottom: '2px solid #8b1538'
            }}>
                <button
                    onClick={() => navigate('/van-sales')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: 'transparent',
                        border: '1px solid #8b1538',
                        color: '#8b1538',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginBottom: '1rem',
                        fontSize: '0.9rem'
                    }}
                >
                    <ArrowLeft size={18} />
                    Back to Van Sales
                </button>
                <h1 style={{ fontSize: '2rem', color: '#8b1538', margin: 0 }}>
                    🚚 New Van Sale
                </h1>
                <p style={{ color: '#666', marginTop: '0.5rem' }}>
                    Record a direct sale from delivery van
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Sale Information Section */}
                <div className="form-section" style={{
                    backgroundColor: 'white',
                    padding: '2rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    marginBottom: '2rem'
                }}>
                    <div className="section-header" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '1.5rem',
                        paddingBottom: '1rem',
                        borderBottom: '2px solid #f0f0f0'
                    }}>
                        <FileText className="icon" color="#8b1538" />
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Sale Information</h3>
                    </div>

                    <div className="form-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {/* Van Selection */}
                        <div className="form-group">
                            <label htmlFor="van-select" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Van <span style={{ color: '#f44336' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Truck size={18} style={{
                                    position: 'absolute',
                                    left: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#666'
                                }} />
                                <select
                                    id="van-select"
                                    value={vanId}
                                    onChange={(e) => setVanId(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                        border: '2px solid #ddd',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                >
                                    <option value="">Select Van...</option>
                                    {vans.map(van => (
                                        <option key={van.id} value={van.id}>
                                            {van.van_number} {van.driver_name ? `- ${van.driver_name}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {selectedVan?.driver_name && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <User size={14} />
                                    Driver: {selectedVan.driver_name}
                                </div>
                            )}
                        </div>

                        {/* Customer Selection */}
                        <div className="form-group">
                            <label htmlFor="customer-select" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Customer <span style={{ color: '#f44336' }}>*</span>
                            </label>
                            <SearchableSelect
                                options={customers}
                                value={customerId}
                                onChange={setCustomerId}
                                placeholder="Search customer..."
                            />
                        </div>

                        {/* Sale Date (Auto-filled, read-only) */}
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Sale Date
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={18} style={{
                                    position: 'absolute',
                                    left: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#666'
                                }} />
                                <input
                                    type="text"
                                    value={new Date().toLocaleString()}
                                    readOnly
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                        border: '2px solid #ddd',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        backgroundColor: '#f9f9f9',
                                        color: '#666'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Products Section */}
                <div className="form-section" style={{
                    backgroundColor: 'white',
                    padding: '2rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    marginBottom: '2rem'
                }}>
                    <ProductSelector
                        items={items}
                        onAddItem={handleAddItem}
                        onRemoveItem={handleRemoveItem}
                        onUpdateItem={handleUpdateItem}
                    />
                </div>

                {/* Payment Section */}
                <div className="form-section" style={{
                    backgroundColor: 'white',
                    padding: '2rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    marginBottom: '2rem'
                }}>
                    <PaymentSection
                        subtotal={subtotal}
                        taxRate={DEFAULT_TAX_RATE}
                        taxAmount={taxAmount}
                        totalAmount={totalAmount}
                        paymentMethod={paymentMethod}
                        amountReceived={amountReceived}
                        onPaymentMethodChange={setPaymentMethod}
                        onAmountReceivedChange={setAmountReceived}
                    />
                </div>

                {/* Notes Section */}
                <div className="form-section" style={{
                    backgroundColor: 'white',
                    padding: '2rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    marginBottom: '2rem'
                }}>
                    <label htmlFor="notes" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                        Notes (Optional)
                    </label>
                    <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any additional notes about this sale..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #ddd',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontFamily: 'inherit',
                            resize: 'vertical'
                        }}
                    />
                </div>

                {/* Form Actions */}
                <div className="form-actions" style={{
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end',
                    paddingTop: '1rem'
                }}>
                    <button
                        type="button"
                        onClick={() => navigate('/van-sales')}
                        disabled={saving}
                        style={{
                            padding: '0.75rem 2rem',
                            backgroundColor: 'white',
                            border: '2px solid #ddd',
                            color: '#666',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 600
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || items.length === 0}
                        style={{
                            padding: '0.75rem 2rem',
                            backgroundColor: saving ? '#ccc' : '#8b1538',
                            border: 'none',
                            color: 'white',
                            borderRadius: '8px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {saving ? (
                            <>
                                <Loader className="spinner" size={18} />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Complete Sale
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Receipt Modal */}
            {showReceipt && completedSale && (
                <ReceiptPrint
                    sale={completedSale}
                    onClose={handleReceiptClose}
                />
            )}

            <style>{`
        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
        </div>
    );
}
