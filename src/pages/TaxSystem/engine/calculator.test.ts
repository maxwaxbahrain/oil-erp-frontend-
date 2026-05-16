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

import { describe, expect, it } from 'vitest';

import {
    calculateTax,
    findExemption,
    hasNexus,
    pickRule,
} from './calculator';
import type { TaxExemption, TaxNexus, TaxRule } from '../data/types';

// ─── Test fixtures ────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

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
        // CA default is 10.25% in US_STATE_RATES — change this if the
        // constant changes.
        expect(result.rate).toBe(10.25);
        expect(result.taxAmount).toBeCloseTo(102.5, 5);
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
