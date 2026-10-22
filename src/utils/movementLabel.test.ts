import { describe, expect, it } from 'vitest';
import { formatMovementLabel } from './movementLabel';

describe('formatMovementLabel', () => {
  it('joins source and movement type when they differ', () => {
    expect(formatMovementLabel({ source_type: 'invoice', movement_type: 'deduct' })).toBe('invoice · deduct');
  });

  it('keeps a single token when the type matches the source', () => {
    expect(formatMovementLabel({ source_type: 'grn', movement_type: 'grn' })).toBe('grn');
  });

  it('falls back when both fields are blank', () => {
    expect(formatMovementLabel({ source_type: '  ', movement_type: '' })).toBe('movement');
  });
});
