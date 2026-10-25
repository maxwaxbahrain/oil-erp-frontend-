import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { rolePillLabel } from '../../../utils/roleLabel';
import ZavaRail, { focusZavaQuestion, railCounts, scrollToZava } from '../zavaRail';

function mount(node: ReactNode) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
        root.render(node);
    });
    return {
        host,
        unmount() {
            act(() => root.unmount());
            host.remove();
        },
    };
}

const base = {
    signalCount: 10,
    healthCount: 3,
    healthUrgent: true,
    showDataHealth: true,
    showRunChecks: true,
    runningChecks: false,
    checkedAt: '2026-10-13T12:00:00.000Z',
    active: 'signals' as const,
    onSignals: () => {},
    onHealth: () => {},
    onRunChecks: () => {},
    onAsk: () => {},
};

describe('Zava side rail', () => {
    it('scrolls to Signals and Data health, and focuses the question', () => {
        const signals = document.createElement('section');
        signals.id = 'zava-signals';
        const health = document.createElement('section');
        health.id = 'zava-data-health';
        const question = document.createElement('textarea');
        question.id = 'zava-question';
        document.body.append(signals, health, question);
        const scrolled: string[] = [];
        signals.scrollIntoView = () => scrolled.push('signals');
        health.scrollIntoView = () => scrolled.push('health');
        question.scrollIntoView = () => scrolled.push('ask');
        let focused = false;
        question.focus = () => { focused = true; };
        scrollToZava('zava-signals');
        scrollToZava('zava-data-health');
        focusZavaQuestion();
        expect(scrolled).toEqual(['signals', 'health', 'ask']);
        expect(focused).toBe(true);
        signals.remove();
        health.remove();
        question.remove();
    });

    it('hides Data health for a manager and Run checks now unless the user is an admin', () => {
        const manager = mount(<ZavaRail {...base} showDataHealth={false} showRunChecks={false} />);
        expect(manager.host.textContent).toContain('Signals');
        expect(manager.host.textContent).not.toContain('Data health');
        expect(manager.host.textContent).not.toContain('Run checks now');
        manager.unmount();

        const admin = mount(<ZavaRail {...base} />);
        expect(admin.host.textContent).toContain('Data health');
        expect(admin.host.textContent).toContain('Run checks now');
        expect(admin.host.textContent).toContain('10');
        expect(admin.host.textContent).toContain('3');
        expect(admin.host.querySelector('.zava-rail-dot')).not.toBeNull();
        expect(admin.host.textContent).toContain('Last checked:');
        expect(admin.host.querySelector('[aria-current="true"]')?.textContent).toContain('Signals');
        admin.unmount();
    });

    it('matches section counts and shows a spinner while checks run', () => {
        expect(railCounts([{ priority: 'fyi' }, { priority: 'urgent' }])).toEqual({ count: 2, urgent: true });
        expect(railCounts([])).toEqual({ count: 0, urgent: false });
        expect(railCounts(null)).toEqual({ count: 0, urgent: false });
        const running = mount(<ZavaRail {...base} runningChecks healthUrgent={false} />);
        expect(running.host.querySelector('.zava-rail-spin')).not.toBeNull();
        expect(running.host.querySelector('.zava-rail-dot')).toBeNull();
        running.unmount();
    });

    it('uses a bottom bar on a narrow screen and the real role in the header', () => {
        const page = readFileSync(resolve(process.cwd(), 'src/pages/Agent/AgentPage.tsx'), 'utf8');
        const app = readFileSync(resolve(process.cwd(), 'src/app/App.tsx'), 'utf8');
        expect(page).toContain('scrollToZava(\'zava-signals\')');
        expect(page).toContain('scrollToZava(\'zava-data-health\')');
        expect(page).toContain('onAsk={focusZavaQuestion}');
        expect(page).toContain('showDataHealth');
        expect(page).toContain('isAdmin && isStaging');
        expect(page).toContain('railCounts(signals)');
        expect(page).toContain('railCounts(health)');
        expect(page).toContain('@media (max-width: 767px)');
        expect(page).toContain('zava-rail');
        expect(rolePillLabel('admin')).toBe('Admin');
        expect(rolePillLabel('manager')).toBe('Manager');
        expect(app).toContain('rolePillLabel(user?.role)');
        expect(app).toContain("location.pathname.startsWith('/agent')");
    });
});
