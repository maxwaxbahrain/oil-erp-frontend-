/**
 * Phase 3 intent dispatch for hands-free (open / read / speak only).
 * Mirrors Nexus push-to-talk — no writes, no LLM.
 */

import type { NavigateFunction } from 'react-router-dom';
import api from '../../../api/axios';
import { getVanLocations, getVans } from '../../../services/api';
import { getArSummary, searchCustomers } from '../../../services/customerService';
import { buildOpsVans } from '../opsMap/opsMapModel';
import { companyAmount, signalFigure, signalWhy } from '../signalCards';
import type { NexusSignalCard } from '../nexus/nexusModel';
import {
  countVanStatuses,
  customerBalanceSpeech,
  formatCardSpeech,
  formatVanSummary,
  parseVoiceIntent,
  type VoiceIntent,
} from '../nexus/voiceIntent';

export type HandsFreeSpeak = (text: string) => Promise<void>;

export type HandsFreeIntentDeps = {
  navigate: NavigateFunction;
  speak: HandsFreeSpeak;
  muted: boolean;
  quiet: boolean;
};

async function loadSpeakableCards(): Promise<NexusSignalCard[]> {
  try {
    const { data } = await api.get<{ cards: NexusSignalCard[] }>('/api/agent/signals');
    return (data.cards || []).filter((c) => c && c.title);
  } catch {
    return [];
  }
}

async function maybeSpeak(deps: HandsFreeIntentDeps, text: string): Promise<void> {
  if (deps.muted || deps.quiet) return;
  await deps.speak(text);
}

export async function dispatchHandsFreeTranscript(raw: string, deps: HandsFreeIntentDeps): Promise<VoiceIntent> {
  const intent = parseVoiceIntent(raw);
  const { navigate } = deps;

  switch (intent.type) {
    case 'stop':
      await maybeSpeak(deps, 'Stopped.');
      return intent;
    case 'updates': {
      const cards = await loadSpeakableCards();
      if (!cards.length) {
        await maybeSpeak(deps, 'There are no updates to read right now.');
        return intent;
      }
      const card = cards[0];
      const figure = signalFigure(card) || companyAmount(card.money);
      await maybeSpeak(
        deps,
        formatCardSpeech({
          title: card.title,
          money: card.money,
          why: signalWhy(card.why),
          figure,
        }),
      );
      return intent;
    }
    case 'next':
    case 'repeat': {
      const cards = await loadSpeakableCards();
      if (!cards.length) {
        await maybeSpeak(deps, 'There are no updates to read right now.');
        return intent;
      }
      const card = cards[0];
      const figure = signalFigure(card) || companyAmount(card.money);
      await maybeSpeak(
        deps,
        formatCardSpeech({
          title: card.title,
          money: card.money,
          why: signalWhy(card.why),
          figure,
        }),
      );
      return intent;
    }
    case 'vans': {
      navigate('/agent/ops-map');
      try {
        const [locations, fleet] = await Promise.all([getVanLocations(), getVans()]);
        const rows = buildOpsVans(
          Array.isArray(locations) ? locations : [],
          Array.isArray(fleet) ? fleet : [],
          new Date(),
        );
        await maybeSpeak(deps, formatVanSummary(countVanStatuses(rows.map((r) => r.status))));
      } catch {
        await maybeSpeak(deps, "I couldn't load van locations right now.");
      }
      return intent;
    }
    case 'open_module':
      navigate(intent.href);
      await maybeSpeak(deps, `Opening ${intent.label}.`);
      return intent;
    case 'go_nexus':
      navigate('/agent/nexus');
      await maybeSpeak(deps, 'Back to Nexus.');
      return intent;
    case 'customer': {
      try {
        const found = await searchCustomers(intent.query);
        let arLoadedOk = false;
        let balanceById = new Map<number, number>();
        try {
          const ar = await getArSummary();
          arLoadedOk = true;
          balanceById = new Map((ar.per_customer || []).map((r) => [Number(r.id), Number(r.balance)]));
        } catch {
          arLoadedOk = false;
        }
        const rows = (found || []).map((c) => ({ id: Number(c.id), name: String(c.name) }));
        if (!rows.length) {
          await maybeSpeak(deps, `I couldn't find a customer named ${intent.query}.`);
          return intent;
        }
        const one = rows[0];
        navigate(`/customers/${one.id}`);
        await maybeSpeak(
          deps,
          customerBalanceSpeech({
            name: one.name,
            customerId: one.id,
            arLoadedOk,
            balanceById,
          }),
        );
      } catch {
        await maybeSpeak(deps, "I couldn't look that customer up right now.");
      }
      return intent;
    }
    case 'yes':
    case 'no':
    case 'unknown':
    default:
      await maybeSpeak(deps, "I didn't catch that.");
      return intent;
  }
}
