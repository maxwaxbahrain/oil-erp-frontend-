// Pure-function unit tests for the Tax Engine's math layer.
//
// These exist because every function tested here computes tax on real
// customer money — wrong answers turn into invoice disputes, audit
// problems, or quietly-uncollected sales tax. They're also the easiest
// thing in the codebase to unit-test (no React, no DB, no network), so
// there's no excuse for not having them.
//
// Scenarios are taken from the manual browser sweep we ran today plus
// a few regression guards for bugs we already fixed (notably the
// wildcard-vs-specific exemption precedence in findExemption — without
// this test, that bug would have crept back the next time someone
// touched the function).

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
    calculateInvoiceTax,
    calculateTax,
    findExemption,
    hasNexus,
    pickRule,
} from './calculator';
import type { InvoiceTaxLineItem } from './calculator';
import type { TaxExemption, TaxNexus, TaxRule } from '../data/types';
import { US_STATES, US_STATE_RATES } from '../data/constants';

// ─── Time mocking ─────────────────────────────────────────────────────
// findExemption() inside calculator.ts calls `new Date()` each time it
// runs to decide whether a cert is expired. The test fixtures below build
// dates relative to "now" too. Without a frozen clock, the fixture clock
// and the engine clock can resolve `today` to different ISO dates if the
// test happens to cross midnight UTC mid-run — a ~few-millisecond window
// per day that would make the "expires today" test flake roughly once
// every 6 months on a busy CI. Pinning the clock removes the dependency
// on wall time entirely.
const FIXED_NOW = new Date('2026-06-15T12:00:00.000Z');

beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
});
afterAll(() => {
    vi.useRealTimers();
});

// ─── Test fixtures ────────────────────────────────────────────────────

const today = FIXED_NOW.toISOString().slice(0, 10);                                    // '2026-06-15'
const yesterday = new Date(FIXED_NOW.getTime() - 86_400_000).toISOString().slice(0, 10);
const tomorrow = new Date(FIXED_NOW.getTime() + 86_400_000).toISOString().slice(0, 10);

function rule(overrides: Partial<TaxRule> = {}): TaxRule {
    return {
        id: 'r1',
        jurisdiction: 'US-NY',
        name: 'NY Sales Tax',
        rate: 8.875,
        taxType: 'sales',
        isActive: true,
        createdAt: today,
        updatedAt: today,
        ...overrides,
    };
}

function nexus(overrides: Partial<TaxNexus> = {}): TaxNexus {
    return {
        id: 'n1',
        jurisdiction: 'US-NY',
        nexusType: 'physical',
        isActive: true,
        createdAt: today,
        updatedAt: today,
        ...overrides,
    };
}

function exemption(overrides: Partial<TaxExemption> = {}): TaxExemption {
    return {
        id: 'e1',
        customerId: 'ACME',
        customerName: 'Acme Corp.',
        jurisdiction: 'US-NY',
        exemptionType: 'resale',
        certificateNumber: 'ST-119-001',
        isActive: true,
        createdAt: today,
        updatedAt: today,
        ...overrides,
    };
}

// ─── hasNexus ─────────────────────────────────────────────────────────

describe('hasNexus', () => {
    it('returns true when an active nexus exists for the jurisdiction', () => {
        expect(hasNexus([nexus()], 'US-NY')).toBe(true);
    });

    it('returns false when the only matching nexus is inactive', () => {
        expect(hasNexus([nexus({ isActive: false })], 'US-NY')).toBe(false);
    });

    it('returns false when no nexus matches the jurisdiction', () => {
        expect(hasNexus([nexus({ jurisdiction: 'US-CA' })], 'US-NY')).toBe(false);
    });

    it('is case-insensitive on jurisdiction', () => {
        expect(hasNexus([nexus({ jurisdiction: 'us-ny' })], 'US-NY')).toBe(true);
        expect(hasNexus([nexus()], 'us-ny')).toBe(true);
    });

    it('returns false for an empty list', () => {
        expect(hasNexus([], 'US-NY')).toBe(false);
    });
});

// ─── pickRule ─────────────────────────────────────────────────────────

