import { describe, expect, it } from 'vitest';
import {
  splitSequentialMessages,
  splitByTopLevelSpaces,
  parseNamedArgs,
  tryResolveShorthand
} from './message-parser';
import type { FieldMapping } from '$lib/objects/schemas/utils';

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

describe('parseNamedArgs', () => {
  it.each([
    // All positional
    [['1', '2', '3'], { positional: ['1', '2', '3'], named: {} }],

    // All named
    [['key=foo', 'value=42'], { positional: [], named: { key: 'foo', value: '42' } }],

    // Mixed
    [['foo', 'value=42'], { positional: ['foo'], named: { value: '42' } }],

    // Named with complex values
    [['value={x: 1}'], { positional: [], named: { value: '{x: 1}' } }],
    [['value="hello world"'], { positional: [], named: { value: '"hello world"' } }],

    // Not named: no key before =
    [['=foo'], { positional: ['=foo'], named: {} }],

    // Not named: key starts with number
    [['2x=foo'], { positional: ['2x=foo'], named: {} }],

    // Empty
    [[], { positional: [], named: {} }]
  ])('%j → %j', (input, expected) => {
    expect(parseNamedArgs(input)).toEqual(expected);
  });
});

describe('tryResolveShorthand', () => {
  // Test type map simulating real schemas:
  // set: 1-field {value: Any}, 2-field {key: String, value: Any}
  // get: 1-field {key: String}
  // setCode: 1-field {value: String} (lastFieldIsString)
  // bang, clear: 0-field symbols
  const typeMap = new Map<string, FieldMapping[]>([
    [
      'set',
      [
        { fields: ['value'], lastFieldIsString: false },
        { fields: ['key', 'value'], lastFieldIsString: false }
      ]
    ],
    ['get', [{ fields: ['key'], lastFieldIsString: false }]],
    ['setCode', [{ fields: ['value'], lastFieldIsString: true }]],
    ['bang', [{ fields: [], lastFieldIsString: false }]],
    ['clear', [{ fields: [], lastFieldIsString: false }]]
  ]);

  it.each([
    // Symbol (0 args, recognized type)
    [['set'], { type: 'set' }],
    [['bang'], { type: 'bang' }],
    [['clear'], { type: 'clear' }],

    // Basic positional — 1-field schema
    [['set', '1'], { type: 'set', value: 1 }],
    [['set', 'true'], { type: 'set', value: true }],
    [['set', '"hello"'], { type: 'set', value: 'hello' }],
    [['set', '{x: 1}'], { type: 'set', value: { x: 1 } }],
    [['set', '[1, 2]'], { type: 'set', value: [1, 2] }],
    [['get', 'foo'], { type: 'get', key: 'foo' }],

    // Basic positional — 2-field schema (arg count selects schema)
    [['set', 'foo', '42'], { type: 'set', key: 'foo', value: 42 }],
    [['set', 'myKey', '"hello"'], { type: 'set', key: 'myKey', value: 'hello' }],

    // Named args
    [['set', 'value=1'], { type: 'set', value: 1 }],
    [['set', 'key=foo', 'value=42'], { type: 'set', key: 'foo', value: 42 }],
    [['get', 'key=bar'], { type: 'get', key: 'bar' }],

    // Mixed positional + named (named overrides)
    [['set', 'foo', 'value=42'], { type: 'set', key: 'foo', value: 42 }],

    // Rest-args (last field is String)
    [['setCode', 'console.log(x)', '+', '1'], { type: 'setCode', value: 'console.log(x) + 1' }],
    [['setCode', 'hello', 'world'], { type: 'setCode', value: 'hello world' }],

    // No match → null
    [['unknownType', '1'], null],
    [['set', '1', '2', '3'], null],
    [['bang', '10', '20'], null]
  ] as [string[], Record<string, unknown> | null][])('%j → %j', (tokens, expected) => {
    expect(tryResolveShorthand(tokens, typeMap)).toEqual(expected);
  });
});
