/**
 * Receipt Service
 * Handles receipt generation, formatting, and printing
 */

import type { VanSale, ReceiptData } from '../types/vanSales';

/**
 * Company information (can be moved to settings later)
 */
const DEFAULT_COMPANY_INFO = {
    name: 'MaxWax Bahrain',
    address: '123 Business Street, Manama, Bahrain',
    phone: '+973 1234 5678',
    email: 'sales@maxwaxbahrain.com',
    tax_id: 'BH-TAX-123456'
};

/**
 * Generate receipt data
 */
export const generateReceiptData = (sale: VanSale): ReceiptData => {
    return {
        receipt_number: sale.receipt_number,
        sale,
        company_info: DEFAULT_COMPANY_INFO,
        print_date: new Date().toISOString()
    };
};

/**
 * Format currency
 */
export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

/**
 * Format date and time
 */
export const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

/**
 * Format date only
 */
export const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
};

/**
 * Generate receipt HTML for printing
 */
export const generateReceiptHTML = (receiptData: ReceiptData): string => {
    const { sale, company_info } = receiptData;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt ${sale.receipt_number}</title>
      <style>
        @media print {
          @page { margin: 0.5cm; }
          body { margin: 0; }
        }
        
        body {
          font-family: 'Courier New', monospace;
          max-width: 80mm;
          margin: 0 auto;
          padding: 10px;
          font-size: 12px;
          line-height: 1.4;
        }
        
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        
        .company-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .company-details {
          font-size: 10px;
          color: #333;
        }
        
        .receipt-title {
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          margin: 10px 0;
        }
        
        .info-section {
          margin: 10px 0;
          font-size: 11px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 5px 0;
        }
        
        .items-table th {
          text-align: left;
          font-size: 10px;
          padding: 5px 0;
          border-bottom: 1px solid #000;
        }
        
        .items-table td {
          padding: 3px 0;
          font-size: 11px;
        }
        
        .item-name {
          width: 50%;
        }
        
        .item-qty {
          width: 15%;
          text-align: center;
        }
        
        .item-price {
          width: 20%;
          text-align: right;
        }
        
        .item-total {
          width: 15%;
          text-align: right;
        }
        
        .totals-section {
          margin-top: 10px;
          border-top: 1px dashed #000;
          padding-top: 5px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 11px;
        }
        
        .total-row.grand-total {
          font-size: 14px;
          font-weight: bold;
          border-top: 2px solid #000;
          padding-top: 5px;
          margin-top: 5px;
        }
        
        .payment-section {
          margin-top: 10px;
          border-top: 1px dashed #000;
          padding-top: 5px;
        }
        
        .footer {
          text-align: center;
          margin-top: 15px;
          padding-top: 10px;
          border-top: 2px dashed #000;
          font-size: 10px;
        }
        
        .thank-you {
          font-weight: bold;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${company_info?.name || 'Company Name'}</div>
        <div class="company-details">
          ${company_info?.address || ''}<br>
          Tel: ${company_info?.phone || ''}<br>
          Email: ${company_info?.email || ''}<br>
          ${company_info?.tax_id ? `Tax ID: ${company_info.tax_id}` : ''}
        </div>
      </div>
      
      <div class="receipt-title">SALES RECEIPT</div>
      
      <div class="info-section">
        <div class="info-row">
          <span>Receipt #:</span>
          <span><strong>${sale.receipt_number}</strong></span>
        </div>
        <div class="info-row">
          <span>Date:</span>
          <span>${formatDateTime(sale.sale_date)}</span>
        </div>
        <div class="info-row">
          <span>Van:</span>
          <span>Van ${sale.van_id}</span>
        </div>
        ${sale.driver_name ? `
        <div class="info-row">
          <span>Driver:</span>
          <span>${sale.driver_name}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span>Customer:</span>
          <span>${sale.customer_name || 'N/A'}</span>
        </div>
      </div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th class="item-name">Item</th>
            <th class="item-qty">Qty</th>
            <th class="item-price">Price</th>
            <th class="item-total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${sale.items.map(item => `
            <tr>
              <td class="item-name">${item.product_name}</td>
              <td class="item-qty">${item.quantity}</td>
              <td class="item-price">${formatCurrency(item.unit_price)}</td>
              <td class="item-total">${formatCurrency(item.line_total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals-section">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(sale.subtotal)}</span>
        </div>
        <div class="total-row">
          <span>Tax (${(sale.tax_rate * 100).toFixed(1)}%):</span>
          <span>${formatCurrency(sale.tax_amount)}</span>
        </div>
        <div class="total-row grand-total">
          <span>TOTAL:</span>
          <span>${formatCurrency(sale.total_amount)}</span>
        </div>
      </div>
      
      <div class="payment-section">
        <div class="total-row">
          <span>Payment Method:</span>
          <span>${sale.payment_method.toUpperCase()}</span>
        </div>
        <div class="total-row">
          <span>Amount Received:</span>
          <span>${formatCurrency(sale.amount_received)}</span>
        </div>
        ${sale.change_given > 0 ? `
        <div class="total-row">
          <span>Change:</span>
          <span>${formatCurrency(sale.change_given)}</span>
        </div>
        ` : ''}
        ${sale.outstanding_balance > 0 ? `
        <div class="total-row" style="color: #d32f2f;">
          <span>Outstanding Balance:</span>
          <span>${formatCurrency(sale.outstanding_balance)}</span>
        </div>
        ` : ''}
      </div>
      
      ${sale.notes ? `
      <div class="info-section">
        <div><strong>Notes:</strong></div>
        <div style="font-size: 10px; margin-top: 3px;">${sale.notes}</div>
      </div>
      ` : ''}
      
      <div class="footer">
        <div class="thank-you">Thank You for Your Business!</div>
        <div>Please keep this receipt for your records</div>
        <div style="margin-top: 5px;">Printed: ${formatDateTime(receiptData.print_date)}</div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Print receipt
 */
export const printReceipt = (receiptData: ReceiptData): void => {
    const html = generateReceiptHTML(receiptData);

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=300,height=600');

    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();

        // Wait for content to load, then print
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            // Don't close automatically - let user close after printing
        };
    } else {
        alert('Please allow popups to print receipts');
    }
};

/**
 * Download receipt as PDF (basic implementation using print)
 */
export const downloadReceipt = (receiptData: ReceiptData): void => {
    // For now, use browser's print-to-PDF functionality
    printReceipt(receiptData);
};

/**
 * Get receipt text format (for SMS/Email)
 */
export const getReceiptText = (receiptData: ReceiptData): string => {
    const { sale, company_info } = receiptData;

    let text = `${company_info?.name || 'Company'}\n`;
    text += `SALES RECEIPT\n`;
    text += `${'='.repeat(40)}\n\n`;
    text += `Receipt #: ${sale.receipt_number}\n`;
    text += `Date: ${formatDateTime(sale.sale_date)}\n`;
    text += `Van: Van ${sale.van_id}\n`;
    if (sale.driver_name) text += `Driver: ${sale.driver_name}\n`;
    text += `Customer: ${sale.customer_name || 'N/A'}\n\n`;

    text += `ITEMS:\n`;
    text += `${'-'.repeat(40)}\n`;
    sale.items.forEach(item => {
        text += `${item.product_name}\n`;
        text += `  ${item.quantity} x ${formatCurrency(item.unit_price)} = ${formatCurrency(item.line_total)}\n`;
    });
    text += `${'-'.repeat(40)}\n\n`;

    text += `Subtotal: ${formatCurrency(sale.subtotal)}\n`;
    text += `Tax (${(sale.tax_rate * 100).toFixed(1)}%): ${formatCurrency(sale.tax_amount)}\n`;
    text += `TOTAL: ${formatCurrency(sale.total_amount)}\n\n`;

    text += `Payment: ${sale.payment_method.toUpperCase()}\n`;
    text += `Received: ${formatCurrency(sale.amount_received)}\n`;
    if (sale.change_given > 0) {
        text += `Change: ${formatCurrency(sale.change_given)}\n`;
    }
    if (sale.outstanding_balance > 0) {
        text += `Outstanding: ${formatCurrency(sale.outstanding_balance)}\n`;
    }

    text += `\nThank you for your business!\n`;

    return text;
};

// Export service object
export const receiptService = {
    generate: generateReceiptData,
    print: printReceipt,
    download: downloadReceipt,
    getHTML: generateReceiptHTML,
    getText: getReceiptText,
    formatCurrency,
    formatDateTime,
    formatDate
};
