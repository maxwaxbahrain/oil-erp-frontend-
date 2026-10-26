import { describe, expect, it } from 'vitest';
import {
  isZavaFieldOccupied,
  planZavaApply,
  type ExtractCustomerResponse,
  type ZavaFormSnapshot,
} from '../TellZavaBox';

function emptySnap(overrides: Partial<ZavaFormSnapshot> = {}): ZavaFormSnapshot {
  return {
    name: '',
    email: '',
    phone: '',
    address: '',
    category: 'retail',
    credit_limit: undefined,
    opening_balance: undefined,
    openingSide: 'debit',
    openingAsOf: '2026-10-26',
    notes: '',
    isEdit: false,
    ...overrides,
  };
}

function extract(overrides: Partial<ExtractCustomerResponse>): ExtractCustomerResponse {
  return {
    name: null,
    email: null,
    phone: null,
    address: null,
    category: null,
    credit_limit: null,
    opening_balance: null,
    notes: null,
    filled_fields: [],
    warnings: [],
    possible_duplicates: [],
    ...overrides,
  };
}

describe('planZavaApply', () => {
  it('fills empty fields only', () => {
    const result = extract({
      name: 'Acme Co',
      phone: '718-555-0177',
      filled_fields: ['name', 'phone'],
    });
    const { auto, conflicts } = planZavaApply(emptySnap(), result);
    expect(conflicts).toHaveLength(0);
    expect(auto.form).toEqual({ name: 'Acme Co', phone: '718-555-0177' });
    expect(auto.tagged).toEqual(['name', 'phone']);
  });

  it('never overwrites typed fields without asking', () => {
    const snap = emptySnap({ name: 'Typed Co', phone: '111' });
    const result = extract({
      name: 'Zava Co',
      phone: '222',
      email: 'z@x.com',
      filled_fields: ['name', 'phone', 'email'],
    });
    const { auto, conflicts } = planZavaApply(snap, result);
    expect(auto.form).toEqual({ email: 'z@x.com' });
    expect(auto.tagged).toEqual(['email']);
    expect(conflicts.map((c) => c.field).sort()).toEqual(['name', 'phone']);
  });

  it('skips opening balance on edit', () => {
    const snap = emptySnap({ isEdit: true });
    const result = extract({
      opening_balance: { side: 'dr', amount: 100, as_of: null },
      filled_fields: ['opening_balance'],
    });
    const { auto, conflicts } = planZavaApply(snap, result);
    expect(auto.tagged).toHaveLength(0);
    expect(conflicts).toHaveLength(0);
  });
});

describe('isZavaFieldOccupied', () => {
  it('treats default retail category as empty', () => {
    expect(isZavaFieldOccupied('category', emptySnap())).toBe(false);
    expect(isZavaFieldOccupied('category', emptySnap({ category: 'wholesale' }))).toBe(true);
  });
});
