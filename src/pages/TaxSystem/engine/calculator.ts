// Tax Engine — pure calculation helpers.
//
// calculateTax() stays pure / framework-agnostic so it can be unit-tested
// without React. Session 1D adds calculateTaxWithProvider() which can
// optionally consult an external provider (TaxJar / Avalara) — that one
// is async and falls back to the pure calc on provider error.

import type { TaxRule, TaxNexus, TaxProviderConfig, ProviderId, TaxExemption } from '../data/types';
import { US_STATE_RATES, EXEMPTION_ANY_JURISDICTION } from '../data/constants';
import { quote as providerQuote } from '../integrations/providerClient';

export interface TaxComputation {
    rate: number;        // percent
    taxAmount: number;   // currency
    source: 'rule' | 'us-state-default' | 'no-rate' | 'no-nexus' | 'provider' | 'exempt';
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
    /** Session 1E — set when source='exempt'. The exemption certificate
     *  that caused tax to be zeroed out, plus the rate that WOULD have
     *  applied so the UI can say "$X tax suppressed by cert #...".
     *  Exemption takes precedence over nexus enforcement (a customer
     *  with a valid resale cert pays $0 even in nexus jurisdictions). */
    matchedExemption?: TaxExemption;
}

/** True if an active nexus exists for the jurisdiction. */
export function hasNexus(nexusList: TaxNexus[], jurisdiction: string): boolean {
    const j = (jurisdiction || '').trim().toUpperCase();
    return nexusList.some(n => n.isActive && n.jurisdiction.toUpperCase() === j);
}

/** Find an active, non-expired exemption certificate for the given customer
 *  + jurisdiction. Matches:
 *   - customerId (case-insensitive, trimmed)
 *   - jurisdiction equal OR exemption.jurisdiction === '*' (any)
 *   - isActive === true
 *   - expiryDate either missing or in the future
 *
 *  When the customer has BOTH a wildcard ('*') cert AND a jurisdiction-
 *  specific cert, the specific one wins — same precedence rule pickRule
 *  uses for product categories. Falling back to wildcard only when no
 *  specific match exists keeps the more-specific bookkeeping (e.g.
 *  state resale cert taking priority over a federal nonprofit cert).
 *
 *  Pass an empty list / undefined customer to skip the check. */
export function findExemption(
    exemptions: TaxExemption[],
    customerId: string | undefined,
    jurisdiction: string,
): TaxExemption | undefined {
    const cust = (customerId || '').trim().toLowerCase();
    if (!cust) return undefined;
    const j = (jurisdiction || '').trim().toUpperCase();
    const today = new Date().toISOString().slice(0, 10);
    const candidates = exemptions.filter(e =>
        e.isActive &&
        e.customerId.trim().toLowerCase() === cust &&
        (e.jurisdiction === EXEMPTION_ANY_JURISDICTION || e.jurisdiction.toUpperCase() === j) &&
        (!e.expiryDate || e.expiryDate >= today),
    );
    // Prefer a jurisdiction-specific match over a wildcard match.
    return candidates.find(e => e.jurisdiction !== EXEMPTION_ANY_JURISDICTION) || candidates[0];
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
 * Session 1E: when an `exemptions` + `customerId` pair is supplied, the
 * engine checks for an active, non-expired exemption certificate matching
 * (customerId, jurisdiction). If one exists, tax is suppressed (returned
 * as 0 with source='exempt') and the matched cert is attached for the UI.
 * Exemption takes precedence over nexus — a valid cert wins regardless
 * of nexus status, because the customer is the one claiming exemption.
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
    exemptions?: TaxExemption[],
    customerId?: string,
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

    // Exemption check — runs FIRST (before nexus) when caller supplied
    // exemptions + a customerId. A valid cert means "this customer doesn't
    // owe tax in this jurisdiction" regardless of nexus / rule / state
    // default. The provisional rate is preserved so the UI can show
    // "$X.XX would have applied — suppressed by cert #...".
    if (exemptions !== undefined && customerId && provisional.source !== 'no-rate') {
        const exempt = findExemption(exemptions, customerId, jurisdiction);
        if (exempt) {
            return {
                ...provisional,
                taxAmount: 0,
                source: 'exempt',
                matchedExemption: exempt,
            };
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
    exemptions?: TaxExemption[],
    customerId?: string,
): Promise<TaxComputation> {
    const internal = calculateTax(amount, jurisdiction, rules, productCategory, nexusList, exemptions, customerId);

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

    // Exemption check (Session 1E) — applies to provider quotes too.
    // Customer exemption wins regardless of source, because the customer
    // is the entity claiming the exemption (TaxJar/Avalara would also
    // suppress in this case if we passed exemption info to them).
    if (exemptions !== undefined && customerId) {
        const exempt = findExemption(exemptions, customerId, jurisdiction);
        if (exempt) {
            return {
                ...provisional,
                taxAmount: 0,
                source: 'exempt',
                matchedExemption: exempt,
            };
        }
    }

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
