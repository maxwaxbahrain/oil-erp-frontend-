import { createContext, useContext, type ReactNode } from 'react';
import type { ArSummary } from '../services/customerService';
import type { ShellLoadState } from '../utils/alertCounts';

/** ERP payload App loads once for the alert bar / AI assistant / Nexus. */
export type ErpShellData = {
  invoices: unknown[];
  customers: unknown[];
  products: unknown[];
  payments: unknown[];
  purchaseOrders: unknown[];
  arSummary: ArSummary | null;
  productsLoad: ShellLoadState;
  invoicesLoad: ShellLoadState;
  paymentsLoad: ShellLoadState;
  arLoad: ShellLoadState;
};

export type ErpShellContextValue = {
  shell: ErpShellData;
  /** Re-run App's shell Promise.all (Nexus Retry). */
  reloadShell: () => void;
};

const defaultShell: ErpShellData = {
  invoices: [],
  customers: [],
  products: [],
  payments: [],
  purchaseOrders: [],
  arSummary: null,
  productsLoad: 'loading',
  invoicesLoad: 'loading',
  paymentsLoad: 'loading',
  arLoad: 'loading',
};

const ErpShellContext = createContext<ErpShellContextValue>({
  shell: defaultShell,
  reloadShell: () => undefined,
});

export function ErpShellProvider({
  value,
  reloadShell,
  children,
}: {
  value: ErpShellData;
  reloadShell: () => void;
  children: ReactNode;
}) {
  return (
    <ErpShellContext.Provider value={{ shell: value, reloadShell }}>
      {children}
    </ErpShellContext.Provider>
  );
}

export function useErpShell(): ErpShellData {
  return useContext(ErpShellContext).shell;
}

export function useErpShellReload(): () => void {
  return useContext(ErpShellContext).reloadShell;
}
