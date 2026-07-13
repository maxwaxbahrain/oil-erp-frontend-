export type VanLiveStatus = 'moving' | 'stopped' | 'offline';

const OFFLINE_THRESHOLD_MINUTES = 10;
const MOVING_SPEED_MS = 1;

/** Derive live status from ERP van location row (speed is m/s). */
export function deriveVanLiveStatus(
  recordedAt: string | null | undefined,
  speedMs: number | null | undefined,
): VanLiveStatus {
  if (!recordedAt) return 'offline';
  const ageMinutes = (Date.now() - new Date(recordedAt).getTime()) / 60000;
  if (ageMinutes > OFFLINE_THRESHOLD_MINUTES) return 'offline';
  if ((speedMs ?? 0) > MOVING_SPEED_MS) return 'moving';
  return 'stopped';
}

export function vanStatusColor(status: VanLiveStatus): string {
  switch (status) {
    case 'moving':
      return '#16A34A';
    case 'stopped':
      return '#D97706';
    default:
      return '#6B7280';
  }
}

export function vanStatusLabel(status: VanLiveStatus): string {
  switch (status) {
    case 'moving':
      return 'Moving';
    case 'stopped':
      return 'Stopped';
    default:
      return 'Offline';
  }
}

export function speedKmh(speedMs: number | null | undefined): number {
  return Math.round((speedMs ?? 0) * 3.6);
}

export function formatRelativeTime(recordedAt: string | null | undefined): string {
  if (!recordedAt) return 'No data';
  const diffMs = Date.now() - new Date(recordedAt).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  return new Date(recordedAt).toLocaleString();
}
