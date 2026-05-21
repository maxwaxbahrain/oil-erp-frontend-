// SOLTOL THEME PREVIEW — isolated showcase of the new design system.
//
// Routed at /preview-soltol-theme.  Renders ONLY when that route is
// visited.  Bypasses the Redwood app shell (via the matching branch
// in src/app/App.tsx) so the dark navy theme owns the full viewport.
//
// Self-contained:
//   * Imports its own CSS (./styles/soltol-theme.css), scoped under
//     .soltol-dashboard so it cannot leak to other pages.
//   * Loads Google Fonts (Syne / DM Sans / DM Mono) via useEffect on
//     mount and removes them on unmount — no global font pollution.
//   * Uses ONLY .soltol-* class names.  No redwood-* or Tailwind
//     utilities — keeps the visual comparison clean.
//
// Includes a light/dark toggle so both modes can be evaluated in one
// session.  All content is demo data — no API calls, no real records.
// ============================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Search,
    Mic,
    Send,
    Bell,
    Sun,
    Moon,
    ArrowLeft,
    LayoutDashboard,
    Users,
    FileText,
    Package,
    BookOpen,
    BarChart3,
    Receipt,
} from 'lucide-react';

import '../../styles/soltol-theme.css';

// Demo invoice rows — fake data only.  Nothing hits any API.
const DEMO_INVOICES: ReadonlyArray<{
    id: string;
    customer: string;
    amount: string;
    status: 'Paid' | 'Pending' | 'Overdue' | 'Sent';
}> = [
    { id: 'INV-4021', customer: 'Al-Khaleej Trading Co.',   amount: '$12,840.00', status: 'Paid' },
    { id: 'INV-4020', customer: 'Gulf Petroleum Services',  amount: '$8,250.00',  status: 'Pending' },
    { id: 'INV-4019', customer: 'Bahrain Motors Ltd.',      amount: '$3,180.00',  status: 'Overdue' },
    { id: 'INV-4018', customer: 'MaxWax Oil Trading',       amount: '$15,920.00', status: 'Sent' },
    { id: 'INV-4017', customer: 'Arabian Lubricants Co.',   amount: '$5,460.00',  status: 'Paid' },
];

const BADGE_CLASS: Record<'Paid' | 'Pending' | 'Overdue' | 'Sent', string> = {
    Paid:    'soltol-badge soltol-badge-green',
    Pending: 'soltol-badge soltol-badge-amber',
    Overdue: 'soltol-badge soltol-badge-red',
    Sent:    'soltol-badge soltol-badge-blue',
};

