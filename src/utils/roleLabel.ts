const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manager',
    accountant: 'Accountant',
    sales: 'Sales',
    driver: 'Driver',
};

export function rolePillLabel(role: string | undefined | null): string {
    if (!role) return 'User';
    return ROLE_LABELS[role] || role.charAt(0).toUpperCase() + role.slice(1);
}
