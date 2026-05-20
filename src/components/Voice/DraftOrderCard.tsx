// DraftOrderCard — shows an AI-extracted draft order from a call.
// Surfaced on CallDetail when a CallOrderEmbed is present and
// `order_id` is null (i.e. not yet approved into the ERP).
//
// Approve calls voiceService.approveCallOrder(callOrderId) → returns
// the minted SO number (`VO-YYYYMMDD-HHHHHH`) and the ERP sales_order_id.
// On success, the parent should refresh the call so the badge flips
// from "DRAFT" to a "View Order" link.
//
// Pricing is NULL at extraction time (backend Phase 7 decision); we
// render qty-only line items here. Quantity edits are out of scope —
// for v1 the rep approves as-is or rejects and creates the order
// manually in the Sales module.

import { useState } from 'react';
import { ShoppingCart, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { approveCallOrder, type CallOrderEmbed } from '../../services/voiceService';

export interface DraftOrderCardProps {
    order: CallOrderEmbed;
    /** Optional rep_id override sent in the approve payload. Falls back to
     *  the stored voice_rep_id on the backend if omitted. */
    repId?: number;
    /** Called with the minted SO number after a successful approve. */
    onApproved?: (soNumber: string, salesOrderId: string) => void;
    /** Called when the rep clicks the dismiss button. */
    onReject?: () => void;
    className?: string;
}

// ── extracted_order shape (Claude Haiku → JSON we persist on call_orders) ──
type RawItem = {
    sku?: string;
    product_name?: string;
    qty?: number | string;
    unit?: string;
};
type RawExtracted = {
    items?: RawItem[];
    notes?: string | null;
    delivery_date?: string | null;
    confidence?: number;
};

export default function DraftOrderCard({
    order,
    repId,
    onApproved,
    onReject,
    className,
}: DraftOrderCardProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [approved, setApproved] = useState<{ so_number: string; sales_order_id: string } | null>(
        order.order_id ? { so_number: order.order_id, sales_order_id: order.order_id } : null,
    );

    const extracted = (order.extracted_order || {}) as RawExtracted;
    const items: RawItem[] = Array.isArray(extracted.items) ? extracted.items : [];
    const notes = typeof extracted.notes === 'string' ? extracted.notes : null;
    const confidence = typeof extracted.confidence === 'number' ? extracted.confidence : null;

    const handleApprove = async () => {
        if (busy || approved) return;
        setBusy(true);
        setError(null);
        try {
            const res = await approveCallOrder(order.id, repId ? { rep_id: repId } : {});
            setApproved({ so_number: res.so_number, sales_order_id: res.sales_order_id });
            onApproved?.(res.so_number, res.sales_order_id);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to approve order');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className={clsx(
                'bg-white border-2 border-redwood-primary/30 rounded-xl shadow-md overflow-hidden',
                className,
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-redwood-primary/5 border-b border-redwood-primary/20">
                <div className="flex items-center gap-2">
                    <ShoppingCart size={16} className="text-redwood-primary" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-redwood-primary">
                        AI-Extracted Draft Order
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {confidence != null && (
                        <span className="text-[10px] font-mono text-redwood-text-muted">
                            {(confidence * 100).toFixed(0)}% conf
                        </span>
                    )}
                    <span
                        className={clsx(
                            'inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border',
                            approved
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-amber-50 border-amber-200 text-amber-700',
                        )}
                    >
                        {approved ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                        {approved ? 'Approved' : 'Draft'}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
                {items.length === 0 ? (
                    <p className="text-sm text-redwood-text-muted italic">
                        Claude did not extract any line items from this call.
                    </p>
                ) : (
                    <ul className="divide-y divide-redwood-border">
                        {items.map((item, idx) => (
                            <li key={idx} className="py-2 flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-redwood-text-main truncate">
                                        {item.product_name || item.sku || 'Unknown product'}
                                    </p>
                                    {item.sku && item.product_name && (
                                        <p className="text-[11px] text-redwood-text-muted font-mono mt-0.5">
                                            {item.sku}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <p className="text-sm font-black text-redwood-text-main">
                                        × {item.qty ?? '—'}
                                    </p>
                                    {item.unit && (
                                        <p className="text-[10px] text-redwood-text-muted uppercase tracking-widest">
                                            {item.unit}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {notes && (
                    <div className="mt-3 rounded-lg bg-redwood-bg-light p-3 text-xs text-redwood-text-muted">
                        <span className="font-black uppercase tracking-widest text-[10px] block mb-1">
                            Notes
                        </span>
                        {notes}
                    </div>
                )}

                {extracted.delivery_date && (
                    <div className="mt-2 text-xs text-redwood-text-muted">
                        <span className="font-black uppercase tracking-widest text-[10px] mr-2">
                            Delivery
                        </span>
                        {extracted.delivery_date}
                    </div>
                )}

                {error && (
                    <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {approved && (
                    <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                        <span className="font-black uppercase tracking-widest text-[10px] block mb-1">
                            Sales Order Created
                        </span>
                        <span className="font-mono text-emerald-900">{approved.so_number}</span>
                    </div>
                )}
            </div>

            {/* Footer actions */}
            {!approved && (
                <div className="flex items-center gap-2 px-5 py-3 border-t border-redwood-border bg-redwood-bg-light/50">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={handleApprove}
                        className={clsx(
                            'flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2',
                            busy
                                ? 'bg-redwood-primary/60 text-white cursor-wait'
                                : 'bg-redwood-primary text-white hover:brightness-95',
                        )}
                    >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        {busy ? 'Approving…' : 'Approve & Create SO'}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onReject}
                        className="px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest text-redwood-text-muted hover:bg-redwood-border/50 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <X size={14} /> Dismiss
                    </button>
                </div>
            )}
        </div>
    );
}
