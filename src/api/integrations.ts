import api from './axios';

export const API_KEY_SCOPES = [
  'customers:read',
  'customers:write',
  'products:read',
  'products:write',
  'invoices:read',
  'invoices:write',
  'payments:read',
  'payments:write',
  'suppliers:read',
  'suppliers:write',
  'purchase_orders:read',
  'purchase_orders:write',
  'accounts:read',
  'sales_orders:read',
  'sales_orders:write',
  'deliveries:read',
  'chat:read',
  'chat:write',
  'ai:chat',
  'ai:news',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const SCOPE_GROUPS: { label: string; scopes: ApiKeyScope[] }[] = [
  { label: 'Customers', scopes: ['customers:read', 'customers:write'] },
  { label: 'Products', scopes: ['products:read', 'products:write'] },
  { label: 'Invoices', scopes: ['invoices:read', 'invoices:write'] },
  { label: 'Payments', scopes: ['payments:read', 'payments:write'] },
  {
    label: 'Suppliers & purchasing',
    scopes: ['suppliers:read', 'suppliers:write', 'purchase_orders:read', 'purchase_orders:write'],
  },
  { label: 'Accounting', scopes: ['accounts:read'] },
  { label: 'Sales & delivery', scopes: ['sales_orders:read', 'sales_orders:write', 'deliveries:read'] },
  { label: 'Team-Pulse', scopes: ['chat:read', 'chat:write'] },
  { label: 'AI', scopes: ['ai:chat', 'ai:news'] },
];

export const MONEY_WRITE_SCOPES: ApiKeyScope[] = [
  'invoices:write',
  'payments:write',
  'purchase_orders:write',
];

export const CSV_IMPORT_ENTITIES = [
  'customers',
  'products',
  'suppliers',
  'invoices',
  'payments',
  'purchase_orders',
] as const;

export const CSV_EXPORT_ENTITIES = [...CSV_IMPORT_ENTITIES, 'chart_of_accounts'] as const;

export type CsvImportEntity = (typeof CSV_IMPORT_ENTITIES)[number];
export type CsvExportEntity = (typeof CSV_EXPORT_ENTITIES)[number];

export interface ApiKeyCreated {
  id: number;
  name: string;
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  raw_key: string;
}

export interface ApiKeyRow {
  id: number;
  name: string;
  prefix: string;
  scopes: string[];
  role: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface WebhookEndpoint {
  id: number;
  url: string;
  events: string[];
  description: string | null;
  is_active: boolean;
  secret_prefix: string;
  failure_count: number;
  disabled_at: string | null;
  created_at: string | null;
  secret?: string;
}

export interface WebhookSecret {
  secret: string;
  secret_prefix: string;
}

export interface WebhookTestResult {
  delivery_id: number;
  status: string;
  response_status: number | null;
  error: string | null;
}

export interface WebhookDelivery {
  id: number;
  event_id: number;
  event_type: string;
  attempt: number;
  status: string;
  next_attempt_at: string | null;
  delivered_at: string | null;
  response_status: number | null;
  response_excerpt: string | null;
  error: string | null;
  created_at: string | null;
}

export interface CsvImportFailure {
  row: number;
  external_id: string | null;
  error: string;
}

export interface CsvImportResult {
  created: number;
  skipped_existing: number;
  failed: CsvImportFailure[];
  total_rows: number;
}

export function webhookUrlError(url: string): string | null {
  if (!url.startsWith('https://')) {
    return 'URL must start with https://';
  }
  return null;
}

export function apiDocsUrl(): string {
  const origin = String(api.defaults.baseURL || '').replace(/\/+$/, '');
  return `${origin}/api/v1/docs`;
}

export function apiErrorDetail(error: unknown, fallback: string): string {
  const axiosErr = error as {
    response?: { data?: { detail?: unknown } | Blob; status?: number };
    message?: string;
  };
  const data = axiosErr.response?.data;
  if (data && typeof data === 'object' && !(data instanceof Blob) && 'detail' in data) {
    const detail = data.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (detail !== undefined) return JSON.stringify(detail);
  }
  if (axiosErr.message && !axiosErr.response) return axiosErr.message;
  return fallback;
}

export function filenameFromContentDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return encoded[1];
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] || fallback;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function listApiKeys(): Promise<ApiKeyRow[]> {
  return api.get<ApiKeyRow[]>('/api/v1/settings/api-keys').then((res) => res.data);
}

export function createApiKey(body: {
  name: string;
  scopes: string[];
  expires_in_days?: number | null;
}): Promise<ApiKeyCreated> {
  return api.post<ApiKeyCreated>('/api/v1/settings/api-keys', body).then((res) => res.data);
}

export function revokeApiKey(id: number): Promise<void> {
  return api.delete(`/api/v1/settings/api-keys/${id}`).then(() => undefined);
}

export function rotateApiKey(id: number): Promise<ApiKeyCreated> {
  return api.post<ApiKeyCreated>(`/api/v1/settings/api-keys/${id}/rotate`).then((res) => res.data);
}

export function listWebhookEventTypes(): Promise<string[]> {
  return api.get<string[]>('/api/v1/settings/webhooks/event-types').then((res) => res.data);
}

export function listWebhooks(): Promise<WebhookEndpoint[]> {
  return api.get<WebhookEndpoint[]>('/api/v1/settings/webhooks').then((res) => res.data);
}

export function createWebhook(body: {
  url: string;
  events: string[];
  description?: string;
}): Promise<WebhookEndpoint> {
  return api.post<WebhookEndpoint>('/api/v1/settings/webhooks', body).then((res) => res.data);
}

export function updateWebhook(
  id: number,
  body: { url?: string; events?: string[]; description?: string | null; is_active?: boolean },
): Promise<WebhookEndpoint> {
  return api.patch<WebhookEndpoint>(`/api/v1/settings/webhooks/${id}`, body).then((res) => res.data);
}

export function deleteWebhook(id: number): Promise<void> {
  return api.delete(`/api/v1/settings/webhooks/${id}`).then(() => undefined);
}

export function rotateWebhookSecret(id: number): Promise<WebhookSecret> {
  return api.post<WebhookSecret>(`/api/v1/settings/webhooks/${id}/rotate-secret`).then((res) => res.data);
}

export function testWebhook(id: number): Promise<WebhookTestResult> {
  return api.post<WebhookTestResult>(`/api/v1/settings/webhooks/${id}/test`).then((res) => res.data);
}

export function listWebhookDeliveries(id: number, status?: string): Promise<WebhookDelivery[]> {
  return api
    .get<WebhookDelivery[]>(`/api/v1/settings/webhooks/${id}/deliveries`, {
      params: { limit: 50, status: status || undefined },
    })
    .then((res) => res.data);
}

export function retryWebhookDelivery(deliveryId: number): Promise<{ id: number; status: string }> {
  return api
    .post<{ id: number; status: string }>(`/api/v1/settings/webhooks/deliveries/${deliveryId}/retry`)
    .then((res) => res.data);
}

async function downloadCsv(kind: 'templates' | 'export', entity: string): Promise<void> {
  const fallback = `${entity}-${kind === 'templates' ? 'template' : 'export'}.csv`;
  const res = await api.get(`/api/v1/csv/${kind}/${entity}`, { responseType: 'blob' });
  const header = res.headers['content-disposition'] as string | undefined;
  triggerDownload(res.data as Blob, filenameFromContentDisposition(header, fallback));
}

export function downloadCsvTemplate(entity: string): Promise<void> {
  return downloadCsv('templates', entity);
}

export function downloadCsvExport(entity: string): Promise<void> {
  return downloadCsv('export', entity);
}

export function importCsv(entity: string, file: File, system: string): Promise<CsvImportResult> {
  const form = new FormData();
  form.append('file', file);
  return api
    .post<CsvImportResult>(`/api/v1/csv/import/${entity}`, form, {
      params: { system: system || 'external' },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((res) => res.data);
}
