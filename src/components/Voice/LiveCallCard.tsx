// LiveCallCard — popup card shown when an incoming_call WS event arrives.
// Used by VoiceDashboard. Has a pulsing red "LIVE" badge, the caller's
// hydrated customer context (name, tier, open orders, unpaid invoices),
// and a "Claim Call" placeholder button (Phase 6.5 rep-assignment will
// wire this; for now it just routes to the call detail page).

import { Phone, User, AlertCircle, FileText, ShoppingCart, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

export interface LiveCallCardProps {
    callId: string;
    callerPhone: string | null;
    customer: {
        id?: number | string;
        name?: string;
        category?: string;
        balance?: number;
        credit_limit?: number;
    } | null;
    openOrdersCount: number;
    unpaidInvoices: number;
    isNewLead: boolean;
    /** Click handler — defaults to navigating to /voice/calls/{callId}. */
    onClick?: () => void;
    className?: string;
}

export default function LiveCallCard({
    callId,
    callerPhone,
    customer,
    openOrdersCount,
    unpaidInvoices,
    isNewLead,
    onClick,
    className,
}: LiveCallCardProps) {
    return (
        <div
            onClick={onClick}
            className={clsx(
                'bg-white border-2 border-redwood-brand rounded-xl shadow-lg p-5 cursor-pointer hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200',
                'animate-in fade-in slide-in-from-top-2 duration-300',
                className,
            )}
        >
            {/* Top row: LIVE badge + phone */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="relative flex items-center">
                        <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-redwood-brand opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-redwood-brand" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-redwood-brand">Live Call</span>
                </div>
                <div className="text-[10px] font-mono text-redwood-text-muted truncate max-w-[120px]" title={callId}>
                    {callId.slice(0, 8)}
                </div>
            </div>

            {/* Caller block */}
            <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-redwood-bg-light flex items-center justify-center shrink-0">
                    {isNewLead ? <Phone size={18} className="text-redwood-text-muted" /> : <User size={18} className="text-redwood-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-redwood-text-main truncate">
                        {customer?.name || 'New Lead'}
                    </p>
                    <p className="text-xs text-redwood-text-muted font-mono mt-0.5 truncate">
                        {callerPhone || '— no caller id —'}
                    </p>
                    {customer?.category && (
                        <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-redwood-bg-light text-redwood-text-muted">
                            {customer.category}
                        </span>
                    )}
                </div>
            </div>

            {/* Context grid: open orders + unpaid invoices */}
            {!isNewLead && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-redwood-bg-light rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-redwood-text-muted uppercase tracking-widest mb-1">
                            <ShoppingCart size={11} /> Open orders
                        </div>
                        <p className="text-lg font-black text-redwood-text-main">{openOrdersCount}</p>
                    </div>
                    <div className={clsx(
                        'rounded-lg p-3',
                        unpaidInvoices > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-redwood-bg-light',
                    )}>
                        <div className={clsx(
                            'flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-1',
                            unpaidInvoices > 0 ? 'text-amber-700' : 'text-redwood-text-muted',
                        )}>
                            <FileText size={11} /> Unpaid
                        </div>
                        <p className={clsx(
                            'text-lg font-black',
                            unpaidInvoices > 0 ? 'text-amber-900' : 'text-redwood-text-main',
                        )}>{unpaidInvoices}</p>
                    </div>
                </div>
            )}

            {isNewLead && (
                <div className="bg-redwood-bg-light border border-redwood-border rounded-lg p-3 mb-4 flex items-center gap-2">
                    <AlertCircle size={14} className="text-redwood-text-muted shrink-0" />
                    <p className="text-xs text-redwood-text-muted">New lead — not in customer catalog.</p>
                </div>
            )}

            {/* Claim button (Phase 6.5 placeholder — for now it's just a "view detail" CTA). */}
            <button
                className="w-full py-2.5 bg-redwood-brand text-white text-[11px] font-black uppercase tracking-widest rounded-lg hover:brightness-95 transition-all flex items-center justify-center gap-2"
                onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            >
                View Call <ArrowRight size={14} />
            </button>
        </div>
    );
}
