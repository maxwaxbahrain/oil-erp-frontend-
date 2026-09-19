import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  getCreditCheckDetail,
  getCreditChecks,
  getCreditProviderSettings,
  getPaymentScore,
  getPaymentScoreHistory,
  pullCreditsafeReport,
  recomputePaymentScore,
  searchCreditsafe,
  type CreditCheckDetail,
  type CreditCheckRow,
  type CreditProviderSettings,
  type CreditsafeMatch,
  type PaymentScore,
  type PaymentScoreBand,
} from '../../services/api';
import { formatCurrency, formatDateOnly } from '../../utils/formatters';

const FOOTER_TEXT =
  "Based on this customer's own payment history. GREEN means no warning signs in payment history.";

const cardStyle: CSSProperties = {
  background: 'var(--bg2,#0a1726)',
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 10,
  padding: '14px 16px',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '.5px',
  textTransform: 'uppercase',
  color: 'var(--t3,#3E5678)',
  marginBottom: 8,
};

function bandChipStyle(band: PaymentScoreBand): CSSProperties {
  const colors: Record<PaymentScoreBand, { bg: string; text: string; border: string }> = {
    GREEN: { bg: 'rgba(34,197,94,.12)', text: '#22C55E', border: 'rgba(34,197,94,.3)' },
    YELLOW: { bg: 'rgba(245,158,11,.12)', text: '#FCD34D', border: 'rgba(245,158,11,.3)' },
    RED: { bg: 'rgba(239,68,68,.12)', text: '#FCA5A5', border: 'rgba(239,68,68,.3)' },
    UNRATED: { bg: 'rgba(148,163,184,.12)', text: '#94A3B8', border: 'rgba(148,163,184,.25)' },
  };
  const tone = colors[band];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 999,
    background: tone.bg,
    border: `1px solid ${tone.border}`,
    color: tone.text,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '.04em',
  };
}

function formatApiError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Request failed';
}

export interface CustomerCreditTabProps {
  customerId: string;
  customerName: string;
  creditLimit?: number | null;
  canManage: boolean;
}

