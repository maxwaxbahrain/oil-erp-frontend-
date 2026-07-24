import jsPDF from 'jspdf';
import { formatCityLine, getCompanyProfile, getDocumentSignature } from '../services/settingsService';

export const generateStandardPDF = (title: string, filename: string, contentCallback: (doc: jsPDF) => void, docType: 'invoice' | 'po' | 'ledger' | 'quotation' | 'report') => {
    const doc = new jsPDF();
    const profile = getCompanyProfile();
    const signature = getDocumentSignature();

    // 1. Add Header (Company Info & Logo)
    let currentY = 15;

    if (profile.logo) {
        try {
            doc.addImage(profile.logo, 'PNG', 14, currentY, 40, 15);
        } catch (e) {
            console.error('Failed to add logo to PDF', e);
        }
    } else {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 20);
        doc.text("ERP System", 14, currentY + 10);
    }

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, 200 - titleWidth, currentY + 10);

    currentY += 25;

    doc.setFontSize(10);
    const cityLine = formatCityLine(profile.city, profile.state, profile.postalCode);
    const headerLines: { text: string; bold?: boolean }[] = [];
    if (profile.name.trim()) headerLines.push({ text: profile.name.trim(), bold: true });
    if (profile.address1.trim()) headerLines.push({ text: profile.address1.trim() });
    if (cityLine) headerLines.push({ text: cityLine });
    if (profile.country.trim()) headerLines.push({ text: profile.country.trim() });
    if (profile.phone.trim()) headerLines.push({ text: `Phone: ${profile.phone.trim()}` });
    if (profile.email.trim()) headerLines.push({ text: `Email: ${profile.email.trim()}` });
    if (profile.website.trim()) headerLines.push({ text: `Website: ${profile.website.trim()}` });

    let headerY = currentY;
    for (const line of headerLines) {
        doc.setFont('helvetica', line.bold ? 'bold' : 'normal');
        doc.text(line.text, 14, headerY);
        headerY += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 200 - doc.getTextWidth(`Date: ${new Date().toLocaleDateString()}`), currentY);

    currentY += 50;

    // 2. Add Content (via callback)
    contentCallback(doc);

    // 3. Add Signature (at the bottom of the last page)
    const canShowSignature =
        (docType === 'ledger' && signature.showOnLedgers) ||
        (docType === 'po' && signature.showOnPurchaseOrders) ||
        (docType === 'invoice' && signature.showOnInvoices) ||
        (docType === 'quotation' && signature.showOnQuotations) ||
        (docType === 'report' && signature.showOnReports);

    if (canShowSignature && (signature.signatureImage || signature.signatoryName)) {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setPage(pageCount);

        const finalY = (doc as any).lastAutoTable?.cursor?.y || currentY + 100;
        let sigY = Math.min(finalY + 20, 250); // Ensure it doesn't go off page

        doc.setDrawColor(200, 200, 200);
        doc.line(14, sigY, 100, sigY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text("Authorized Signature:", 14, sigY - 5);

        if (signature.signatureImage) {
            try {
                doc.addImage(signature.signatureImage, 'PNG', 14, sigY + 5, 40, 15);
                sigY += 25;
            } catch (e) {
                console.error('Failed to add signature to PDF', e);
                sigY += 10;
            }
        } else {
            sigY += 15;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(signature.signatoryName, 14, sigY);
        doc.setFont('helvetica', 'normal');
        doc.text(signature.signatoryTitle, 14, sigY + 5);
        doc.text(profile.name, 14, sigY + 10);
    }

    // 4. Add Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `This is a computer-generated document from SOLTOL ONE | Generated on: ${new Date().toLocaleString()}`,
            14,
            285
        );
        doc.text(`Page ${i} of ${pageCount}`, 200 - doc.getTextWidth(`Page ${i} of ${pageCount}`), 285);
    }

    doc.save(`${filename}.pdf`);
};
