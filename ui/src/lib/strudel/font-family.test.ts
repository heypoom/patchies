import { expect, it } from 'vitest';
import { normalizeStrudelFontFamily } from './font-family';

it.each([
  ['Press Start 2P', '"Press Start 2P"'],
  ['  Press Start 2P  ', '"Press Start 2P"'],
  ['Monaco', '"Monaco"'],
  ['"Press Start 2P"', '"Press Start 2P"'],
  ["'Press Start 2P'", "'Press Start 2P'"],
  ['"Press Start 2P", monospace', '"Press Start 2P", monospace'],
  ['Monaco, monospace', '"Monaco", monospace'],
  ['Press Start 2P, monospace', '"Press Start 2P", monospace'],
  ['  Monaco , Press Start 2P , monospace  ', '"Monaco", "Press Start 2P", monospace'],
  ['Monaco, "Press Start 2P", monospace', '"Monaco", "Press Start 2P", monospace'],
  ['Monaco, var(--font-mono)', '"Monaco", var(--font-mono)'],
  ['Monaco, var(--font-mono, monospace)', '"Monaco", var(--font-mono, monospace)'],
  ['"Font, Name", Press Start 2P, monospace', '"Font, Name", "Press Start 2P", monospace'],
  ['var(--font-mono, monospace)', 'var(--font-mono, monospace)'],
  [
    'var(--font-mono, var(--fallback, monospace)), Press Start 2P',
    'var(--font-mono, var(--fallback, monospace)), "Press Start 2P"'
  ],
  ['"Monaco", "Press Start 2P"', '"Monaco", "Press Start 2P"'],
  ['monospace', 'monospace'],
  ['system-ui', 'system-ui'],
  ['inherit', 'inherit'],
  ['var(--font-mono)', 'var(--font-mono)'],
  ['A "quoted" font', '"A \\"quoted\\" font"'],
  ['', '']
])('normalizes Strudel font family %s', (input, expected) => {
  expect(normalizeStrudelFontFamily(input)).toBe(expected);
});
