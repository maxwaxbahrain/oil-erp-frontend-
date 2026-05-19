// TASK 3 — Real PDF payslip generation. Uses the existing
// `generateStandardPDF` helper (which gives us company header + signature
// + footer for free) and renders the per-employee payslip body via jspdf
// + jspdf-autotable. Replaces the W4-3 print-CSS approach with a real
// downloadable file (no browser print dialog).

import autoTable from 'jspdf-autotable';
import { generateStandardPDF } from './documentGenerator';
import type { CompletePayrollResult } from '../services/payrollCalculationEngine';
import type { Employee } from '../services/payrollService';

export interface PayslipPDFInput {
    employee: Employee;
    /** Pre-calculated payroll result. Caller is responsible for running
     *  the engine; this keeps the PDF helper a pure data → PDF function. */
    result: CompletePayrollResult;
    /** Display period, e.g. "May 2026". */
    period: string;
}

export function generatePayslipPDF(input: PayslipPDFInput): void {
    const { employee, result, period } = input;
    const periodSlug = period.replace(/\s+/g, '-');
    const filename = `payslip-${employee.employeeId || employee.id}-${periodSlug}`;
    const currency = result.meta?.currency || employee.currency || 'USD';

    generateStandardPDF('Payslip', filename, (doc) => {
        // generateStandardPDF positions currentY around 90 after its header.
        // We pick up from there and lay out: employee meta → earnings table →
        // deductions table → net pay banner → bank-account footer line.
        let y = 92;

        // ─── Employee meta block ───────────────────────────────────────
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 20);
        doc.text(`Employee: ${employee.name}`, 14, y);
        y += 7;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Employee ID: ${employee.employeeId || employee.id}`, 14, y);
        doc.text(`Period: ${period}`, 140, y);
        y += 6;

        doc.text(`Department: ${employee.department || '—'}`, 14, y);
        doc.text(`Job Title: ${employee.jobTitle || '—'}`, 140, y);
        y += 6;

        const salaryRate = employee.salaryType === 'Hourly' ? '/hr' : employee.salaryType === 'Annual' ? '/yr' : '/mo';
        const salaryAmt = Number(employee.salaryAmount || 0).toFixed(2);
        doc.text(`Base Salary: ${employee.currency || 'USD'} ${salaryAmt}${salaryRate}`, 14, y);
        if (employee.filingStatus) {
            doc.text(`Filing: ${employee.filingStatus} · Allowances: ${employee.allowances ?? 0}`, 140, y);
        }
        y += 8;

        // ─── Earnings table ────────────────────────────────────────────
        autoTable(doc, {
            startY: y,
            head: [['Earnings', `Amount (${currency})`]],
            body: result.earnings.map(e => [e.name, e.amount.toFixed(2)]),
            foot: [['Gross Pay', result.grossPay.toFixed(2)]],
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' }, // emerald-500
            footStyles: { fillColor: [220, 252, 231], textColor: 20, fontStyle: 'bold' }, // emerald-50
            columnStyles: { 1: { halign: 'right' } },
            margin: { left: 14, right: 14 },
            styles: { fontSize: 10, cellPadding: 3 },
        });

        const afterEarningsY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 50;

        // ─── Deductions table ──────────────────────────────────────────
        autoTable(doc, {
            startY: afterEarningsY + 6,
            head: [['Deductions', `Amount (${currency})`]],
            body: result.deductions.map(d => [d.name, d.amount.toFixed(2)]),
            foot: [['Total Deductions', result.totalDeductions.toFixed(2)]],
            headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' }, // rose-600
            footStyles: { fillColor: [254, 226, 226], textColor: 20, fontStyle: 'bold' }, // rose-50
            columnStyles: { 1: { halign: 'right' } },
            margin: { left: 14, right: 14 },
            styles: { fontSize: 10, cellPadding: 3 },
        });

        const afterDeductionsY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? afterEarningsY + 50;

        // ─── Net Pay banner ────────────────────────────────────────────
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.6);
        doc.line(14, afterDeductionsY + 8, 196, afterDeductionsY + 8);

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105); // emerald-600
        doc.text('NET PAY', 14, afterDeductionsY + 18);
        const netStr = `${currency} ${result.netPay.toFixed(2)}`;
        const netWidth = doc.getTextWidth(netStr);
        doc.text(netStr, 196 - netWidth, afterDeductionsY + 18);

        // ─── Bank-account footer line (if present) ─────────────────────
        if (employee.bankName || employee.accountNumber) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text(
                `Payment to: ${employee.bankName || 'Bank'}  ·  A/C: ${employee.accountNumber || '—'}`,
                14,
                afterDeductionsY + 28,
            );
        }
    }, 'report');
}
