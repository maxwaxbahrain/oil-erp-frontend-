/**
 * Daily inventory brief (app/agents/router.py, outside the agent gate).
 * Settings are per tenant; the server's ENABLE_INVENTORY_BRIEF switch decides
 * whether scheduled sends happen at all.
 */
import { authFetch } from '../api/axios';
import { ledgerQuery } from './inventoryLedgerService';
import { parseError } from './reorderService';

/** settings_payload in app/agents/inventory/brief.py. timezone and tenant_id are read-only. */
export interface InventoryBriefSettings {
  tenant_id: number;
  enabled: boolean;
  /** Tenant-local HH:MM. */
  send_time: string;
  /** Comma-separated. Null means the company admins. */
  recipients: string | null;
  include_proposals: boolean;
  timezone: string;
}

export type InventoryBriefSettingsUpdate = Partial<Pick<InventoryBriefSettings, 'enabled' | 'send_time' | 'recipients' | 'include_proposals'>>;

/** send_payload in app/agents/inventory/brief.py. */
export interface InventoryBriefSend {
  id: number;
  tenant_id: number;
  local_date: string | null;
  trigger: 'scheduled' | 'test';
  sent_at: string | null;
  recipients_count: number;
  status: 'sent' | 'failed' | 'skipped';
  narrative_ok: boolean;
  error: string | null;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

function sendJson<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
  return readJson<T>(ledgerQuery(path, {}), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getBriefSettings(): Promise<InventoryBriefSettings> {
  return readJson<InventoryBriefSettings>(ledgerQuery('/agent/inventory-brief/settings', {}));
}

/** Partial PUT: fields left out keep their value on the server. Admin only. */
export function updateBriefSettings(changes: InventoryBriefSettingsUpdate): Promise<InventoryBriefSettings> {
  return sendJson<InventoryBriefSettings>('PUT', '/agent/inventory-brief/settings', changes);
}

/** Admin only. Sends one brief to the caller now and returns the send row. */
export function sendTestBrief(): Promise<InventoryBriefSend> {
  return sendJson<InventoryBriefSend>('POST', '/agent/inventory-brief/test', {});
}

export async function listBriefSends(limit?: number): Promise<InventoryBriefSend[]> {
  const body = await readJson<{ sends: InventoryBriefSend[] }>(ledgerQuery('/agent/inventory-brief/sends', { limit }));
  return body.sends ?? [];
}
