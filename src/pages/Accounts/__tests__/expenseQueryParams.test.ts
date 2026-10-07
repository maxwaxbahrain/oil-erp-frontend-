import { describe, expect, it } from 'vitest';
import { buildNewExpenseUrl, parseNewExpenseParams } from '../expenseQueryParams';

describe('expense query params', () => {
  it('parses new=1 with a numeric client', () => {
    expect(parseNewExpenseParams('?new=1&client=42')).toEqual({ open: true, clientId: '42' });
  });

  it('parses new=1 with no client', () => {
    expect(parseNewExpenseParams('?new=1')).toEqual({ open: true, clientId: null });
  });

  it('rejects a non-numeric client', () => {
    expect(parseNewExpenseParams('?new=1&client=abc')).toEqual({ open: true, clientId: null });
  });

  it('keeps a numeric client when new is absent', () => {
    expect(parseNewExpenseParams('?client=42')).toEqual({ open: false, clientId: '42' });
  });

  it('parses an empty search', () => {
    expect(parseNewExpenseParams('')).toEqual({ open: false, clientId: null });
  });

  it('builds the finance expenses url', () => {
    expect(buildNewExpenseUrl(7)).toBe('/finance/expenses?new=1&client=7');
  });
});
