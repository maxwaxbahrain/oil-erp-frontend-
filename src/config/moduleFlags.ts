// Modules disabled pending a backend fix. Flip to true to restore.
// sales_returns: PATCH /api/sales-returns/{id} -> "approved" does NOT post
// to the GL. Subledger and GL silently diverge. See backend repo
// docs/PHASE_A_FINDINGS.md section D3.0. Restore after D3.0.1.
export const MODULE_FLAGS = {
  sales_returns: false,
} as const;
