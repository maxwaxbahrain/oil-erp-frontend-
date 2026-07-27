import { isStaging } from './appEnv';

// Sidebar visibility toggles — environment-aware.
// Staging (VITE_APP_ENV=staging): all pilot modules visible for iterative work.
// Production / unknown / development: pilot modules hidden (fail-safe).
// Routes and components are untouched; only sidebar links are gated here
// (except sales_returns, which is also gated at the route level).

// sales_returns: PATCH /api/sales-returns/{id} -> "approved" does NOT post
// to the GL. Subledger and GL silently diverge. See backend repo
// docs/PHASE_A_FINDINGS.md section D3.0. Restore after D3.0.1.
// Always false in every environment until D3.0.1 lands.
const PILOT_VISIBLE = isStaging;

export const MODULE_FLAGS = {
  sales_returns: false,

  // Demo / mock-data screens
  pulse: PILOT_VISIBLE,
  meeting_notes: PILOT_VISIBLE,
  credit_intelligence: PILOT_VISIBLE,
  crm_pipeline: PILOT_VISIBLE,
  amazon: PILOT_VISIBLE,
  tax_management: PILOT_VISIBLE,
  agent_hub: PILOT_VISIBLE,
  ai_intelligence_landing: PILOT_VISIBLE,
  auto_po_generation: PILOT_VISIBLE,
  anomaly_detection: PILOT_VISIBLE,
  email_auto_reply: PILOT_VISIBLE,
  business_news: PILOT_VISIBLE,
  marketing: PILOT_VISIBLE,
  voice_dashboard: PILOT_VISIBLE,
  voice_analytics: PILOT_VISIBLE,
  voice_coaching_rules: PILOT_VISIBLE,
  payroll: PILOT_VISIBLE,
  bad_debts_writeoff: PILOT_VISIBLE,

  // Broken / stub screens
  demand_forecast: PILOT_VISIBLE,
  customer_forecast: PILOT_VISIBLE,
  revenue_forecast: PILOT_VISIBLE,
  user_access_management: PILOT_VISIBLE,

  // Duplicate profitability nav — /reports/sales; keep /reports/financial
  reports_profitability_sales: PILOT_VISIBLE,
} as const;
