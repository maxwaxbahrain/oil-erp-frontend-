// CoachingTipBanner — amber dismissible banner shown when a `coaching_tip`
// WS push lands. Displayed on VoiceDashboard while the rep is on a live call.
// Auto-fades after ~30s; stackable when multiple tips arrive in quick
// succession (the parent renders one banner per active tip in a vertical
// stack). Banner style mirrors the amber/warning patterns already used in
// src/pages/Sales/Invoices.tsx — no new design tokens.

import { useEffect, useState } from 'react';
import { Brain, X } from 'lucide-react';
import clsx from 'clsx';

export interface CoachingTipBannerProps {
    callId: string;
    message: string;
    /** Called when the banner is dismissed (manual close or auto-fade). */
    onDismiss?: () => void;
    /** Milliseconds before auto-dismissing; pass 0 to disable. */
    autoDismissMs?: number;
    className?: string;
}

export default function CoachingTipBanner({
    callId,
    message,
    onDismiss,
    autoDismissMs = 30_000,
    className,
}: CoachingTipBannerProps) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (!autoDismissMs || autoDismissMs <= 0) return;
        const t = setTimeout(() => {
            setVisible(false);
            // give the fade-out a beat before notifying parent
            setTimeout(() => onDismiss?.(), 300);
        }, autoDismissMs);
        return () => clearTimeout(t);
    }, [autoDismissMs, onDismiss]);

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => onDismiss?.(), 300);
    };

    return (
        <div
            className={clsx(
                'flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm',
                'transition-all duration-300',
                visible
                    ? 'opacity-100 translate-y-0 animate-in fade-in slide-in-from-top-2'
                    : 'opacity-0 -translate-y-2',
                className,
            )}
            role="status"
            aria-live="polite"
        >
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Brain size={18} className="text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                        Coaching Tip
                    </span>
                    <span
                        className="text-[10px] font-mono text-amber-600/70 truncate"
                        title={callId}
                    >
                        {callId.slice(0, 8)}
                    </span>
                </div>
                <p className="text-sm text-amber-900 leading-snug">{message}</p>
            </div>
            <button
                type="button"
                onClick={handleClose}
                aria-label="Dismiss coaching tip"
                className="p-1 rounded-md text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
            >
                <X size={16} />
            </button>
        </div>
    );
}
