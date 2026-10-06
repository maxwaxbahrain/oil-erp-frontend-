import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('sales order van error state', () => {
  it('shows a load failure separately from an empty active-van list', () => {
    const form = readFileSync(resolve(process.cwd(), 'src/pages/Sales/SalesOrderFormPage.tsx'), 'utf8');
    const detail = readFileSync(resolve(process.cwd(), 'src/pages/Sales/SalesOrderDetailPage.tsx'), 'utf8');

    expect(form).toContain("Couldn't load vans");
    expect(detail).toContain("Couldn't load vans");
    expect(form).toContain('No active vans available');
  });
});
