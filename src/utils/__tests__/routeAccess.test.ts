import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  DRIVER_TOOL_ROLES,
  FINANCE_ROLES,
  INTERNAL_WEB_ROLES,
  MANAGEMENT_ROLES,
  SALES_TOOL_ROLES,
  SPOD_AI_ROLES,
  SPOD_COMMON_ROLES,
  WAREHOUSE_PAGE_ROLES,
} from '../rbac';
import { ROUTE_ROLES } from '../routeAccess';

describe('ROUTE_ROLES', () => {
  it('/dashboard uses SPOD_COMMON_ROLES', () => {
    expect(ROUTE_ROLES['/dashboard']).toEqual(SPOD_COMMON_ROLES);
  });

  it('/finance/dashboard uses FINANCE_ROLES', () => {
    expect(ROUTE_ROLES['/finance/dashboard']).toEqual(FINANCE_ROLES);
  });

  it('/sales/dashboard uses INTERNAL_WEB_ROLES', () => {
    expect(ROUTE_ROLES['/sales/dashboard']).toEqual(INTERNAL_WEB_ROLES);
  });

  it('/warehouse/dashboard uses INTERNAL_WEB_ROLES', () => {
    expect(ROUTE_ROLES['/warehouse/dashboard']).toEqual(INTERNAL_WEB_ROLES);
  });

  it('/warehouse/picking uses WAREHOUSE_PAGE_ROLES', () => {
    expect(ROUTE_ROLES['/warehouse/picking']).toEqual(WAREHOUSE_PAGE_ROLES);
  });

  it('/logistics/pod uses DRIVER_TOOL_ROLES', () => {
    expect(ROUTE_ROLES['/logistics/pod']).toEqual(DRIVER_TOOL_ROLES);
  });

  it('/ai/hub uses SPOD_AI_ROLES', () => {
    expect(ROUTE_ROLES['/ai/hub']).toEqual(SPOD_AI_ROLES);
  });

  it('/settings/users uses ADMIN_ROLES', () => {
    expect(ROUTE_ROLES['/settings/users']).toEqual(ADMIN_ROLES);
  });

  it('/sales/invoices uses SALES_TOOL_ROLES', () => {
    expect(ROUTE_ROLES['/sales/invoices']).toEqual(SALES_TOOL_ROLES);
  });

  it('/products uses SPOD_COMMON_ROLES', () => {
    expect(ROUTE_ROLES['/products']).toEqual(SPOD_COMMON_ROLES);
  });

  it('/reports/aged-receivable uses MANAGEMENT_ROLES', () => {
    expect(ROUTE_ROLES['/reports/aged-receivable']).toEqual(MANAGEMENT_ROLES);
  });
});
