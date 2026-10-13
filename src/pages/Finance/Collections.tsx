import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardList,
  Copy,
  Download,
  PhoneOff,
  Printer,
  Receipt,
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
import { formatCurrency, formatDateOnly, formatDateTime, parseApiDateTime, parseDateOnlyLocal } from '../../utils/formatters';

export type GroupFilter = 1 | 2 | 3 | 4 | null;
export type CollectionsScope = 'all' | 'late';

export const GROUP_CARD_META: Record<1 | 2 | 3 | 4, { title: string; subtitle: string }> = {
  1: { title: 'Still ordering', subtitle: 'cash on delivery' },
  2: { title: 'Recently quiet', subtitle: 'call this week' },
  3: { title: 'Old', subtitle: 'one round, then decide' },
  4: { title: 'Not late yet', subtitle: 'no action yet' },
};

export const GROUP_PILL_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: 'collections-pill-green',
  2: 'collections-pill-amber',
  3: 'collections-pill-red',
  4: 'collections-pill-neutral',
};

const GROUP_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: 'var(--color-brand-green)',
  2: 'var(--color-brand-amber)',
  3: 'var(--color-brand-red)',
  4: 'var(--color-redwood-text-muted)',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export type DaysBand = 'neutral' | 'amber' | 'orange' | 'red';

export function daysBand(days: number): DaysBand {
  if (days <= 30) return 'neutral';
  if (days <= 60) return 'amber';
  if (days <= 90) return 'orange';
  return 'red';
}

const DAYS_CHIP_STYLE: Record<DaysBand, { background: string; color: string }> = {
  neutral: { background: 'rgba(255,255,255,0.08)', color: 'var(--color-redwood-text-muted)' },
  amber: { background: 'rgba(245,158,11,0.16)', color: 'var(--color-brand-amber)' },
  orange: {
    background: 'color-mix(in srgb, var(--color-brand-amber) 22%, transparent)',
    color: 'color-mix(in srgb, var(--color-brand-amber) 40%, var(--color-brand-red))',
  },
  red: { background: 'rgba(239,68,68,0.16)', color: 'var(--color-brand-red)' },
};

export function formatPhoneDisplay(stored: string | null | undefined): { text: string; href: string | null } {
  const raw = stored ?? '';
  const digits = raw.replace(/\D/g, '');
  let national = '';
  if (digits.length === 10) national = digits;
  else if (digits.length === 11 && digits.startsWith('1')) national = digits.slice(1);
  if (!national) {
    const trimmed = raw.trim();
    return { text: raw, href: trimmed ? `tel:${trimmed}` : null };
  }
  const text = `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  return { text, href: `tel:+1${national}` };
}

export function formatLastOrder(value: string | null | undefined, currentYear = new Date().getFullYear()): string {
  const parsed = parseDateOnlyLocal(value);
  if (!parsed) return value ?? '';
  const label = `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}`;
  if (parsed.getFullYear() === currentYear) return label;
  return `${label}, ${parsed.getFullYear()}`;
}

export function formatUpdatedLabel(iso: string | null | undefined): string {
  const parsed = parseApiDateTime(iso);
  if (!parsed) return '';
  const formatted = parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Updated ${formatted}`;
}

export type CollectionSortKey = 'customer' | 'group' | 'invoice' | 'days' | 'outstanding' | 'last_order' | 'action';

export function sortCollectionRows(
  rows: CollectionsRow[],
  key: CollectionSortKey,
  direction: 'asc' | 'desc',
): CollectionsRow[] {
  const factor = direction === 'asc' ? 1 : -1;
  const valueOf = (row: CollectionsRow): string | number => {
    if (key === 'customer') return row.customer_name.toLowerCase();
    if (key === 'group') return row.group;
    if (key === 'invoice') return row.invoice_number.toLowerCase();
    if (key === 'days') return row.days_unpaid;
    if (key === 'outstanding') return row.outstanding;
    if (key === 'last_order') return row.last_order || '';
    return row.action.toLowerCase();
  };
  return [...rows].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    if (left < right) return -1 * factor;
    if (left > right) return 1 * factor;
    return a.invoice_id - b.invoice_id;
  });
}

const toolButtonClass =
  'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-redwood-border px-3 text-sm text-redwood-text-main hover:bg-white/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-blue)]';

const actionButtonClass =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-redwood-border px-3 text-sm text-redwood-text-main hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-blue)]';

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

