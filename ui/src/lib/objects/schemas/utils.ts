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

interface SchemaToHtmlOptions {
  compact?: boolean;
}

/**
 * Check if a schema is a complex object (has properties beyond just `type`).
 */
export function isComplexSchema(schema: TSchema): boolean {
  if (schema[Kind] !== 'Object') return false;

  const props = schema.properties as Record<string, TSchema>;
  const keys = Object.keys(props);

  // Symbol shorthand has only `type` field
  return !(keys.length === 1 && keys[0] === 'type');
}

/**
 * Get the type name from a message schema (the value of the `type` field).
 */
export function getSchemaTypeName(schema: TSchema): string | null {
  if (schema[Kind] !== 'Object') return null;

  const props = schema.properties as Record<string, TSchema>;

  if (props.type?.[Kind] === 'Literal') {
    return String(props.type.const);
  }

  return null;
}

/**
 * Convert a TypeBox schema to syntax-highlighted HTML.
 * Used for displaying message types with color coding.
 * @param compact - If true, shows shortened version for complex objects (e.g., `size{...}`)
 */
export function schemaToHtml(schema: TSchema, options: SchemaToHtmlOptions = {}): string {
  const { compact = false } = options;

  switch (schema[Kind]) {
    case 'Literal': {
      if (typeof schema.const === 'string') {
        return `<span class="${hl.string}">'${schema.const}'</span>`;
      }
      return `<span class="${hl.type}">${String(schema.const)}</span>`;
    }

    case 'String':
      return `<span class="${hl.type}">string</span>`;

    case 'Number':
      return `<span class="${hl.type}">number</span>`;

    case 'Boolean':
      return `<span class="${hl.type}">boolean</span>`;

    case 'Object': {
      const props = schema.properties as Record<string, TSchema>;
      const keys = Object.keys(props);

      // Symbol shorthand: { type: 'bang' } → bang
      if (keys.length === 1 && keys[0] === 'type' && props.type[Kind] === 'Literal') {
        return `<span>${String(props.type.const)}</span>`;
      }

      // Compact mode: show type name for complex objects
      if (compact && props.type?.[Kind] === 'Literal') {
        return `<span>${String(props.type.const)}</span><span class="${hl.punct}">{...}</span>`;
      }

      const parts = Object.entries(props).map(([key, value]) => {
        const valueHtml = schemaToHtml(value, options);

        return `<span>${key}</span><span class="${hl.punct}">:</span> ${valueHtml}`;
      });

      return `<span class="${hl.punct}">{</span>${parts.join(`<span class="${hl.punct}">,</span> `)}<span class="${hl.punct}">}</span>`;
    }

    case 'Array': {
      const itemSchema = schema.items as TSchema;
      return `${schemaToHtml(itemSchema, options)}<span class="${hl.punct}">[]</span>`;
    }

    case 'Union': {
      const anyOf = schema.anyOf as TSchema[];
      return anyOf
        .map((s) => schemaToHtml(s, options))
        .join(`<span class="${hl.punct}"> | </span>`);
    }

    case 'Unknown':
      return `<span class="${hl.type}">any</span>`;

    case 'Any':
      return `<span class="${hl.type}">any</span>`;

    default:
      return `<span class="${hl.type}">unknown</span>`;
  }
}
