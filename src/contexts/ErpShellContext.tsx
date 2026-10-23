import { createContext, useContext, type ReactNode } from 'react';
import type { ArSummary } from '../services/customerService';
import type { ProductsLoadState } from '../utils/alertCounts';

/** ERP payload App loads once for the alert bar / AI assistant / Nexus. */
export type ErpShellData = {
  invoices: unknown[];
  customers: unknown[];
  products: unknown[];
  payments: unknown[];
  purchaseOrders: unknown[];
  arSummary: ArSummary | null;
  productsLoad: ProductsLoadState;
};

const defaultShell: ErpShellData = {
  invoices: [],
  customers: [],
  products: [],
  payments: [],
  purchaseOrders: [],
  arSummary: null,
  productsLoad: 'loading',
};

const ErpShellContext = createContext<ErpShellData>(defaultShell);

export function ErpShellProvider({
  value,
  children,
}: {
  value: ErpShellData;
  children: ReactNode;
}) {
  return <ErpShellContext.Provider value={value}>{children}</ErpShellContext.Provider>;
}

export function useErpShell(): ErpShellData {
  return useContext(ErpShellContext);
}
