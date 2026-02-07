import type { TSchema } from '@sinclair/typebox';
import { Kind } from '@sinclair/typebox';

// Syntax highlighting CSS classes
const hl = {
  key: 'text-sky-400',
  string: 'text-emerald-400',
  type: 'text-purple-400',
  punct: 'text-zinc-500',
  symbol: 'text-amber-400'
};

/**
 * Convert a TypeBox schema to a human-readable string representation.
 * Used for displaying message types in docs and tooltips.
 */
export function schemaToString(schema: TSchema): string {
  switch (schema[Kind]) {
    case 'Literal':
      return typeof schema.const === 'string' ? `'${schema.const}'` : String(schema.const);

    case 'String':
      return 'string';

    case 'Number':
      return 'number';

    case 'Boolean':
      return 'boolean';

    case 'Object': {
      const props = schema.properties as Record<string, TSchema>;
      const keys = Object.keys(props);

      // Symbol shorthand: { type: 'bang' } → bang
      if (keys.length === 1 && keys[0] === 'type' && props.type[Kind] === 'Literal') {
        return String(props.type.const);
      }

      const parts = Object.entries(props).map(([key, value]) => {
        const valueStr = schemaToString(value);
        return `${key}: ${valueStr}`;
      });

      return `{${parts.join(', ')}}`;
    }

    case 'Array': {
      const itemSchema = schema.items as TSchema;
      return `${schemaToString(itemSchema)}[]`;
    }

    case 'Union': {
      const anyOf = schema.anyOf as TSchema[];
      return anyOf.map(schemaToString).join(' | ');
    }

    case 'Unknown':
      return 'any';

    case 'Any':
      return 'any';

    default:
      return 'unknown';
  }
}
