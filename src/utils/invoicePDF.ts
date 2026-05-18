// ITEM 7G — Real PDF download for invoices. Mirrors the payslip/receipt
// PDF pattern (TASK 3 / TASK 4): uses generateStandardPDF for company
// header + signature + footer, then renders the invoice body with
// autoTable. No browser print dialog — direct file download via jspdf.

import autoTable from 'jspdf-autotable';
import { generateStandardPDF } from './documentGenerator';

export interface InvoicePDFLineItem {
    product?: string;
    description?: string;
    quantity: number;
    rate: number;
    discount?: number;     // per-line %; optional (ITEM 7D)
    taxRate?: number;      // per-line %; optional (ITEM 7D)
    amount: number;        // line total before per-line discount/tax
}

export interface InvoicePDFInput {
    invoiceNumber: string;
    invoiceDate: string;          // 'YYYY-MM-DD'
    dueDate?: string;
    customerName: string;
    customerCode?: string;
    customerAddress?: string;
    customerPhone?: string;
    lineItems: InvoicePDFLineItem[];
    subtotal: number;
    taxAmount: number;            // header-level tax total (sum of per-line if applicable)
    discount: number;             // header-level discount total
    grandTotal: number;
    amountPaid?: number;
    remainingBalance?: number;
    paymentStatus?: 'Paid' | 'Unpaid' | 'Partial' | 'Advance Paid';
    salesman?: string;
    notes?: string;
    currency?: string;
}

export function generateInvoicePDF(input: InvoicePDFInput): void {
    const {
        invoiceNumber,
        invoiceDate,
        dueDate,
        customerName,
        customerCode,
        customerAddress,
        customerPhone,
        lineItems,
        subtotal,
        taxAmount,
        discount,
        grandTotal,
        amountPaid,
        remainingBalance,
        paymentStatus,
        salesman,
        notes,
        currency = 'USD',
    } = input;

    const filename = `invoice-${invoiceNumber.replace(/[^A-Za-z0-9-]/g, '_')}`;

    generateStandardPDF('Invoice', filename, (doc) => {
        let y = 92; // standard header leaves us around y=90

        // ── Invoice meta + customer block ──────────────────────────────
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(`Invoice #: ${invoiceNumber}`, 14, y);
        doc.text(`Invoice Date: ${new Date(invoiceDate).toLocaleDateString()}`, 140, y);
        y += 6;
        if (dueDate) {
            doc.text(`Due Date: ${new Date(dueDate).toLocaleDateString()}`, 140, y);
        }
        if (salesman) {
            doc.text(`Salesman: ${salesman}`, 14, y);
        }
        y += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 20);
        doc.text('BILL TO', 14, y);
        y += 6;
        doc.setFontSize(12);
        doc.text(customerName, 14, y);
        y += 5;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        if (customerCode) { doc.text(`Code: ${customerCode}`, 14, y); y += 4; }
        if (customerAddress) { doc.text(customerAddress, 14, y); y += 4; }
        if (customerPhone) { doc.text(customerPhone, 14, y); y += 4; }
        y += 6;

        // ── Line items table ───────────────────────────────────────────
        const hasPerLineTax = lineItems.some(li => (li.taxRate ?? 0) > 0 || (li.discount ?? 0) > 0);
        const head = hasPerLineTax
            ? [['Item', 'Qty', 'Rate', 'Disc%', 'Tax%', 'Amount']]
            : [['Item', 'Qty', 'Rate', 'Amount']];
        const body = lineItems.map(li => {
            const itemLabel = [li.product, li.description].filter(Boolean).join(' — ') || '—';
            const qty = (Number(li.quantity) || 0).toString();
            const rate = (Number(li.rate) || 0).toFixed(2);
            const amt = (Number(li.amount) || 0).toFixed(2);
            return hasPerLineTax
                ? [itemLabel, qty, rate, `${li.discount ?? 0}%`, `${li.taxRate ?? 0}%`, amt]
                : [itemLabel, qty, rate, amt];
        });

        autoTable(doc, {
            startY: y,
            head,
            body,
            headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
            margin: { left: 14, right: 14 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: hasPerLineTax
                ? {
                    1: { halign: 'right', cellWidth: 16 },
                    2: { halign: 'right', cellWidth: 22 },
                    3: { halign: 'right', cellWidth: 16 },
                    4: { halign: 'right', cellWidth: 16 },
                    5: { halign: 'right', cellWidth: 28 },
                }
                : {
                    1: { halign: 'right', cellWidth: 22 },
                    2: { halign: 'right', cellWidth: 30 },
                    3: { halign: 'right', cellWidth: 36 },
                },
        });

        let summaryY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 60;
        summaryY += 6;

        // ── Totals block (right-aligned) ───────────────────────────────
        const totalsLabelX = 130;
        const totalsValueX = 196;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);

        const row = (label: string, value: string, bold = false, color: [number, number, number] = [80, 80, 80]) => {
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.setTextColor(...color);
            doc.text(label, totalsLabelX, summaryY);
            const width = doc.getTextWidth(value);
            doc.text(value, totalsValueX - width, summaryY);
            summaryY += 6;
        };

        row('Subtotal', `${currency} ${subtotal.toFixed(2)}`);
        if (discount > 0) row('Discount', `-${currency} ${discount.toFixed(2)}`, false, [180, 60, 60]);
        if (taxAmount > 0) row('Tax', `${currency} ${taxAmount.toFixed(2)}`);
        // Total separator line
        doc.setDrawColor(160, 160, 160);
        doc.line(totalsLabelX, summaryY - 2, totalsValueX, summaryY - 2);
        summaryY += 3;
        row('GRAND TOTAL', `${currency} ${grandTotal.toFixed(2)}`, true, [20, 20, 20]);

        if (amountPaid !== undefined && amountPaid > 0) {
            row('Amount Paid', `${currency} ${amountPaid.toFixed(2)}`, false, [5, 150, 105]);
        }
        if (remainingBalance !== undefined && remainingBalance > 0) {
            row('Balance Due', `${currency} ${remainingBalance.toFixed(2)}`, true, [180, 60, 60]);
        }

        if (paymentStatus) {
            summaryY += 3;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            const statusColor: [number, number, number] = paymentStatus === 'Paid' ? [5, 150, 105]
                : paymentStatus === 'Partial' || paymentStatus === 'Advance Paid' ? [217, 119, 6]
                : [180, 60, 60];
            doc.setTextColor(...statusColor);
            const statusLabel = `Status: ${paymentStatus}`;
            const sw = doc.getTextWidth(statusLabel);
            doc.text(statusLabel, totalsValueX - sw, summaryY);
        }

        // ── Notes (left-aligned, below the table, below the totals) ────
        if (notes && notes.trim()) {
            const notesY = Math.max(summaryY + 10, 240);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text('NOTES', 14, notesY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(40, 40, 40);
            const wrapped = doc.splitTextToSize(notes.trim(), 180);
            doc.text(wrapped, 14, notesY + 5);
        }
    }, 'invoice');
}
