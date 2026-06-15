export type BillingPlanSlug = 'basic' | 'standard' | 'premium';

export interface TenantBillingInfo {
  company_name: string;
  plan: string;
  trial_ends_at: string | null;
  days_left: number;
  is_trial_expired: boolean;
  ai_tokens_used: number;
  ai_cost_usd: number;
  subscription_status: string | null;
  has_active_subscription: boolean;
}

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
}

export interface PortalSessionResponse {
  portal_url: string;
  session_id: string;
}

export const BILLING_PLANS: {
  slug: BillingPlanSlug;
  label: string;
  monthlyUsd: number;
  userCap: string;
}[] = [
  { slug: 'basic', label: 'Basic', monthlyUsd: 99, userCap: '1 user' },
  { slug: 'standard', label: 'Standard', monthlyUsd: 299, userCap: 'Up to 3 users' },
  { slug: 'premium', label: 'Premium', monthlyUsd: 499, userCap: 'Up to 5 users' },
];

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status.trim().toLowerCase());
}

export function normalizePlanSlug(plan: string | null | undefined): BillingPlanSlug | null {
  const slug = (plan || '').trim().toLowerCase();
  if (slug === 'basic' || slug === 'standard' || slug === 'premium') {
    return slug;
  }
  return null;
}
