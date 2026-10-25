import { isStaging } from './appEnv';
import type { AuthRole } from '../contexts/AuthContext';

/** Staging admin lands on Zava Nexus. Warehouse lands on the picking board. Everyone else keeps the dashboard. */
export function postLoginHomePath(role: AuthRole | string | undefined | null): string {
  const value = String(role || '').toLowerCase();
  if (value === 'warehouse') return '/warehouse/picking';
  if (isStaging && value === 'admin') {
    return '/agent/nexus';
  }
  return '/dashboard';
}
