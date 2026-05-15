// Tax Engine — public surface.
// Pages import from `./engine` rather than reaching into individual files,
// so future refactors (e.g. moving to a worker, adding caching) only
// touch the engine internals.

export { calculateTax, pickRule, hasNexus } from './calculator';
export type { TaxComputation } from './calculator';
