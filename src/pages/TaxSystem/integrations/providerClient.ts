// Tax Engine — external provider client (TaxJar / Avalara).
//
// Session 1D ships a *stub*: the request/response shape matches what we'd
// post to TaxJar (POST /v2/taxes) and Avalara (POST /api/v2/transactions/
// createoradjust), but we never actually leave the browser. quote() simulates
// a 250 ms network round-trip and returns a slightly adjusted rate so the UI
// can show "this came from TaxJar, not your local rules" with believable
// numbers. When real API keys are wired in (Session 1D-B / 1E), only the
// internals of this file change — callers don't.

import type { ProviderId, ProviderQuote, TaxProviderConfig } from '../data/types';
import { US_STATE_RATES } from '../data/constants';

interface QuoteInput {
    amount: number;
    jurisdiction: string;
    productCategory?: string;
}

const NETWORK_DELAY_MS = 250;

/** Deterministic per-provider adjustment so users see consistent numbers
 *  across re-runs (vs. random jitter that would look like a bug). Real
 *  providers return rooftop-accurate rates that DO differ from the state
 *  average — this fakes that delta in a reproducible way. */
function providerDelta(providerId: ProviderId): number {
    if (providerId === 'taxjar') return 0.12;      // TaxJar tends slightly higher
    if (providerId === 'avalara') return -0.08;    // Avalara slightly lower
    return 0;
}

function buildBreakdown(rate: number): ProviderQuote['breakdown'] {
    // Rough rooftop split — state takes the bulk, then county / city / special.
    return {
        state: +(rate * 0.55).toFixed(3),
        county: +(rate * 0.20).toFixed(3),
        city: +(rate * 0.18).toFixed(3),
        special: +(rate * 0.07).toFixed(3),
    };
}

export interface QuoteResult {
    quote: ProviderQuote | null;
    error?: string;
}

/** Ask the active provider for a tax quote. Falls back to error when:
 *   - config is missing or inactive
 *   - jurisdiction has no rate to base the simulation on
 *   - (real impl) HTTP call fails
 *
 *  Callers should fall back to the internal engine on error.
 */
export async function quote(
    config: TaxProviderConfig,
    input: QuoteInput,
): Promise<QuoteResult> {
    if (!config.isActive) {
        return { quote: null, error: 'Provider is not active' };
    }
    if (!config.apiKey?.trim()) {
        return { quote: null, error: `${config.id} API key is required` };
    }

    await new Promise(r => setTimeout(r, NETWORK_DELAY_MS));

    // Mock derivation: pull the US-state default and apply a provider delta.
    // For non-US jurisdictions we simulate a flat 5% (typical VAT/GST starter)
    // — when a real client is plugged in this branch goes away entirely.
    const usMatch = /^US-([A-Z]{2})$/i.exec(input.jurisdiction || '');
    let baseRate: number | undefined;
    if (usMatch) {
        baseRate = US_STATE_RATES[usMatch[1].toUpperCase()];
    } else if (input.jurisdiction?.trim()) {
        baseRate = 5; // simulated international fallback
    }
    if (baseRate === undefined) {
        return { quote: null, error: `${config.id}: jurisdiction "${input.jurisdiction}" not recognised` };
    }

    const rate = Math.max(0, +(baseRate + providerDelta(config.id)).toFixed(3));
    const safeAmount = Number.isFinite(input.amount) ? input.amount : 0;
    return {
        quote: {
            rate,
            taxAmount: +(safeAmount * (rate / 100)).toFixed(2),
            providerId: config.id,
            breakdown: buildBreakdown(rate),
        },
    };
}

/** "Test Connection" button — simulates a ping. Validates the API key looks
 *  vaguely real (non-empty + ≥8 chars) so users get sensible feedback when
 *  they paste a placeholder. */
export async function testConnection(config: TaxProviderConfig): Promise<{ ok: boolean; error?: string }> {
    await new Promise(r => setTimeout(r, NETWORK_DELAY_MS));
    if (!config.apiKey?.trim()) return { ok: false, error: 'API key is empty' };
    if (config.apiKey.trim().length < 8) return { ok: false, error: 'API key looks too short' };
    return { ok: true };
}
