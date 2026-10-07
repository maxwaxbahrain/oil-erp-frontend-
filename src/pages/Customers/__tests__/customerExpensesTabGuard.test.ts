import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('customer expenses tab guard', () => {
  it('gates + Add expense on management roles and points it at Finance expenses', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/Customers/CustomerOverview.tsx'), 'utf8');
    expect(source).toContain('buildNewExpenseUrl(');
    expect(source).not.toContain('No expenses are linked to this customer yet');

    const tabStart = source.indexOf("activeTab === 'expenses'");
    expect(tabStart).toBeGreaterThanOrEqual(0);
    const tabBlock = source.slice(tabStart, source.indexOf('Payment Modal', tabStart));
    const roleAt = tabBlock.indexOf('hasRole(...MANAGEMENT_ROLES)');
    const buttonAt = tabBlock.indexOf('+ Add expense');
    expect(roleAt).toBeGreaterThanOrEqual(0);
    expect(buttonAt).toBeGreaterThan(roleAt);
  });
});
