import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('useNexusVoice mic-only speak', () => {
  it('does not auto-welcome on pointerdown / first click', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).not.toMatch(/addEventListener\('pointerdown'/);
    expect(src).not.toMatch(/onFirstInteraction/);
    expect(src).not.toMatch(/markWelcomeSpoken/);
    expect(src).toMatch(/onMicTap/);
    expect(src).toMatch(/Mic tap only/);
  });
});
