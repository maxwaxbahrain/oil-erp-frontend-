export type HandsFreeChipStatus = 'off' | 'listening' | 'hearing' | 'paused' | 'mic_blocked';

const LABELS: Record<HandsFreeChipStatus, string> = {
  off: 'Off',
  listening: 'Listening',
  hearing: 'Hearing you',
  paused: 'Paused — click to resume',
  mic_blocked: 'Mic blocked',
};

type Props = {
  status: HandsFreeChipStatus;
  onClick: () => void;
  visible: boolean;
  statusMessage?: string;
};

export default function HandsFreeChip({ status, onClick, visible, statusMessage }: Props) {
  if (!visible) return null;
  const label = LABELS[status];
  const warn = status === 'paused' || status === 'mic_blocked';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
      <button
        type="button"
        data-testid="hands-free-chip"
        data-status={status}
        aria-label={`Hands-free Zava: ${label}`}
        title={statusMessage || label}
        onClick={onClick}
        style={{
          height: 32,
          padding: '0 10px',
          borderRadius: 999,
          border: warn
            ? '1px solid rgba(251,191,36,0.45)'
            : '1px solid rgba(94,234,212,0.35)',
          background:
            status === 'off'
              ? 'rgba(255,255,255,0.04)'
              : warn
                ? 'rgba(251,191,36,0.12)'
                : 'rgba(94,234,212,0.12)',
          color: warn ? '#FBBF24' : status === 'off' ? '#94A3B8' : '#5EEAD4',
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
      {statusMessage ? (
        <span
          data-testid="hands-free-status-message"
          style={{ fontSize: 10, color: '#FBBF24', maxWidth: 220, textAlign: 'right', lineHeight: 1.3 }}
        >
          {statusMessage}
        </span>
      ) : null}
    </div>
  );
}