describe('pickRule', () => {
    it('picks an active rule for the matching jurisdiction', () => {
        const r = rule();
        expect(pickRule([r], 'US-NY')?.id).toBe('r1');
    });

    it('ignores inactive rules', () => {
        expect(pickRule([rule({ isActive: false })], 'US-NY')).toBeUndefined();
    });

    it('is case-insensitive on jurisdiction', () => {
        expect(pickRule([rule({ jurisdiction: 'us-ny' })], 'US-NY')?.id).toBe('r1');
    });

    it('prefers a category-specific match over a generic rule', () => {
        const generic = rule({ id: 'gen', productCategory: undefined });
        const specific = rule({ id: 'food', productCategory: 'food', rate: 0 });
        const picked = pickRule([generic, specific], 'US-NY', 'food');
        expect(picked?.id).toBe('food');
    });

    it('falls back to a generic rule when no category-specific exists', () => {
        const generic = rule({ id: 'gen' });
        expect(pickRule([generic], 'US-NY', 'food')?.id).toBe('gen');
    });

    it('returns undefined when nothing matches', () => {
        expect(pickRule([rule()], 'US-CA')).toBeUndefined();
        expect(pickRule([], 'US-NY')).toBeUndefined();
    });
});

// ─── findExemption ────────────────────────────────────────────────────

describe('findExemption', () => {
    it('finds an exact (customer, jurisdiction) match', () => {
        const e = exemption();
        expect(findExemption([e], 'ACME', 'US-NY')?.certificateNumber).toBe('ST-119-001');
    });

    it('is case-insensitive on customer id AND jurisdiction', () => {
        expect(findExemption([exemption()], 'acme', 'us-ny')?.certificateNumber).toBe('ST-119-001');
    });

    it('trims whitespace on customer id', () => {
        expect(findExemption([exemption()], '  ACME  ', 'US-NY')?.certificateNumber).toBe('ST-119-001');
    });

    it('returns undefined for the wrong jurisdiction', () => {
        expect(findExemption([exemption()], 'ACME', 'US-CA')).toBeUndefined();
    });

    it('returns undefined for an inactive cert', () => {
        expect(findExemption([exemption({ isActive: false })], 'ACME', 'US-NY')).toBeUndefined();
    });

    it('returns undefined for a cert that expired yesterday', () => {
        expect(findExemption([exemption({ expiryDate: yesterday })], 'ACME', 'US-NY')).toBeUndefined();
    });

    it('still treats a cert that expires today as valid', () => {
        // expiry >= today, so "expires today" is still in force for today's
        // calculations. Matches the engine's >= comparison.
        expect(findExemption([exemption({ expiryDate: today })], 'ACME', 'US-NY')?.certificateNumber).toBe('ST-119-001');
    });

    it('treats a cert with no expiry date as never-expiring', () => {
        expect(findExemption([exemption({ expiryDate: undefined })], 'ACME', 'US-NY')?.certificateNumber).toBe('ST-119-001');
    });

    it('honours future expiry dates', () => {
        expect(findExemption([exemption({ expiryDate: tomorrow })], 'ACME', 'US-NY')?.certificateNumber).toBe('ST-119-001');
    });

    it('matches a wildcard cert against any jurisdiction', () => {
        const wc = exemption({ id: 'wc', customerId: 'GLOBAL', jurisdiction: '*', certificateNumber: 'NP-001' });
        expect(findExemption([wc], 'GLOBAL', 'US-NY')?.certificateNumber).toBe('NP-001');
        expect(findExemption([wc], 'GLOBAL', 'US-FL')?.certificateNumber).toBe('NP-001');
        expect(findExemption([wc], 'GLOBAL', 'BH')?.certificateNumber).toBe('NP-001');
    });

    // REGRESSION GUARD — without this, the next refactor of findExemption
    // can quietly re-introduce the bug we caught + fixed today.
    it('prefers a jurisdiction-specific cert over a wildcard cert (wildcard precedence)', () => {
        const specific = exemption({ id: 's', customerId: 'X', jurisdiction: 'US-NY', certificateNumber: 'SPECIFIC' });
        const wildcard = exemption({ id: 'w', customerId: 'X', jurisdiction: '*',     certificateNumber: 'WILDCARD' });

        // Specific should win regardless of which is listed first — that
        // was the bug: order-dependent .find() returned whichever came
        // first instead of preferring the more specific match.
        expect(findExemption([specific, wildcard], 'X', 'US-NY')?.certificateNumber).toBe('SPECIFIC');
        expect(findExemption([wildcard, specific], 'X', 'US-NY')?.certificateNumber).toBe('SPECIFIC');
    });

    it('falls back to the wildcard cert when no specific cert matches the jurisdiction', () => {
        const specific = exemption({ id: 's', customerId: 'X', jurisdiction: 'US-NY', certificateNumber: 'SPECIFIC' });
        const wildcard = exemption({ id: 'w', customerId: 'X', jurisdiction: '*',     certificateNumber: 'WILDCARD' });
        // Calculating at US-CA — specific doesn't apply, wildcard does.
        expect(findExemption([specific, wildcard], 'X', 'US-CA')?.certificateNumber).toBe('WILDCARD');
    });

    it('returns undefined for an unknown customer', () => {
        expect(findExemption([exemption()], 'STRANGER', 'US-NY')).toBeUndefined();
    });

    it('returns undefined when customerId is empty or undefined', () => {
        expect(findExemption([exemption()], '', 'US-NY')).toBeUndefined();
        expect(findExemption([exemption()], undefined, 'US-NY')).toBeUndefined();
        expect(findExemption([exemption()], '   ', 'US-NY')).toBeUndefined();
    });
});

