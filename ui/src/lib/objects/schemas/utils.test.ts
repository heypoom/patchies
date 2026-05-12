import { describe, expect, test } from 'vitest';
import { Type } from '@sinclair/typebox';

import { schemaToHtml, schemaToString } from './utils';

describe('schema rendering', () => {
  test('marks optional object fields from TypeBox required metadata', () => {
    const schema = Type.Object({
      type: Type.Literal('note'),
      note: Type.Number(),
      velocity: Type.Optional(Type.Number()),
      channel: Type.Optional(Type.Number())
    });

    expect(schemaToString(schema)).toBe(
      "{type: 'note', note: number, velocity?: number, channel?: number}"
    );

    expect(schemaToHtml(schema)).toContain('<span>velocity?</span>');
    expect(schemaToHtml(schema)).toContain('<span>channel?</span>');
    expect(schemaToHtml(schema)).toContain('<span>note</span>');
    expect(schemaToHtml(schema)).not.toContain('<span>note?</span>');
  });

  test('marks top-level optional values', () => {
    expect(schemaToString(Type.Optional(Type.String()))).toBe('string?');
    expect(schemaToHtml(Type.Optional(Type.String()))).toBe(
      '<span class="text-purple-400">string</span><span class="text-zinc-500">?</span>'
    );
  });
});
