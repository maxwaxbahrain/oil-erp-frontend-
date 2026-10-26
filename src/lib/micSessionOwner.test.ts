import { describe, expect, it, vi } from 'vitest';
import {
  claimMicSession,
  getActiveMicOwner,
  registerMicConsumer,
  releaseMicSession,
} from './micSessionOwner';

describe('micSessionOwner', () => {
  it('stops other consumers when a session is claimed', () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    registerMicConsumer('command-bar-deepgram', stopA);
    registerMicConsumer('nexus-zava-ptt', stopB);
    claimMicSession('command-bar-deepgram');
    expect(getActiveMicOwner()).toBe('command-bar-deepgram');
    claimMicSession('nexus-zava-ptt');
    expect(stopA).toHaveBeenCalled();
    expect(getActiveMicOwner()).toBe('nexus-zava-ptt');
    releaseMicSession('nexus-zava-ptt');
    expect(getActiveMicOwner()).toBeNull();
  });
});
