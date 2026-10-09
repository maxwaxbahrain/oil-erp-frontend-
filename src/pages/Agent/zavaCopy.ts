export const VIOLET = '#C4B5FD';

export const SUGGESTIONS = [
    { id: 'attention', question: 'What needs attention today?' },
    { id: 'overdue', question: 'Who owes us money for more than 60 days?' },
    { id: 'stock', question: 'Which products are low on stock?' },
    { id: 'customers', question: 'Who are my top 5 customers this month?' },
] as const;

export const ERRORS = {
    off: 'Zava is not available right now. Contact SOLTOL support if this continues.',
    limit: "This company's monthly Zava limit is reached. Zava will answer again next month.",
    role: 'Zava is available to admin, manager, and accountant users.',
    timeout: 'That lookup took too long. Ask again, or ask a smaller question.',
    network: 'The connection dropped. Check your network and send the question again.',
} as const;

export const INVALID_EMAIL = 'Enter a valid email address.';
export const MAILBOX_WARNING = 'This address cannot receive mail. Update the email on your profile.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
    return EMAIL.test(value.trim());
}

export function cannotReceiveMail(email: string): boolean {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) return true;
    const host = trimmed.split('@')[1] || '';
    return host === 'example.com' || host.endsWith('.example.com');
}

export function firstName(fullName: string | undefined): string {
    const word = (fullName || '').trim().split(/\s+/)[0];
    return word || 'there';
}

export function showMorningBriefing(role: string | undefined): boolean {
    return role === 'admin';
}

export function showNewConversation(questionCount: number): boolean {
    return questionCount > 0;
}

const STEPS: Record<string, { label: string; href?: string }> = {
    sales_summary: { label: 'Looked up sales' },
    cash_received: { label: 'Looked up cash received' },
    receivables_ageing: { label: 'Looked up overdue invoices', href: '/reports/aged-receivable' },
    top_customers: { label: 'Looked up top customers' },
    low_stock: { label: 'Looked up stock levels', href: '/products' },
    failed_postings: { label: 'Looked up posting problems' },
    waiting_for_approval: { label: 'Looked up items waiting for approval', href: '/finance/expenses/approvals' },
    deliveries_for_day: { label: 'Looked up deliveries' },
    delegate: { label: 'Checked the company records' },
};

export function stepView(name: string): { label: string; href?: string } {
    return STEPS[name] || { label: 'Looked something up' };
}

export function messageForFailure(input: { status?: number; detail?: string; network?: boolean; timedOut?: boolean }): string {
    if (input.timedOut) return ERRORS.timeout;
    if (input.network) return ERRORS.network;
    const detail = (input.detail || '').toLowerCase();
    if (detail.includes('60 second') || detail.includes('8 tool') || detail.includes('timed out') || detail.includes('timeout')) {
        return ERRORS.timeout;
    }
    if (detail.includes('monthly') || detail.includes('limit reached') || detail.includes('zava limit')) {
        return ERRORS.limit;
    }
    if (detail.includes('admin, manager') || detail.includes('cannot use zava') || detail.includes('your role')) {
        return ERRORS.role;
    }
    if (
        detail.includes('not available right now')
        || detail.includes('turned off')
        || detail.includes('not available in production')
        || detail.includes('switched off')
    ) {
        return ERRORS.off;
    }
    if (!input.detail) return ERRORS.network;
    return ERRORS.off;
}

export function presentAnswer(text: string): string {
    const detail = text.toLowerCase();
    if (detail.includes('60 second') || detail.includes('8 tool calls')) return ERRORS.timeout;
    if (detail.includes('monthly') && detail.includes('limit')) return ERRORS.limit;
    if (detail.includes('not available right now') || detail.includes('turned off')) return ERRORS.off;
    return text;
}
