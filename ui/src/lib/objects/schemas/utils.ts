import type { TSchema } from '@sinclair/typebox';
import { Kind } from '@sinclair/typebox';

import type { ObjectSchemaRegistry } from './types';

// Syntax highlighting CSS classes
const hl = {
  key: 'text-sky-400',
  string: 'text-emerald-400',
  type: 'text-purple-400',
  punct: 'text-zinc-500',
  symbol: 'text-amber-400'
};

// Discriminator fields used for message routing.
const DISCRIMINATOR_FIELDS = ['type'] as const;

/**
 * Get the discriminator field and value from a schema.
 * Supports `type` as discriminator field.
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

    case 'Integer':
      return 'integer';

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

    case 'Tuple': {
      const items = schema.items as TSchema[];

      return `[${items.map(schemaToString).join(', ')}]`;
    }

    case 'Unsafe':
      // Type.Unsafe<T>({ type: 'TypeName' }) - use the type property
      return schema.type ?? 'unknown';

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

    case 'Integer':
      return `<span class="${hl.type}">integer</span>`;

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

    case 'Tuple': {
      const items = schema.items as TSchema[];
      const itemsHtml = items
        .map((s) => schemaToHtml(s, options))
        .join(`<span class="${hl.punct}">, </span>`);

      return `<span class="${hl.punct}">[</span>${itemsHtml}<span class="${hl.punct}">]</span>`;
    }

    case 'Unsafe':
      // Type.Unsafe<T>({ type: 'TypeName' }) - use the type property
      return `<span class="${hl.type}">${schema.type ?? 'unknown'}</span>`;

    default:
      return `<span class="${hl.type}">unknown</span>`;
  }
}

/**
 * Field mapping for shorthand message resolution.
 * Maps a message type name to its non-type fields.
 */
export interface FieldMapping {
  /** Field names in canonical order (declaration order) */
  fields: string[];

  /**
   * Whether the last field is Type.String().
   *
   * When true, extra positional args beyond the field count are joined with
   * spaces into the last field instead of causing a fallback to array mode.
   *
   * Example: `setCode` has one field `{ value: Type.String() }`.
   * `setCode console.log(x) + 1` has 3 positional tokens but only 1 field.
   * Because lastFieldIsString is true, they join: `{type: 'setCode', value: 'console.log(x) + 1'}`.
   * Without this, it would fall through to array: `[{type: 'setCode'}, ...]`.
   */
  lastFieldIsString: boolean;
}

/**
 * Extract non-type field names from a TObject message schema.
 */
export function getMessageFields(schema: TSchema): FieldMapping | null {
  if (schema[Kind] !== 'Object') return null;

  const props = schema.properties as Record<string, TSchema>;
  const fields = Object.keys(props).filter((k) => k !== 'type');
  const lastField = fields[fields.length - 1];
  const lastFieldIsString = lastField ? props[lastField]?.[Kind] === 'String' : false;

  return { fields, lastFieldIsString };
}

/** Add a single schema's field mapping to a type map (with deduplication). */
function addSchemaToMap(schema: TSchema, map: Map<string, FieldMapping[]>): void {
  const typeName = getSchemaTypeName(schema);
  if (!typeName) return;

  const mapping = getMessageFields(schema);
  if (!mapping) return;

  const existing = map.get(typeName) ?? [];
  const key = mapping.fields.join(',');

  if (!existing.some((m) => m.fields.join(',') === key)) {
    existing.push(mapping);
    map.set(typeName, existing);
  }
}

/** Add all inlet message schemas from an ObjectSchema to a type map. */
function addObjectSchemasToMap(
  objSchema: { inlets: Array<{ messages?: Array<{ schema: TSchema }> }> },
  map: Map<string, FieldMapping[]>
): void {
  for (const inlet of objSchema.inlets) {
    if (!inlet.messages) continue;

    for (const message of inlet.messages) {
      addSchemaToMap(message.schema, map);
    }
  }
}

/**
 * Build a map from message type name → field mappings.
 * Used for shorthand resolution (e.g., `set 1` → `{type: 'set', value: 1}`).
 *
 * Scans all inlet message schemas across all registered objects.
 * Deduplicates by field names — same type name with same fields in same order is kept once.
 */
export function buildMessageTypeMap(registry: ObjectSchemaRegistry): Map<string, FieldMapping[]> {
  const map = new Map<string, FieldMapping[]>();

  for (const objSchema of Object.values(registry)) {
    addObjectSchemasToMap(objSchema, map);
  }

  return map;
}

/**
 * Build a type map from the common schemas only (Bang, Set, Get, etc.).
 * These are always available for shorthand resolution regardless of downstream connections.
 */
export function buildCommonMessageTypeMap(commonSchemas: TSchema[]): Map<string, FieldMapping[]> {
  const map = new Map<string, FieldMapping[]>();

  for (const schema of commonSchemas) {
    addSchemaToMap(schema, map);
  }

  return map;
}

/**
 * Build a type map filtered to specific object types, with a base map (typically common schemas)
 * always included. Used for context-aware shorthand resolution when a msg node has connections.
 */
export function buildMessageTypeMapForTypes(
  registry: ObjectSchemaRegistry,
  objectTypes: string[],
  baseMap: Map<string, FieldMapping[]>
): Map<string, FieldMapping[]> {
  // Clone the base map (common schemas)
  const map = new Map<string, FieldMapping[]>();

  for (const [typeName, mappings] of baseMap) {
    map.set(typeName, [...mappings]);
  }

  // Add schemas from specified object types
  for (const objectType of objectTypes) {
    const objSchema = registry[objectType];
    if (!objSchema) continue;

    addObjectSchemasToMap(objSchema, map);
  }

  return map;
}
