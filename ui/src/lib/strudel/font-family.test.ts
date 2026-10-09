import { expect, it } from 'vitest';
import { normalizeStrudelFontFamily } from './font-family';

it.each([
  ['Press Start 2P', '"Press Start 2P"'],
  ['  Press Start 2P  ', '"Press Start 2P"'],
  ['Monaco', '"Monaco"'],
  ['"Press Start 2P"', '"Press Start 2P"'],
  ["'Press Start 2P'", "'Press Start 2P'"],
  ['"Press Start 2P", monospace', '"Press Start 2P", monospace'],
  ['Monaco, monospace', 'Monaco, monospace'],
  ['monospace', 'monospace'],
  ['system-ui', 'system-ui'],
  ['inherit', 'inherit'],
  ['var(--font-mono)', 'var(--font-mono)'],
  ['A "quoted" font', '"A \\"quoted\\" font"'],
  ['', '']
])('normalizes Strudel font family %s', (input, expected) => {
  expect(normalizeStrudelFontFamily(input)).toBe(expected);
});
