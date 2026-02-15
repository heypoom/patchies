/**
 * TypeBox-to-code-string emitter.
 *
 * Converts runtime TypeBox schema objects back into `Type.xxx()` source code strings.
 * Used by the schema generator to produce a static TypeScript file
 * that recreates TypeBox schemas without importing node classes.
 */

import { Kind, OptionalKind, type TSchema } from '@sinclair/typebox';

/**
 * Emit a TypeBox schema as a TypeScript code string.
 *
 * @example
 * emitTypeBox(Type.Number()) // → 'Type.Number()'
 * emitTypeBox(Type.Literal('bang')) // → "Type.Literal('bang')"
 * emitTypeBox(Type.Object({ type: Type.Literal('set'), value: Type.Any() }))
 *   // → "Type.Object({ type: Type.Literal('set'), value: Type.Any() })"
 */
export function emitTypeBox(schema: TSchema): string {
  // Check Optional modifier FIRST (doesn't change Kind)
  if ((schema as Record<symbol, unknown>)[OptionalKind] === 'Optional') {
    const inner = { ...schema };
    delete (inner as Record<symbol, unknown>)[OptionalKind];
    return `Type.Optional(${emitTypeBox(inner as TSchema)})`;
  }

  const kind = schema[Kind];

  switch (kind) {
    case 'Number': {
      const opts = emitNumberOptions(schema);
      return opts ? `Type.Number(${opts})` : 'Type.Number()';
    }

    case 'Integer': {
      const opts = emitNumberOptions(schema);
      return opts ? `Type.Integer(${opts})` : 'Type.Integer()';
    }

    case 'String':
      return 'Type.String()';

    case 'Boolean':
      return 'Type.Boolean()';

    case 'Literal': {
      const val = schema.const;
      if (typeof val === 'string') return `Type.Literal(${JSON.stringify(val)})`;
      return `Type.Literal(${String(val)})`;
    }

    case 'Object': {
      const props = schema.properties as Record<string, TSchema>;
      const entries = Object.entries(props)
        .map(([key, value]) => `${safeKey(key)}: ${emitTypeBox(value)}`)
        .join(', ');
      return `Type.Object({ ${entries} })`;
    }

    case 'Array':
      return `Type.Array(${emitTypeBox(schema.items as TSchema)})`;

    case 'Union': {
      const items = (schema.anyOf as TSchema[]).map((s) => emitTypeBox(s)).join(', ');
      return `Type.Union([${items}])`;
    }

    case 'Tuple': {
      const items = (schema.items as TSchema[]).map((s) => emitTypeBox(s)).join(', ');
      return `Type.Tuple([${items}])`;
    }

    case 'Any':
      return 'Type.Any()';

    case 'Unknown':
      return 'Type.Unknown()';

    case 'Null':
      return 'Type.Null()';

    case 'Unsafe': {
      const type = schema.type as string | undefined;
      if (type) return `Type.Unsafe({ type: ${JSON.stringify(type)} })`;
      return 'Type.Unsafe({})';
    }

    default:
      // Fallback: emit Type.Any() with a comment about the unknown kind
      return `Type.Any() /* unknown kind: ${String(kind)} */`;
  }
}

/** Emit `{ minimum, maximum }` options if present on a Number/Integer schema. */
function emitNumberOptions(schema: TSchema): string | null {
  const opts: string[] = [];

  if (schema.minimum !== undefined) opts.push(`minimum: ${schema.minimum}`);
  if (schema.maximum !== undefined) opts.push(`maximum: ${schema.maximum}`);

  return opts.length > 0 ? `{ ${opts.join(', ')} }` : null;
}

/** Ensure object key is valid JS identifier, quote if needed. */
function safeKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}
