import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ORBIT_CARD_NAME_STYLE } from './NexusOrbit';
import { ORBIT_MODULE_DEFS } from './nexusOrbitNav';

describe('orbit module names never truncated', () => {
  it('name style does not ellipsize / nowrap', () => {
    expect(ORBIT_CARD_NAME_STYLE.whiteSpace).toBe('normal');
    expect(ORBIT_CARD_NAME_STYLE.textOverflow).not.toBe('ellipsis');
    expect(ORBIT_CARD_NAME_STYLE.overflow).not.toBe('hidden');
  });

  it('all module labels are complete strings (Payroll & HR, Customers & CRM, …)', () => {
    const labels = ORBIT_MODULE_DEFS.map((d) => d.label);
    expect(labels).toContain('Payroll & HR');
    expect(labels).toContain('Customers & CRM');
    expect(labels).toContain('Expenses');
    expect(labels.every((l) => !l.includes('…'))).toBe(true);
  });

  it('orbit cards widen and grid kicks in below 640px (1024/1280 centre)', () => {
    const src = readFileSync(join(__dirname, 'NexusOrbit.tsx'), 'utf8');
    expect(src).toMatch(/width: layout === 'orbit' \? 148/);
    expect(src).toMatch(/setUseGrid\(w < 640\)/);
  });
});
