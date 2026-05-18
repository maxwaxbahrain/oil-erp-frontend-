// ITEM 16 — Keyboard shortcut helper.
// Calls `handler` whenever the user presses Escape — but only while
// `enabled` is true (so closed modals don't fight each other for the
// keypress and the topmost open one wins). Falls back to a sensible
// no-op when disabled, and unbinds cleanly on unmount.
//
// Usage:
//   useEscape(() => setOpen(false), open);

import { useEffect } from 'react';

export function useEscape(handler: () => void, enabled: boolean = true) {
    useEffect(() => {
        if (!enabled) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                handler();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
        // We intentionally re-bind when `handler` changes so the latest
        // closure is used; callers can stabilize with useCallback if it
        // matters.
    }, [handler, enabled]);
}