export default function CustomerCreditTab({
  customerId,
  customerName,
  creditLimit,
  canManage,
}: CustomerCreditTabProps) {
  const [score, setScore] = useState<PaymentScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [recomputeBusy, setRecomputeBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<PaymentScore[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [providerSettings, setProviderSettings] = useState<CreditProviderSettings | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<CreditCheckRow | null>(null);
  const [checksLoading, setChecksLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState(customerName);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CreditsafeMatch[]>([]);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [storedReport, setStoredReport] = useState<CreditCheckDetail | null>(null);
  const [viewReportBusy, setViewReportBusy] = useState(false);
  const [viewReportError, setViewReportError] = useState<string | null>(null);

  const loadScore = useCallback(async () => {
    setScoreLoading(true);
    setScoreError(null);
    try {
      const data = await getPaymentScore(customerId);
      setScore(data);
    } catch (error) {
      setScore(null);
      setScoreError(formatApiError(error));
    } finally {
      setScoreLoading(false);
    }
  }, [customerId]);

  const loadProviderLayer = useCallback(async () => {
    setProviderLoading(true);
    setChecksLoading(true);
    setProviderError(null);
    try {
      const [settings, checks] = await Promise.all([
        getCreditProviderSettings(),
        getCreditChecks(customerId),
      ]);
      setProviderSettings(settings);
      setLastCheck(checks[0] ?? null);
    } catch (error) {
      setProviderSettings(null);
      setLastCheck(null);
      setProviderError(formatApiError(error));
    } finally {
      setProviderLoading(false);
      setChecksLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadScore();
    void loadProviderLayer();
  }, [loadScore, loadProviderLayer]);

  useEffect(() => {
    setSearchQuery(customerName);
  }, [customerName]);

  const onRecompute = async () => {
    setRecomputeBusy(true);
    setScoreError(null);
    try {
      const data = await recomputePaymentScore(customerId);
      setScore(data);
      if (historyOpen) {
        const rows = await getPaymentScoreHistory(customerId);
        setHistory(rows);
      }
    } catch (error) {
      setScoreError(formatApiError(error));
    } finally {
      setRecomputeBusy(false);
    }
  };

  const toggleHistory = async () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (!next) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await getPaymentScoreHistory(customerId);
      setHistory(rows);
    } catch (error) {
      setHistory([]);
      setHistoryError(formatApiError(error));
    } finally {
      setHistoryLoading(false);
    }
  };

  const onRunSearch = async () => {
    if (!window.confirm('This uses one Creditsafe search credit. Continue?')) return;
    setSearchBusy(true);
    setSearchError(null);
    setSearchResults([]);
    setReportError(null);
    try {
      const resp = await searchCreditsafe(searchQuery.trim());
      setSearchResults(resp.matches ?? []);
    } catch (error) {
      setSearchError(formatApiError(error));
    } finally {
      setSearchBusy(false);
    }
  };

  const onPickMatch = async (match: CreditsafeMatch) => {
    if (!match.connect_id || !match.name) return;
    setReportBusy(true);
    setReportError(null);
    try {
      const resp = await pullCreditsafeReport({
        connectId: match.connect_id,
        companyName: match.name,
        customerId,
      });
      setStoredReport({
        id: resp.check_id,
        tenant_id: 0,
        customer_id: Number(customerId),
        company_name: resp.company_name,
        connect_id: match.connect_id,
        country: 'US',
        environment: resp.environment,
        credit_score: resp.credit_score,
        risk_rating: resp.risk_rating,
        provider_credit_limit: resp.provider_credit_limit,
        currency: resp.currency,
        checked_by_user_id: null,
        created_at: new Date().toISOString(),
        report_json: resp.report,
      });
      setSearchResults([]);
      await loadProviderLayer();
    } catch (error) {
      setReportError(formatApiError(error));
    } finally {
      setReportBusy(false);
    }
  };

  const onViewReport = async () => {
    const checkId = lastCheck?.id ?? storedReport?.id;
    if (!checkId) return;
    setViewReportBusy(true);
    setViewReportError(null);
    try {
      const detail = await getCreditCheckDetail(checkId);
      setStoredReport(detail);
    } catch (error) {
      setViewReportError(formatApiError(error));
    } finally {
      setViewReportBusy(false);
    }
  };

  const isUnrated = score?.band === 'UNRATED';
  const scoreVersion =
    (score?.metrics?.score_version as string | undefined) ?? '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t,#EEF2FF)', margin: 0 }}>
        Payment reliability
      </h3>

      {/* Layer 1 — Payment score */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Payment score</p>
        {scoreLoading ? (
          <p style={{ fontSize: 12, color: 'var(--t2,#8BA3C7)' }}>Loading…</p>
        ) : scoreError ? (
          <p style={{ fontSize: 12, color: '#FCA5A5' }}>{scoreError}</p>
        ) : score ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <span style={bandChipStyle(score.band)}>
                {score.band}
                {!isUnrated && score.score != null ? (
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{score.score}</span>
                ) : null}
              </span>
              {!isUnrated ? (
                <span style={{ fontSize: 11, color: 'var(--t3,#3E5678)' }}>
                  As of {score.as_of ? formatDateOnly(score.as_of) : '—'} · version {scoreVersion}
                </span>
              ) : null}
            </div>

            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--t2,#8BA3C7)', fontSize: 12 }}>
              {(score.reasons ?? []).map((reason) => (
                <li key={reason.code}>{reason.text}</li>
              ))}
            </ul>

            {!isUnrated ? (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 10,
                  }}
                >
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--t3,#3E5678)', marginBottom: 4 }}>
                      Suggested limit
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>
                      {formatCurrency(score.suggested_limit ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--t3,#3E5678)', marginBottom: 4 }}>
                      Current credit limit
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--t,#EEF2FF)' }}>
                      {creditLimit != null && creditLimit > 0
                        ? formatCurrency(creditLimit)
                        : 'No limit'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {canManage ? (
                    <button
                      type="button"
                      disabled={recomputeBusy}
                      onClick={() => void onRecompute()}
                      style={{
                        background: '#4F8EF7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: recomputeBusy ? 0.6 : 1,
                      }}
                    >
                      {recomputeBusy ? 'Recomputing…' : 'Recompute'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void toggleHistory()}
                    style={{
                      background: 'transparent',
                      color: '#4F8EF7',
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    {historyOpen ? 'Hide history' : 'History'}
                  </button>
                </div>

                {historyOpen ? (
                  <div style={{ overflowX: 'auto' }}>
                    {historyLoading ? (
                      <p style={{ fontSize: 11, color: 'var(--t3,#3E5678)' }}>Loading history…</p>
                    ) : historyError ? (
                      <p style={{ fontSize: 11, color: '#FCA5A5' }}>{historyError}</p>
                    ) : (
                      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', color: 'var(--t3,#3E5678)', padding: '6px 8px' }}>
                              Date
                            </th>
                            <th style={{ textAlign: 'left', color: 'var(--t3,#3E5678)', padding: '6px 8px' }}>
                              Band
                            </th>
                            <th style={{ textAlign: 'left', color: 'var(--t3,#3E5678)', padding: '6px 8px' }}>
                              Score
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((row) => (
                            <tr key={row.id}>
                              <td style={{ padding: '6px 8px', color: 'var(--t2,#8BA3C7)' }}>
                                {row.computed_at ?? row.as_of
                                  ? formatDateOnly(row.computed_at ?? row.as_of)
                                  : '—'}
                              </td>
                              <td style={{ padding: '6px 8px', color: 'var(--t,#EEF2FF)' }}>{row.band}</td>
                              <td style={{ padding: '6px 8px', color: 'var(--t,#EEF2FF)' }}>
                                {row.score ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : null}
              </>
            ) : canManage ? (
              <button
                type="button"
                disabled={recomputeBusy}
                onClick={() => void onRecompute()}
                style={{
                  background: '#4F8EF7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: recomputeBusy ? 0.6 : 1,
                  alignSelf: 'flex-start',
                }}
              >
                {recomputeBusy ? 'Recomputing…' : 'Recompute'}
              </button>
            ) : null}

            <p style={{ fontSize: 11, color: 'var(--t3,#3E5678)', margin: 0 }}>{FOOTER_TEXT}</p>
          </div>
        ) : null}
      </div>

      {/* Layer 2 — Public screen */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Public records</p>
        <p style={{ fontSize: 12, color: 'var(--t2,#8BA3C7)', margin: 0 }}>
          Coming soon — entity status, licences, judgments and reviews from public sources.
        </p>
      </div>

      {/* Layer 3 — Creditsafe */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Creditsafe</p>
        {providerLoading || checksLoading ? (
          <p style={{ fontSize: 12, color: 'var(--t2,#8BA3C7)' }}>Loading…</p>
        ) : providerError ? (
          <p style={{ fontSize: 12, color: '#FCA5A5' }}>{providerError}</p>
        ) : !providerSettings?.connected ? (
          <div style={{ fontSize: 12, color: 'var(--t3,#3E5678)' }}>
            <p style={{ margin: '0 0 8px' }}>Creditsafe not connected</p>
            <Link to="/settings/credit-sources" style={{ color: '#4F8EF7', fontWeight: 600 }}>
              Connect in Settings › Credit data sources
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span
              style={{
                display: 'inline-block',
                alignSelf: 'flex-start',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.04em',
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(79,142,247,.12)',
                color: '#4F8EF7',
                border: '1px solid rgba(79,142,247,.25)',
              }}
            >
              {providerSettings.environment ?? '—'}
            </span>

            {lastCheck ? (
              <div style={{ fontSize: 12, color: 'var(--t2,#8BA3C7)' }}>
                <p style={{ margin: '0 0 4px', color: 'var(--t,#EEF2FF)', fontWeight: 600 }}>
                  Last check
                </p>
                <p style={{ margin: 0 }}>
                  {lastCheck.created_at ? formatDateOnly(lastCheck.created_at) : '—'} ·{' '}
                  {lastCheck.company_name}
                </p>
                {lastCheck.risk_rating ? (
                  <p style={{ margin: '4px 0 0' }}>Risk: {lastCheck.risk_rating}</p>
                ) : null}
                {lastCheck.credit_score != null ? (
                  <p style={{ margin: '4px 0 0' }}>
                    Provider score: {lastCheck.credit_score}
                    {lastCheck.provider_credit_limit != null
                      ? ` · Limit: ${formatCurrency(lastCheck.provider_credit_limit)}`
                      : ''}
                  </p>
                ) : null}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--t3,#3E5678)', margin: 0 }}>
                No Creditsafe check on file for this customer yet.
              </p>
            )}

            {lastCheck || storedReport ? (
              <button
                type="button"
                disabled={viewReportBusy}
                onClick={() => void onViewReport()}
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  color: '#4F8EF7',
                  border: '1px solid rgba(79,142,247,.35)',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {viewReportBusy ? 'Loading report…' : 'View report'}
              </button>
            ) : null}

            {viewReportError ? (
              <p style={{ fontSize: 12, color: '#FCA5A5', margin: 0 }}>{viewReportError}</p>
            ) : null}

            {storedReport?.report_json ? (
              <pre
                style={{
                  margin: 0,
                  maxHeight: 220,
                  overflow: 'auto',
                  fontSize: 10,
                  color: 'var(--t2,#8BA3C7)',
                  background: 'var(--bg3,#0f1f33)',
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 8,
                  padding: 10,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(storedReport.report_json, null, 2)}
              </pre>
            ) : null}

            {canManage ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--t,#EEF2FF)', margin: 0 }}>
                  Run new check
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: '1 1 200px',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 11,
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid rgba(255,255,255,.1)',
                      color: 'var(--t,#EEF2FF)',
                    }}
                  />
                  <button
                    type="button"
                    disabled={searchBusy || !searchQuery.trim()}
                    onClick={() => void onRunSearch()}
                    style={{
                      background: '#4F8EF7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: searchBusy || !searchQuery.trim() ? 0.6 : 1,
                    }}
                  >
                    {searchBusy ? 'Searching…' : 'Search'}
                  </button>
                </div>
                {searchError ? (
                  <p style={{ fontSize: 12, color: '#FCA5A5', margin: 0 }}>{searchError}</p>
                ) : null}
                {reportError ? (
                  <p style={{ fontSize: 12, color: '#FCA5A5', margin: 0 }}>{reportError}</p>
                ) : null}
                {reportBusy ? (
                  <p style={{ fontSize: 11, color: 'var(--t3,#3E5678)', margin: 0 }}>
                    Pulling report…
                  </p>
                ) : null}
                {searchResults.length > 0 ? (
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      border: '1px solid rgba(255,255,255,.07)',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    {searchResults.map((match) => (
                      <li
                        key={`${match.connect_id ?? match.name}`}
                        style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}
                      >
                        <button
                          type="button"
                          disabled={reportBusy || !match.connect_id}
                          onClick={() => void onPickMatch(match)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            color: 'var(--t,#EEF2FF)',
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{match.name ?? 'Unknown'}</span>
                          {match.reg_no ? (
                            <span style={{ color: 'var(--t3,#3E5678)', marginLeft: 8 }}>
                              {match.reg_no}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