export default function SoltolThemePreview() {
    const [isLight, setIsLight] = useState(false);
    const [cmdQuery, setCmdQuery] = useState('');

    // Inject Google Fonts on mount, remove on unmount so other pages
    // never see DM Sans / Syne in the cascade.
    useEffect(() => {
        const links: HTMLLinkElement[] = [];
        const add = (props: Partial<HTMLLinkElement>) => {
            const el = document.createElement('link');
            Object.assign(el, props);
            document.head.appendChild(el);
            links.push(el);
        };
        add({ rel: 'preconnect', href: 'https://fonts.googleapis.com' });
        add({
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossOrigin: 'anonymous',
        });
        add({
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap',
        });
        return () => {
            for (const el of links) {
                if (el.parentNode) el.parentNode.removeChild(el);
            }
        };
    }, []);

    const wrapperClass = `soltol-dashboard${isLight ? ' soltol-light' : ''}`;

    return (
        <div className={wrapperClass}>
            {/* ── TOP NAV ─────────────────────────────────────── */}
            <header className="soltol-topnav">
                <div className="soltol-logo-icon">S1</div>
                <div className="soltol-logo-text">SOLTOL ONE</div>

                {/* AI Command bar (visual only — preview) */}
                <div className="soltol-cmd-wrap">
                    <div className="soltol-cmd-bar">
                        <Search size={14} style={{ color: 'var(--soltol-t3)', flexShrink: 0 }} />
                        <input
                            type="text"
                            className="soltol-cmd-input"
                            placeholder="Ask anything or speak a command..."
                            value={cmdQuery}
                            onChange={(e) => setCmdQuery(e.target.value)}
                        />
                        <button type="button" className="soltol-mic-btn" aria-label="Speak">
                            <Mic size={14} />
                        </button>
                        <button
                            type="button"
                            className={`soltol-send-btn ${cmdQuery.trim() ? 'visible' : ''}`}
                            aria-label="Send"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </div>

                {/* Live indicator */}
                <div className="soltol-live">LIVE</div>

                {/* Theme toggle */}
                <button
                    type="button"
                    className="soltol-btn-ghost"
                    onClick={() => setIsLight((v) => !v)}
                    aria-label="Toggle light / dark mode"
                >
                    {isLight ? <Moon size={12} /> : <Sun size={12} />}
                    {isLight ? 'Dark' : 'Light'}
                </button>

                {/* Back to ERP */}
                <Link
                    to="/"
                    className="soltol-btn-ghost"
                    style={{ textDecoration: 'none' }}
                    aria-label="Back to ERP"
                >
                    <ArrowLeft size={12} />
                    Back to ERP
                </Link>

                {/* Notification icon */}
                <button type="button" className="soltol-icon-btn" aria-label="Notifications">
                    <Bell size={14} />
                    <span className="soltol-notif-dot" />
                </button>

                {/* Avatar */}
                <div className="soltol-avatar" title="System Admin">AQ</div>
            </header>

            {/* ── CHIPS BAR ───────────────────────────────────── */}
            <div className="soltol-chips-bar">
                <span className="soltol-chip soltol-chip-blue">All</span>
                <span className="soltol-chip soltol-chip-green">Paid · 28</span>
                <span className="soltol-chip soltol-chip-amber">Pending · 7</span>
                <span className="soltol-chip soltol-chip-red">Overdue · 3</span>
                <span className="soltol-chip soltol-chip-teal">Drafts · 12</span>
                <span className="soltol-chip soltol-chip-purple">Tax filings · 2</span>
                <span className="soltol-chip soltol-chip-grey">Archive</span>
            </div>

            {/* ── SIDEBAR + MAIN ──────────────────────────────── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <aside className="soltol-sidebar">
                    <div className="soltol-sb-search">
                        <input
                            type="text"
                            className="soltol-sb-input"
                            placeholder="Search modules..."
                        />
                    </div>

                    <div className="soltol-sg-header">
                        <div
                            className="soltol-sg-icon"
                            style={{
                                background: 'rgba(79,142,247,0.18)',
                                color: '#93C5FD',
                            }}
                        >
                            <LayoutDashboard size={12} />
                        </div>
                        <span className="soltol-sg-name">Operations</span>
                    </div>
                    <div className="soltol-nav-item active">
                        <LayoutDashboard size={11} /> Dashboard
                    </div>
                    <div className="soltol-nav-item">
                        <Users size={11} /> Customers
                    </div>
                    <div className="soltol-nav-item">
                        <FileText size={11} /> Invoices
                    </div>
                    <div className="soltol-nav-item">
                        <Package size={11} /> Inventory
                    </div>

                    <div className="soltol-sg-header">
                        <div
                            className="soltol-sg-icon"
                            style={{
                                background: 'rgba(0,212,170,0.18)',
                                color: '#5EEAD4',
                            }}
                        >
                            <BookOpen size={12} />
                        </div>
                        <span className="soltol-sg-name">Finance</span>
                    </div>
                    <div className="soltol-nav-item">
                        <BookOpen size={11} /> Accounting
                    </div>
                    <div className="soltol-nav-item">
                        <BarChart3 size={11} /> Reports
                    </div>
                    <div className="soltol-nav-item">
                        <Receipt size={11} /> Tax Filings
                    </div>
                </aside>

                <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {/* Page title */}
                    <div style={{ marginBottom: '18px' }}>
                        <h1 className="soltol-page-title">Dashboard</h1>
                        <div className="soltol-page-subtitle">
                            Real-time overview of operations · Demo preview (no live data)
                        </div>
                    </div>

                    {/* KPI cards row */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: '12px',
                            marginBottom: '20px',
                        }}
                    >
                        <div className="soltol-kpi soltol-kpi-green">
                            <div className="soltol-kpi-value">$184,250</div>
                            <div className="soltol-kpi-label">Revenue MTD</div>
                            <div className="soltol-kpi-sub good">↑ 12.4% vs last month</div>
                        </div>
                        <div className="soltol-kpi soltol-kpi-red">
                            <div className="soltol-kpi-value">$23,840</div>
                            <div className="soltol-kpi-label">Overdue Receivables</div>
                            <div className="soltol-kpi-sub warn">8 invoices past due</div>
                        </div>
                        <div className="soltol-kpi soltol-kpi-blue">
                            <div className="soltol-kpi-value">142</div>
                            <div className="soltol-kpi-label">Active Customers</div>
                            <div className="soltol-kpi-sub">+6 new this month</div>
                        </div>
                        <div className="soltol-kpi soltol-kpi-amber">
                            <div className="soltol-kpi-value">7</div>
                            <div className="soltol-kpi-label">Low Stock Alerts</div>
                            <div className="soltol-kpi-sub warn">Reorder recommended</div>
                        </div>
                    </div>

                    {/* Recent invoices panel */}
                    <div className="soltol-panel" style={{ marginBottom: '20px' }}>
                        <div className="soltol-panel-header">
                            <div className="soltol-panel-title">Recent Invoices</div>
                            <div className="soltol-panel-action">View all →</div>
                        </div>
                        <table className="soltol-table">
                            <thead>
                                <tr>
                                    <th>Invoice</th>
                                    <th>Customer</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DEMO_INVOICES.map((inv) => (
                                    <tr key={inv.id}>
                                        <td>
                                            <span className="soltol-mono">{inv.id}</span>
                                        </td>
                                        <td>{inv.customer}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'var(--soltol-mono)', color: 'var(--soltol-t)' }}>
                                            {inv.amount}
                                        </td>
                                        <td>
                                            <span className={BADGE_CLASS[inv.status]}>
                                                {inv.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Action row */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                        <button className="soltol-btn-primary">+ New Invoice</button>
                        <button className="soltol-btn-ghost">Export CSV</button>
                        <button className="soltol-btn-ghost">Filter</button>
                    </div>

                    {/* Preview footer hint */}
                    <div
                        style={{
                            marginTop: '24px',
                            padding: '12px 14px',
                            borderRadius: 'var(--soltol-rs)',
                            background: 'var(--soltol-bd)',
                            border: '1px solid var(--soltol-bb)',
                            fontSize: '11px',
                            color: 'var(--soltol-t2)',
                        }}
                    >
                        This is an isolated theme preview — no live data, no API calls.
                        Toggle{' '}
                        <strong style={{ color: 'var(--soltol-t)' }}>Light / Dark</strong>{' '}
                        in the top nav to compare modes.  Click{' '}
                        <strong style={{ color: 'var(--soltol-t)' }}>Back to ERP</strong>{' '}
                        to return to the live app.
                    </div>
                </main>
            </div>
        </div>
    );
}
