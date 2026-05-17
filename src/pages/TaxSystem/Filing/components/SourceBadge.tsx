// SourceBadge — color-coded chip showing where a field's value came from.
// Per Session 2F spec: ERP=blue, User=green, Calculated=purple, Missing=red.
// user-override styled like user (it IS a user input, just on top of ERP).

import type { FieldSource } from '../../services/filingApi';

interface SourceBadgeProps {
    source: FieldSource;
}

const STYLES: Record<FieldSource, { bg: string; text: string; label: string }> = {
    erp:            { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'ERP' },
    user:           { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'User' },
    'user-override': { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'User Override' },
    calculated:     { bg: 'bg-purple-100',  text: 'text-purple-700',  label: 'Calculated' },
    missing:        { bg: 'bg-rose-100',    text: 'text-rose-700',    label: 'To Be Provided' },
};

export default function SourceBadge({ source }: SourceBadgeProps) {
    const style = STYLES[source] ?? STYLES.missing;
    return (
        <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
            {style.label}
        </span>
    );
}
