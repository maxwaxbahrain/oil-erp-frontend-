import { describe, expect, it } from 'vitest';
import { mapAuthRole } from './AuthContext';

describe('mapAuthRole', () => {
  it('maps a warehouse login and leaves the other roles in place', () => {
    expect(mapAuthRole('warehouse')).toBe('warehouse');
    expect(mapAuthRole('WAREHOUSE')).toBe('warehouse');
    expect(mapAuthRole('admin')).toBe('admin');
    expect(mapAuthRole('manager')).toBe('manager');
    expect(mapAuthRole('accountant')).toBe('accountant');
    expect(mapAuthRole('sales')).toBe('sales');
    expect(mapAuthRole('driver')).toBe('driver');
  });
});
