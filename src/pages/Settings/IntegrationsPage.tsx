import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  API_KEY_SCOPES,
  CSV_EXPORT_ENTITIES,
  CSV_IMPORT_ENTITIES,
  MONEY_WRITE_SCOPES,
  SCOPE_GROUPS,
  apiDocsUrl,
  apiErrorDetail,
  createApiKey,
  createWebhook,
  deleteWebhook,
  downloadCsvExport,
  downloadCsvTemplate,
  importCsv,
  listApiKeys,
  listWebhookDeliveries,
  listWebhookEventTypes,
  listWebhooks,
  retryWebhookDelivery,
  revokeApiKey,
  rotateApiKey,
  rotateWebhookSecret,
  testWebhook,
  updateWebhook,
  webhookUrlError,
  type ApiKeyCreated,
  type ApiKeyRow,
  type ApiKeyScope,
  type CsvExportEntity,
  type CsvImportResult,
  type WebhookDelivery,
  type WebhookEndpoint,
} from '../../api/integrations';
import { formatDateTime, parseApiDateTime } from '../../utils/formatters';
import { showToast } from '../../utils/showToast';

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const SIGNATURE_HELP =
  'Verify signatures: header X-Soltol-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>"> with the endpoint secret; reject if t is older than 300 seconds.';

type TabId = 'keys' | 'webhooks' | 'csv' | 'docs';
type DeliveryFilter = '' | 'pending' | 'delivered' | 'failed' | 'dead';

function showErrorToast(message: string): void {
  const id = 'integrations-error-toast';
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.setAttribute('role', 'alert');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed',
    'top:16px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:99999',
    'background:#b91c1c',
    'color:#fff',
    'padding:12px 20px',
    'border-radius:8px',
    'font-size:14px',
    'font-weight:600',
    'max-width:min(520px,90vw)',
    'text-align:center',
  ].join(';');
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 4000);
}

function fail(error: unknown, fallback: string): void {
  showErrorToast(apiErrorDetail(error, fallback));
}

function apiKeyStatus(row: ApiKeyRow): 'Active' | 'Revoked' | 'Expired' {
  if (row.revoked_at) return 'Revoked';
  const expires = parseApiDateTime(row.expires_at);
  if (expires && expires.getTime() < Date.now()) return 'Expired';
  return 'Active';
}

function when(value: string | null | undefined, empty = '—'): string {
  if (!value) return empty;
  return formatDateTime(value) || empty;
}

