import type { ReactNode } from 'react';

export type Inline = { kind: 'text'; text: string } | { kind: 'bold'; text: string };

export type Block =
    | { kind: 'paragraph'; inlines: Inline[] }
    | { kind: 'list'; items: Inline[][] }
    | { kind: 'table'; headers: string[]; rows: string[][] };

function parseInlines(line: string): Inline[] {
    const parts: Inline[] = [];
    const pattern = /\*\*(.+?)\*\*/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
        if (match.index > last) parts.push({ kind: 'text', text: line.slice(last, match.index) });
        parts.push({ kind: 'bold', text: match[1] });
        last = match.index + match[0].length;
    }
    if (last < line.length) parts.push({ kind: 'text', text: line.slice(last) });
    if (parts.length === 0) parts.push({ kind: 'text', text: line });
    return parts;
}

function tableCells(line: string): string[] | 'rule' | null {
    if (!line.includes('|')) return null;
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    const cells = trimmed.split('|').map((cell) => cell.trim());
    if (cells.length < 2) return null;
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) return 'rule';
    return cells;
}

export function blocksFromAnswer(source: string): Block[] {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const blocks: Block[] = [];
    let paragraph: string[] = [];
    let list: Inline[][] = [];
    let table: string[][] = [];

    const flushParagraph = () => {
        const text = paragraph.join(' ').trim();
        paragraph = [];
        if (text) blocks.push({ kind: 'paragraph', inlines: parseInlines(text) });
    };
    const flushList = () => {
        if (list.length) blocks.push({ kind: 'list', items: list });
        list = [];
    };
    const flushTable = () => {
        if (table.length) {
            const [headers, ...rows] = table;
            blocks.push({ kind: 'table', headers, rows });
        }
        table = [];
    };
    const flushAll = () => {
        flushParagraph();
        flushList();
        flushTable();
    };

    for (const line of lines) {
        const cells = tableCells(line);
        if (cells === 'rule') continue;
        if (cells) {
            flushParagraph();
            flushList();
            table.push(cells);
            continue;
        }
        flushTable();
        const item = line.match(/^\s*[-*]\s+(.*)$/);
        if (item) {
            flushParagraph();
            list.push(parseInlines(item[1]));
            continue;
        }
        flushList();
        if (line.trim() === '') {
            flushParagraph();
            continue;
        }
        paragraph.push(line.trim());
    }
    flushAll();
    return blocks;
}

export function visibleText(blocks: Block[]): string {
    const inlineText = (inlines: Inline[]) => inlines.map((part) => part.text).join('');
    return blocks.map((block) => {
        if (block.kind === 'paragraph') return inlineText(block.inlines);
        if (block.kind === 'list') return block.items.map(inlineText).join(' ');
        return [...block.headers, ...block.rows.flat()].join(' ');
    }).join(' ');
}

function Inlines({ parts }: { parts: Inline[] }) {
    return (
        <>
            {parts.map((part, index) => (
                part.kind === 'bold'
                    ? <strong key={index}>{part.text}</strong>
                    : <span key={index}>{part.text}</span>
            ))}
        </>
    );
}

export function AnswerBody({ source }: { source: string }): ReactNode {
    const blocks = blocksFromAnswer(source);
    return (
        <div className="space-y-3 text-[15px] leading-6 text-redwood-text-main" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {blocks.map((block, index) => {
                if (block.kind === 'list') {
                    return (
                        <ul key={index} className="list-disc space-y-1 pl-5">
                            {block.items.map((item, itemIndex) => (
                                <li key={itemIndex}><Inlines parts={item} /></li>
                            ))}
                        </ul>
                    );
                }
                if (block.kind === 'table') {
                    return (
                        <div key={index} className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr>
                                        {block.headers.map((header) => (
                                            <th key={header} className="border-b border-redwood-border px-2 py-1 font-semibold">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {block.rows.map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {row.map((cell, cellIndex) => (
                                                <td key={cellIndex} className="border-b border-redwood-border px-2 py-1">{cell}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                }
                return <p key={index}><Inlines parts={block.inlines} /></p>;
            })}
        </div>
    );
}
