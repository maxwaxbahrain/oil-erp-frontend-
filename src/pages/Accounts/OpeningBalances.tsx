import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getGLJournalEntries,
  getGLTrialBalance,
  postOpeningBalances,
  yearStartISO,
} from '../../services/glService';
import { showToast } from '../../utils/showToast';

const PAGE_BG = '#060f1c';
const CARD_BG = '#111827';
const CARD_BORDER = '1px solid rgba(56, 189, 248, 0.2)';

const ASSET_ACCOUNTS = ['Cash on Hand', 'Bank', 'Accounts Receivable', 'Inventory'] as const;
const LIABILITY_ACCOUNTS = ['Accounts Payable', 'Tax Payable'] as const;
const EQUITY_ACCOUNTS = ['Owner Capital', 'Retained Earnings'] as const;

const ALL_ACCOUNTS = [...ASSET_ACCOUNTS, ...LIABILITY_ACCOUNTS, ...EQUITY_ACCOUNTS];

type AmountsState = Record<string, string>;

function showErrorToast(message: string): void {
  const id = 'app-global-share-toast';
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
    'box-shadow:0 4px 12px rgba(0,0,0,.18)',
  ].join(';');

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function emptyAmounts(): AmountsState {
  return Object.fromEntries(ALL_ACCOUNTS.map((name) => [name, '']));
}

function parseAmount(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ScalesIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v18M5 7h14M7 7l-3 6h6L7 7zm10 0l-3 6h6l-3-6z"
        stroke="#60A5FA"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const inputStyle: CSSProperties = {
  width: 180,
  background: '#0d1420',
  border: '1px solid rgba(56, 189, 248, 0.2)',
  borderRadius: 8,
  padding: '8px 12px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  color: '#EEF2FF',
  fontSize: 14,
  fontFamily: 'inherit',
};

interface SectionCardProps {
  title: string;
  borderColor: string;
  accounts: readonly string[];
  amounts: AmountsState;
  onChange: (name: string, value: string) => void;
}

function SectionCard({ title, borderColor, accounts, amounts, onChange }: SectionCardProps) {
  return (
    <section
      style={{
        background: CARD_BG,
        border: CARD_BORDER,
        borderRadius: 12,
        borderLeft: `3px solid ${borderColor}`,
        padding: '16px 18px',
      }}
    >
      <h2
        className="redwood-text-main"
        style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: '#EEF2FF' }}
      >
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {accounts.map((name) => (
          <div
            key={name}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <span style={{ fontSize: 14, color: '#EEF2FF' }}>{name}</span>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={amounts[name] ?? ''}
              onChange={(e) => onChange(name, e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function OpeningBalances() {
  const navigate = useNavigate();
  const [asOfDate, setAsOfDate] = useState(yearStartISO);
  const [amounts, setAmounts] = useState<AmountsState>(emptyAmounts);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const setAmount = useCallback((name: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [name]: value }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [entries] = await Promise.all([getGLJournalEntries(), getGLTrialBalance()]);
        if (cancelled) return;

        const opening = entries
          .filter((e) => e.source_type === 'opening_balance' && e.status === 'posted')
          .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

        const next = emptyAmounts();

        if (opening) {
          if (opening.entry_date) setAsOfDate(opening.entry_date.slice(0, 10));
          for (const line of opening.lines) {
            const name = line.account_name;
            if (!name || !ALL_ACCOUNTS.includes(name as (typeof ALL_ACCOUNTS)[number])) continue;
            const amt = line.debit > 0 ? line.debit : line.credit;
            if (amt > 0) next[name] = String(amt);
          }
        }

        setAmounts(next);
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const sum = (names: readonly string[]) =>
      names.reduce((acc, name) => acc + parseAmount(amounts[name] ?? ''), 0);
    const totalAssets = sum(ASSET_ACCOUNTS);
    const totalLiabilities = sum(LIABILITY_ACCOUNTS);
    const totalEquity = sum(EQUITY_ACCOUNTS);
    const diff = Math.abs(totalAssets - (totalLiabilities + totalEquity));
    const balanced = diff < 0.005;
    return { totalAssets, totalLiabilities, totalEquity, diff, balanced };
  }, [amounts]);

  const handleSave = async () => {
    const entries = ALL_ACCOUNTS.map((account_name) => ({
      account_name,
      amount: parseAmount(amounts[account_name] ?? ''),
    })).filter((e) => e.amount > 0);

    if (entries.length < 2) {
      showErrorToast('Enter at least two non-zero balances before saving.');
      return;
    }
    if (!totals.balanced) {
      showErrorToast(`Books are out of balance by $${formatMoney(totals.diff)}`);
      return;
    }

    setSaving(true);
    try {
      await postOpeningBalances(entries, asOfDate);
      showToast('Opening balances saved and posted to GL ✓');
      navigate('/finance/accounting');
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Failed to save opening balances');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="redwood-text-muted"
        style={{ minHeight: '100%', background: PAGE_BG, padding: 24, fontSize: 14 }}
      >
        Loading opening balances…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', background: PAGE_BG, padding: '24px 28px 40px' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <ScalesIcon />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#EEF2FF' }}>
              Opening Balances
            </h1>
            <p className="redwood-text-muted" style={{ margin: '6px 0 0', fontSize: 14, maxWidth: 480 }}>
              Set your starting account balances. This runs once to initialize your GL.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          style={{
            background: '#3b7eff',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving…' : 'Save Opening Balances'}
        </button>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          fontSize: 14,
        }}
      >
        <label className="redwood-text-muted" htmlFor="as-of-date">
          As of date:
        </label>
        <input
          id="as-of-date"
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          style={{
            ...inputStyle,
            width: 'auto',
            textAlign: 'left',
          }}
        />
      </div>

      <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
        <SectionCard
          title="Assets"
          borderColor="#4F8EF7"
          accounts={ASSET_ACCOUNTS}
          amounts={amounts}
          onChange={setAmount}
        />
        <SectionCard
          title="Liabilities"
          borderColor="#EF4444"
          accounts={LIABILITY_ACCOUNTS}
          amounts={amounts}
          onChange={setAmount}
        />
        <SectionCard
          title="Equity"
          borderColor="#22C55E"
          accounts={EQUITY_ACCOUNTS}
          amounts={amounts}
          onChange={setAmount}
        />

        <section
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: 12,
            borderLeft: '3px solid #F59E0B',
            padding: '16px 18px',
          }}
        >
          <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: '#EEF2FF' }}>
            Summary
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EEF2FF' }}>
              <span>Total Assets</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatMoney(totals.totalAssets)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EEF2FF' }}>
              <span>Total Liabilities</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                ${formatMoney(totals.totalLiabilities)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EEF2FF' }}>
              <span>Total Equity</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatMoney(totals.totalEquity)}</span>
            </div>
          </div>
          <p
            style={{
              margin: '14px 0 0',
              fontSize: 14,
              fontWeight: 600,
              color: totals.balanced ? '#22C55E' : '#EF4444',
            }}
          >
            {totals.balanced
              ? '✓ Balanced'
              : `✗ Out of balance by $${formatMoney(totals.diff)}`}
          </p>
        </section>
      </div>
    </div>
  );
}
