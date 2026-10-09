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
