import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';

export type MetricTile = {
    label: string;
    value: string;
    href?: string;
};

export type RankedItem = {
    name: string;
    value: string;
    share?: number;
    href?: string;
};

export type AgeBucket = {
    key: string;
    label: string;
    amount: number;
    count: number;
};

export type Debtor = {
    name: string;
    value: string;
    href?: string;
};

export type TableRow = {
    cells: string[];
    href?: string;
};

export type ApprovalGroup = {
    type: string;
    count: number;
    href?: string;
};

export type SpatialBlock = {
    type: string;
    tiles?: MetricTile[];
    items?: RankedItem[];
    value?: string;
    invoice_count?: number;
    href?: string;
    buckets?: AgeBucket[];
    debtors?: Debtor[];
    columns?: string[];
    rows?: TableRow[];
    view_all?: { label: string; href: string };
    groups?: ApprovalGroup[];
    reason?: string;
    actions?: string[];
    headline?: string;
};

const TONE: Record<string, string> = {
    '0_30': 'var(--color-brand-green)',
    '31_60': 'var(--color-brand-amber)',
    '61_90': 'color-mix(in srgb, var(--color-brand-amber) 45%, var(--color-brand-red))',
    '90_plus': 'var(--color-brand-red)',
};

export const SPATIAL_CSS = `
.zava-glass {
    position: relative;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(15,31,51,0.70);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.35),
        inset 2px 0 14px rgba(196,181,253,0.20),
        0 10px 28px rgba(0,0,0,0.28),
        0 2px 6px rgba(0,0,0,0.18);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
    animation: zava-rise 250ms ease;
}
.zava-headline { margin: 0; font-size: 20px; font-weight: 600; line-height: 1.35; color: var(--color-redwood-text-main); }
.zava-note { margin: 0; font-size: 15px; line-height: 1.5; color: var(--color-redwood-text-muted); }
.zava-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; min-width: 0; }
@media (min-width: 640px) {
    .zava-metrics[data-count="1"] { grid-template-columns: 1fr; }
    .zava-metrics[data-count="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .zava-metrics[data-count="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.zava-tile, .zava-row, .zava-group {
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.06);
    color: inherit;
    text-decoration: none;
    min-width: 0;
    animation: zava-in 200ms ease both;
}
.zava-tile { display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 14px; min-height: 84px; }
.zava-label { font-size: 13px; line-height: 1.3; color: var(--color-redwood-text-muted); }
.zava-figure { font-size: 28px; line-height: 1.1; font-weight: 600; color: var(--color-redwood-text-main); font-variant-numeric: tabular-nums; }
.zava-row, .zava-group { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px 12px; align-items: center; padding: 12px 14px; }
.zava-row-name, .zava-cell { min-width: 0; overflow-wrap: anywhere; font-size: 15px; color: var(--color-redwood-text-main); }
.zava-row-value { font-variant-numeric: tabular-nums; font-size: 15px; color: var(--color-redwood-text-main); }
.zava-share { font-size: 13px; color: var(--color-redwood-text-muted); font-variant-numeric: tabular-nums; }
.zava-share-bar { grid-column: 1 / -1; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
.zava-share-bar > span { display: block; height: 100%; background: var(--color-brand-blue); }
.zava-bar { display: flex; height: 10px; width: 100%; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,0.06); }
.zava-bar > span { display: block; height: 100%; min-width: 0; }
.zava-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 8px 0 0; padding: 0; list-style: none; }
.zava-legend li { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-redwood-text-muted); }
.zava-swatch { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
.zava-table-wrap { min-width: 0; overflow-x: hidden; display: flex; flex-direction: column; gap: 8px; }
.zava-table-head, .zava-table-row { display: grid; gap: 8px 12px; min-width: 0; }
.zava-table-head { font-size: 13px; color: var(--color-redwood-text-muted); padding: 0 14px; }
.zava-table-row { border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.06); color: inherit; text-decoration: none; padding: 12px 14px; animation: zava-in 200ms ease both; }
.zava-view-all { font-size: 13px; color: var(--color-brand-blue); }
.zava-hit { transition: transform 150ms ease, border-color 150ms ease; }
.zava-hit:hover { transform: translateY(-2px); border-color: rgba(238,242,255,0.38); }
.zava-hit:focus-visible { outline: 2px solid #C4B5FD; outline-offset: 2px; }
.zava-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 8px 0 4px; }
.zava-empty-icon { width: 48px; height: 48px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.06); color: var(--color-redwood-text-muted); }
.zava-empty p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--color-redwood-text-muted); max-width: 360px; }
.zava-pills, .zava-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.zava-pill, .zava-user-pill {
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(15,31,51,0.70);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: var(--color-redwood-text-main);
    font-size: 14px;
    line-height: 1.3;
    padding: 8px 14px;
}
.zava-pill { cursor: pointer; }
.zava-user-pill { max-width: 85%; }
.zava-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 12px; color: var(--color-redwood-text-muted); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .zava-glass, .zava-pill, .zava-user-pill { background: var(--color-redwood-bg-surface); }
}
@media (max-width: 480px) {
    .zava-metrics { grid-template-columns: 1fr 1fr; }
    .zava-row, .zava-group { grid-template-columns: minmax(0, 1fr) auto; }
    .zava-table-head { display: none; }
    .zava-table-row { display: flex; flex-direction: column; align-items: stretch; }
    .zava-table-row .zava-cell { display: flex; justify-content: space-between; gap: 12px; }
    .zava-table-row .zava-cell::before { content: attr(data-label); color: var(--color-redwood-text-muted); font-size: 13px; }
}
@media (prefers-reduced-motion: reduce) {
    .zava-glass, .zava-tile, .zava-row, .zava-group, .zava-table-row { animation: none; }
    .zava-hit, .zava-hit:hover { transition: none; transform: none; }
}
@keyframes zava-rise {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: none; }
}
@keyframes zava-in {
    from { opacity: 0; }
    to { opacity: 1; }
}
`;