function LogEditor({
  draft,
  busy,
  onChange,
  onSave,
}: {
  draft: LogDraft;
  busy: boolean;
  onChange: (next: LogDraft) => void;
  onSave: () => void;
}) {
  return (
    <div className="max-w-xl space-y-3">
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Note *</span>
        <AutoGrowTextarea
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Promised date</span>
          <input
            type="date"
            value={draft.promised_date}
            onChange={(e) => onChange({ ...draft, promised_date: e.target.value })}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Promised method</span>
          <select
            value={draft.promised_method}
            onChange={(e) => onChange({ ...draft, promised_method: e.target.value })}
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
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Status</span>
          <select
            value={draft.status}
            onChange={(e) => onChange({ ...draft, status: e.target.value })}
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
        disabled={busy || !draft.note.trim()}
        onClick={onSave}
        className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save log'}
      </button>
    </div>
  );
}

function LogLines({ entries }: { entries: CollectionsLogEntry[] }) {
  if (!entries.length) return null;
  return (
    <div className="ml-2 space-y-1 border-l-2 border-gray-100 pl-3">
      {entries.map((entry) => (
        <p key={entry.id} className="text-xs text-gray-500">
          <span className="font-bold text-gray-700">{entry.note}</span>
          {entry.status ? ` · ${entry.status}` : ''}
          {entry.created_at ? ` · ${formatDateTime(entry.created_at)}` : ''}
        </p>
      ))}
    </div>
  );
}

function DataProblemNote({ reason }: { reason?: string | null }) {
  if (!reason) return null;
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--color-brand-amber)]">
      <AlertTriangle size={12} aria-hidden="true" />
      {reason}
    </span>
  );
}

