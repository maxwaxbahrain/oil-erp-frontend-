/** Draft from Nexus Ask → full customer form (sessionStorage; form page consumes on mount). */
export const NEXUS_CUSTOMER_FORM_DRAFT_KEY = 'soltol_nexus_customer_form_draft';

export type NexusCustomerFormDraft = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  credit_limit?: number;
  zavaTagged: string[];
};

export function writeNexusCustomerFormDraft(draft: NexusCustomerFormDraft): void {
  try {
    sessionStorage.setItem(NEXUS_CUSTOMER_FORM_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function readNexusCustomerFormDraft(): NexusCustomerFormDraft | null {
  try {
    const raw = sessionStorage.getItem(NEXUS_CUSTOMER_FORM_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NexusCustomerFormDraft;
  } catch {
    return null;
  }
}

export function clearNexusCustomerFormDraft(): void {
  try {
    sessionStorage.removeItem(NEXUS_CUSTOMER_FORM_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
