import { cancelSynth, speakWithSynth } from './nexusSpeechOut';

const HAS_MONEY = /[0-9$€£]/;

function takeCompleteSentences(full: string): { sentences: string[]; consumed: number } {
  const sentences: string[] = [];
  let consumed = 0;
  let rest = full;
  while (rest.length) {
    const m = rest.match(/^(.+?[.!?])(?:\s+|[.!?]+$)/);
    if (!m?.[1]) break;
    sentences.push(m[1].trim());
    consumed += m[0].length;
    rest = full.slice(consumed);
  }
  return { sentences, consumed };
}

function allSentences(full: string): string[] {
  const { sentences, consumed } = takeCompleteSentences(full);
  const tail = full.slice(consumed).trim();
  if (tail) sentences.push(tail);
  return sentences.filter(Boolean);
}

/** Speak complete sentences as streamed text grows; flush remainder on done. */
export function createStreamSentenceSpeaker() {
  let spokenChars = 0;
  let chain: Promise<void> = Promise.resolve();
  let spokeAny = false;
  let stopped = false;
  const spokenEarly = new Set<string>();

  const enqueue = (sentence: string) => {
    const s = sentence.trim();
    if (!s || stopped) return;
    spokeAny = true;
    chain = chain.then(() => {
      if (stopped) return;
      return speakWithSynth(s);
    });
  };

  return {
    onText(text: string) {
      const full = String(text || '');
      const rest = full.slice(spokenChars);
      const { sentences, consumed } = takeCompleteSentences(rest);
      spokenChars += consumed;
      for (const sentence of sentences) {
        if (HAS_MONEY.test(sentence)) continue;
        spokenEarly.add(sentence);
        enqueue(sentence);
      }
    },
    flush(text: string) {
      const finalText = String(text || '');
      for (const sentence of allSentences(finalText)) {
        if (spokenEarly.has(sentence)) continue;
        enqueue(sentence);
      }
    },
    cancel() {
      stopped = true;
      cancelSynth();
    },
    wait(): Promise<void> {
      return chain;
    },
    get spokeAny() {
      return spokeAny;
    },
  };
}
