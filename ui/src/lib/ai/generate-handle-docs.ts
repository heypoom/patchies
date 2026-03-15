/**
 * Generates handle ID documentation from ObjectSchemas.
 *
 * This is the single source of truth for AI handle ID instructions.
 * Instead of manually maintaining handle ID rules in prompts,
 * we derive them from the same schemas that drive the actual components.
 */

import { objectSchemas } from '$lib/objects/schemas';
import { deriveHandleId } from '$lib/utils/handle-id';

import type {
  ObjectSchema,
  InletSchema,
  OutletSchema,
  HandlePattern
} from '$lib/objects/schemas/types';

/**
 * Generate a handle doc line for a single port.
 */
function portHandleDoc(
  port: InletSchema | OutletSchema,
  direction: 'inlet' | 'outlet'
): string | null {
  if (!port.handle) return null;

  const id = deriveHandleId({
    port: direction,
    type: port.handle.handleType,
    id: port.handle.handleId
  });

  const description = port.description ? ` (${port.description})` : '';

  return `  ${direction === 'inlet' ? 'inlet' : 'outlet'}: "${id}"${description}`;
}

/**
 * Generate a handle pattern doc line.
 */
function patternDoc(pattern: HandlePattern, direction: 'inlet' | 'outlet'): string {
  const desc = pattern.description ? ` — ${pattern.description}` : '';

  return `  ${direction} pattern: "${pattern.template}"${desc}`;
}

/**
 * Generate handle documentation for a single object type.
 * Returns null if the schema has no handle information.
 */
export function generateHandleDocForType(schema: ObjectSchema): string | null {
  const lines: string[] = [];

  for (const inlet of schema.inlets) {
    const line = portHandleDoc(inlet, 'inlet');
    if (line) lines.push(line);
  }

  for (const outlet of schema.outlets) {
    const line = portHandleDoc(outlet, 'outlet');
    if (line) lines.push(line);
  }

  if (schema.handlePatterns?.inlet) {
    lines.push(patternDoc(schema.handlePatterns.inlet, 'inlet'));
  }

  if (schema.handlePatterns?.outlet) {
    lines.push(patternDoc(schema.handlePatterns.outlet, 'outlet'));
  }

  if (lines.length === 0) return null;

  return `${schema.type}:\n${lines.join('\n')}`;
}

/**
 * Generate handle documentation for specific object types.
 * Used by the multi-object generator to inject handle info for relevant types.
 */
export function generateHandleDocs(types: string[]): string {
  const docs: string[] = [];

  for (const type of types) {
    const schema = objectSchemas[type];
    if (!schema) continue;

    const doc = generateHandleDocForType(schema);
    if (doc) docs.push(doc);
  }

  // Always include "object" type guidance since it's the meta-type for audio objects
  if (types.includes('object') || types.some((t) => t.endsWith('~'))) {
    docs.push(
      `object (audio objects like osc~, gain~, delay~, etc.):\n` +
        `  Audio objects use the "object" node type with data: { expr, name, params }\n` +
        `  signal inlets → "audio-in-{index}" (e.g. audio-in-0, audio-in-1)\n` +
        `  message inlets → "message-in-{index}" (e.g. message-in-0, message-in-1)\n` +
        `  signal outlets → "audio-out-{index}" (e.g. audio-out-0)\n` +
        `  message outlets → "message-out-{index}" (e.g. message-out-0)\n` +
        `  out~ has ONE audio inlet: "audio-in-0" — multiple sources connect to the SAME inlet (Web Audio auto-mixes)`
    );
  }

  if (docs.length === 0) return '';

  return (
    `HANDLE ID REFERENCE (auto-generated from schemas):\n` +
    `Handle IDs are derived from node schemas. Use these exact IDs for sourceHandle/targetHandle in edges.\n\n` +
    docs.join('\n\n')
  );
}