// ─── calculateTax ─────────────────────────────────────────────────────

describe('calculateTax', () => {
    it('uses an active rule when one matches', () => {
        const r = rule({ rate: 8.875 });
        const result = calculateTax(1000, 'US-NY', [r]);
        expect(result.source).toBe('rule');
        expect(result.rate).toBe(8.875);
        expect(result.taxAmount).toBeCloseTo(88.75, 5);
        expect(result.matchedRule?.id).toBe('r1');
    });

    it('falls back to the US state default when no rule matches a US jurisdiction', () => {
        const result = calculateTax(1000, 'US-CA', []);
        expect(result.source).toBe('us-state-default');
        // CA = 7.25 state + 1.57 local = 8.82 combined (Session 1B retrofit).
        // If US_STATES['CA'] changes, this test changes.
        expect(result.rate).toBe(8.82);
        expect(result.taxAmount).toBeCloseTo(88.2, 5);
    });

    it('returns no-rate for an unknown non-US jurisdiction', () => {
        const result = calculateTax(1000, 'ZZ', []);
        expect(result.source).toBe('no-rate');
        expect(result.rate).toBe(0);
        expect(result.taxAmount).toBe(0);
    });

    it('returns no-rate for an unknown US state code (US-XX)', () => {
        const result = calculateTax(1000, 'US-XX', []);
        expect(result.source).toBe('no-rate');
        expect(result.taxAmount).toBe(0);
    });

    it('coerces NaN amount to 0 instead of NaN-propagating', () => {
        const result = calculateTax(Number.NaN, 'US-NY', [rule()]);
        expect(result.taxAmount).toBe(0);
        // Rate still comes from the matched rule — only the amount is
        // defended.
        expect(result.rate).toBe(8.875);
    });

    it('suppresses tax to 0 with source=no-nexus when caller passes an empty nexus list', () => {
        const result = calculateTax(1000, 'US-NY', [rule()], undefined, []);
        expect(result.source).toBe('no-nexus');
        expect(result.taxAmount).toBe(0);
        expect(result.nexusMissing).toBe(true);
        // The provisional rate is preserved so the UI can show "would have
        // applied X%" — this is the user-visible banner contract.
        expect(result.rate).toBe(8.875);
    });

    it('does NOT enforce nexus when caller omits the nexusList argument entirely', () => {
        // Important distinction: undefined nexusList = "caller doesn't want
        // nexus enforcement" (e.g. while loading). Empty array = "I checked
        // and there's no nexus."
        const result = calculateTax(1000, 'US-NY', [rule()], undefined, undefined);
        expect(result.source).toBe('rule');
        expect(result.taxAmount).toBeCloseTo(88.75, 5);
    });

    it('does NOT trigger no-nexus when the underlying source is no-rate', () => {
        // No rate to suppress in the first place, so the no-nexus banner
        // doesn't fire — caller would see "no rate configured" instead of
        // "would have been X% but no nexus".
        const result = calculateTax(1000, 'ZZ', [], undefined, []);
        expect(result.source).toBe('no-rate');
    });

    it('returns source=exempt with the matched cert when a customer has an active exemption', () => {
        const result = calculateTax(
            1000, 'US-NY', [rule()],
            undefined,
            [nexus()],                       // nexus exists — would otherwise charge
            [exemption()], 'ACME',
        );
        expect(result.source).toBe('exempt');
        expect(result.taxAmount).toBe(0);
        expect(result.matchedExemption?.certificateNumber).toBe('ST-119-001');
        // Provisional rate preserved for the "tax suppressed" banner.
        expect(result.rate).toBe(8.875);
    });

    it('exemption beats nexus enforcement (exempt wins over no-nexus)', () => {
        // Customer has a cert AND no nexus on file. The cert should win —
        // because the customer's exemption is the more specific signal
        // ("this customer doesn't owe tax here") vs the general nexus
        // policy ("we don't collect tax here yet").
        const result = calculateTax(
            1000, 'US-NY', [rule()],
            undefined,
            [],                              // NO nexus
            [exemption()], 'ACME',
        );
        expect(result.source).toBe('exempt');
        expect(result.taxAmount).toBe(0);
    });

    it('does NOT mark exempt when the customer has no matching cert', () => {
        const result = calculateTax(
            1000, 'US-NY', [rule()],
            undefined,
            [nexus()],
            [exemption()], 'STRANGER',       // different customer
        );
        expect(result.source).toBe('rule');
        expect(result.taxAmount).toBeCloseTo(88.75, 5);
    });

    it('does NOT mark exempt when customerId is missing', () => {
        const result = calculateTax(
            1000, 'US-NY', [rule()],
            undefined,
            [nexus()],
            [exemption()], undefined,        // no customer → skip cert check
        );
        expect(result.source).toBe('rule');
    });

    it('respects an expired cert (falls through to nexus check)', () => {
        const result = calculateTax(
            1000, 'US-NY', [rule()],
            undefined,
            [],                              // no nexus
            [exemption({ expiryDate: yesterday })], 'ACME',
        );
        // Cert expired → not matched → nexus check kicks in → no-nexus.
        expect(result.source).toBe('no-nexus');
    });
});

