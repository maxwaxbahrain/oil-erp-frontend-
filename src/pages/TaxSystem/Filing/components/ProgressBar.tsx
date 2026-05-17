// ProgressBar — reusable horizontal progress for the wizard.
// `value` is 0-100.  `label` shows on the right; `accent` picks
// the bar color (orange = default, emerald = complete, rose = error).

interface ProgressBarProps {
    value: number;
    label?: string;
    accent?: 'orange' | 'emerald' | 'rose';
}

export default function ProgressBar({ value, label, accent = 'orange' }: ProgressBarProps) {
    const clamped = Math.max(0, Math.min(100, value));
    const barClass = accent === 'emerald'
        ? 'bg-emerald-500'
        : accent === 'rose'
            ? 'bg-rose-500'
            : 'bg-orange-500';
    return (
        <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${barClass} transition-all duration-500 ease-out`}
                    style={{ width: `${clamped}%` }}
                />
            </div>
            {label !== undefined && (
                <span className="font-mono font-black text-xs text-gray-700 w-12 text-right">
                    {label}
                </span>
            )}
        </div>
    );
}
