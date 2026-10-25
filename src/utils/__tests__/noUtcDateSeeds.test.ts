/**
 * Forbidden UTC date slices are allowed only when the same line contains `utc-date-ok`.
 *
 * A line matching toISOString().slice(0, 10), toISOString().slice(0,10), or
 * toISOString().split('T')[0] fails this scan unless that same line includes
 * the marker, for example a trailing // comment, or a block comment when a
 * trailing // would break JSX or a string.
 *
 * Scans src/ and skips *.test.*, *.spec.*, __tests__, mocks, and __mocks__.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');

const FORBIDDEN = [
  'toISOString().slice(0, 10)',
  'toISOString().slice(0,10)',
  "toISOString().split('T')[0]",
];

const MARKER = 'utc-date-ok';

function isSkipped(rel: string): boolean {
  const parts = rel.split('/');
  if (parts.some((part) => part === '__tests__' || part === 'mocks' || part === '__mocks__')) return true;
  const base = parts[parts.length - 1] || '';
  return base.includes('.test.') || base.includes('.spec.');
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(SRC, full).split('\\').join('/');
    if (isSkipped(rel)) continue;
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

describe('no UTC date seeds', () => {
  it('fails on unmarked toISOString date slices under src/', () => {
    const hits: string[] = [];

    for (const rel of sourceFiles(SRC)) {
      const lines = readFileSync(join(SRC, rel), 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (!FORBIDDEN.some((pattern) => line.includes(pattern))) return;
        if (line.includes(MARKER)) return;
        hits.push(`${rel}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(hits, `unmarked UTC date slices:\n${hits.join('\n')}`).toEqual([]);
  });
});