function GroupPill({ group }: { group: 1 | 2 | 3 | 4 }) {
  return (
    <span
      className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${GROUP_PILL_CLASS[group]}`}
      style={{
        color: GROUP_COLOR[group],
        background: `color-mix(in srgb, ${GROUP_COLOR[group]} 16%, transparent)`,
      }}
    >
      {GROUP_CARD_META[group].title}
    </span>
  );
}

function DaysChip({ days }: { days: number }) {
  const band = daysBand(days);
  return (
    <span
      data-days-band={band}
      className="inline-flex min-w-8 justify-end rounded-md px-1.5 py-0.5 text-sm tabular-nums"
      style={DAYS_CHIP_STYLE[band]}
    >
      {days}
    </span>
  );
}

function PhoneLine({ row }: { row: CollectionsRow }) {
  if (row.phone_missing) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-redwood-text-muted">
        <PhoneOff size={12} aria-hidden="true" />
        No phone on file
      </span>
    );
  }
  const phone = formatPhoneDisplay(row.customer_phone);
  if (!phone.href) return null;
  return (
    <a href={phone.href} className="mt-0.5 block text-xs text-redwood-text-muted underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-blue)]">
      {phone.text}
    </a>
  );
}

function SummaryCard({
  group,
  summary,
  active,
  onClick,
}: {
  group: 1 | 2 | 3 | 4;
  summary: { customers: number; invoices: number; total: number };
  active: boolean;
  onClick: () => void;
}) {
  const meta = GROUP_CARD_META[group];
  const quiet = summary.customers === 0 && summary.invoices === 0 && summary.total === 0;
  return (
    <button
      type="button"
      aria-label={`Filter group ${group}`}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-2xl border border-redwood-border bg-redwood-bg-surface p-4 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-blue)] ${
        quiet ? 'opacity-60' : ''
      } ${active ? 'ring-2 ring-white/20' : ''}`}
      style={{ borderLeftWidth: 3, borderLeftColor: GROUP_COLOR[group] }}
    >
      <h3 className="text-sm font-semibold text-redwood-text-main">{meta.title}</h3>
      <p className="mt-0.5 text-xs text-redwood-text-muted">{meta.subtitle}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-redwood-text-main">{formatCurrency(summary.total)}</p>
      <p className="mt-1 flex items-baseline gap-3 text-sm text-redwood-text-muted">
        <span>{summary.customers} Customers</span>
        <span>{summary.invoices} Invoices</span>
      </p>
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
  const [scope, setScope] = useState<CollectionsScope>('all');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(null);
  const [sortKey, setSortKey] = useState<CollectionSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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
      const data = await getCollectionsReport(undefined, scope);
      setReport(data);
    } catch {
      setError(LOAD_ERROR);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const visibleRows = useMemo(() => {
    if (!report) return [];
    const filtered = filterRowsByGroup(report.rows, groupFilter);
    if (!sortKey) return filtered;
    return sortCollectionRows(filtered, sortKey, sortDirection);
  }, [report, groupFilter, sortKey, sortDirection]);

  const toggleSort = (key: CollectionSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const toggleGroupFilter = (group: 1 | 2 | 3 | 4) => {
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

  const visibleGroups = scope === 'all' ? ([1, 2, 3, 4] as const) : ([1, 2, 3] as const);
  const chooseScope = (next: CollectionsScope) => {
    setScope(next);
    setGroupFilter(null);
    setSortKey(null);
    setSortDirection('asc');
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
      <div className="inline-flex rounded-lg border border-redwood-border p-0.5" role="group" aria-label="Collections scope">
        <button
          type="button"
          aria-pressed={scope === 'all'}
          onClick={() => chooseScope('all')}
          className={`h-9 rounded-md px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-blue)] ${
            scope === 'all' ? 'bg-white/10 text-redwood-text-main' : 'text-redwood-text-muted hover:bg-white/5'
          }`}
        >
          All outstanding
        </button>
        <button
          type="button"
          aria-pressed={scope === 'late'}
          onClick={() => chooseScope('late')}
          className={`h-9 rounded-md px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-blue)] ${
            scope === 'late' ? 'bg-white/10 text-redwood-text-main' : 'text-redwood-text-muted hover:bg-white/5'
          }`}
        >
          Late only
        </button>
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border border-redwood-border bg-redwood-bg-surface p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-redwood-text-main">
            <Receipt size={22} aria-hidden="true" />
            Collections
          </h1>
          {report && (
            <>
              <p className="mt-2 text-4xl font-semibold tabular-nums text-redwood-text-main">{formatCurrency(report.total)}</p>
              <p className="mt-1 text-xs text-redwood-text-muted">{formatUpdatedLabel(report.as_of)}</p>
              <div className="mt-3">
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                  {visibleGroups.map((group) => {
                    const share = report.total > 0 ? ((report.groups[group]?.total ?? 0) / report.total) * 100 : 0;
                    if (share <= 0) return null;
                    return <span key={group} style={{ width: `${share}%`, background: GROUP_COLOR[group] }} />;
                  })}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-redwood-text-muted">
                  {visibleGroups.map((group) => (
                    <li key={group} className="inline-flex items-center gap-1.5">
                      <i className="inline-block h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[group] }} />
                      {GROUP_CARD_META[group].title}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            disabled={csvBusy || loading}
            onClick={() => void onDownloadCsv()}
            className={toolButtonClass}
          >
            <Download size={14} />
            {csvBusy ? 'Downloading…' : 'Download CSV'}
          </button>
          <Link to="/finance/collections/driver" className={toolButtonClass}>
            <Printer size={14} />
            Print driver list
          </Link>
          <button type="button" onClick={() => void openSettings()} className={toolButtonClass}>
            <Settings size={14} />
            Settings
          </button>
          <button type="button" onClick={() => void fetchReport()} disabled={loading} className={toolButtonClass}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2 shadow-sm">
          <AlertTriangle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {report && (
        <div className={`grid grid-cols-1 gap-4 ${scope === 'all' ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
          {visibleGroups.map((g) => (
            <SummaryCard
              key={g}
              group={g}
              summary={report.groups[g] ?? { customers: 0, invoices: 0, total: 0 }}
              active={groupFilter === g}
              onClick={() => toggleGroupFilter(g)}
            />
          ))}
        </div>
      )}

      {groupFilter && (
        <p className="flex items-center gap-2 text-sm text-redwood-text-main">
          Showing: {GROUP_CARD_META[groupFilter].title}
          <button
            type="button"
            onClick={() => setGroupFilter(null)}
            className="rounded-lg border border-redwood-border px-2 py-1 text-xs text-redwood-text-muted hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-blue)]"
          >
            Clear filter
          </button>
        </p>
      )}

      <div className="rounded-2xl border border-redwood-border bg-redwood-bg-surface shadow-sm">
        {loading && (
          <div className="p-10 text-center text-sm font-medium text-redwood-text-muted">Loading…</div>
        )}

        {emptyReport && (
          <div className="p-10 text-center">
            <p className="mx-auto max-w-md text-sm text-redwood-text-muted">
              No invoices past your late threshold. Adjust the threshold in Settings if that looks
              wrong.
            </p>
          </div>
        )}

        {!loading && report && report.rows.length > 0 && (
          <>
            <div className="hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-redwood-border bg-redwood-bg-light text-left">
                  {(
                    [
                      ['customer', 'Customer', 'text-left'],
                      ['group', 'Group', 'text-left'],
                      ['invoice', 'Invoice', 'text-left'],
                      ['days', 'Days unpaid', 'text-right'],
                      ['outstanding', 'Outstanding', 'text-right'],
                      ['last_order', 'Last order', 'text-left'],
                      ['action', 'Next step', 'text-left'],
                    ] as const
                  ).map(([key, label, align]) => (
                    <th key={key} className={`sticky top-0 bg-redwood-bg-light px-3 py-3 ${align}`}>
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="text-sm font-medium text-redwood-text-main focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-blue)]"
                        aria-sort={sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        {label}
                      </button>
                    </th>
                  ))}
                  <th className="sticky top-0 w-72 bg-redwood-bg-light px-3 py-3 text-sm font-medium text-redwood-text-main print:hidden">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <Fragment key={row.invoice_id}>
                    <tr data-customer={row.customer_name} className="border-b border-redwood-border hover:bg-white/5">
                      <td className="px-3 py-3 align-top">
                        <p className="line-clamp-2 font-medium text-redwood-text-main" title={row.customer_name}>
                          {row.customer_name}
                        </p>
                        <DataProblemNote reason={row.data_problem_reason} />
                        <PhoneLine row={row} />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <GroupPill group={row.group} />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Link
                          to={`/sales/invoices/${row.invoice_id}`}
                          className="text-redwood-text-main underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-blue)]"
                        >
                          {row.invoice_number}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        <DaysChip days={row.days_unpaid} />
                      </td>
                      <td className="px-3 py-3 text-right align-top font-medium tabular-nums text-redwood-text-main">
                        {formatCurrency(row.outstanding)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-redwood-text-muted">
                        {formatLastOrder(row.last_order)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="line-clamp-2 text-sm text-redwood-text-muted" title={row.action}>
                          {row.action}
                        </p>
                      </td>
                      <td className="w-72 px-3 py-3 align-top print:hidden">
                        <div className="flex flex-nowrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => void onCopyMessage(row)}
                            className={actionButtonClass}
                          >
                            <Copy size={14} />
                            {copiedInvoiceId === row.invoice_id ? 'Copied' : 'Copy message'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openLog(row.invoice_id)}
                            className={actionButtonClass}
                          >
                            <ClipboardList size={14} />
                            Log follow-up
                          </button>
                        </div>
                      </td>
                    </tr>
                    {logOpenInvoiceId === row.invoice_id && (
                      <tr className="bg-gray-50/80">
                        <td colSpan={8} className="px-4 py-4">
                          <LogEditor
                            draft={logDraft}
                            busy={logBusy}
                            onChange={setLogDraft}
                            onSave={() => void submitLog(row)}
                          />
                        </td>
                      </tr>
                    )}
                    {(logsByInvoice[row.invoice_id]?.length ?? 0) > 0 && (
                      <tr className="bg-white">
                        <td colSpan={8} className="px-4 pb-3 pt-0">
                          <LogLines entries={logsByInvoice[row.invoice_id]} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
            <ul className="space-y-3 p-3 lg:hidden">
              {visibleRows.map((row) => (
                <li key={row.invoice_id} className="rounded-xl border border-redwood-border p-3">
                  <p className="font-medium text-redwood-text-main" title={row.customer_name}>{row.customer_name}</p>
                  <DataProblemNote reason={row.data_problem_reason} />
                  <PhoneLine row={row} />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <GroupPill group={row.group} />
                    <DaysChip days={row.days_unpaid} />
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-redwood-text-main">{formatCurrency(row.outstanding)}</p>
                  <p className="text-xs text-redwood-text-muted">
                    <Link to={`/sales/invoices/${row.invoice_id}`} className="underline-offset-2 hover:underline">{row.invoice_number}</Link>
                    {' · '}
                    {formatLastOrder(row.last_order)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-redwood-text-muted" title={row.action}>{row.action}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => void onCopyMessage(row)} className={actionButtonClass}>
                      <Copy size={14} />
                      {copiedInvoiceId === row.invoice_id ? 'Copied' : 'Copy message'}
                    </button>
                    <button type="button" onClick={() => openLog(row.invoice_id)} className={actionButtonClass}>
                      <ClipboardList size={14} />
                      Log follow-up
                    </button>
                  </div>
                  {logOpenInvoiceId === row.invoice_id && (
                    <div className="mt-3">
                      <LogEditor
                        draft={logDraft}
                        busy={logBusy}
                        onChange={setLogDraft}
                        onSave={() => void submitLog(row)}
                      />
                    </div>
                  )}
                  {(logsByInvoice[row.invoice_id]?.length ?? 0) > 0 && (
                    <div className="mt-3">
                      <LogLines entries={logsByInvoice[row.invoice_id]} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
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
