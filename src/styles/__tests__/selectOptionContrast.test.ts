import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const themeCss = readFileSync(resolve(__dirname, '../theme.css'), 'utf8');

describe('open dropdown list colors', () => {
    it('forces every option to dark text on white without restyling the closed select', () => {
        const rule = themeCss.match(/select option\s*\{[^}]+\}/)?.[0] ?? '';
        expect(rule).toContain('background-color: #ffffff !important;');
        expect(rule).toContain('color: #0a1726 !important;');
        expect(themeCss).not.toMatch(/[^-\w]select\s*\{[^}]*color:\s*#0a1726\s*!important/);

        const style = document.createElement('style');
        style.textContent = rule;
        document.head.appendChild(style);
        const select = document.createElement('select');
        select.style.color = '#EEF2FF';
        select.style.backgroundColor = '#0a1726';
        const option = document.createElement('option');
        option.textContent = 'asset';
        select.appendChild(option);
        document.body.appendChild(select);

        expect(getComputedStyle(option).color).toBe('rgb(10, 23, 38)');
        expect(getComputedStyle(option).backgroundColor).toBe('rgb(255, 255, 255)');
        expect(getComputedStyle(select).color).toBe('rgb(238, 242, 255)');

        select.remove();
        style.remove();
    });
});
