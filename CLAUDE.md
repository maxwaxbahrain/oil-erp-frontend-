# Working Rules for This Repo (SOLTOL frontend / oil-erp-frontend-)

## Golden rules — follow on EVERY task
1. **Audit first.** Before writing or changing any code, do a read-only micro-audit and report findings inline (file:line evidence). Do not edit until I've seen the audit.
2. **Never auto-commit.** After making changes, STOP and show me the diff + build output. Do NOT run git commit or git push. Wait for my explicit "commit it" before committing.
3. **Staging before production.** Work on staging first, verified, then promoted to prod (www.soltol.com) in a reviewed batch. Never push/deploy to prod without explicit approval.
4. **Match the report to its label.** Report links/labels must point to the report they actually name. Never point a label at the wrong report or create a duplicate/stub page — prefer wiring to existing real components.
5. **Presentation vs data.** When changing labels/UI, do NOT change API calls or accounting logic. State clearly what is display-only vs data.

## Stack
- React + TypeScript + Vite + Tailwind + React Router. Repo: oil-erp-frontend-. Prod: www.soltol.com (deploys from main), staging app.soltol.com.
- Backend API base: bettano-erp-backend.onrender.com. Real report endpoints exist: /finance/reports/pnl, /finance/reports/cashflow, /finance/reports/balance-sheet, etc.
- Multi-tenant ERP. Bettano = reference tenant. Production tenant 13 (Bettano) trial balance verified 21 Jul 2026: $1,686,469.21 debits = credits, 1,721 journal entries, difference 0.000000.

## Never
- Never commit .env or secrets.
- Never create duplicate report pages when a real one exists — flag duplicates instead.

## Money and GL rules (added 21 Jul 2026)
6. **Applies to every AI tool, any model.** These rules are not Claude-specific.
   Any assistant used on this repo follows them, because this is live financial
   software with real customer books in production.
7. **Never silently recompute stored money from a hardcoded default.** Tax,
   price, and cost must derive from stored values or an authoritative source.
   A wrong default is worse than no default, because it gets accepted without
   thought.
8. **Never delete financial records.** Invoices, journal entries and payments
   are reversed via credit note or reversing entry — never row-deleted. There
   is deliberately no invoice DELETE endpoint. Keep it that way.
9. **Exactly ONE code path may compute tax.** As of 21 Jul 2026 several can.
   Do not add another.
10. **Money/GL changes are test-locked.** The expected result is written down
    before the code is written.

## Known landmines — read before touching these areas
- **Invoice tax.** InvoiceFormPage.tsx historically defaulted to `taxRate: 17`
  labelled "UAE VAT" — a Gulf-region rate on US invoices. Fixed 21 Jul 2026
  (commit 171d676): default is now 0, and edit-mode derives the rate from
  stored subtotal and tax amount so opening and saving an invoice cannot
  silently re-tax it. DO NOT reintroduce a hardcoded rate.
- **SPOD auto-invoice.** DriverApp.tsx sets taxRate: 0 / taxAmount: 0 — every
  driver-generated invoice omits sales tax. Known gap, tracked as C3.4.5.
- **Backend does not store tax_rate yet.** The frontend mapper already reads
  `inv.tax_rate ?? inv.taxRate` and is ready for it (C3.4.1).
- **Scattered tax rates.** 17% (invoice form, now fixed), 5% (VanSalesForm),
  15% (financialSettingsService), 0% (SPOD, sales orders), 8.52% (TaxSystem
  module, display only). Consolidating these is C3.4.

## Reference — read before any money/GL work
Full findings and task backlog live in the BACKEND repo:
  docs/PHASE_A_FINDINGS.md  — all known blockers with file:line evidence
  docs/WIPE_ORDER.md        — tenant wipe order, verified against production
