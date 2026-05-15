// Tax Engine — pure calculation helpers.
//
// Stays pure / framework-agnostic so it can be unit-tested without
// React. Session 1B will plug TaxJar lookups in here; for 1A we just
// look at the rules array we've already loaded.

import type { TaxRule } from '../data/types';
import { US_STATE_RATES } from '../data/constants';

export interface TaxComputation {
    rate: number;        // percent
    taxAmount: number;   // currency
    source: 'rule' | 'us-state-default' | 'no-rate';
    matchedRule?: TaxRule;
}

/** Find the most specific active rule for the given jurisdiction. */
export function pickRule(rules: TaxRule[], jurisdiction: string, productCategory?: string): TaxRule | undefined {
    const j = (jurisdiction || '').trim().toUpperCase();
    const cat = (productCategory || '').trim().toLowerCase();
    const candidates = rules.filter(r => r.isActive && r.jurisdiction.toUpperCase() === j);
    // Prefer a category-specific match over a generic one.
    if (cat) {
        const specific = candidates.find(r => (r.productCategory || '').toLowerCase() === cat);
        if (specific) return specific;
    }
    return candidates.find(r => !r.productCategory) || candidates[0];
}

/** Compute tax for an amount given the loaded rules and a jurisdiction. */
export function calculateTax(
    amount: number,
    jurisdiction: string,
    rules: TaxRule[],
    productCategory?: string,
): TaxComputation {
    const rule = pickRule(rules, jurisdiction, productCategory);
    if (rule) {
        const rate = Number(rule.rate) || 0;
        return {
            rate,
            taxAmount: amount * (rate / 100),
            source: 'rule',
            matchedRule: rule,
        };
    }
    // US fallback — if jurisdiction looks like US-XX, use the state's
    // average combined rate so the UI doesn't show 0% when no rule
    // has been configured yet.
    const usMatch = /^US-([A-Z]{2})$/i.exec(jurisdiction || '');
    if (usMatch) {
        const state = usMatch[1].toUpperCase();
        const rate = US_STATE_RATES[state];
        if (rate !== undefined) {
            return { rate, taxAmount: amount * (rate / 100), source: 'us-state-default' };
        }
    }
    return { rate: 0, taxAmount: 0, source: 'no-rate' };
}