// ─── US_STATES coverage (Session 1B retrofit) ────────────────────────
//
// The prompt asked for all 50 states + DC. These tests assert that the
// table is complete, internally consistent (stateRate + avgLocalRate ===
// combinedRate within float tolerance), and that the derived
// US_STATE_RATES lookup matches the combined rate. Catches typos in the
// data table (e.g. someone editing avgLocalRate without recomputing
// combinedRate) before they ship into customer tax bills.

describe('US_STATES coverage', () => {
    const EXPECTED_CODES = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
        'DC',
    ];

    it('has all 50 states + DC (exactly 51 entries)', () => {
        expect(Object.keys(US_STATES).sort()).toEqual([...EXPECTED_CODES].sort());
    });

    it.each(EXPECTED_CODES)('%s: stateRate + avgLocalRate === combinedRate', (code) => {
        const info = US_STATES[code];
        // Sum to 3 decimals to absorb float noise (MN has .875 + .580 = 7.455).
        expect(Math.round((info.stateRate + info.avgLocalRate) * 1000) / 1000)
            .toBeCloseTo(info.combinedRate, 3);
    });

    it.each(EXPECTED_CODES)('%s: derived US_STATE_RATES matches combinedRate', (code) => {
        expect(US_STATE_RATES[code]).toBe(US_STATES[code].combinedRate);
    });

    it.each(EXPECTED_CODES)('%s: stateCode field matches the key', (code) => {
        expect(US_STATES[code].stateCode).toBe(code);
    });

    it.each(EXPECTED_CODES)('%s: stateName is a non-empty string', (code) => {
        expect(typeof US_STATES[code].stateName).toBe('string');
        expect(US_STATES[code].stateName.length).toBeGreaterThan(0);
    });
});

