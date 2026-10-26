/** Local TTS via speechSynthesis — low latency for fast-path answers. */

export function splitSpeakSentences(text: string): { first: string; rest: string } {
  const t = String(text || '').trim();
  if (!t) return { first: '', rest: '' };
  const m = t.match(/^(.+?[.!?])(?:\s+([\s\S]+))?$/);
  if (m && m[1]) {
    return { first: m[1].trim(), rest: (m[2] || '').trim() };
  }
  return { first: t, rest: '' };
}

export function synthAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function cancelSynth(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export function speakWithSynth(text: string): Promise<void> {
  const line = String(text || '').trim();
  if (!line) return Promise.resolve();
  if (!synthAvailable()) return Promise.resolve();
  cancelSynth();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(line);
    u.rate = 1;
    u.pitch = 1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
    window.setTimeout(finish, Math.min(60_000, line.length * 80 + 2000));
  });
}

/** Speak first sentence immediately, then the remainder. */
export async function speakFirstThenRest(full: string): Promise<void> {
  const { first, rest } = splitSpeakSentences(full);
  if (!first) return;
  await speakWithSynth(first);
  if (rest) await speakWithSynth(rest);
}
