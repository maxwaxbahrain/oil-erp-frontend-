import { HANDS_FREE_PREFS_LOAD_ERROR, HANDS_FREE_UNSUPPORTED_HINT } from './browserSupport';
import { useHandsFreeOptional } from './HandsFreeProvider';

/** Settings control — Hands-free Zava (admin / staging). */
export default function HandsFreeToggle() {
  const ctx = useHandsFreeOptional();
  if (!ctx || !ctx.showUi) return null;

  const hint = ctx.prefsError
    ? HANDS_FREE_PREFS_LOAD_ERROR
    : !ctx.supported
      ? HANDS_FREE_UNSUPPORTED_HINT
      : null;

  return (
    <div className="mt-4 rounded-xl border border-redwood-border p-4" data-testid="hands-free-toggle">
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-redwood-text-main">Hands-free Zava</span>
          <span className="mt-1 block text-xs text-redwood-text-muted">
            Say &quot;Zava&quot; then your question. Chrome or Edge only. Off by default.
          </span>
          {hint && (
            <span className="mt-2 block text-xs text-amber-300" data-testid="hands-free-toggle-hint">
              {hint}
            </span>
          )}
          {ctx.statusMessage && (
            <span className="mt-2 block text-xs text-amber-300" data-testid="hands-free-panel-status">
              {ctx.statusMessage}
            </span>
          )}
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Hands-free Zava"
          checked={Boolean(ctx.prefs.hands_free_zava)}
          disabled={ctx.toggleDisabled}
          onChange={(e) => ctx.setHandsFreeDesired(e.target.checked)}
        />
      </label>
    </div>
  );
}