// ─── 2-decimal rounding (Session 1B retrofit) ────────────────────────
//
// All taxAmount values surfaced by the engine pass through round2() so
// the UI never has to render $88.789012. Tests assert that the result
// has at most 2 decimal places for inputs that would otherwise produce
// more — including edge cases where the float math is ugly.

describe('2-decimal rounding on taxAmount', () => {
    function decimalPlaces(n: number): number {
        const s = n.toString();
        const dot = s.indexOf('.');
        return dot === -1 ? 0 : s.length - dot - 1;
    }

    it('rounds rule-based output (1000 * 8.875% = 88.75 → exact)', () => {
        const result = calculateTax(1000, 'US-NY', [rule({ rate: 8.875 })]);
        expect(result.taxAmount).toBe(88.75);
        expect(decimalPlaces(result.taxAmount)).toBeLessThanOrEqual(2);
    });

    it('rounds rule-based output to 2dp for an awkward float input', () => {
        // 999.99 * 8.875% = 88.74911...625 → should round to 88.75.
        const result = calculateTax(999.99, 'US-NY', [rule({ rate: 8.875 })]);
        expect(result.taxAmount).toBe(88.75);
        expect(decimalPlaces(result.taxAmount)).toBeLessThanOrEqual(2);
    });

    it('rounds us-state-default output to 2dp', () => {
        // 137 * 9.22% = 12.6314 → should round to 12.63.
        const result = calculateTax(137, 'US-AL', []);
        expect(result.taxAmount).toBe(12.63);
        expect(decimalPlaces(result.taxAmount)).toBeLessThanOrEqual(2);
    });

    it('does NOT round provisional rate (rate stays at the configured precision)', () => {
        // Rounding is for currency display, not rate display.
        const result = calculateTax(1000, 'US-NY', [rule({ rate: 8.875 })]);
        expect(result.rate).toBe(8.875);
    });
});

// ─── calculateInvoiceTax (Session 1B retrofit) ───────────────────────
//
// The function invoice pages will call. Per-line math is delegated to
// calculateTax so all rule / nexus / exemption logic is shared; this
// covers the aggregation, state/local split, effectiveRate, and the
// passthrough fields the UI renders.

