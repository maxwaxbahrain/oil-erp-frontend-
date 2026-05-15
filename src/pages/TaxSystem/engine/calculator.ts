// Tax Engine — pure calculation helpers.
//
// calculateTax() stays pure / framework-agnostic so it can be unit-tested
// without React. Session 1D adds calculateTaxWithProvider() which can
// optionally consult an external provider (TaxJar / Avalara) — that one
// is async and falls back to the pure calc on provider error.

import type { TaxRule, TaxNexus, TaxProviderConfig, ProviderId } from '../data/types';
import { US_STATE_RATES } from '../data/constants';
import { quote as providerQuote } from '../integrations/providerClient';

export interface TaxComputation {
    rate: number;        // percent
    taxAmount: number;   // currency
    source: 'rule' | 'us-state-default' | 'no-rate' | 'no-nexus' | 'provider';
    matchedRule?: TaxRule;
    /** True when a rule / fallback existed but we suppressed tax because
     *  there's no active nexus for the jurisdiction. */
    nexusMissing?: boolean;
    /** Session 1D — set when source='provider'. Identifies which external
     *  service answered the quote, so the UI can render a "via TaxJar"
     *  badge without re-deriving it. */
    providerId?: ProviderId;
    /** Optional jurisdiction breakdown (state/county/city/special).
     *  Provider-supplied; not populated by the internal engine. */
    providerBreakdown?: {
        state?: number;
        county?: number;
        city?: number;
        special?: number;
    };
    /** Session 1D — set when the provider was tried but failed and we fell
     *  back to the internal engine. UI uses this to show a small banner
     *  explaining the source mismatch. */
    providerFallbackReason?: string;
}

/** True if an active nexus exists for the jurisdiction. */
export function hasNexus(nexusList: TaxNexus[], jurisdiction: string): boolean {
    const j = (jurisdiction || '').trim().toUpperCase();
    return nexusList.some(n => n.isActive && n.jurisdiction.toUpperCase() === j);
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

/** Compute tax for an amount given the loaded rules and a jurisdiction.
 *
 * Session 1C: when a `nexusList` is supplied, the engine enforces
 * nexus — even if a matching rule or US-state default exists, tax is
 * suppressed (returned as 0 with source='no-nexus') when there's no
 * active nexus on file for the jurisdiction. Callers that don't want
 * nexus enforcement just omit the arg.
 *
 * Defensive coercion: amount is forced to a finite number so callers
 * passing NaN, "" or undefined still get a sane zero result instead of
 * NaN propagating into the rendered total.
 */
export function calculateTax(
    amount: number,
    jurisdiction: string,
    rules: TaxRule[],
    productCategory?: string,
    nexusList?: TaxNexus[],
): TaxComputation {
    const safeAmount = Number.isFinite(amount) ? amount : 0;

    // What WOULD the tax be if nexus were established? Compute first,
    // then suppress at the end if nexus is missing — so the UI can show
    // "would have been X%" context.
    let provisional: TaxComputation;

    const rule = pickRule(rules, jurisdiction, productCategory);
    if (rule) {
        const rate = Number(rule.rate) || 0;
        provisional = {
            rate,
            taxAmount: safeAmount * (rate / 100),
            source: 'rule',
            matchedRule: rule,
        };
    } else {
        // US fallback — if jurisdiction looks like US-XX, use the state's
        // average combined rate so the UI doesn't show 0% when no rule
        // has been configured yet.
        const usMatch = /^US-([A-Z]{2})$/i.exec(jurisdiction || '');
        if (usMatch) {
            const state = usMatch[1].toUpperCase();
            const rate = US_STATE_RATES[state];
            if (rate !== undefined) {
                provisional = { rate, taxAmount: safeAmount * (rate / 100), source: 'us-state-default' };
            } else {
                provisional = { rate: 0, taxAmount: 0, source: 'no-rate' };
            }
        } else {
            provisional = { rate: 0, taxAmount: 0, source: 'no-rate' };
        }
    }

    // Nexus enforcement — only kicks in when caller supplied a nexus list.
    // If the calc would have produced a non-zero result but no active
    // nexus exists, return 0 and mark source='no-nexus' so the UI can
    // explain the suppression.
    if (nexusList !== undefined && provisional.source !== 'no-rate' && !hasNexus(nexusList, jurisdiction)) {
        return {
            ...provisional,
            taxAmount: 0,
            source: 'no-nexus',
            nexusMissing: true,
        };
    }

    return provisional;
}

/** Session 1D — async calc that prefers the external provider when one is
 *  active. Behaviour:
 *
 *    1. If no active provider, just runs calculateTax() and returns.
 *    2. If active provider exists, asks it for a quote.
 *       - Success → source='provider', rate/amount from the quote.
 *       - Failure → falls back to calculateTax() and stamps
 *         `providerFallbackReason` so the UI can flag it.
 *    3. Nexus enforcement runs AFTER the provider answers — so even a
 *       provider-supplied quote gets suppressed when no nexus exists.
 *       (Provider only knows rates; nexus is an internal concern.)
 */
export async function calculateTaxWithProvider(
    amount: number,
    jurisdiction: string,
    rules: TaxRule[],
    productCategory: string | undefined,
    nexusList: TaxNexus[] | undefined,
    activeProvider: TaxProviderConfig | null | undefined,
): Promise<TaxComputation> {
    const internal = calculateTax(amount, jurisdiction, rules, productCategory, nexusList);

    if (!activeProvider || activeProvider.id === 'internal' || !activeProvider.isActive) {
        return internal;
    }

    const { quote: q, error } = await providerQuote(activeProvider, { amount, jurisdiction, productCategory });
    if (!q) {
        return { ...internal, providerFallbackReason: error || 'Provider returned no quote' };
    }

    const provisional: TaxComputation = {
        rate: q.rate,
        taxAmount: q.taxAmount,
        source: 'provider',
        providerId: q.providerId,
        providerBreakdown: q.breakdown,
    };

    // Nexus enforcement applies to provider quotes too — provider doesn't
    // know whether we have a collection obligation in that jurisdiction.
    if (nexusList !== undefined && !hasNexus(nexusList, jurisdiction)) {
        return {
            ...provisional,
            taxAmount: 0,
            source: 'no-nexus',
            nexusMissing: true,
        };
    }

    return provisional;
}
