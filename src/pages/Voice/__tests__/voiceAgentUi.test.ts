import { describe, expect, it } from 'vitest';

import { shouldShowVoiceAgentPanel } from '../voiceAgentUi';

describe('shouldShowVoiceAgentPanel', () => {
    it('is true in this non-production test env', () => {
        expect(shouldShowVoiceAgentPanel()).toBe(true);
    });
});