describe('calculateInvoiceTax', () => {
    const line = (over: Partial<InvoiceTaxLineItem> = {}): InvoiceTaxLineItem => ({
        amount: 100,
        ...over,
    });

    it('handles an empty invoice (no lines) without dividing by zero', () => {
        const result = calculateInvoiceTax([], 'US-NY', [rule()]);
        expect(result.totalTax).toBe(0);
        expect(result.stateTax).toBe(0);
        expect(result.localTax).toBe(0);
        expect(result.effectiveRate).toBe(0);
        expect(result.lineBreakdown).toEqual([]);
    });

    it('computes single-line tax via the underlying calculateTax', () => {
        const result = calculateInvoiceTax([line({ amount: 1000 })], 'US-NY', [rule({ rate: 8.875 })]);
        expect(result.totalTax).toBe(88.75);
        expect(result.lineBreakdown).toHaveLength(1);
        expect(result.lineBreakdown[0].amount).toBe(1000);
        expect(result.lineBreakdown[0].taxAmount).toBe(88.75);
        expect(result.lineBreakdown[0].source).toBe('rule');
        // effectiveRate = 88.75 / 1000 * 100 = 8.875%, rounded to 3dp.
        expect(result.effectiveRate).toBe(8.875);
    });

    it('sums multi-line tax + reports a useful effectiveRate', () => {
        // Two lines, both at NY rule rate. Subtotal = 1500, totalTax = 133.13.
        // (1000 * 0.08875 = 88.75; 500 * 0.08875 = 44.375 → rounds to 44.38;
        //  88.75 + 44.38 = 133.13)
        const result = calculateInvoiceTax(
            [line({ amount: 1000, lineId: 'a' }), line({ amount: 500, lineId: 'b' })],
            'US-NY',
            [rule({ rate: 8.875 })],
        );
        expect(result.totalTax).toBe(133.13);
        expect(result.lineBreakdown.map(l => l.lineId)).toEqual(['a', 'b']);
        // effectiveRate ≈ 8.875% (modulo a fraction of a basis point from
        // per-line rounding).
        expect(result.effectiveRate).toBeCloseTo(8.875, 2);
    });

    it('splits stateTax + localTax in US_STATES ratio for US jurisdictions', () => {
        // NY = 4.00 state + 4.52 local = 8.52 combined. Ratio: state share
        // = 4.00 / 8.52 ≈ 0.4695. For a $1000 line at 8.52% combined
        // (state-default path), totalTax = 85.20; stateTax = 85.20 * 0.4695
        // ≈ 40.00; localTax = remainder = 45.20.
        const result = calculateInvoiceTax([line({ amount: 1000 })], 'US-NY', []);
        expect(result.totalTax).toBe(85.20);
        expect(result.stateTax).toBe(40.00);
        expect(result.localTax).toBe(45.20);
        // stateTax + localTax must equal totalTax exactly — that's the
        // "no $0.01 drift" guarantee.
        expect(result.stateTax + result.localTax).toBe(result.totalTax);
    });

    it('attributes the entire amount to stateTax for non-US jurisdictions', () => {
        const result = calculateInvoiceTax([line({ amount: 1000 })], 'BH', [rule({ jurisdiction: 'BH', rate: 10 })]);
        expect(result.totalTax).toBe(100);
        expect(result.stateTax).toBe(100);
        expect(result.localTax).toBe(0);
    });

    it('returns $0 totals when every line is exempt for the customer', () => {
        const result = calculateInvoiceTax(
            [line({ amount: 1000 }), line({ amount: 500 })],
            'US-NY',
            [rule({ rate: 8.875 })],
            [nexus()],
            [exemption()],
            'ACME',
        );
        expect(result.totalTax).toBe(0);
        expect(result.stateTax).toBe(0);
        expect(result.localTax).toBe(0);
        expect(result.lineBreakdown.every(l => l.source === 'exempt')).toBe(true);
        expect(result.lineBreakdown.every(l => l.matchedExemption?.certificateNumber === 'ST-119-001')).toBe(true);
    });

    it('returns $0 totals when nexus is missing', () => {
        const result = calculateInvoiceTax(
            [line({ amount: 1000 })],
            'US-NY',
            [rule({ rate: 8.875 })],
            [],                              // no nexus
        );
        expect(result.totalTax).toBe(0);
        expect(result.stateTax).toBe(0);
        expect(result.localTax).toBe(0);
        expect(result.lineBreakdown[0].source).toBe('no-nexus');
        // Rate preserved on the line so the UI can still show "would have
        // been 8.875%".
        expect(result.lineBreakdown[0].rate).toBe(8.875);
    });

    it('routes per-line productCategory through to pickRule', () => {
        const generic = rule({ id: 'g', rate: 10 });
        const food    = rule({ id: 'f', rate: 0, productCategory: 'food' });
        const result = calculateInvoiceTax(
            [line({ amount: 100, productCategory: 'food' }), line({ amount: 100 })],
            'US-NY',
            [generic, food],
        );
        expect(result.lineBreakdown[0].matchedRule?.id).toBe('f');   // food line uses food rule (0%)
        expect(result.lineBreakdown[1].matchedRule?.id).toBe('g');   // other line uses generic (10%)
        expect(result.lineBreakdown[0].taxAmount).toBe(0);
        expect(result.lineBreakdown[1].taxAmount).toBe(10);
    });

    it('effectiveRate is 0 when subtotal is 0 (no divide-by-zero)', () => {
        const result = calculateInvoiceTax([line({ amount: 0 })], 'US-NY', [rule()]);
        expect(result.effectiveRate).toBe(0);
        expect(result.totalTax).toBe(0);
    });
});
