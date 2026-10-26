/** Short soft ack when mic starts (~200 ms target). */
export function playMicAck(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 520;
    gain.gain.value = 0.035;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.start(t0);
    osc.stop(t0 + 0.12);
    void ctx.close();
  } catch {
    /* ignore — optional UX */
  }
}
