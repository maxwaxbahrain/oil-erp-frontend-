import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Copy,
  Download,
  MessageSquare,
  Printer,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import AutoGrowTextarea from '../../components/AutoGrowTextarea';
import {
  createCollectionsLog,
  deleteManualCreditHold,
  downloadCollectionsCsv,
  getCollectionsReport,
  getCollectionsSettings,
  getManualCreditHolds,
  isValidManualHoldReason,
  listCollectionsLog,
  putManualCreditHold,
  updateCollectionsSettings,
  type CollectionsLogEntry,
  type CollectionsReport,
  type CollectionsRow,
  type CollectionsSettings,
  type ManualCreditHoldRow,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { searchCustomers, type Customer } from '../../services/customerService';
import { MANAGEMENT_ROLES } from '../../utils/rbac';
import { formatCurrency, formatDateOnly, formatDateTime } from '../../utils/formatters';

export type GroupFilter = 1 | 2 | 3 | null;

export const GROUP_CARD_META: Record<1 | 2 | 3, { title: string; subtitle: string }> = {
  1: { title: 'Still ordering', subtitle: 'cash on delivery' },
  2: { title: 'Recently quiet', subtitle: 'call this week' },
  3: { title: 'Old', subtitle: 'one round, then decide' },
};

export const GROUP_PILL_CLASS: Record<1 | 2 | 3, string> = {
  1: 'bg-rose-100 text-rose-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-gray-100 text-gray-600',
};

export function filterRowsByGroup<T extends { group: number }>(
  rows: T[],
  filter: GroupFilter,
): T[] {
  if (filter === null) return rows;
  return rows.filter((r) => r.group === filter);
}

export function group1Rows<T extends { group: number }>(rows: T[]): T[] {
  return rows.filter((r) => r.group === 1);
}

const LOAD_ERROR = "Couldn't load collections. Check your connection and try again.";
const SAVE_ERROR = "Couldn't save settings. Try again.";
const LOG_ERROR = "Couldn't save the log entry. Try again.";
const COPY_ERROR = "Couldn't copy to the clipboard.";

const PROMISED_METHODS = ['Zelle', 'Card', 'Cheque', 'Cash', 'Other'] as const;
const LOG_STATUSES = [
  'Open',
  'Promised',
  'Paid',
  'Plan',
  'Disputed',
  'Final notice',
  'Escalated',
  'Written off',
] as const;

type LogDraft = {
  note: string;
  promised_date: string;
  promised_method: string;
  status: string;
};

const emptyLogDraft = (): LogDraft => ({
  note: '',
  promised_date: '',
  promised_method: '',
  status: 'Open',
});

function GroupPill({ group }: { group: 1 | 2 | 3 }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${GROUP_PILL_CLASS[group]}`}
    >
      {group}
    </span>
  );
}

function SummaryCard({
  group,
  summary,
  active,
  onClick,
}: {
  group: 1 | 2 | 3;
  summary: { customers: number; invoices: number; total: number };
  active: boolean;
  onClick: () => void;
}) {
  const meta = GROUP_CARD_META[group];
  return (
    <button
      type="button"
      aria-label={`Filter group ${group}`}
      aria-pressed={active}
      onClick={onClick}
      className={`text-left bg-white p-5 rounded-2xl border shadow-sm transition-all ${
        active
          ? 'border-gray-900 ring-2 ring-gray-900/10'
          : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">
        Group {group}
      </p>
      <h3 className="text-sm font-black text-gray-900 leading-snug">
        {meta.title}
        <span className="block text-xs font-semibold text-gray-500 normal-case tracking-normal mt-0.5">
          {meta.subtitle}
        </span>
      </h3>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-black text-gray-900">{summary.customers}</p>
          <p className="text-[9px] font-bold uppercase text-gray-400">Customers</p>
        </div>
        <div>
          <p className="text-lg font-black text-gray-900">{summary.invoices}</p>
          <p className="text-[9px] font-bold uppercase text-gray-400">Invoices</p>
        </div>
        <div>
          <p className="text-sm font-black text-gray-900">{formatCurrency(summary.total)}</p>
          <p className="text-[9px] font-bold uppercase text-gray-400">Total</p>
        </div>
      </div>
    </button>
  );
}

function ManualHoldsSection() {
  const { hasRole } = useAuth();
  const [holds, setHolds] = useState<ManualCreditHoldRow[]>([]);
  const [holdsLoading, setHoldsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [reason, setReason] = useState('');
  const [putWarning, setPutWarning] = useState<string | null>(null);
  const [putBusy, setPutBusy] = useState(false);
  const [releaseBusyId, setReleaseBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadHolds = useCallback(async () => {
    setHoldsLoading(true);
    try {
      const rows = await getManualCreditHolds();
      setHolds(rows);
    } catch {
      setHolds([]);
    } finally {
      setHoldsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHolds();
  }, [loadHolds]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearchBusy(true);
      void searchCustomers(q)
        .then((rows) => setSearchResults(rows.slice(0, 10)))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchBusy(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const reasonTrimmed = reason.trim();
  const reasonValid = isValidManualHoldReason(reason);

  const onSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchQuery('');
    setSearchResults([]);
    setPutWarning(null);
  };

  const onPutHold = async () => {
    if (!selectedCustomer || !reasonValid) return;
    setPutBusy(true);
    setPutWarning(null);
    try {
      const resp = await putManualCreditHold(selectedCustomer.id, reasonTrimmed);
      setToast('On hold');
      window.setTimeout(() => setToast(null), 2500);
      if (resp.warning) setPutWarning(resp.warning);
      setReason('');
      setSelectedCustomer(null);
      await loadHolds();
    } catch {
      setToast("Couldn't put customer on hold. Try again.");
      window.setTimeout(() => setToast(null), 2500);
    } finally {
      setPutBusy(false);
    }
  };

  const onRelease = async (row: ManualCreditHoldRow) => {
    if (
      !window.confirm(
        `Release manual credit hold for ${row.name}? They will be able to place credit orders again (unless automatic hold applies).`,
      )
    ) {
      return;
    }
    setReleaseBusyId(row.id);
    try {
      await deleteManualCreditHold(row.id);
      await loadHolds();
    } catch {
      setToast("Couldn't release hold. Try again.");
      window.setTimeout(() => setToast(null), 2500);
    } finally {
      setReleaseBusyId(null);
    }
  };

  if (!hasRole(...MANAGEMENT_ROLES)) return null;

  return (
    <div className="pt-2 border-t border-gray-100 space-y-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Manual holds</p>

      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
          Search customer
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Name or phone…"
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </label>

      {searchBusy && searchQuery.trim().length >= 2 ? (
        <p className="text-xs text-gray-500">Searching…</p>
      ) : null}

      {searchResults.length > 0 ? (
        <ul className="rounded-xl border border-gray-100 divide-y divide-gray-50 max-h-48 overflow-y-auto">
          {searchResults.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => onSelectCustomer(customer)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
              >
                <p className="text-sm font-bold text-gray-900">{customer.name}</p>
                <p className="text-xs text-gray-500">{customer.phone || 'No phone'}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedCustomer ? (
        <div className="rounded-xl border border-gray-100 p-3 space-y-3 bg-gray-50/50">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">{selectedCustomer.name}</p>
              <p className="text-xs text-gray-500">{selectedCustomer.phone || 'No phone'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCustomer(null);
                setReason('');
                setPutWarning(null);
              }}
              className="text-xs font-bold text-gray-500 hover:text-gray-800"
            >
              Clear
            </button>
          </div>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Reason
            </span>
            <AutoGrowTextarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              {reasonTrimmed.length}/255 · minimum 3 characters
            </p>
          </label>
          <button
            type="button"
            disabled={putBusy || !reasonValid}
            onClick={() => void onPutHold()}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:opacity-90 disabled:opacity-50"
          >
            {putBusy ? 'Saving…' : 'Put on hold'}
          </button>
        </div>
      ) : null}

      {putWarning ? (
        <div className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
          <p>{putWarning}</p>
          <button
            type="button"
            onClick={() => setPutWarning(null)}
            className="shrink-0 font-bold text-amber-900 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {toast ? (
        <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {toast}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 text-left border-b border-gray-100">
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                Customer
              </th>
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                Phone
              </th>
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                Reason
              </th>
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                Set by
              </th>
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                Since
              </th>
              <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody>
            {holdsLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : holds.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs text-gray-500">
                  No customers on manual hold.
                </td>
              </tr>
            ) : (
              holds.map((row) => (
                <tr key={row.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 font-bold text-gray-900">{row.name}</td>
                  <td className="px-3 py-2 text-gray-600">{row.phone || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{row.reason}</td>
                  <td className="px-3 py-2 text-gray-600">{row.set_by}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {row.set_at ? formatDateOnly(row.set_at) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={releaseBusyId === row.id}
                      onClick={() => void onRelease(row)}
                      className="px-2.5 py-1 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {releaseBusyId === row.id ? 'Releasing…' : 'Release'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsModal({
  open,
  settings,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  settings: CollectionsSettings;
  saving: boolean;
  onClose: () => void;
  onChange: (next: CollectionsSettings) => void;
  onSave: () => void;
}) {
  if (!open) return null;

  const field = (
    label: string,
    key: keyof CollectionsSettings,
    type: 'text' | 'number' = 'text',
  ) => (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</span>
      <input
        type={type}
        value={settings[key]}
        onChange={(e) =>
          onChange({
            ...settings,
            [key]: type === 'number' ? Number(e.target.value) : e.target.value,
          })
        }
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 print:hidden">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {field('Sender name', 'sender_name')}
          {field('Zelle', 'zelle')}
          {field('Card phone', 'card_phone')}
          {field('Cheque payee', 'cheque_payee')}
          {field('Group 1 days (still ordering)', 'group1_days', 'number')}
          {field('Group 2 days (recently quiet)', 'group2_days', 'number')}
          {field('Minimum balance', 'min_balance', 'number')}
          {field('Late days threshold', 'late_days', 'number')}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Credit hold</p>
            <div className="space-y-2">
              {(
                [
                  ['off', 'Off', 'Off: no checks'],
                  ['warn', 'Warn', 'Warn: allow the order, show a warning, log it'],
                  ['block', 'Block', 'Block: stop credit orders until the balance is cleared; managers can override'],
                ] as const
              ).map(([value, label, description]) => (
                <label
                  key={value}
                  className="flex items-start gap-2 rounded-xl border border-gray-100 px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="credit_hold_mode"
                    checked={(settings.credit_hold_mode ?? 'off') === value}
                    onChange={() => onChange({ ...settings, credit_hold_mode: value })}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    <span className="font-bold text-gray-900">{label}</span>
                    <span className="block text-xs text-gray-500 font-medium">{description}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Hold after (days)
              </span>
              <input
                type="number"
                min={1}
                value={settings.credit_hold_days ?? 45}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    credit_hold_days: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            These details appear in every message and driver line.
          </p>
          <ManualHoldsSection />
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Collections() {
  const [report, setReport] = useState<CollectionsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(null);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<number | null>(null);
  const [logOpenInvoiceId, setLogOpenInvoiceId] = useState<number | null>(null);
  const [logDraft, setLogDraft] = useState<LogDraft>(emptyLogDraft());
  const [logBusy, setLogBusy] = useState(false);
  const [logsByInvoice, setLogsByInvoice] = useState<Record<number, CollectionsLogEntry[]>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<CollectionsSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCollectionsReport();
      setReport(data);
    } catch {
      setError(LOAD_ERROR);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const visibleRows = useMemo(() => {
    if (!report) return [];
    return filterRowsByGroup(report.rows, groupFilter);
  }, [report, groupFilter]);

  const toggleGroupFilter = (group: 1 | 2 | 3) => {
    setGroupFilter((prev) => (prev === group ? null : group));
  };

  const onCopyMessage = async (row: CollectionsRow) => {
    try {
      await navigator.clipboard.writeText(row.statement_message);
      setCopiedInvoiceId(row.invoice_id);
      window.setTimeout(() => setCopiedInvoiceId(null), 2000);
    } catch {
      setError(COPY_ERROR);
    }
  };

  const openLog = (invoiceId: number) => {
    if (logOpenInvoiceId === invoiceId) {
      setLogOpenInvoiceId(null);
      return;
    }
    setLogOpenInvoiceId(invoiceId);
    setLogDraft(emptyLogDraft());
  };

  const submitLog = async (row: CollectionsRow) => {
    const note = logDraft.note.trim();
    if (!note) return;
    setLogBusy(true);
    setError(null);
    try {
      await createCollectionsLog({
        invoice_id: row.invoice_id,
        note,
        promised_date: logDraft.promised_date || null,
        promised_method: logDraft.promised_method || null,
        status: logDraft.status || null,
      });
      const entries = await listCollectionsLog(row.invoice_id);
      setLogsByInvoice((prev) => ({ ...prev, [row.invoice_id]: entries.slice(0, 3) }));
      setLogOpenInvoiceId(null);
      setLogDraft(emptyLogDraft());
    } catch {
      setError(LOG_ERROR);
    } finally {
      setLogBusy(false);
    }
  };

  const openSettings = async () => {
    setError(null);
    try {
      const settings = await getCollectionsSettings();
      setSettingsDraft(settings);
      setSettingsOpen(true);
    } catch {
      setError(LOAD_ERROR);
    }
  };

  const saveSettings = async () => {
    if (!settingsDraft) return;
    setSettingsSaving(true);
    setError(null);
    try {
      await updateCollectionsSettings(settingsDraft);
      setSettingsOpen(false);
      setSettingsDraft(null);
      await fetchReport();
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setSettingsSaving(false);
    }
  };

  const onDownloadCsv = async () => {
    setCsvBusy(true);
    setError(null);
    try {
      await downloadCollectionsCsv(report?.as_of);
    } catch {
      setError("Couldn't download CSV. Try again.");
    } finally {
      setCsvBusy(false);
    }
  };

  const emptyReport = !loading && report && report.rows.length === 0;

  return (
    <div className="space-y-5 max-w-[1100px] mx-auto pb-10 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase flex items-center gap-2">
              <MessageSquare size={24} className="text-gray-700" />
              Collections
            </h1>
            {report && (
              <p className="text-sm text-gray-500 mt-1">
                As of {formatDateTime(report.as_of)} ·{' '}
                <span className="font-bold text-gray-900">{formatCurrency(report.total)}</span>{' '}
                outstanding
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              disabled={csvBusy || loading}
              onClick={() => void onDownloadCsv()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download size={14} />
              {csvBusy ? 'Downloading…' : 'Download CSV'}
            </button>
            <Link
              to="/finance/collections/driver"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              <Printer size={14} />
              Driver list
            </Link>
            <button
              type="button"
              onClick={() => void openSettings()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:opacity-90"
            >
              <Settings size={14} />
              Settings
            </button>
            <button
              type="button"
              onClick={() => void fetchReport()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2 shadow-sm">
          <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([1, 2, 3] as const).map((g) => (
            <SummaryCard
              key={g}
              group={g}
              summary={report.groups[g]}
              active={groupFilter === g}
              onClick={() => toggleGroupFilter(g)}
            />
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading && (
          <div className="p-10 text-center text-sm font-medium text-gray-400">Loading…</div>
        )}

        {emptyReport && (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              No invoices past your late threshold. Adjust the threshold in Settings if that looks
              wrong.
            </p>
          </div>
        )}

        {!loading && report && report.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Group
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Invoice #
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Days unpaid
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Outstanding
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Last order
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400 min-w-[180px]">
                    Action
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400 print:hidden">
                    &nbsp;
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <Fragment key={row.invoice_id}>
                    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <GroupPill group={row.group} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900">{row.customer_name}</p>
                        {row.phone_missing ? (
                          <span className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-700">
                            No phone
                          </span>
                        ) : (
                          <p className="text-xs text-gray-500">{row.customer_phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-700">{row.days_unpaid}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {formatCurrency(row.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDateOnly(row.last_order)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 leading-snug">{row.action}</td>
                      <td className="px-4 py-3 print:hidden">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => void onCopyMessage(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                          >
                            <Copy size={12} />
                            {copiedInvoiceId === row.invoice_id ? 'Copied' : 'Copy message'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openLog(row.invoice_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                          >
                            Log
                          </button>
                        </div>
                      </td>
                    </tr>
                    {logOpenInvoiceId === row.invoice_id && (
                      <tr className="bg-gray-50/80">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="max-w-xl space-y-3">
                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                Note *
                              </span>
                              <AutoGrowTextarea
                                value={logDraft.note}
                                onChange={(e) =>
                                  setLogDraft((d) => ({ ...d, note: e.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                              />
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <label className="block">
                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                  Promised date
                                </span>
                                <input
                                  type="date"
                                  value={logDraft.promised_date}
                                  onChange={(e) =>
                                    setLogDraft((d) => ({ ...d, promised_date: e.target.value }))
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="block">
                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                  Promised method
                                </span>
                                <select
                                  value={logDraft.promised_method}
                                  onChange={(e) =>
                                    setLogDraft((d) => ({ ...d, promised_method: e.target.value }))
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                >
                                  <option value="">—</option>
                                  {PROMISED_METHODS.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                  Status
                                </span>
                                <select
                                  value={logDraft.status}
                                  onChange={(e) =>
                                    setLogDraft((d) => ({ ...d, status: e.target.value }))
                                  }
                                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                >
                                  {LOG_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <button
                              type="button"
                              disabled={logBusy || !logDraft.note.trim()}
                              onClick={() => void submitLog(row)}
                              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:opacity-90 disabled:opacity-50"
                            >
                              {logBusy ? 'Saving…' : 'Save log'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {(logsByInvoice[row.invoice_id]?.length ?? 0) > 0 && (
                      <tr className="bg-white">
                        <td colSpan={8} className="px-4 pb-3 pt-0">
                          <div className="ml-2 pl-3 border-l-2 border-gray-100 space-y-1">
                            {logsByInvoice[row.invoice_id].map((entry) => (
                              <p key={entry.id} className="text-xs text-gray-500">
                                <span className="font-bold text-gray-700">{entry.note}</span>
                                {entry.status ? ` · ${entry.status}` : ''}
                                {entry.created_at
                                  ? ` · ${formatDateTime(entry.created_at)}`
                                  : ''}
                              </p>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {settingsDraft && (
        <SettingsModal
          open={settingsOpen}
          settings={settingsDraft}
          saving={settingsSaving}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsDraft(null);
          }}
          onChange={setSettingsDraft}
          onSave={() => void saveSettings()}
        />
      )}
    </div>
  );
}
