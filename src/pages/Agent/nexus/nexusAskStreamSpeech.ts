import { speakWithSynth } from './nexusSpeechOut';

/** Speak complete sentences as streamed text grows; flush remainder on done. */
export function createStreamSentenceSpeaker() {
  let spokenChars = 0;
  let chain: Promise<void> = Promise.resolve();
  let spokeAny = false;

  const enqueue = (sentence: string) => {
    const s = sentence.trim();
    if (!s) return;
    spokeAny = true;
    chain = chain.then(() => speakWithSynth(s));
  };

  const drainCompleteSentences = (full: string) => {
    let rest = full.slice(spokenChars);
    while (rest.length) {
      const m = rest.match(/^(.+?[.!?])(?:\s+|[.!?]+$)/);
      if (m?.[1]) {
        const chunk = m[1];
        spokenChars += m[0].length;
        enqueue(chunk);
        rest = full.slice(spokenChars);
      } else {
        break;
      }
    }
  };

  return {
    onText(text: string) {
      drainCompleteSentences(String(text || ''));
    },
    flush(text: string) {
      const full = String(text || '');
      drainCompleteSentences(full);
      const tail = full.slice(spokenChars).trim();
      if (tail) {
        spokenChars = full.length;
        enqueue(tail);
      }
    },
    wait(): Promise<void> {
      return chain;
    },
    get spokeAny() {
      return spokeAny;
    },
  };
}