export function SpatialStyles() {
    return <style>{SPATIAL_CSS}</style>;
}

function delayStyle(index: number): { animationDelay: string } {
    return { animationDelay: `${index * 40}ms` };
}

function Hit({ href, className, children, index }: { href?: string; className: string; children: ReactNode; index: number }) {
    const style = delayStyle(index);
    if (!href) return <div className={className} style={style}>{children}</div>;
    return <Link className={`${className} zava-hit zava-control`} to={href} style={style}>{children}</Link>;
}

export function SpatialBlocks({ blocks, onAsk }: { blocks: SpatialBlock[]; onAsk: (question: string) => void }) {
    let index = 0;
    const next = () => index++;
    return (
        <>
            {blocks.map((block, blockIndex) => {
                if (block.type === 'metrics' && block.tiles?.length) {
                    const count = Math.min(block.tiles.length, 4);
                    return (
                        <div key={blockIndex} className="zava-metrics" data-count={count}>
                            {block.tiles.slice(0, 4).map((tile) => {
                                const order = next();
                                return (
                                    <Hit key={tile.label} href={tile.href} className="zava-tile" index={order}>
                                        <span className="zava-label">{tile.label}</span>
                                        <span className="zava-figure">{tile.value}</span>
                                    </Hit>
                                );
                            })}
                        </div>
                    );
                }
                if (block.type === 'ranked_list' && block.items?.length) {
                    return (
                        <div key={blockIndex} className="flex flex-col gap-2">
                            {block.items.map((item) => {
                                const order = next();
                                const share = Number(item.share || 0);
                                return (
                                    <Hit key={`${item.name}-${order}`} href={item.href} className="zava-row" index={order}>
                                        <span className="zava-row-name">{item.name}</span>
                                        <span className="zava-row-value">{item.value}</span>
                                        <span className="zava-share">{share}%</span>
                                        <span className="zava-share-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, share))}%` }} /></span>
                                    </Hit>
                                );
                            })}
                        </div>
                    );
                }
                if (block.type === 'ageing' && block.buckets) {
                    const total = block.buckets.reduce((sum, bucket) => sum + Number(bucket.amount || 0), 0);
                    const totalOrder = next();
                    const countOrder = next();
                    return (
                        <div key={blockIndex} className="flex flex-col gap-4">
                            <div className="zava-metrics" data-count="2">
                                <Hit href={block.href} className="zava-tile" index={totalOrder}>
                                    <span className="zava-label">Total</span>
                                    <span className="zava-figure">{block.value}</span>
                                </Hit>
                                <div className="zava-tile" style={delayStyle(countOrder)}>
                                    <span className="zava-label">Invoices</span>
                                    <span className="zava-figure">{block.invoice_count ?? 0}</span>
                                </div>
                            </div>
                            <div>
                                <div className="zava-bar" role="img" aria-label="How the balance splits by age">
                                    {block.buckets.map((bucket) => (
                                        <span
                                            key={bucket.key}
                                            style={{
                                                width: total > 0 ? `${(Number(bucket.amount) / total) * 100}%` : '0%',
                                                background: TONE[bucket.key] || 'var(--color-brand-blue)',
                                            }}
                                        />
                                    ))}
                                </div>
                                <ul className="zava-legend">
                                    {block.buckets.map((bucket) => (
                                        <li key={bucket.label}>
                                            <i className="zava-swatch" style={{ background: TONE[bucket.key] || 'var(--color-brand-blue)' }} />
                                            {bucket.label} · {bucket.count}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {block.debtors?.map((debtor) => {
                                const order = next();
                                return (
                                    <Hit key={`${debtor.name}-${order}`} href={debtor.href} className="zava-row" index={order}>
                                        <span className="zava-row-name">{debtor.name}</span>
                                        <span className="zava-row-value">{debtor.value}</span>
                                    </Hit>
                                );
                            })}
                        </div>
                    );
                }
                if (block.type === 'table' && block.columns && block.rows) {
                    return (
                        <div key={blockIndex} className="zava-table-wrap">
                            <div className="zava-table-head" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${block.columns.length}, minmax(0, 1fr))` }}>
                                {block.columns.map((column) => <span key={column}>{column}</span>)}
                            </div>
                            {block.rows.slice(0, 10).map((row, rowIndex) => {
                                const order = next();
                                const body = block.columns!.map((column, cellIndex) => (
                                    <span key={column} className="zava-cell" data-label={column}>{row.cells[cellIndex] ?? ''}</span>
                                ));
                                if (!row.href) {
                                    return <div key={rowIndex} className="zava-table-row" style={{ ...delayStyle(order), gridTemplateColumns: `repeat(${block.columns!.length}, minmax(0, 1fr))` }}>{body}</div>;
                                }
                                return (
                                    <Link
                                        key={rowIndex}
                                        className="zava-hit zava-control zava-table-row"
                                        to={row.href}
                                        style={{ ...delayStyle(order), gridTemplateColumns: `repeat(${block.columns!.length}, minmax(0, 1fr))` }}
                                    >
                                        {body}
                                    </Link>
                                );
                            })}
                            {block.view_all && (
                                <Link className="zava-control zava-view-all" to={block.view_all.href}>{block.view_all.label}</Link>
                            )}
                        </div>
                    );
                }
                if (block.type === 'approvals' && block.groups?.length) {
                    return (
                        <div key={blockIndex} className="flex flex-col gap-2">
                            {block.groups.map((group) => {
                                const order = next();
                                return (
                                    <Hit key={group.type} href={group.href} className="zava-group" index={order}>
                                        <span className="zava-row-name">{group.type}</span>
                                        <span className="zava-row-value">{group.count}</span>
                                    </Hit>
                                );
                            })}
                        </div>
                    );
                }
                if (block.type === 'empty') {
                    return (
                        <div key={blockIndex} className="zava-empty">
                            <span className="zava-empty-icon" aria-hidden="true"><Inbox size={20} /></span>
                            {block.reason ? <p>{block.reason}</p> : null}
                            {!!block.actions?.length && (
                                <div className="zava-actions">
                                    {block.actions.slice(0, 3).map((action) => (
                                        <button key={action} type="button" className="zava-pill zava-control" onClick={() => onAsk(action)}>
                                            {action}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }
                return null;
            })}
        </>
    );
}

export function ZavaPanel({
    headline,
    note,
    blocks,
    onAsk,
    children,
}: {
    headline: string;
    note?: string | null;
    blocks: SpatialBlock[];
    onAsk: (question: string) => void;
    children?: ReactNode;
}) {
    return (
        <div className="zava-glass">
            <h2 className="zava-headline">{headline}</h2>
            {note ? <p className="zava-note">{note}</p> : null}
            <SpatialBlocks blocks={blocks} onAsk={onAsk} />
            {children}
        </div>
    );
}

export function FollowUps({ questions, onAsk }: { questions: string[]; onAsk: (question: string) => void }) {
    if (!questions.length) return null;
    return (
        <div className="zava-pills mt-3">
            {questions.slice(0, 3).map((question) => (
                <button key={question} type="button" className="zava-pill zava-control" onClick={() => onAsk(question)}>
                    {question}
                </button>
            ))}
        </div>
    );
}
