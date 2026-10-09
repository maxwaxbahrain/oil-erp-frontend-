import { isStaging } from './appEnv';

// Sidebar visibility toggles — environment-aware.
// Staging (VITE_APP_ENV=staging): all pilot modules visible for iterative work.
// Production / unknown / development: pilot modules hidden (fail-safe).
// Routes and components are untouched; only sidebar links are gated here
// (except sales_returns, which is also gated at the route level).

// sales_returns is on only when VITE_APP_ENV is staging.
const PILOT_VISIBLE = isStaging;

export const MODULE_FLAGS = {
  sales_returns: PILOT_VISIBLE,

  // Mock / invoice-math screens — not GL-aligned. Gated at route + sidebar (all envs).
  finance_accounting_dashboard: false,
  // Banking: GL-backed since Sep 2026 release; visible in all envs
  finance_banking:true,
  // Duplicate nav to /reports/sales; primary entry is /reports/financial (Profitability Analysis).
  reports_profitability_duplicate: false,

  // Demo / mock-data screens
  pulse: true, // GA — live in production (Pulse team chat)
  meeting_notes: true, // GA — live in production (Meeting Notes)
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

  // Duplicate profitability nav — /reports/sales; keep /reports/financial
  reports_profitability_sales: PILOT_VISIBLE,
} as const;
