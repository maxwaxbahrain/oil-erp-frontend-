import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Invoice } from './api';
import type { CompanySettings } from './settingsService';
import { getCompanySettings } from './settingsService';
import { showToast } from '../utils/showToast';

const MAROON: [number, number, number] = [128, 0, 32];
const LOGO_MAX_W_MM = 40;
const LOGO_MAX_H_MM = 20;

function safeFilename(ref: string): string {
  return ref.replace(/[^\w.-]+/g, '_');
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Same URL the customer opens in the browser (no login). */
export function getPublicInvoicePageUrl(shareToken: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/invoice/${encodeURIComponent(shareToken)}`;
}

export type SharePdfMethod = 'whatsapp' | 'sms' | 'email' | 'copy';

export type SharePdfResult =
  | { showAttachModal: false }
  | { showAttachModal: true; channel: 'whatsapp' | 'sms' | 'email'; fileName: string };

type InvoiceLike = Invoice & {
  invoice_number?: string;
  customer_name?: string;
  total?: number;
  share_token?: string;
};

export function buildShareMessage(invoice: InvoiceLike, company: CompanySettings): string {
  const invNum = invoice.invoiceNumber || invoice.invoice_number || '';
  const total = invoice.grandTotal ?? invoice.total ?? 0;
  const customer = invoice.customerName || invoice.customer_name || '';
  const token = (invoice.shareToken || invoice.share_token || '').trim();
  const link = token ? `${window.location.origin}/invoice/${encodeURIComponent(token)}` : '';

  return `Hi ${customer},

Your invoice from ${company.name}:
Invoice: ${invNum}
Amount: $${Number(total).toFixed(2)}
${link ? `View online: ${link}` : ''}

${company.name}
${company.phone}
${company.email}

Thank you for your business!`;
}

/** Message for WhatsApp / SMS / Email: public invoice link only (no PDF attachment). */
function buildLinkOnlyShareMessage(invoice: InvoiceLike, company: CompanySettings): string {
  const invNum = invoice.invoiceNumber || invoice.invoice_number || '';
  const total = Number(invoice.grandTotal ?? invoice.total ?? 0).toFixed(2);
  const customer = invoice.customerName || invoice.customer_name || '';
  const token = (invoice.shareToken || invoice.share_token || '').trim();
  const frontendBase =
    window.location.hostname === 'localhost'
      ? 'https://hon-treasures-breed-define.trycloudflare.com'
      : window.location.origin;
  const link = token ? `${frontendBase}/invoice/${token}` : '';

  return `Hi ${customer},

Your invoice from ${company.name}:
Invoice: ${invNum}
Amount: $${total}

View & download your invoice here:
${link}

${company.name}
${company.phone}
${company.email}

Thank you for your business!`;
}

/**
 * WhatsApp / SMS / Email: open channel with link-only message (public invoice page).
 * Copy: clipboard. Download PDF remains on the ledger Download PDF action only.
 */
export async function shareInvoicePDF(
  invoice: InvoiceLike,
  company: CompanySettings | null | undefined,
  method: SharePdfMethod
): Promise<SharePdfResult> {
  const companyData = company ?? getCompanySettings();

  if (method === 'copy') {
    const message = buildShareMessage(invoice, companyData);
    try {
      await navigator.clipboard.writeText(message);
      showToast('Message copied to clipboard!');
    } catch {
      showToast('Could not copy to clipboard.');
    }
    return { showAttachModal: false };
  }

  const message = buildLinkOnlyShareMessage(invoice, companyData);
  const encodedMsg = encodeURIComponent(message);
  const invRef = invoice.invoiceNumber || invoice.invoice_number || 'invoice';

  if (method === 'whatsapp') {
    window.open(`https://web.whatsapp.com/send?text=${encodedMsg}`, '_blank', 'noopener,noreferrer');
    return { showAttachModal: false };
  }

  if (method === 'sms') {
    window.location.href = `sms:?body=${encodedMsg}`;
    return { showAttachModal: false };
  }

  if (method === 'email') {
    const subject = encodeURIComponent(`Invoice ${invRef} from ${companyData.name}`);
    window.open(`mailto:?subject=${subject}&body=${encodedMsg}`, '_blank', 'noopener,noreferrer');
    return { showAttachModal: false };
  }

  return { showAttachModal: false };
}

async function resolveCompanyLogoDataUrl(logo: string | undefined): Promise<string | null> {
  if (!logo?.trim()) return null;
  try {
    if (logo.startsWith('data:image')) {
      return logo;
    }
    const res = await fetch(logo, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function measureDataUrl(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('image-load'));
    img.src = dataUrl;
  });
}

