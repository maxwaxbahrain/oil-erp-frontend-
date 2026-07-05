import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightCircle, Check, Receipt, Send, XCircle, ExternalLink, Pencil } from 'lucide-react';
import {
    convertQuotationToInvoice,
    convertQuotationToSalesOrder,
    updateQuotationStatus,
    type Quotation,
    type QuotationStatus,
} from '../../services/quotationService';

const btnBase: CSSProperties = {
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: '1px solid var(--color-redwood-border)',
};

const btnPrimary: CSSProperties = {
    ...btnBase,
    background: 'rgba(79,142,247,.15)',
    color: 'var(--color-brand-blue-tint)',
    border: '1px solid rgba(79,142,247,.35)',
};

const btnSuccess: CSSProperties = {
    ...btnBase,
    background: 'rgba(34,197,94,.12)',
    color: 'var(--color-brand-green-tint)',
    border: '1px solid rgba(34,197,94,.3)',
};

const btnMuted: CSSProperties = {
    ...btnBase,
    background: 'transparent',
    color: 'var(--color-redwood-text-muted)',
};

const btnDanger: CSSProperties = {
    ...btnBase,
    background: 'rgba(239,68,68,.1)',
    color: '#FCA5A5',
    border: '1px solid rgba(239,68,68,.25)',
};

type Props = {
    quote: Pick<
        Quotation,
        'id' | 'status' | 'converted_sales_order_id' | 'converted_invoice_id' | 'quote_number'
    >;
    onUpdated: () => void | Promise<void>;
    /** Show Edit button (list navigates; form can hide when already editing). */
    showEdit?: boolean;
    editPath?: string;
};

export default function QuotationStatusActions({
    quote,
    onUpdated,
    showEdit = true,
    editPath,
}: Props) {
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);

    const run = async (fn: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
            await onUpdated();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Action failed');
        } finally {
            setBusy(false);
        }
    };

    const patchStatus = (status: QuotationStatus) =>
        run(async () => {
            await updateQuotationStatus(quote.id, status);
        });

    const convertSo = () =>
        run(async () => {
            const res = await convertQuotationToSalesOrder(quote.id);
            alert(`Sales order ${res.so_number} created`);
        });

    const convertInv = () =>
        run(async () => {
            const res = await convertQuotationToInvoice(quote.id);
            alert(`Invoice ${res.invoice_number} created`);
        });

    const editBtn =
        showEdit && quote.status !== 'converted' && quote.status !== 'expired' ? (
            <button
                type="button"
                disabled={busy}
                onClick={() => navigate(editPath ?? `/sales/quotations/${quote.id}`)}
                style={btnMuted}
            >
                <Pencil size={12} /> Edit
            </button>
        ) : null;

    if (quote.status === 'converted') {
        return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {quote.converted_sales_order_id && (
                    <button
                        type="button"
                        onClick={() => navigate(`/sales/orders/${quote.converted_sales_order_id}`)}
                        style={btnPrimary}
                    >
                        <ExternalLink size={12} /> View sales order
                    </button>
                )}
                {quote.converted_invoice_id && (
                    <button
                        type="button"
                        onClick={() => navigate(`/sales/invoices/${quote.converted_invoice_id}`)}
                        style={btnSuccess}
                    >
                        <ExternalLink size={12} /> View invoice
                    </button>
                )}
            </div>
        );
    }

    if (quote.status === 'draft') {
        return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={() => void patchStatus('sent')} style={btnPrimary}>
                    <Send size={12} /> Mark as Sent
                </button>
                {editBtn}
            </div>
        );
    }

    if (quote.status === 'sent') {
        return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={() => void patchStatus('accepted')} style={btnSuccess}>
                    <Check size={12} /> Mark Accepted
                </button>
                <button type="button" disabled={busy} onClick={() => void patchStatus('rejected')} style={btnDanger}>
                    <XCircle size={12} /> Mark Rejected
                </button>
                {editBtn}
            </div>
        );
    }

    if (quote.status === 'accepted') {
        return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={() => void convertSo()} style={btnPrimary}>
                    <ArrowRightCircle size={12} /> Convert to Sales Order
                </button>
                <button type="button" disabled={busy} onClick={() => void convertInv()} style={btnSuccess}>
                    <Receipt size={12} /> Convert to Invoice
                </button>
                {editBtn}
            </div>
        );
    }

    // expired / rejected — view + optional edit for rejected only
    if (quote.status === 'rejected') {
        return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{editBtn}</div>;
    }

    return null;
}
