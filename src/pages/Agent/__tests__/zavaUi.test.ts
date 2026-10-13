import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { blocksFromAnswer, visibleText } from '../formatAnswer';
import {
    ERRORS,
    INVALID_EMAIL,
    MAILBOX_WARNING,
    cannotReceiveMail,
    isValidEmail,
    messageForFailure,
    showMorningBriefing,
    showNewConversation,
    stepView,
} from '../zavaCopy';

describe('email validation', () => {
    it('accepts a normal address and rejects anything else', () => {
        expect(isValidEmail('owner@shop.com')).toBe(true);
        expect(isValidEmail('not an email')).toBe(false);
        expect(isValidEmail('missing-at.com')).toBe(false);
        expect(INVALID_EMAIL).toBe('Enter a valid email address.');
    });
});

describe('step names', () => {
    it('uses plain words and links the reports an owner already has', () => {
        expect(stepView('receivables_ageing')).toEqual({
            label: 'Looked up overdue invoices',
            href: '/reports/aged-receivable',
        });
        expect(stepView('low_stock').href).toBe('/products');
        expect(stepView('waiting_for_approval').href).toBe('/finance/expenses/approvals');
        expect(stepView('delegate').label).toBe('Checked the company records');
        expect(stepView('secret_tool').label).toBe('Looked something up');
    });
});

describe('error messages', () => {
    it('explains each failure without an apology', () => {
        expect(messageForFailure({ detail: 'Zava is not available right now. Contact SOLTOL support if this continues.' })).toBe(ERRORS.off);
        expect(messageForFailure({ detail: 'The AI agent is not available in production.' })).toBe(ERRORS.off);
        expect(messageForFailure({ detail: "This company's monthly Zava limit is reached. Zava will answer again next month." })).toBe(ERRORS.limit);
        expect(messageForFailure({ detail: 'Zava is available to admin, manager, and accountant users.' })).toBe(ERRORS.role);
        expect(messageForFailure({ timedOut: true })).toBe(ERRORS.timeout);
        expect(messageForFailure({ detail: 'Stopped: this request reached the 60 second limit.' })).toBe(ERRORS.timeout);
        expect(messageForFailure({ network: true })).toBe(ERRORS.network);
        for (const message of Object.values(ERRORS)) {
            expect(message.toLowerCase()).not.toContain('sorry');
            expect(message.toLowerCase()).not.toContain('apolog');
        }
    });
});

describe('example.com warning', () => {
    it('warns when the login address cannot receive mail', () => {
        expect(cannotReceiveMail('scratch-import-20260719@example.com')).toBe(true);
        expect(cannotReceiveMail('person@shop.example.com')).toBe(true);
        expect(cannotReceiveMail('not-an-email')).toBe(true);
        expect(cannotReceiveMail('owner@shop.com')).toBe(false);
        expect(MAILBOX_WARNING).toContain('cannot receive mail');
    });
});

describe('who sees the morning briefing', () => {
    it('shows the briefing only to admins, and new conversation only after a question', () => {
        expect(showMorningBriefing('admin')).toBe(true);
        expect(showMorningBriefing('manager')).toBe(false);
        expect(showMorningBriefing('accountant')).toBe(false);
        expect(showMorningBriefing('sales')).toBe(false);
        expect(showNewConversation(0)).toBe(false);
        expect(showNewConversation(1)).toBe(true);
    });
});

describe('question box focus', () => {
    it('keeps the textarea borderless when focused and brightens the rounded box', () => {
        const agent = readFileSync(resolve(process.cwd(), 'src/pages/Agent/AgentPage.tsx'), 'utf8');
        const style = agent.match(/<style>\{`([\s\S]*?)`\}<\/style>/)?.[1];
        expect(style).toBeTruthy();

        const global = document.createElement('style');
        global.textContent = `
            textarea:hover,
            textarea:focus,
            textarea:focus-visible,
            textarea:active {
                outline: 3px solid red;
                outline-offset: 2px;
                border: 2px solid red;
                border-radius: 4px;
                box-shadow: 0 0 0 3px red;
                background: white;
                background-color: white;
                appearance: auto;
                resize: both;
            }
        `;
        document.head.appendChild(global);
        const tag = document.createElement('style');
        tag.textContent = style ?? '';
        document.head.appendChild(tag);

        document.body.innerHTML = `
            <div class="zava-page">
                <div class="zava-ask">
                    <textarea id="zava-question" class="zava-control"></textarea>
                </div>
            </div>
        `;
        const field = document.getElementById('zava-question') as HTMLTextAreaElement;
        field.focus();
        const computed = getComputedStyle(field);
        expect(computed.outlineStyle).toBe('none');
        expect(computed.outlineWidth).toBe('0px');
        expect(computed.borderTopStyle).toBe('none');
        expect(computed.borderTopWidth).toBe('0px');
        expect(computed.boxShadow).toBe('none');
        expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(computed.backgroundColor);
        expect(computed.borderRadius).toBe('0px');
        expect(computed.resize).toBe('none');

        const box = document.querySelector('.zava-ask') as HTMLElement;
        const shadow = getComputedStyle(box).boxShadow;
        expect(shadow).toContain('#c4b5fd');
        expect(shadow).toContain('2px');
        expect(shadow).toContain('28px');
    });
});