function fitSizeMm(naturalW: number, naturalH: number, maxWmm: number, maxHmm: number): { w: number; h: number } {
  const aspect = naturalW / naturalH;
  let w = maxWmm;
  let h = w / aspect;
  if (h > maxHmm) {
    h = maxHmm;
    w = h * aspect;
  }
  return { w, h };
}

function dataUrlToJspdfFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  const head = dataUrl.slice(0, 40).toLowerCase();
  if (head.includes('image/png')) return 'PNG';
  if (head.includes('image/jpeg') || head.includes('image/jpg')) return 'JPEG';
  if (head.includes('image/webp')) return 'WEBP';
  return 'PNG';
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  const m = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!m) return null;
  const binary = atob(m[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function dataUrlToDocxImageType(dataUrl: string): 'png' | 'jpg' | 'gif' | 'bmp' | null {
  const head = dataUrl.slice(0, 32).toLowerCase();
  if (head.includes('image/png')) return 'png';
  if (head.includes('image/jpeg') || head.includes('image/jpg')) return 'jpg';
  if (head.includes('image/gif')) return 'gif';
  if (head.includes('image/bmp')) return 'bmp';
  return null;
}

/** docx uses EMU; 914400 EMU per inch */
function docxTransformForLogoBox(naturalW: number, naturalH: number, maxWidthMm: number, maxHeightMm: number): {
  width: number;
  height: number;
} {
  const ratio = naturalW / naturalH;
  const maxWEmu = (maxWidthMm / 25.4) * 914400;
  const maxHEmu = (maxHeightMm / 25.4) * 914400;
  let w = maxWEmu;
  let h = w / ratio;
  if (h > maxHEmu) {
    h = maxHEmu;
    w = h * ratio;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

/** Build PDF — returns Blob */
export async function generateInvoicePDF(invoice: Invoice, company: CompanySettings): Promise<Blob> {
  const doc = new jsPDF();
  let y = 16;

  const logoDataUrl = await resolveCompanyLogoDataUrl(company.logo);
  if (logoDataUrl) {
    try {
      const { w: nw, h: nh } = await measureDataUrl(logoDataUrl);
      const { w: dispW, h: dispH } = fitSizeMm(nw, nh, LOGO_MAX_W_MM, LOGO_MAX_H_MM);
      const pageW = doc.internal.pageSize.getWidth();
      const marginRight = 14;
      const x = pageW - marginRight - dispW;
      const yLogo = 8;
      const fmt = dataUrlToJspdfFormat(logoDataUrl);
      doc.addImage(logoDataUrl, fmt, x, yLogo, dispW, dispH);
    } catch {
      /* skip logo silently */
    }
  }

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAROON);
  doc.text(company.name, 14, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 55, 55);
  const addrLines = [company.address, company.city, company.country].filter(Boolean);
  for (const line of addrLines) {
    doc.text(line, 14, y);
    y += 5;
  }
  if (company.phone) {
    doc.text(`Phone: ${company.phone}`, 14, y);
    y += 5;
  }
  if (company.email) {
    doc.text(`Email: ${company.email}`, 14, y);
    y += 5;
  }
  if (company.website) {
    doc.text(`Web: ${company.website}`, 14, y);
    y += 5;
  }
  if (company.taxId) {
    doc.text(`Tax ID: ${company.taxId}`, 14, y);
    y += 5;
  }

  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.text('INVOICE', 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 14, y);
  y += 5;
  doc.text(`Date: ${invoice.invoiceDate}`, 14, y);
  y += 5;
  doc.text(`Due: ${invoice.dueDate || '—'}`, 14, y);
  y += 5;
  doc.text(`Customer: ${invoice.customerName}`, 14, y);
  y += 5;
  if (invoice.salesman) {
    doc.text(`Salesman: ${invoice.salesman}`, 14, y);
    y += 5;
  }
  y += 4;

  const body = invoice.lineItems.map((li) => [
    li.product || '—',
    (li.description || '').slice(0, 60),
    String(li.quantity),
    formatMoney(li.rate),
    formatMoney(li.amount),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Product', 'Description', 'Qty', 'Rate', 'Amount']],
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  let ty = finalY + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Subtotal: ${formatMoney(invoice.subtotal)}`, 140, ty, { align: 'right' });
  ty += 5;
  doc.text(`Tax: ${formatMoney(invoice.taxAmount)}`, 140, ty, { align: 'right' });
  ty += 5;
  if (invoice.discount > 0) {
    doc.text(`Discount: ${formatMoney(invoice.discount)}`, 140, ty, { align: 'right' });
    ty += 5;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...MAROON);
  doc.text(`Total: ${formatMoney(invoice.grandTotal)}`, 140, ty, { align: 'right' });
  ty += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  if (invoice.notes) {
    doc.text('Notes / payment terms:', 14, ty);
    ty += 4;
    const split = doc.splitTextToSize(invoice.notes, 180);
    doc.text(split, 14, ty);
  }

  return doc.output('blob');
}

function cellPara(text: string, opts?: { bold?: boolean }): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts?.bold })],
  });
}

/** Word document — same information as PDF */
export async function generateInvoiceWord(invoice: Invoice, company: CompanySettings): Promise<Blob> {
  const prefixBlocks: Paragraph[] = [];

  const logoDataUrl = await resolveCompanyLogoDataUrl(company.logo);
  if (logoDataUrl) {
    try {
      const imgType = dataUrlToDocxImageType(logoDataUrl);
      const bytes = dataUrlToUint8Array(logoDataUrl);
      if (imgType && bytes) {
        const { w: nw, h: nh } = await measureDataUrl(logoDataUrl);
        const transform = docxTransformForLogoBox(nw, nh, LOGO_MAX_W_MM, LOGO_MAX_H_MM);
        prefixBlocks.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new ImageRun({
                type: imgType,
                data: bytes,
                transformation: transform,
              }),
            ],
          }),
          new Paragraph({ text: '' })
        );
      }
    } catch {
      /* skip logo silently */
    }
  }

  const headerBlocks: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: company.name, bold: true, size: 32, color: '800020' })],
    }),
  ];
  if (company.address) headerBlocks.push(cellPara(company.address));
  if (company.city) headerBlocks.push(cellPara(company.city));
  if (company.country) headerBlocks.push(cellPara(company.country));
  if (company.phone) headerBlocks.push(cellPara(`Phone: ${company.phone}`));
  if (company.email) headerBlocks.push(cellPara(`Email: ${company.email}`));
  if (company.website) headerBlocks.push(cellPara(`Website: ${company.website}`));
  if (company.taxId) headerBlocks.push(cellPara(`Tax ID: ${company.taxId}`));

  headerBlocks.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [new TextRun({ text: 'INVOICE', bold: true, size: 24 })],
    }),
    cellPara(`Invoice #: ${invoice.invoiceNumber}`),
    cellPara(`Date: ${invoice.invoiceDate}`),
    cellPara(`Due: ${invoice.dueDate || '—'}`),
    cellPara(`Customer: ${invoice.customerName}`),
    ...(invoice.salesman ? [cellPara(`Salesman: ${invoice.salesman}`)] : []),
    new Paragraph({ text: '' })
  );

  const headerRow = new TableRow({
    children: ['Product', 'Description', 'Qty', 'Rate', 'Amount'].map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        })
    ),
  });

  const dataRows = invoice.lineItems.map(
    (li) =>
      new TableRow({
        children: [
          new TableCell({ children: [cellPara(li.product || '—')] }),
          new TableCell({ children: [cellPara((li.description || '').slice(0, 200))] }),
          new TableCell({ children: [cellPara(String(li.quantity))] }),
          new TableCell({ children: [cellPara(formatMoney(li.rate))] }),
          new TableCell({ children: [cellPara(formatMoney(li.amount))] }),
        ],
      })
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  const totals: Paragraph[] = [
    new Paragraph({ text: '' }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `Subtotal: ${formatMoney(invoice.subtotal)}` })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `Tax: ${formatMoney(invoice.taxAmount)}` })],
    }),
  ];
  if (invoice.discount > 0) {
    totals.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `Discount: ${formatMoney(invoice.discount)}` })],
      })
    );
  }
  totals.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `Total: ${formatMoney(invoice.grandTotal)}`,
          bold: true,
          size: 28,
          color: '800020',
        }),
      ],
    })
  );

  if (invoice.notes) {
    totals.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        children: [new TextRun({ text: 'Notes / payment terms:', bold: true })],
      }),
      new Paragraph({ children: [new TextRun({ text: invoice.notes })] })
    );
  }

  const doc = new Document({
    sections: [
      {
        children: [...prefixBlocks, ...headerBlocks, table, ...totals],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function downloadInvoicePDF(invoice: Invoice, company: CompanySettings): Promise<void> {
  const blob = await generateInvoicePDF(invoice, company);
  saveAs(blob, `${safeFilename(invoice.invoiceNumber)}.pdf`);
}

export async function downloadInvoiceWord(invoice: Invoice, company: CompanySettings): Promise<void> {
  const blob = await generateInvoiceWord(invoice, company);
  saveAs(blob, `${safeFilename(invoice.invoiceNumber)}.docx`);
}

