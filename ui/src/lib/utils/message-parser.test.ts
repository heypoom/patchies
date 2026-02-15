import { describe, expect, it } from 'vitest';
import { splitSequentialMessages, splitByTopLevelSpaces } from './message-parser';

describe('splitSequentialMessages', () => {
  it.each([
    // Single messages (no splitting)
    ['bang', ['bang']],
    ['100', ['100']],
    ['{a: 1, b: 2}', ['{a: 1, b: 2}']],
    ['[1, 2, 3]', ['[1, 2, 3]']],
    ['"hello, world"', ['"hello, world"']],
    ["'hello, world'", ["'hello, world'"]],
    ['', ['']],

    // Comma-separated messages
    ['bang, 100, hello', ['bang', '100', 'hello']],
    ['{a: 1, b: 2}, bang', ['{a: 1, b: 2}', 'bang']],
    ['[1, 2], [3, 4]', ['[1, 2]', '[3, 4]']],
    ['{a: [1, 2], b: {c: 3}}, bang', ['{a: [1, 2], b: {c: 3}}', 'bang']],
    ['"hello, world", 42', ['"hello, world"', '42']],
    [
      '{type: "set", value: 1}, bang, [255, 0, 0]',
      ['{type: "set", value: 1}', 'bang', '[255, 0, 0]']
    ],
    ["'hello, world', 42", ["'hello, world'", '42']],

    // Placeholders
    ['{note: $1}, bang', ['{note: $1}', 'bang']],
    ['$1, bang', ['$1', 'bang']],

    // Edge cases
    ['  bang  ,  100  ', ['bang', '100']],
    ['bang, ', ['bang']],
    [', bang', ['bang']],
    ['{a: {b: {c: [1, 2, 3]}}}, bang', ['{a: {b: {c: [1, 2, 3]}}}', 'bang']],
    ['"hello \\"world\\"", 42', ['"hello \\"world\\""', '42']],
    ['`hello, world`, 42', ['`hello, world`', '42']],
    ['{a: 1', ['{a: 1']],
    ['bang,,100', ['bang', '100']]
  ])('%j → %j', (input, expected) => {
    expect(splitSequentialMessages(input)).toEqual(expected);
  });
});

describe('splitByTopLevelSpaces', () => {
  it.each([
    // Single tokens (no splitting)
    ['bang', ['bang']],
    ['1024', ['1024']],
    ['{a: 1, b: 2}', ['{a: 1, b: 2}']],
    ['[1, 2, 3]', ['[1, 2, 3]']],
    ['"hello world"', ['"hello world"']],
    ["'hello world'", ["'hello world'"]],
    ['', ['']],

    // Space-separated tokens
    ['1024 2048', ['1024', '2048']],
    ['1024 2048 4096', ['1024', '2048', '4096']],
    ['bang 100 hello', ['bang', '100', 'hello']],
    ["1024 bang {type: 'set', value: 1} 'yo'", ['1024', 'bang', "{type: 'set', value: 1}", "'yo'"]],
    ['"hello world" 42', ['"hello world"', '42']],
    ["'hello world' 42", ["'hello world'", '42']],
    ['{x: 1} [1, 2]', ['{x: 1}', '[1, 2]']],

    // Spaces inside structures preserved
    ['{a: 1, b: 2} bang', ['{a: 1, b: 2}', 'bang']],
    ['[1, 2, 3] bang', ['[1, 2, 3]', 'bang']],
    ['{a: {b: [1, 2]}} bang', ['{a: {b: [1, 2]}}', 'bang']],

    // Edge cases
    ['  1024   2048  ', ['1024', '2048']],
    ['1024  2048', ['1024', '2048']]
  ])('%j → %j', (input, expected) => {
    expect(splitByTopLevelSpaces(input)).toEqual(expected);
  });
});
