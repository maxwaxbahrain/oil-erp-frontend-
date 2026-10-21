export type HandsFreeChipStatus = 'off' | 'listening' | 'hearing' | 'paused';

const LABELS: Record<HandsFreeChipStatus, string> = {
  off: 'Off',
  listening: 'Listening',
  hearing: 'Hearing you',
  paused: 'Paused — click to resume',
};

type Props = {
  status: HandsFreeChipStatus;
  onClick: () => void;
  visible: boolean;
};

export default function HandsFreeChip({ status, onClick, visible }: Props) {
  if (!visible) return null;
  const label = LABELS[status];
  return (
    <button
      type="button"
      data-testid="hands-free-chip"
      data-status={status}
      aria-label={`Hands-free Zava: ${label}`}
      title={label}
      onClick={onClick}
      style={{
        flexShrink: 0,
        height: 32,
        padding: '0 10px',
        borderRadius: 999,
        border: '1px solid rgba(94,234,212,0.35)',
        background:
          status === 'off'
            ? 'rgba(255,255,255,0.04)'
            : status === 'paused'
              ? 'rgba(251,191,36,0.12)'
              : 'rgba(94,234,212,0.12)',
        color: status === 'paused' ? '#FBBF24' : status === 'off' ? '#94A3B8' : '#5EEAD4',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
