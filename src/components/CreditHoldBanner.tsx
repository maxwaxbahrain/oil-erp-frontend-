import type { CreditHoldDetail } from '../services/api';

export interface CreditHoldBannerProps {
  hold: CreditHoldDetail | null;
  onOverride?: () => void;
  canOverride: boolean;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CreditHoldBanner({ hold, onOverride, canOverride }: CreditHoldBannerProps) {
  if (!hold || !hold.held || hold.mode === 'off') return null;

  const isCashExempt = hold.exempt_reason === 'cash';
  const isBlock = hold.mode === 'block' && !isCashExempt;
  const tone = isBlock ? 'red' : 'amber';

  const title = isCashExempt
    ? 'On credit hold — cash only'
    : hold.mode === 'block'
      ? 'Credit hold — order blocked'
      : 'Credit hold — warning';

  const bg = tone === 'red' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const titleColor = tone === 'red' ? 'text-red-900' : 'text-amber-900';
  const bodyColor = tone === 'red' ? 'text-red-800' : 'text-amber-800';
  const listColor = tone === 'red' ? 'text-red-700' : 'text-amber-700';

  return (
    <div className={`rounded-xl border px-4 py-3 ${bg}`} role="alert" data-testid="credit-hold-banner">
      <p className={`text-sm font-black uppercase tracking-wide ${titleColor}`}>{title}</p>
      {hold.message ? (
        <p className={`mt-1 text-sm font-medium ${bodyColor}`}>{hold.message}</p>
      ) : null}
      {hold.invoices && hold.invoices.length > 0 ? (
        <ul className={`mt-2 space-y-1 text-xs font-semibold ${listColor}`}>
          {hold.invoices.map((inv) => (
            <li key={inv.invoice_id}>
              {inv.invoice_number} · ${formatMoney(inv.outstanding)} · {inv.days_unpaid}d
            </li>
          ))}
        </ul>
      ) : null}
      {isBlock && canOverride && onOverride ? (
        <button
          type="button"
          onClick={onOverride}
          className="mt-3 px-3 py-1.5 rounded-lg bg-red-900 text-white text-xs font-bold hover:opacity-90"
        >
          Override and continue
        </button>
      ) : null}
      {isBlock && !canOverride ? (
        <p className={`mt-2 text-xs font-semibold ${bodyColor}`}>
          Ask a manager to override or collect payment first
        </p>
      ) : null}
    </div>
  );
}
