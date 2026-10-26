/** Dev-only voice latency logs (tap→listening, speech end→answer, answer→speaking). */

const dev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

export function logVoiceTiming(label: string, ms: number): void {
  if (!dev) return;
  console.log(`[Zava voice] ${label}: ${Math.round(ms)}ms`);
}
