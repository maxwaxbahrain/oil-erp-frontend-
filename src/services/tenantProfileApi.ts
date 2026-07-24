import api from '../api/axios';
import {
    companyProfileToSettings,
    type CompanyProfile,
    type CompanySettings,
} from './settingsService';

/** Backend GET/PUT /api/tenants/me/profile response shape. */
export interface TenantProfile {
    company_name: string;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    phone: string | null;
    public_email: string | null;
    website: string | null;
    tax_id: string | null;
    logo_url: string | null;
}

/** PUT body — all fields optional; logo is not accepted by the backend yet. */
export type TenantProfileUpdatePayload = {
    company_name?: string;
    address_line1?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    phone?: string | null;
    public_email?: string | null;
    website?: string | null;
    tax_id?: string | null;
};

function orEmpty(value: string | null | undefined): string {
    return value ?? '';
}

export async function fetchTenantProfile(): Promise<TenantProfile> {
    const res = await api.get<TenantProfile>('/api/tenants/me/profile');
    return res.data;
}

export async function updateTenantProfile(
    payload: TenantProfileUpdatePayload,
): Promise<TenantProfile> {
    const res = await api.put<TenantProfile>('/api/tenants/me/profile', payload);
    return res.data;
}

export function toCompanyProfile(p: TenantProfile): CompanyProfile {
    return {
        name: p.company_name,
        address1: orEmpty(p.address_line1),
        city: orEmpty(p.city),
        state: orEmpty(p.state),
        postalCode: orEmpty(p.postal_code),
        country: orEmpty(p.country),
        phone: orEmpty(p.phone),
        email: orEmpty(p.public_email),
        website: orEmpty(p.website),
        taxId: orEmpty(p.tax_id),
        logo: p.logo_url ?? undefined,
    };
}

export function toCompanySettings(p: TenantProfile): CompanySettings {
    const profile = toCompanyProfile(p);
    const settings = companyProfileToSettings(profile);

    // Env fallback mashes state/postal into city ("Jamaica, NY 11423") — do not re-mash.
    if (p.state == null && p.postal_code == null) {
        settings.city = p.city ?? '';
    }

    return settings;
}

export function fromCompanyProfile(c: CompanyProfile): TenantProfileUpdatePayload {
    return {
        company_name: c.name,
        address_line1: c.address1 || null,
        city: c.city || null,
        state: c.state || null,
        postal_code: c.postalCode || null,
        country: c.country || null,
        phone: c.phone || null,
        public_email: c.email || null,
        website: c.website || null,
        tax_id: c.taxId || null,
    };
}
