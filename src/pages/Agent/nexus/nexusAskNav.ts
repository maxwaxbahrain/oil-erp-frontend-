import type { SpatialBlock } from '../spatial';

export type AskNavButton = { label: string; href: string };

export type AskAnswer = {
  headline: string;
  detail: string;
  buttons: AskNavButton[];
};

export function navButtonsFromBlocks(blocks: SpatialBlock[] | undefined): AskNavButton[] {
  const out: AskNavButton[] = [];
  const seen = new Set<string>();
  const push = (label: string, href?: string) => {
    if (!href || seen.has(href) || out.length >= 2) return;
    seen.add(href);
    out.push({ label, href });
  };
  for (const block of blocks || []) {
    if (block.view_all?.href) push(block.view_all.label || 'Open', block.view_all.href);
    if (block.href) push(block.headline || 'Open', block.href);
    for (const tile of block.tiles || []) {
      push(tile.label ? `Open ${tile.label}` : 'Open', tile.href);
    }
    for (const item of block.items || []) {
      push(item.name ? `Open ${item.name}` : 'Open', item.href);
    }
    for (const d of block.debtors || []) {
      push(d.name ? `Open ${d.name}` : 'Open customer', d.href);
    }
    for (const row of block.rows || []) {
      push('Open', row.href);
    }
    for (const g of block.groups || []) {
      push(g.type ? `Open ${g.type}` : 'Open', g.href);
    }
  }
  return out.slice(0, 2);
}
