/**
 * Payment Section Component - ERP Grade Payment Logic
 * Implements strict accounting rules for payment processing
 */

import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Smartphone, Clock, AlertCircle, TrendingUp, Percent } from 'lucide-react';

// Payment method types with strict accounting rules
export type PaymentMethodType =
    | 'cash'                    // Full cash payment
    | 'card'                    // Full card payment
    | 'digital'                 // Full digital payment
    | 'credit_no_advance'       // Full credit - no advance
    | 'credit_with_advance'     // Partial advance + credit
    | 'cash_credit_split';      // Cash + Credit split

interface PaymentSectionProps {
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: PaymentMethodType;
    amountReceived: number;
    onPaymentMethodChange: (method: PaymentMethodType) => void;
    onAmountReceivedChange: (amount: number) => void;
}

export default function PaymentSection({
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
    paymentMethod,
    amountReceived,
    onPaymentMethodChange,
    onAmountReceivedChange
}: PaymentSectionProps) {
    const [changeGiven, setChangeGiven] = useState(0);
    const [accountsReceivable, setAccountsReceivable] = useState(0);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [cashPercentage, setCashPercentage] = useState(100);

    // Payment method configurations
    const paymentMethods = [
        {
            value: 'cash',
            label: 'Cash (Full)',
            icon: DollarSign,
            color: '#4caf50',
            description: '100% cash payment'
        },
        {
            value: 'card',
            label: 'Card (Full)',
            icon: CreditCard,
            color: '#2196f3',
            description: '100% card payment'
        },
        {
            value: 'digital',
            label: 'Digital (Full)',
            icon: Smartphone,
            color: '#9c27b0',
            description: '100% digital payment'
        },
        {
            value: 'credit_no_advance',
            label: 'Credit (No Advance)',
            icon: Clock,
            color: '#ff9800',
            description: 'Full amount on credit'
        },
        {
            value: 'credit_with_advance',
            label: 'Credit (With Advance)',
            icon: TrendingUp,
            color: '#ff5722',
            description: 'Partial advance + credit'
        },
        {
            value: 'cash_credit_split',
            label: 'Cash + Credit',
            icon: Percent,
            color: '#795548',
            description: 'Split payment'
        }
    ];

    // Validation and calculation logic
    useEffect(() => {
        setValidationError(null);

        switch (paymentMethod) {
            case 'cash':
            case 'card':
            case 'digital':
                // Full payment methods
                if (amountReceived < totalAmount) {
                    setValidationError('Amount received must equal total for full payment methods');
                } else if (amountReceived > totalAmount) {
                    // Calculate change for cash
                    if (paymentMethod === 'cash') {
                        setChangeGiven(amountReceived - totalAmount);
                    } else {
                        setValidationError('Amount cannot exceed total for card/digital payments');
                    }
                }
                setAccountsReceivable(0);
                break;

            case 'credit_no_advance':
                // Must be exactly 0
                if (amountReceived !== 0) {
                    setValidationError('Amount received must be 0 for full credit sales');
                    // Auto-correct to 0
                    onAmountReceivedChange(0);
                }
                setAccountsReceivable(totalAmount);
                setChangeGiven(0);
                break;

            case 'credit_with_advance':
                // Advance must be > 0 and < total
                if (amountReceived === 0) {
                    setValidationError('Advance amount must be greater than 0');
                } else if (amountReceived >= totalAmount) {
                    setValidationError('Advance must be less than total. Use full payment method instead');
                } else if (amountReceived < 0) {
                    setValidationError('Advance cannot be negative');
                }
                setAccountsReceivable(totalAmount - amountReceived);
                setChangeGiven(0);
                break;

            case 'cash_credit_split':
                // Cash percentage based split
                const calculatedCash = (totalAmount * cashPercentage) / 100;
                if (amountReceived !== calculatedCash) {
                    onAmountReceivedChange(calculatedCash);
                }
                if (amountReceived < 0) {
                    setValidationError('Cash amount cannot be negative');
                } else if (amountReceived > totalAmount) {
                    setValidationError('Cash amount cannot exceed total');
                }
                setAccountsReceivable(totalAmount - amountReceived);
                setChangeGiven(0);
                break;

            default:
                break;
        }
    }, [amountReceived, totalAmount, paymentMethod, cashPercentage]);

    // Auto-set amount based on payment method
    useEffect(() => {
        switch (paymentMethod) {
            case 'cash':
            case 'card':
            case 'digital':
                // Auto-fill with exact amount
                if (amountReceived === 0) {
                    onAmountReceivedChange(totalAmount);
                }
                break;

            case 'credit_no_advance':
                // Lock to 0
                onAmountReceivedChange(0);
                break;

            case 'cash_credit_split':
                // Set based on percentage
                const calculatedAmount = (totalAmount * cashPercentage) / 100;
                onAmountReceivedChange(calculatedAmount);
                break;
        }
    }, [paymentMethod, totalAmount]);

    // Handle percentage change for split payment
    const handlePercentageChange = (percentage: number) => {
        setCashPercentage(Math.max(0, Math.min(100, percentage)));
        const calculatedAmount = (totalAmount * percentage) / 100;
        onAmountReceivedChange(calculatedAmount);
    };

    // Check if amount field should be disabled
    const isAmountDisabled = paymentMethod === 'credit_no_advance';

    // Check if amount field should be readonly (calculated)
    const isAmountReadonly = paymentMethod === 'cash_credit_split';

    return (
        <div className="payment-section">
            <div className="section-header" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1.5rem',
                paddingBottom: '1rem',
                borderBottom: '2px solid #f0f0f0'
            }}>
                <DollarSign className="icon" color="#8b1538" />
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Payment & Settlement</h3>
            </div>

            {/* Totals Summary */}
            <div className="totals-summary" style={{
                backgroundColor: '#f5f5f5',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '1.5rem'
            }}>
                <div className="total-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    fontSize: '1rem'
                }}>
                    <span>Subtotal:</span>
                    <span style={{ fontWeight: 500 }}>${subtotal.toFixed(2)}</span>
                </div>
                <div className="total-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    fontSize: '1rem',
                    borderBottom: '1px solid #ddd'
                }}>
                    <span>Tax ({(taxRate * 100).toFixed(1)}%):</span>
                    <span style={{ fontWeight: 500 }}>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="total-row grand-total" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#8b1538'
                }}>
                    <span>TOTAL:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                </div>
            </div>

            {/* Payment Method Selection */}
            <div className="payment-methods" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 500 }}>
                    Payment Method <span style={{ color: '#f44336' }}>*</span>
                </label>
                <div className="method-buttons" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '0.75rem'
                }}>
                    {paymentMethods.map(method => {
                        const Icon = method.icon;
                        const isSelected = paymentMethod === method.value;

                        return (
                            <button
                                key={method.value}
                                type="button"
                                onClick={() => onPaymentMethodChange(method.value as PaymentMethodType)}
                                className={`method-btn ${isSelected ? 'selected' : ''}`}
                                style={{
                                    padding: '1rem',
                                    border: `2px solid ${isSelected ? method.color : '#ddd'}`,
                                    backgroundColor: isSelected ? `${method.color}15` : 'white',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s',
                                    fontWeight: isSelected ? 600 : 400,
                                    textAlign: 'center'
                                }}
                            >
                                <Icon size={24} color={isSelected ? method.color : '#666'} />
                                <span style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{method.label}</span>
                                <span style={{ fontSize: '0.7rem', color: '#999', lineHeight: '1.1' }}>
                                    {method.description}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Percentage Slider for Cash + Credit Split */}
            {paymentMethod === 'cash_credit_split' && (
                <div className="split-percentage" style={{
                    padding: '1.5rem',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    border: '2px solid #795548'
                }}>
                    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 600, color: '#795548' }}>
                        Cash Payment Percentage
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={cashPercentage}
                            onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
                            style={{ flex: 1, accentColor: '#795548' }}
                        />
                        <div style={{
                            minWidth: '80px',
                            padding: '0.5rem 1rem',
                            backgroundColor: '#795548',
                            color: 'white',
                            borderRadius: '6px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.1rem'
                        }}>
                            {cashPercentage}%
                        </div>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem',
                        marginTop: '1rem'
                    }}>
                        <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#4caf50', color: 'white', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Cash Amount</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                ${((totalAmount * cashPercentage) / 100).toFixed(2)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#ff9800', color: 'white', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Credit Amount</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                ${(totalAmount - (totalAmount * cashPercentage) / 100).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Amount Received */}
            <div className="amount-received" style={{ marginBottom: '1rem' }}>
                <label htmlFor="amount-received" style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 500
                }}>
                    Amount Received <span style={{ color: '#f44336' }}>*</span>
                    {isAmountDisabled && <span style={{ color: '#ff9800', fontSize: '0.85rem', marginLeft: '0.5rem' }}>(Locked for Credit)</span>}
                    {isAmountReadonly && <span style={{ color: '#795548', fontSize: '0.85rem', marginLeft: '0.5rem' }}>(Auto-calculated)</span>}
                </label>
                <div style={{ position: 'relative' }}>
                    <span style={{
                        position: 'absolute',
                        left: '1rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '1.1rem',
                        color: isAmountDisabled ? '#999' : '#666',
                        fontWeight: 600
                    }}>$</span>
                    <input
                        id="amount-received"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountReceived || ''}
                        onChange={(e) => onAmountReceivedChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        disabled={isAmountDisabled}
                        readOnly={isAmountReadonly}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem 0.75rem 2rem',
                            border: `2px solid ${isAmountDisabled ? '#ddd' : '#ddd'}`,
                            borderRadius: '8px',
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            backgroundColor: isAmountDisabled ? '#f5f5f5' : isAmountReadonly ? '#f9f9f9' : 'white',
                            cursor: isAmountDisabled ? 'not-allowed' : isAmountReadonly ? 'default' : 'text'
                        }}
                        required
                    />
                </div>

                {/* Quick Amount Buttons (for cash only) */}
                {paymentMethod === 'cash' && (
                    <div className="quick-amounts" style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '0.75rem',
                        flexWrap: 'wrap'
                    }}>
                        <span style={{ fontSize: '0.85rem', color: '#666', marginRight: '0.5rem', alignSelf: 'center' }}>
                            Quick:
                        </span>
                        {[10, 20, 50, 100].map(amount => (
                            <button
                                key={amount}
                                type="button"
                                onClick={() => onAmountReceivedChange(amount)}
                                style={{
                                    padding: '0.4rem 0.8rem',
                                    border: '1px solid #ddd',
                                    backgroundColor: 'white',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                                    e.currentTarget.style.borderColor = '#8b1538';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.borderColor = '#ddd';
                                }}
                            >
                                ${amount}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => onAmountReceivedChange(totalAmount)}
                            style={{
                                padding: '0.4rem 0.8rem',
                                border: '1px solid #4caf50',
                                backgroundColor: '#4caf50',
                                color: 'white',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 500
                            }}
                        >
                            Exact
                        </button>
                    </div>
                )}
            </div>

            {/* Accounting Summary */}
            <div className="accounting-summary" style={{
                backgroundColor: '#e3f2fd',
                padding: '1.25rem',
                borderRadius: '8px',
                marginTop: '1.5rem',
                border: '2px solid #2196f3'
            }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#1565c0' }}>
                    📊 Accounting Breakdown
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'white', borderRadius: '4px' }}>
                        <span style={{ fontWeight: 500 }}>💵 Cash/Payment Received:</span>
                        <span style={{ fontWeight: 600, color: '#4caf50' }}>${amountReceived.toFixed(2)}</span>
                    </div>
                    {accountsReceivable > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'white', borderRadius: '4px' }}>
                            <span style={{ fontWeight: 500 }}>📋 Accounts Receivable:</span>
                            <span style={{ fontWeight: 600, color: '#ff9800' }}>${accountsReceivable.toFixed(2)}</span>
                        </div>
                    )}
                    {changeGiven > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#e8f5e9', borderRadius: '4px', border: '1px solid #4caf50' }}>
                            <span style={{ fontWeight: 500, color: '#2e7d32' }}>💰 Change to Return:</span>
                            <span style={{ fontWeight: 700, color: '#2e7d32', fontSize: '1.1rem' }}>${changeGiven.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Validation Error */}
            {validationError && (
                <div className="validation-error" style={{
                    padding: '1rem',
                    backgroundColor: '#ffebee',
                    border: '2px solid #f44336',
                    borderRadius: '8px',
                    marginTop: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <AlertCircle size={24} color="#f44336" />
                    <div>
                        <div style={{ fontWeight: 600, color: '#c62828', marginBottom: '0.25rem' }}>
                            Payment Validation Error
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#d32f2f' }}>
                            {validationError}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .method-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }

                .method-btn.selected {
                    box-shadow: 0 4px 12px rgba(139, 21, 56, 0.2);
                }

                @media (max-width: 768px) {
                    .method-buttons {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
            `}</style>
        </div>
    );
}
