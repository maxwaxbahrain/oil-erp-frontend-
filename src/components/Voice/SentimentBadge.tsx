// SentimentBadge — small inline pill for call sentiment.
// Used in CallHistory table rows, CallDetail header, Analytics breakdown.
//
// Visual: capsule with colored dot + uppercase label.
// Matches the existing badge style used in src/pages/Sales/Invoices.tsx
// and src/pages/Customers/CustomerList.tsx (Tailwind utility classes only,
// no new design tokens — green for positive, gray for neutral, rose for negative).

import { Smile, Meh, Frown } from 'lucide-react';
import clsx from 'clsx';

type Sentiment = 'positive' | 'neutral' | 'negative' | null | undefined;

interface SentimentBadgeProps {
    sentiment: Sentiment;
    size?: 'sm' | 'md';
    showIcon?: boolean;
    className?: string;
}

const STYLE: Record<'positive' | 'neutral' | 'negative' | 'unknown', { wrap: string; dot: string; label: string }> = {
    positive: {
        wrap: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        dot:  'bg-emerald-500',
        label: 'Positive',
    },
    neutral: {
        wrap: 'bg-gray-50 border-gray-200 text-gray-600',
        dot:  'bg-gray-400',
        label: 'Neutral',
    },
    negative: {
        wrap: 'bg-rose-50 border-rose-200 text-rose-700',
        dot:  'bg-rose-500',
        label: 'Negative',
    },
    unknown: {
        wrap: 'bg-gray-50 border-gray-200 text-gray-400',
        dot:  'bg-gray-300',
        label: 'Unknown',
    },
};

export default function SentimentBadge({
    sentiment,
    size = 'sm',
    showIcon = false,
    className,
}: SentimentBadgeProps) {
    const key: keyof typeof STYLE = sentiment === 'positive' || sentiment === 'neutral' || sentiment === 'negative'
        ? sentiment
        : 'unknown';
    const s = STYLE[key];
    const Icon = key === 'positive' ? Smile : key === 'negative' ? Frown : Meh;
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 border rounded-full font-black uppercase tracking-widest',
                size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1',
                s.wrap,
                className,
            )}
        >
            {showIcon ? <Icon size={size === 'sm' ? 12 : 14} /> : <span className={clsx('w-1.5 h-1.5 rounded-full', s.dot)} />}
            {s.label}
        </span>
    );
}
