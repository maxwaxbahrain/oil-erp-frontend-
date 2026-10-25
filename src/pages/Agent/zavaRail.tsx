import { Bell, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';

import { lastCheckedLabel } from './signalCards';

export type ZavaRailSection = 'ask' | 'signals' | 'health';

export function railCounts(cards: { priority?: string }[] | null): { count: number; urgent: boolean } {
    const rows = cards || [];
    return {
        count: rows.length,
        urgent: rows.some((card) => card.priority === 'urgent'),
    };
}

export function scrollToZava(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function focusZavaQuestion() {
    const box = document.getElementById('zava-question');
    box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (box instanceof HTMLElement) box.focus({ preventScroll: true });
}

type Props = {
    signalCount: number;
    healthCount: number;
    healthUrgent: boolean;
    showDataHealth: boolean;
    showRunChecks: boolean;
    runningChecks: boolean;
    checkedAt: string | null;
    active: ZavaRailSection;
    onSignals: () => void;
    onHealth: () => void;
    onRunChecks: () => void;
    onAsk: () => void;
};

export default function ZavaRail({
    signalCount,
    healthCount,
    healthUrgent,
    showDataHealth,
    showRunChecks,
    runningChecks,
    checkedAt,
    active,
    onSignals,
    onHealth,
    onRunChecks,
    onAsk,
}: Props) {
    return (
        <nav className="zava-rail zava-glass" aria-label="Zava sections">
            <button
                type="button"
                className={`zava-rail-btn${active === 'signals' ? ' is-active' : ''}`}
                aria-current={active === 'signals' ? 'true' : undefined}
                aria-label={`Signals, ${signalCount}`}
                onClick={onSignals}
            >
                <Bell size={16} aria-hidden="true" />
                <span className="zava-rail-label">Signals</span>
                <span className="zava-rail-count">{signalCount}</span>
            </button>
            {showDataHealth && (
                <button
                    type="button"
                    className={`zava-rail-btn${active === 'health' ? ' is-active' : ''}`}
                    aria-current={active === 'health' ? 'true' : undefined}
                    aria-label={healthUrgent ? `Data health, ${healthCount}, urgent` : `Data health, ${healthCount}`}
                    onClick={onHealth}
                >
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span className="zava-rail-label">Data health</span>
                    {healthUrgent && <span className="zava-rail-dot" aria-hidden="true" />}
                    <span className="zava-rail-count">{healthCount}</span>
                </button>
            )}
            {showRunChecks && (
                <div className="zava-rail-run">
                    <button
                        type="button"
                        className="zava-rail-btn"
                        aria-label="Run checks now"
                        disabled={runningChecks}
                        onClick={onRunChecks}
                    >
                        {runningChecks ? <span className="zava-rail-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
                        <span className="zava-rail-label">Run checks now</span>
                    </button>
                    {checkedAt && <p className="zava-rail-checked">{lastCheckedLabel(checkedAt)}</p>}
                </div>
            )}
            <button
                type="button"
                className={`zava-rail-btn${active === 'ask' ? ' is-active' : ''}`}
                aria-current={active === 'ask' ? 'true' : undefined}
                aria-label="Ask Zava"
                onClick={onAsk}
            >
                <MessageCircle size={16} aria-hidden="true" />
                <span className="zava-rail-label">Ask Zava</span>
            </button>
        </nav>
    );
}