describe('signals under the question box', () => {
    it('loads the feed on the page and shows the empty sentence', () => {
        const agent = readFileSync(resolve(process.cwd(), 'src/pages/Agent/AgentPage.tsx'), 'utf8');
        const question = agent.indexOf('id="zava-question"');
        const signals = agent.indexOf('id="zava-signals-title"');
        expect(question).toBeGreaterThan(0);
        expect(signals).toBeGreaterThan(question);
        expect(agent).toContain('Nothing needs your attention right now.');
        expect(agent).toContain("api.get<{ cards: SignalCard[] }>('/api/agent/signals')");
        expect(agent).toContain("api.get<{ data_health?: SignalCard[] }>('/api/agent/data-health')");
        const start = agent.indexOf("api.get<{ cards: SignalCard[] }>('/api/agent/signals')");
        const healthCall = agent.indexOf("api.get<{ data_health?: SignalCard[] }>('/api/agent/data-health')");
        const load = agent.slice(start, healthCall);
        expect(load).not.toContain('/api/agent/data-health');
        expect(load).not.toContain('/api/agent/chat');
        expect(load).not.toContain('complete(');
        expect(agent).toContain('Signals could not be loaded.');
        expect(agent).toContain('Data health could not be loaded.');
        const health = agent.indexOf('id="zava-data-health-title"');
        expect(health).toBeGreaterThan(signals);
        expect(agent).toContain("user?.role === 'admin' || user?.role === 'accountant'");
        expect(agent).toContain('{showDataHealth && (');
        expect(agent).toContain('No book problems found.');
    });
});

describe('talk to zava', () => {
    it('shows the orb states, the stop button, and the permission and cap messages', () => {
        const agent = readFileSync(resolve(process.cwd(), 'src/pages/Agent/AgentPage.tsx'), 'utf8');
        const copy = readFileSync(resolve(process.cwd(), 'src/pages/Agent/zavaCopy.ts'), 'utf8');
        expect(copy).toContain("idle: 'Idle'");
        expect(copy).toContain("listening: 'Listening'");
        expect(copy).toContain("thinking: 'Thinking'");
        expect(copy).toContain("speaking: 'Zava is speaking'");
        expect(copy).toContain('The microphone is off. Allow the microphone for this site, then tap the orb again.');
        expect(copy).toContain("cap: ERRORS.limit");
        expect(agent).toContain('id="zava-orb"');
        expect(agent).toContain('id="zava-voice-stop"');
        expect(agent).toContain("api.get('/api/agent/voice')");
        const ready = agent.indexOf("api.get('/api/agent/voice')");
        const mic = agent.indexOf('getUserMedia');
        expect(ready).toBeGreaterThan(0);
        expect(mic).toBeGreaterThan(ready);
        expect(agent).toContain("permissionDenied(error) ? VOICE.denied");
        expect(agent).toContain('id="zava-voice-countdown"');
        expect(agent).toContain('RECORD_LIMIT_SECONDS * 1000');
        expect(agent).toContain('recordingCountdown');
        expect(agent).toContain('id="zava-signals-title"');
    });

    it('keeps the suggestion chips above the question box', () => {
        const agent = readFileSync(resolve(process.cwd(), 'src/pages/Agent/AgentPage.tsx'), 'utf8');
        const style = agent.match(/<style>\{`([\s\S]*?)`\}<\/style>/)?.[1] || '';
        const pageRule = style.slice(style.indexOf('.zava-page {'), style.indexOf('}', style.indexOf('.zava-page {')));
        expect(pageRule).toContain('overflow: visible');
        expect(pageRule).toContain('height: auto');
        expect(pageRule).not.toContain('overflow: hidden');
        expect(pageRule).not.toContain('height: calc');
        const chips = agent.indexOf('id="zava-suggestions"');
        const orb = agent.indexOf('id="zava-orb"');
        const question = agent.indexOf('id="zava-question"');
        expect(chips).toBeGreaterThan(0);
        expect(orb).toBeGreaterThan(chips);
        expect(question).toBeGreaterThan(orb);
        expect(agent).not.toContain('max-h-48');
        expect(agent).toContain('zava-signal-grid');
        expect(agent).toContain('grid-template-columns: 1fr');
        expect(agent).toContain('.zava-signal-grid { grid-template-columns: 1fr 1fr; }');
    });
});

describe('answers never render raw HTML', () => {
    it('keeps markup as text', () => {
        const source = 'Hello <script>alert(1)</script> **total**\n\n- one';
        const blocks = blocksFromAnswer(source);
        expect(visibleText(blocks)).toContain('<script>alert(1)</script>');
        expect(JSON.stringify(blocks)).not.toContain('dangerouslySetInnerHTML');
        const page = readFileSync(resolve(process.cwd(), 'src/pages/Agent/formatAnswer.tsx'), 'utf8');
        const agent = readFileSync(resolve(process.cwd(), 'src/pages/Agent/AgentPage.tsx'), 'utf8');
        expect(page).not.toContain('dangerouslySetInnerHTML');
        expect(agent).not.toContain('dangerouslySetInnerHTML');
    });
});
