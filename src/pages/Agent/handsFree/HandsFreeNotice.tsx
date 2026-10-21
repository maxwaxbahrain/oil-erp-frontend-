type Props = {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
};

export default function HandsFreeNotice({ open, onAccept, onCancel }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hands-free-notice-title"
      data-testid="hands-free-notice"
    >
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Cancel" onClick={onCancel} />
      <div className="relative z-[1] w-full max-w-md rounded-2xl border border-redwood-border bg-redwood-midnight p-5 text-redwood-text-main shadow-xl">
        <h2 id="hands-free-notice-title" className="text-lg font-semibold">
          Hands-free listening
        </h2>
        <p className="mt-3 text-sm leading-6 text-redwood-text-muted">
          Chrome may show that this site is using your microphone while Hands-free Zava is on. Audio is
          processed in the browser to hear &quot;Zava&quot;; short follow-up clips may be sent to transcribe a
          command. Nothing is stored as a recording. You can turn Hands-free off anytime from the header chip
          or settings.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-redwood-border px-3 text-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="hands-free-notice-accept"
            className="h-9 rounded-lg bg-teal-500/90 px-3 text-sm font-medium text-slate-950"
            onClick={onAccept}
          >
            Accept &amp; turn on
          </button>
        </div>
      </div>
    </div>
  );
}
