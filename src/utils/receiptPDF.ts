// TASK 4 — Payment receipt PDF. Mirrors the TASK 3 payslip pattern:
// uses generateStandardPDF for company header + signature + footer, then
// renders a payment-receipt body. Caller passes a snapshot of the
// just-submitted payment (no backend round-trip needed).

import autoTable from 'jspdf-autotable';
import { generateStandardPDF } from './documentGenerator';

export interface PaymentReceiptPDFInput {
    customerName: string;
    customerCode?: string;
    amount: number;
    currency?: string;
    paymentDate: string;          // 'YYYY-MM-DD'
    paymentMethod: string;
    reference?: string;
    notes?: string;
    invoiceNumber?: string;       // when linked
    isAdvance?: boolean;
    /** Optional receipt number; if omitted we synthesize one from the date + amount. */
    receiptNumber?: string;
}

export function generatePaymentReceiptPDF(input: PaymentReceiptPDFInput): void {
    const {
        customerName,
        customerCode,
        amount,
        currency = 'USD',
        paymentDate,
        paymentMethod,
        reference,
        notes,
        invoiceNumber,
        isAdvance,
    } = input;

    const receiptNo = input.receiptNumber
        || `RCPT-${paymentDate.replace(/-/g, '')}-${Math.round(amount)}`;
    const slug = (customerCode || customerName.replace(/\s+/g, '-')).slice(0, 30);
    const filename = `receipt-${slug}-${paymentDate}`;

    generateStandardPDF('Payment Receipt', filename, (doc) => {
        let y = 92; // generateStandardPDF leaves currentY ~90 after header

        // ─── Receipt number + received-from line ──────────────────────
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(`Receipt #: ${receiptNo}`, 14, y);
        y += 8;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 20);
        doc.text(`Received From:  ${customerName}`, 14, y);
        if (customerCode) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text(`Customer Code: ${customerCode}`, 14, y + 6);
            y += 6;
        }
        y += 12;

        // ─── Amount banner (centered, large, emerald) ────────────────
        doc.setDrawColor(16, 185, 129);
        doc.setFillColor(220, 252, 231); // emerald-50
        doc.roundedRect(14, y, 182, 28, 3, 3, 'FD');

        doc.setTextColor(5, 95, 70); // emerald-800
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('AMOUNT RECEIVED', 105, y + 9, { align: 'center' });

        doc.setFontSize(22);
        doc.setTextColor(5, 150, 105); // emerald-600
        const amountStr = `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        doc.text(amountStr, 105, y + 22, { align: 'center' });
        y += 38;

        // ─── Details table ────────────────────────────────────────────
        const rows: [string, string][] = [
            ['Payment Date', new Date(paymentDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })],
            ['Payment Method', paymentMethod || 'Cash'],
        ];
        if (reference) rows.push(['Reference', reference]);
        if (invoiceNumber) {
            rows.push(['Applied to Invoice', invoiceNumber]);
            rows.push(['Type', 'Invoice Payment']);
        } else if (isAdvance) {
            rows.push(['Type', 'Advance Payment (no invoice)']);
        }

        autoTable(doc, {
            startY: y,
            head: [['Detail', 'Value']],
            body: rows,
            headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' }, // gray-700
            margin: { left: 14, right: 14 },
            styles: { fontSize: 10, cellPadding: 4 },
            columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' } },
        });

        const afterTableY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 40;

        // ─── Notes paragraph (if present) ─────────────────────────────
        if (notes && notes.trim()) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text('NOTES', 14, afterTableY + 10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(40, 40, 40);
            const wrapped = doc.splitTextToSize(notes.trim(), 180);
            doc.text(wrapped, 14, afterTableY + 16);
        }

        // ─── Thank-you tagline ────────────────────────────────────────
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        doc.text(
            'Thank you for your payment. Please retain this receipt for your records.',
            105,
            265,
            { align: 'center' },
        );
    }, 'report');
}
