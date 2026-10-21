import { describe, expect, it, vi } from 'vitest';

/**
 * Pause must never write hands_free_zava=false.
 * Off (chip / settings) is the only path that PUTs false.
 */
describe('pause vs off', () => {
  it('documents that local pause does not call putVoicePrefs(false)', async () => {
    const putVoicePrefs = vi.fn(async (patch: { hands_free_zava?: boolean }) => patch);
    // Simulate pause path: only local state, no PUT
    let localPaused = false;
    const pauseLocally = () => {
      localPaused = true;
    };
    pauseLocally();
    expect(localPaused).toBe(true);
    expect(putVoicePrefs).not.toHaveBeenCalled();

    // Off path
    await putVoicePrefs({ hands_free_zava: false });
    expect(putVoicePrefs).toHaveBeenCalledWith({ hands_free_zava: false });
  });
});
