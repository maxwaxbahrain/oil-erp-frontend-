import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { emptyHomeModules, type HomeModuleBlock, type HomeModules } from './homeSummaryApi';
import { moduleCardDisplay } from './NexusOrbit';
import {
  canOpenOrbitChip,
  canOpenOrbitModule,
  visibleOrbitChips,
  visibleOrbitModules,
  type OrbitNavCtx,
} from './nexusOrbitNav';

function ctx(role: OrbitNavCtx['role'], roles: string[] = []): OrbitNavCtx {
  return {
    role,
    hasRole: (...r) => r.some((x) => roles.includes(x) || x === role),
  };
}

describe('module card display states', () => {
  it('error shows Couldn\'t load, ERROR tag, no number', () => {
    const block: HomeModuleBlock = { state: 'error', sub_line: 'Tap to retry', tag: 'ERROR' };
    const d = moduleCardDisplay('payroll', block);
    expect(d.primary).toBe("Couldn't load");
    expect(d.tag).toBe('ERROR');
    expect(d.hasNumericPrimary).toBe(false);
  });

  it('unavailable shows Not set up yet, IDLE, no number', () => {
    const block: HomeModuleBlock = { state: 'unavailable' };
    const d = moduleCardDisplay('sales', block);
    expect(d.primary).toBe('Not set up yet');
    expect(d.tag).toBe('IDLE');
    expect(d.hasNumericPrimary).toBe(false);
  });

  it('ok collections shows money + ACTION when tagged', () => {
    const block: HomeModuleBlock = {
      state: 'ok',
      value: 94342,
      sub_line: '161 overdue',
      tag: 'ACTION',
    };
    const d = moduleCardDisplay('collections', block);
    expect(d.primary).toBe('$94,342');
    expect(d.tag).toBe('ACTION');
    expect(d.hasNumericPrimary).toBe(true);
  });
});

describe('orbit RBAC', () => {
  it('hides finance/payroll/users from sales role', () => {
    const sales = ctx('sales', ['sales']);
    expect(canOpenOrbitModule(sales, 'finance')).toBe(false);
    expect(canOpenOrbitModule(sales, 'payroll')).toBe(false);
    expect(canOpenOrbitModule(sales, 'collections')).toBe(false);
    expect(canOpenOrbitModule(sales, 'customers')).toBe(true);
    expect(canOpenOrbitChip(sales, 'users')).toBe(false);
    expect(canOpenOrbitChip(sales, 'ai_hub')).toBe(true);
    expect(visibleOrbitModules(sales).some((m) => m.id === 'payroll')).toBe(false);
  });

  it('admin sees modules and chips that flags allow', () => {
    const admin = ctx('admin', ['admin', 'manager', 'accountant']);
    expect(canOpenOrbitModule(admin, 'finance')).toBe(true);
    expect(canOpenOrbitModule(admin, 'warehouse')).toBe(true);
    expect(canOpenOrbitChip(admin, 'users')).toBe(true);
    expect(canOpenOrbitChip(admin, 'security')).toBe(true);
    expect(visibleOrbitChips(admin).length).toBeGreaterThan(0);
  });

  it('cards navigate to existing module routes', () => {
    const admin = ctx('admin', ['admin']);
    const mods = visibleOrbitModules(admin);
    expect(mods.every((m) => m.href.startsWith('/'))).toBe(true);
    expect(mods.find((m) => m.id === 'collections')?.href).toBe('/finance/collections');
    expect(mods.find((m) => m.id === 'delivery')?.href).toBe('/logistics/operations');
  });
});

describe('tap-while-speaking stops without listening', () => {
  it('onMicTap bumps micGen and returns while speaking', () => {
    const src = readFileSync(join(__dirname, 'useNexusVoice.ts'), 'utf8');
    expect(src).toMatch(/Tap while speaking: stop speaking and do NOT start listening/);
    expect(src).toMatch(/micGenRef\.current \+= 1/);
    expect(src).toMatch(/if \(gen !== micGenRef\.current\) return/);
    expect(src).toMatch(/voiceState === 'speaking'/);
  });
});

describe('empty modules helper', () => {
  it('all modules start unavailable', () => {
    const m: HomeModules = emptyHomeModules();
    expect(Object.values(m).every((b) => b.state === 'unavailable')).toBe(true);
  });
});
