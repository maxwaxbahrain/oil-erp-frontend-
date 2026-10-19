import { isStaging } from './appEnv';
import type { AuthRole } from '../contexts/AuthContext';

/** Staging admin lands on Zava Nexus; everyone else keeps the dashboard. */
export function postLoginHomePath(role: AuthRole | string | undefined | null): string {
  if (isStaging && String(role || '').toLowerCase() === 'admin') {
    return '/agent/nexus';
  }
  return '/dashboard';
}