export function ScopePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (scopes: string[]) => void;
}) {
  const money = selected.some((scope) => MONEY_WRITE_SCOPES.includes(scope as ApiKeyScope));
  return (
    <div className="space-y-3">
      {SCOPE_GROUPS.map((group) => (
        <fieldset key={group.label} className="border border-redwood-border rounded-sm p-3">
          <legend className="px-1 text-[10px] font-black uppercase tracking-widest text-redwood-text-muted">
            {group.label}
          </legend>
          <div className="flex flex-wrap gap-3">
            {group.scopes.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-xs text-redwood-text-main">
                <input
                  type="checkbox"
                  checked={selected.includes(scope)}
                  onChange={(event) => {
                    onChange(
                      event.target.checked
                        ? [...selected, scope]
                        : selected.filter((item) => item !== scope),
                    );
                  }}
                />
                {scope}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {money && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2">
          Money writes require an Idempotency-Key header on every request.
        </p>
      )}
      <p className="sr-only">{API_KEY_SCOPES.join(' ')}</p>
    </div>
  );
}

export function OneTimeSecretModal({
  value,
  title,
  onClose,
  showSignatureHelp = false,
}: {
  value: string;
  title: string;
  onClose: () => void;
  showSignatureHelp?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg bg-white border border-redwood-border rounded-sm p-6 space-y-4">
        <h2 className="text-lg font-black text-redwood-text-main">{title}</h2>
        <input readOnly value={value} aria-label="Secret value" className="w-full font-mono text-sm border border-redwood-border rounded-sm px-3 py-2" />
        <button
          type="button"
          className="px-3 py-2 text-xs font-bold uppercase tracking-widest border border-redwood-border rounded-sm"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            showToast('Copied');
          }}
        >
          Copy
        </button>
        <p className="text-sm text-redwood-text-main">This key is shown only once. Store it securely.</p>
        {showSignatureHelp && <p className="text-xs text-redwood-text-muted">{SIGNATURE_HELP}</p>}
        <button type="button" className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-redwood-brand text-white rounded-sm" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function ImportResultTable({ result }: { result: CsvImportResult }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-redwood-text-main">
        Created {result.created}. Skipped (already imported) {result.skipped_existing}. Failed {result.failed.length}.
      </p>
      {result.failed.length === 0 ? (
        <p className="text-sm text-redwood-text-muted">No failed rows.</p>
      ) : (
        <table className="w-full text-left text-xs border border-redwood-border">
          <thead className="bg-redwood-bg-light">
            <tr>
              <th className="p-2">Row</th>
              <th className="p-2">External id</th>
              <th className="p-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {result.failed.map((row) => (
              <tr key={`${row.row}-${row.external_id ?? ''}`} className="border-t border-redwood-border">
                <td className="p-2">{row.row}</td>
                <td className="p-2">{row.external_id || '—'}</td>
                <td className="p-2">{row.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ScopeBadges({ scopes }: { scopes: string[] }) {
  const shown = scopes.slice(0, 4);
  const extra = scopes.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((scope) => (
        <span key={scope} className="px-1.5 py-0.5 rounded-sm bg-redwood-bg-light text-[10px] font-semibold">
          {scope}
        </span>
      ))}
      {extra > 0 && <span className="text-[10px] font-bold text-redwood-text-muted">+{extra}</span>}
    </div>
  );
}

function ModalFrame({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-label={title} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-redwood-border rounded-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black text-redwood-text-main">{title}</h2>
          <button type="button" onClick={onClose} className="text-xs font-bold uppercase tracking-widest">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [tab, setTab] = useState<TabId>('keys');
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [hooks, setHooks] = useState<WebhookEndpoint[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [secretTitle, setSecretTitle] = useState('API key');
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyExpiry, setKeyExpiry] = useState<string>('never');
  const [keyScopes, setKeyScopes] = useState<string[]>([]);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [showHookForm, setShowHookForm] = useState(false);
  const [editingHook, setEditingHook] = useState<WebhookEndpoint | null>(null);
  const [hookUrl, setHookUrl] = useState('');
  const [hookDescription, setHookDescription] = useState('');
  const [hookAll, setHookAll] = useState(false);
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [hookError, setHookError] = useState<string | null>(null);
  const [savingHook, setSavingHook] = useState(false);
  const [deliveryHook, setDeliveryHook] = useState<WebhookEndpoint | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('');
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [expandedDelivery, setExpandedDelivery] = useState<number | null>(null);
  const [csvEntity, setCsvEntity] = useState<CsvExportEntity>('customers');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvSystem, setCsvSystem] = useState('external');
  const [csvRunning, setCsvRunning] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      setKeys(await listApiKeys());
    } catch (error) {
      fail(error, 'Could not load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHooks = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, types] = await Promise.all([listWebhooks(), listWebhookEventTypes()]);
      setHooks(rows);
      setEventTypes(types);
    } catch (error) {
      fail(error, 'Could not load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'keys') void loadKeys();
    if (tab === 'webhooks' || tab === 'docs') void loadHooks();
  }, [tab, loadKeys, loadHooks]);

  function closeSecret() {
    setSecret(null);
  }

  async function submitKey(event: FormEvent) {
    event.preventDefault();
    setKeyError(null);
    const name = keyName.trim();
    if (!name || name.length > 120) {
      setKeyError('Name is required and must be 120 characters or fewer.');
      return;
    }
    if (keyScopes.length === 0) {
      setKeyError('At least one scope is required.');
      return;
    }
    setSavingKey(true);
    try {
      const created: ApiKeyCreated = await createApiKey({
        name,
        scopes: keyScopes,
        expires_in_days: keyExpiry === 'never' ? null : Number(keyExpiry),
      });
      setShowCreateKey(false);
      setSecretTitle('API key');
      setSecret(created.raw_key);
      setKeyName('');
      setKeyScopes([]);
      setKeyExpiry('never');
      await loadKeys();
    } catch (error) {
      const message = apiErrorDetail(error, 'Could not create API key');
      setKeyError(message);
      showErrorToast(message);
    } finally {
      setSavingKey(false);
    }
  }

  function openHookForm(row?: WebhookEndpoint) {
    setHookError(null);
    setEditingHook(row ?? null);
    setHookUrl(row?.url ?? '');
    setHookDescription(row?.description ?? '');
    setHookAll(row?.events?.length === 1 && row.events[0] === '*');
    setHookEvents(row && !(row.events.length === 1 && row.events[0] === '*') ? row.events : []);
    setShowHookForm(true);
  }

  async function submitHook(event: FormEvent) {
    event.preventDefault();
    const urlError = webhookUrlError(hookUrl.trim());
    if (urlError) {
      setHookError(urlError);
      return;
    }
    const events = hookAll ? ['*'] : hookEvents;
    if (events.length === 0) {
      setHookError('Select at least one event, or choose All events.');
      return;
    }
    setSavingHook(true);
    setHookError(null);
    try {
      if (editingHook) {
        await updateWebhook(editingHook.id, {
          url: hookUrl.trim(),
          events,
          description: hookDescription.trim() || null,
        });
        showToast('Webhook updated');
      } else {
        const created = await createWebhook({
          url: hookUrl.trim(),
          events,
          description: hookDescription.trim() || undefined,
        });
        if (created.secret) {
          setSecretTitle('Webhook secret');
          setSecret(created.secret);
        }
      }
      setShowHookForm(false);
      await loadHooks();
    } catch (error) {
      const message = apiErrorDetail(error, 'Could not save webhook');
      setHookError(message);
      showErrorToast(message);
    } finally {
      setSavingHook(false);
    }
  }

  async function refreshDeliveries(row: WebhookEndpoint, status: DeliveryFilter) {
    setDeliveryLoading(true);
    try {
      setDeliveries(await listWebhookDeliveries(row.id, status || undefined));
    } catch (error) {
      fail(error, 'Could not load deliveries');
    } finally {
      setDeliveryLoading(false);
    }
  }

  const importable = csvEntity !== 'chart_of_accounts';

  return (
    <div className="max-w-[1500px] mx-auto space-y-6 pb-16">
      <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm">
        <h1 className="text-2xl font-black text-redwood-text-main tracking-tight">Integrations</h1>
        <p className="text-sm text-redwood-text-muted mt-1">API keys, webhooks, and CSV import for this company.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {([
          ['keys', 'API Keys'],
          ['webhooks', 'Webhooks'],
          ['csv', 'Import / Export'],
          ['docs', 'API Docs'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-sm border ${tab === id ? 'bg-redwood-brand text-white border-redwood-brand' : 'bg-white text-redwood-text-muted border-redwood-border'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'keys' && (
        <section className="bg-white border border-redwood-border rounded-sm p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-black text-redwood-text-main">API Keys</h2>
            <button type="button" className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-redwood-brand text-white rounded-sm" onClick={() => { setKeyError(null); setShowCreateKey(true); }}>
              Create API key
            </button>
          </div>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-redwood-text-muted"><Loader2 className="animate-spin" size={16} /> Loading API keys…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-redwood-text-muted">No API keys yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-redwood-text-muted uppercase tracking-widest">
                    <th className="p-2">Name</th>
                    <th className="p-2">Prefix</th>
                    <th className="p-2">Scopes</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Created</th>
                    <th className="p-2">Last used</th>
                    <th className="p-2">Expires</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((row) => {
                    const status = apiKeyStatus(row);
                    return (
                      <tr key={row.id} className="border-t border-redwood-border">
                        <td className="p-2">{row.name}</td>
                        <td className="p-2 font-mono">{row.prefix}</td>
                        <td className="p-2"><ScopeBadges scopes={row.scopes || []} /></td>
                        <td className="p-2">{row.role || '—'}</td>
                        <td className="p-2">{when(row.created_at)}</td>
                        <td className="p-2">{row.last_used_at ? when(row.last_used_at) : 'never'}</td>
                        <td className="p-2">{row.expires_at ? when(row.expires_at) : 'Never'}</td>
                        <td className="p-2">{status}</td>
                        <td className="p-2 space-x-2">
                          {status !== 'Revoked' && (
                            <>
                              <button
                                type="button"
                                className="underline"
                                onClick={() => {
                                  if (!window.confirm(`Rotate ${row.name}? The current key stops working.`)) return;
                                  void rotateApiKey(row.id)
                                    .then((created) => {
                                      setSecretTitle('API key');
                                      setSecret(created.raw_key);
                                      return loadKeys();
                                    })
                                    .catch((error) => fail(error, 'Could not rotate API key'));
                                }}
                              >
                                Rotate
                              </button>
                              <button
                                type="button"
                                className="underline text-red-700"
                                onClick={() => {
                                  if (!window.confirm(`Revoke ${row.name}? This cannot be undone.`)) return;
                                  void revokeApiKey(row.id)
                                    .then(() => loadKeys())
                                    .catch((error) => fail(error, 'Could not revoke API key'));
                                }}
                              >
                                Revoke
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'webhooks' && (
        <section className="bg-white border border-redwood-border rounded-sm p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-black text-redwood-text-main">Webhooks</h2>
            <button type="button" className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-redwood-brand text-white rounded-sm" onClick={() => openHookForm()}>
              Add endpoint
            </button>
          </div>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-redwood-text-muted"><Loader2 className="animate-spin" size={16} /> Loading webhooks…</p>
          ) : hooks.length === 0 ? (
            <p className="text-sm text-redwood-text-muted">No webhook endpoints yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-redwood-text-muted uppercase tracking-widest">
                    <th className="p-2">URL</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Events</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Failures</th>
                    <th className="p-2">Secret prefix</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hooks.map((row) => (
                    <tr key={row.id} className="border-t border-redwood-border align-top">
                      <td className="p-2 break-all">{row.url}</td>
                      <td className="p-2">{row.description || '—'}</td>
                      <td className="p-2">{row.events.length === 1 && row.events[0] === '*' ? 'All events' : <ScopeBadges scopes={row.events} />}</td>
                      <td className="p-2">
                        {row.is_active ? 'Active' : `Disabled${row.disabled_at ? ` ${when(row.disabled_at)}` : ''}`}
                      </td>
                      <td className="p-2">{row.failure_count}</td>
                      <td className="p-2 font-mono">{row.secret_prefix}</td>
                      <td className="p-2 space-y-1">
                        <button type="button" className="block underline" onClick={() => {
                          void testWebhook(row.id)
                            .then((result) => showToast(`Test ${result.status} / ${result.response_status ?? '—'} ${result.error ?? ''}`.trim()))
                            .catch((error) => fail(error, 'Webhook test failed'));
                        }}>Send test</button>
                        <button type="button" className="block underline" onClick={() => {
                          void updateWebhook(row.id, { is_active: !row.is_active })
                            .then(() => loadHooks())
                            .catch((error) => fail(error, 'Could not update webhook'));
                        }}>{row.is_active ? 'Disable' : 'Enable'}</button>
                        <button type="button" className="block underline" onClick={() => openHookForm(row)}>Edit</button>
                        <button type="button" className="block underline" onClick={() => {
                          if (!window.confirm('Rotate this webhook secret?')) return;
                          void rotateWebhookSecret(row.id)
                            .then((rotated) => {
                              setSecretTitle('Webhook secret');
                              setSecret(rotated.secret);
                              return loadHooks();
                            })
                            .catch((error) => fail(error, 'Could not rotate secret'));
                        }}>Rotate secret</button>
                        <button type="button" className="block underline text-red-700" onClick={() => {
                          if (!window.confirm('Delete this webhook endpoint?')) return;
                          void deleteWebhook(row.id).then(() => loadHooks()).catch((error) => fail(error, 'Could not delete webhook'));
                        }}>Delete</button>
                        <button type="button" className="block underline" onClick={() => {
                          setDeliveryHook(row);
                          setDeliveryFilter('');
                          void refreshDeliveries(row, '');
                        }}>View deliveries</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'csv' && (
        <section className="bg-white border border-redwood-border rounded-sm p-4 space-y-4">
          <h2 className="font-black text-redwood-text-main">Import / Export</h2>
          <label className="block text-xs font-bold uppercase tracking-widest text-redwood-text-muted">
            Entity
            <select
              aria-label="Entity"
              className="mt-1 block w-full max-w-sm border border-redwood-border rounded-sm px-3 py-2 text-sm text-redwood-text-main"
              value={csvEntity}
              onChange={(event) => {
                setCsvEntity(event.target.value as CsvExportEntity);
                setCsvResult(null);
                setCsvError(null);
                setCsvFile(null);
              }}
            >
              {CSV_EXPORT_ENTITIES.map((entity) => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="px-3 py-2 text-xs font-bold uppercase tracking-widest border border-redwood-border rounded-sm" onClick={() => {
              void downloadCsvTemplate(csvEntity).then(() => showToast('Template downloaded')).catch((error) => {
                const message = apiErrorDetail(error, 'Could not download template');
                setCsvError(message);
                showErrorToast(message);
              });
            }}>Download template</button>
            <button type="button" className="px-3 py-2 text-xs font-bold uppercase tracking-widest border border-redwood-border rounded-sm" onClick={() => {
              void downloadCsvExport(csvEntity).then(() => showToast('Export downloaded')).catch((error) => {
                const message = apiErrorDetail(error, 'Could not export CSV');
                setCsvError(message);
                showErrorToast(message);
              });
            }}>Export CSV</button>
          </div>
          {importable ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-widest text-redwood-text-muted">
                CSV file
                <input
                  aria-label="CSV file"
                  type="file"
                  accept=".csv,text/csv"
                  className="mt-1 block text-sm"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file && file.size > MAX_CSV_BYTES) {
                      setCsvError('File must be 5 MB or smaller.');
                      setCsvFile(null);
                      return;
                    }
                    setCsvError(null);
                    setCsvFile(file);
                  }}
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-widest text-redwood-text-muted">
                Source system
                <input
                  aria-label="Source system"
                  className="mt-1 block w-full max-w-sm border border-redwood-border rounded-sm px-3 py-2 text-sm"
                  value={csvSystem}
                  onChange={(event) => setCsvSystem(event.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={csvRunning || !csvFile}
                className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-redwood-brand text-white rounded-sm disabled:opacity-50"
                onClick={() => {
                  if (!csvFile) return;
                  setCsvRunning(true);
                  setCsvError(null);
                  void importCsv(csvEntity, csvFile, csvSystem.trim() || 'external')
                    .then((result) => {
                      setCsvResult(result);
                      showToast('Import finished');
                    })
                    .catch((error) => {
                      const message = apiErrorDetail(error, 'Import failed');
                      setCsvError(message);
                      showErrorToast(message);
                    })
                    .finally(() => setCsvRunning(false));
                }}
              >
                {csvRunning ? 'Importing…' : 'Import'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-redwood-text-muted">chart_of_accounts can be exported. Import is not available.</p>
          )}
          {csvError && <p className="text-sm text-red-700">{csvError}</p>}
          {csvResult && <ImportResultTable result={csvResult} />}
          <p className="sr-only">{CSV_IMPORT_ENTITIES.join(' ')}</p>
        </section>
      )}

      {tab === 'docs' && (
        <section className="bg-white border border-redwood-border rounded-sm p-4 space-y-3 text-sm text-redwood-text-main">
          <h2 className="font-black">API Docs</h2>
          <p>Base URL {apiDocsUrl().replace(/\/docs$/, '')}. Send Authorization: Bearer sk_live_…</p>
          <p>Rate-limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After.</p>
          <p>Money writes require an Idempotency-Key header on every request.</p>
          <div>
            <p className="font-bold">Events</p>
            {eventTypes.length === 0 ? (
              <p className="text-redwood-text-muted">No event types loaded.</p>
            ) : (
              <ul className="list-disc pl-5">
                {eventTypes.map((name) => <li key={name}>{name}</li>)}
              </ul>
            )}
          </div>
          <a className="inline-block px-3 py-2 text-xs font-bold uppercase tracking-widest bg-redwood-brand text-white rounded-sm" href={apiDocsUrl()} target="_blank" rel="noreferrer">
            Open API docs
          </a>
        </section>
      )}

      {showCreateKey && (
        <ModalFrame title="Create API key" onClose={() => setShowCreateKey(false)}>
          <form className="space-y-4" onSubmit={(event) => { void submitKey(event); }}>
            <label className="block text-xs font-bold uppercase tracking-widest text-redwood-text-muted">
              Name
              <input
                aria-label="API key name"
                required
                maxLength={120}
                className="mt-1 block w-full border border-redwood-border rounded-sm px-3 py-2 text-sm"
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-redwood-text-muted">
              Expiry
              <select aria-label="Expiry" className="mt-1 block w-full border border-redwood-border rounded-sm px-3 py-2 text-sm" value={keyExpiry} onChange={(event) => setKeyExpiry(event.target.value)}>
                <option value="never">Never</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">365 days</option>
              </select>
            </label>
            <ScopePicker selected={keyScopes} onChange={setKeyScopes} />
            {keyError && <p className="text-sm text-red-700">{keyError}</p>}
            <button type="submit" disabled={savingKey || keyScopes.length === 0} className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-redwood-brand text-white rounded-sm disabled:opacity-50">
              {savingKey ? 'Creating…' : 'Create'}
            </button>
          </form>
        </ModalFrame>
      )}

      {showHookForm && (
        <ModalFrame title={editingHook ? 'Edit endpoint' : 'Add endpoint'} onClose={() => setShowHookForm(false)}>
          <form className="space-y-4" onSubmit={(event) => { void submitHook(event); }}>
            <label className="block text-xs font-bold uppercase tracking-widest text-redwood-text-muted">
              URL
              <input aria-label="Webhook URL" className="mt-1 block w-full border border-redwood-border rounded-sm px-3 py-2 text-sm" value={hookUrl} onChange={(event) => setHookUrl(event.target.value)} />
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-redwood-text-muted">
              Description
              <input aria-label="Webhook description" className="mt-1 block w-full border border-redwood-border rounded-sm px-3 py-2 text-sm" value={hookDescription} onChange={(event) => setHookDescription(event.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hookAll} onChange={(event) => setHookAll(event.target.checked)} />
              All events
            </label>
            {!hookAll && (
              <div className="flex flex-wrap gap-3">
                {eventTypes.map((name) => (
                  <label key={name} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={hookEvents.includes(name)}
                      onChange={(event) => {
                        setHookEvents(event.target.checked ? [...hookEvents, name] : hookEvents.filter((item) => item !== name));
                      }}
                    />
                    {name}
                  </label>
                ))}
              </div>
            )}
            {hookError && <p className="text-sm text-red-700">{hookError}</p>}
            <button type="submit" disabled={savingHook} className="px-3 py-2 text-xs font-bold uppercase tracking-widest bg-redwood-brand text-white rounded-sm disabled:opacity-50">
              {savingHook ? 'Saving…' : 'Save'}
            </button>
          </form>
        </ModalFrame>
      )}

      {deliveryHook && (
        <ModalFrame title="Deliveries" onClose={() => setDeliveryHook(null)}>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-xs font-bold uppercase tracking-widest text-redwood-text-muted">
              Status
              <select
                aria-label="Delivery status"
                className="ml-2 border border-redwood-border rounded-sm px-2 py-1 text-sm"
                value={deliveryFilter}
                onChange={(event) => {
                  const next = event.target.value as DeliveryFilter;
                  setDeliveryFilter(next);
                  void refreshDeliveries(deliveryHook, next);
                }}
              >
                <option value="">All</option>
                <option value="pending">pending</option>
                <option value="delivered">delivered</option>
                <option value="failed">failed</option>
                <option value="dead">dead</option>
              </select>
            </label>
            <button type="button" className="underline text-xs" onClick={() => { void refreshDeliveries(deliveryHook, deliveryFilter); }}>Refresh</button>
          </div>
          {deliveryLoading ? (
            <p className="text-sm text-redwood-text-muted">Loading deliveries…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-redwood-text-muted">No deliveries.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="p-2">Event</th>
                  <th className="p-2">Attempt</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Response</th>
                  <th className="p-2">Error</th>
                  <th className="p-2">Next attempt</th>
                  <th className="p-2">Delivered</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {deliveries.map((row) => {
                  const excerpt = row.error || row.response_excerpt || '';
                  const open = expandedDelivery === row.id;
                  return (
                    <tr key={row.id} className="border-t border-redwood-border align-top">
                      <td className="p-2">{row.event_type}</td>
                      <td className="p-2">{row.attempt}</td>
                      <td className="p-2">{row.status}</td>
                      <td className="p-2">{row.response_status ?? '—'}</td>
                      <td className="p-2">
                        <button type="button" className="underline" onClick={() => setExpandedDelivery(open ? null : row.id)}>
                          {open ? excerpt || '—' : (excerpt.slice(0, 80) || '—')}
                        </button>
                      </td>
                      <td className="p-2">{when(row.next_attempt_at)}</td>
                      <td className="p-2">{when(row.delivered_at)}</td>
                      <td className="p-2">
                        {(row.status === 'failed' || row.status === 'dead') && (
                          <button type="button" className="underline" onClick={() => {
                            void retryWebhookDelivery(row.id)
                              .then(() => refreshDeliveries(deliveryHook, deliveryFilter))
                              .catch((error) => fail(error, 'Could not retry delivery'));
                          }}>Retry</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ModalFrame>
      )}

      {secret && (
        <OneTimeSecretModal
          value={secret}
          title={secretTitle}
          showSignatureHelp={secretTitle === 'Webhook secret'}
          onClose={closeSecret}
        />
      )}
    </div>
  );
}
