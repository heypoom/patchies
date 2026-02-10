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

// Discriminator fields used for message routing (type or op)
const DISCRIMINATOR_FIELDS = ['type', 'op'] as const;

/**
 * Get the discriminator field and value from a schema.
 * Supports both `type` and `op` as discriminator fields.
 */
function getDiscriminator(props: Record<string, TSchema>): { field: string; value: string } | null {
  for (const field of DISCRIMINATOR_FIELDS) {
    if (props[field]?.[Kind] === 'Literal') {
      return { field, value: String(props[field].const) };
    }
  }

  return null;
}

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
      const disc = getDiscriminator(props);

      // Symbol shorthand: { type: 'bang' } or { op: 'get' } → bang / get
      if (keys.length === 1 && disc) {
        return disc.value;
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
 * Check if a schema is a complex object (has properties beyond just the discriminator).
 */
export function isComplexSchema(schema: TSchema): boolean {
  if (schema[Kind] !== 'Object') return false;

  const props = schema.properties as Record<string, TSchema>;
  const keys = Object.keys(props);
  const disc = getDiscriminator(props);

  // Symbol shorthand has only discriminator field (type or op)
  return !(keys.length === 1 && disc);
}

/**
 * Get the type name from a message schema (the value of the `type` or `op` field).
 */
export function getSchemaTypeName(schema: TSchema): string | null {
  if (schema[Kind] !== 'Object') return null;

  const props = schema.properties as Record<string, TSchema>;
  const disc = getDiscriminator(props);

  return disc?.value ?? null;
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
      const disc = getDiscriminator(props);

      // Symbol shorthand: { type: 'bang' } or { op: 'get' } → bang / get
      if (keys.length === 1 && disc) {
        return `<span>${disc.value}</span>`;
      }

      // Compact mode: show discriminator name for complex objects
      if (compact && disc) {
        return `<span>${disc.value}</span><span class="${hl.punct}">{...}</span>`;
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
