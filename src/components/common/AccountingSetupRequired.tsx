export default function AccountingSetupRequired() {
  return (
    <div
      style={{
        background: 'var(--color-redwood-bg-surface)',
        border: '1px solid var(--color-redwood-border)',
        borderRadius: 14,
        padding: '28px 24px',
        textAlign: 'center',
        color: 'var(--color-redwood-text-main)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "'Syne', sans-serif",
        }}
      >
        Requires accounting setup
      </h2>
      <p
        style={{
          margin: '10px auto 0',
          maxWidth: 560,
          color: 'var(--color-redwood-text-muted)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        This report needs the General Ledger module (chart of accounts + double-entry journal). Coming soon.
      </p>
    </div>
  );
}
