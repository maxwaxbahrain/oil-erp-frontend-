/**
 * Receipt Print Component
 * Displays receipt preview and handles printing
 */

import { Printer, Download, X, CheckCircle } from 'lucide-react';
import type { VanSale } from '../../types/vanSales';
import { receiptService } from '../../services/receiptService';

interface ReceiptPrintProps {
    sale: VanSale;
    onClose: () => void;
    onPrint?: () => void;
}

export default function ReceiptPrint({ sale, onClose, onPrint }: ReceiptPrintProps) {
    const handlePrint = () => {
        const receiptData = receiptService.generate(sale);
        receiptService.print(receiptData);
        if (onPrint) onPrint();
    };

    const handleDownload = () => {
        const receiptData = receiptService.generate(sale);
        receiptService.download(receiptData);
    };

    return (
        <div className="receipt-modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
        }}>
            <div className="receipt-modal" style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                maxWidth: '500px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
                {/* Header */}
                <div className="modal-header" style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#8b1538',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <CheckCircle size={24} />
                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Sale Completed!</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Receipt Preview */}
                <div className="receipt-preview" style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '2rem',
                    backgroundColor: '#f9f9f9'
                }}>
                    <div className="receipt-paper" style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        lineHeight: '1.6'
                    }}>
                        {/* Company Header */}
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px dashed #333', paddingBottom: '1rem' }}>
                            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                MaxWax Bahrain
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                123 Business Street, Manama, Bahrain<br />
                                Tel: +973 1234 5678<br />
                                Email: sales@maxwaxbahrain.com
                            </div>
                        </div>

                        {/* Receipt Title */}
                        <div style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', margin: '1rem 0' }}>
                            SALES RECEIPT
                        </div>

                        {/* Sale Info */}
                        <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span>Receipt #:</span>
                                <span style={{ fontWeight: 'bold' }}>{sale.receipt_number}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span>Date:</span>
                                <span>{receiptService.formatDateTime(sale.sale_date)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span>Van:</span>
                                <span>Van {sale.van_id}</span>
                            </div>
                            {sale.driver_name && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                    <span>Driver:</span>
                                    <span>{sale.driver_name}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span>Customer:</span>
                                <span>{sale.customer_name || 'N/A'}</span>
                            </div>
                        </div>

                        {/* Items */}
                        <div style={{ borderTop: '1px dashed #333', borderBottom: '1px dashed #333', padding: '1rem 0', marginBottom: '1rem' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.85rem' }}>ITEMS:</div>
                            {sale.items.map((item, index) => (
                                <div key={index} style={{ marginBottom: '0.75rem' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{item.product_name}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666', marginTop: '0.2rem' }}>
                                        <span>{item.quantity} x {receiptService.formatCurrency(item.unit_price)}</span>
                                        <span style={{ fontWeight: 'bold', color: '#000' }}>
                                            {receiptService.formatCurrency(item.line_total)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Totals */}
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span>Subtotal:</span>
                                <span>{receiptService.formatCurrency(sale.subtotal)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span>Tax ({(sale.tax_rate * 100).toFixed(1)}%):</span>
                                <span>{receiptService.formatCurrency(sale.tax_amount)}</span>
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                borderTop: '2px solid #000',
                                paddingTop: '0.5rem',
                                marginTop: '0.5rem'
                            }}>
                                <span>TOTAL:</span>
                                <span>{receiptService.formatCurrency(sale.total_amount)}</span>
                            </div>
                        </div>

                        {/* Payment */}
                        <div style={{ borderTop: '1px dashed #333', paddingTop: '1rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span>Payment Method:</span>
                                <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{sale.payment_method}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <span>Amount Received:</span>
                                <span>{receiptService.formatCurrency(sale.amount_received)}</span>
                            </div>
                            {sale.change_given > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: '#4caf50', fontWeight: 'bold' }}>
                                    <span>Change:</span>
                                    <span>{receiptService.formatCurrency(sale.change_given)}</span>
                                </div>
                            )}
                            {sale.outstanding_balance > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: '#f44336', fontWeight: 'bold' }}>
                                    <span>Outstanding Balance:</span>
                                    <span>{receiptService.formatCurrency(sale.outstanding_balance)}</span>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {sale.notes && (
                            <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>Notes:</div>
                                <div style={{ color: '#666' }}>{sale.notes}</div>
                            </div>
                        )}

                        {/* Footer */}
                        <div style={{ textAlign: 'center', borderTop: '2px dashed #333', paddingTop: '1rem', fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Thank You for Your Business!</div>
                            <div style={{ color: '#666' }}>Please keep this receipt for your records</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="modal-footer" style={{
                    padding: '1.5rem',
                    borderTop: '1px solid #eee',
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end',
                    backgroundColor: '#f9f9f9'
                }}>
                    <button
                        onClick={handleDownload}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: 'white',
                            border: '2px solid #8b1538',
                            color: '#8b1538',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                        }}
                    >
                        <Download size={18} />
                        Download
                    </button>
                    <button
                        onClick={handlePrint}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#8b1538',
                            border: 'none',
                            color: 'white',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#6d1028';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#8b1538';
                        }}
                    >
                        <Printer size={18} />
                        Print Receipt
                    </button>
                </div>
            </div>
        </div>
    );
}
