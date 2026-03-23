/**
 * Utilities to generate ObjectSchema from V2 node classes.
 *
 * This makes V2 nodes the single source of truth for documentation,
 * eliminating duplication between node classes and schema files.
 */

import { Type } from '@sinclair/typebox';
import type { ObjectInlet, ObjectOutlet } from '../v2/object-metadata';
import type { ObjectSchema, InletSchema, OutletSchema, MessageSchema, HandleSpec } from './types';
import { sym } from './helpers';
import { ANALYSIS_KEY } from '$lib/audio/v2/constants/fft';

/**
 * Convert ObjectDataType to a TypeBox schema.
 */
function dataTypeToSchema(type: string | undefined, inlet: ObjectInlet): MessageSchema | null {
  // If inlet already has messages defined, don't auto-generate
  if (inlet.messages && inlet.messages.length > 0) {
    return null;
  }

  const description = inlet.description ?? '';

  switch (type) {
    case 'float': {
      let schema = Type.Number();
      if (inlet.minNumber !== undefined && inlet.maxNumber !== undefined) {
        schema = Type.Number({ minimum: inlet.minNumber, maximum: inlet.maxNumber });
      }
      return { schema, description };
    }
    case 'int': {
      let schema = Type.Integer();
      if (inlet.minNumber !== undefined && inlet.maxNumber !== undefined) {
        schema = Type.Integer({ minimum: inlet.minNumber, maximum: inlet.maxNumber });
      }
      return { schema, description };
    }
    case 'string':
    case 'symbol':
      return { schema: Type.String(), description };
    case 'bool':
      return { schema: Type.Boolean(), description };
    case 'bang':
      return { schema: sym('bang'), description };
    case 'int[]':
      return { schema: Type.Array(Type.Integer()), description };
    case 'float[]':
      return { schema: Type.Array(Type.Number()), description };
    case 'message':
    case 'any':
      return { schema: Type.Any(), description };
    case 'signal':
    case 'analysis':
    case 'marker':
      // Audio signals don't have message schemas
      return null;
    default:
      return null;
  }
}

/**
 * Derive HandleSpec from inlet/outlet metadata.
 * Mirrors ObjectNode.svelte's getPortType() + index-based id pattern.
 */
function deriveHandleSpecFromPort(
  port: ObjectInlet | ObjectOutlet,
  originalIndex: number
): HandleSpec {
  if (port.type === 'signal') {
    return { handleType: 'audio', handleId: originalIndex };
  }
  if (port.type === ANALYSIS_KEY) {
    return { handleType: 'analysis', handleId: originalIndex };
  }
  return { handleType: 'message', handleId: originalIndex };
}

/**
 * Convert an ObjectInlet to an InletSchema.
 */
function inletToSchema(inlet: ObjectInlet, index: number): InletSchema {
  const id = inlet.name ?? 'in';
  const description = inlet.description ?? '';

  // Use explicit messages if provided, otherwise generate from type
  let messages: MessageSchema[] | undefined;

  if (inlet.messages && inlet.messages.length > 0) {
    messages = inlet.messages;
  } else {
    const generated = dataTypeToSchema(inlet.type, inlet);

    if (generated) {
      messages = [generated];
    }
  }

  // Skip handle spec for hidden inlets (they don't render handles)
  const handle = inlet.hideInlet ? undefined : deriveHandleSpecFromPort(inlet, index);

  return { id, type: inlet.type, description, messages, isAudioParam: inlet.isAudioParam, handle };
}

/**
 * Convert an ObjectOutlet to an OutletSchema.
 */
function outletToSchema(outlet: ObjectOutlet, index: number): OutletSchema {
  const id = outlet.name ?? 'out';
  const description = outlet.description ?? '';
  const handle = deriveHandleSpecFromPort(outlet, index);

  return { id, type: outlet.type, description, messages: outlet.messages, handle };
}

/**
 * Interface for V2 node classes with static metadata.
 */
interface V2NodeClass {
  type: string;
  aliases?: string[];
  description?: string;
  group?: string;
  inlets?: ObjectInlet[];
  outlets?: ObjectOutlet[];
  tags?: string[];
}

/**
 * Generate an ObjectSchema from a V2 node class.
 *
 * @example
 * ```ts
 * import { NotchNode } from '$lib/audio/v2/nodes/NotchNode';
 * const schema = schemaFromNode(NotchNode, 'audio');
 * ```
 */
export function schemaFromNode(NodeClass: V2NodeClass, category: string): ObjectSchema {
  const inlets = (NodeClass.inlets ?? [])
    .map((inlet, i) => ({ inlet, i }))
    .filter(({ inlet }) => !inlet.hideDocs)
    .map(({ inlet, i }) => inletToSchema(inlet, i));
  const outlets = (NodeClass.outlets ?? []).map((outlet, i) => outletToSchema(outlet, i));

  // Generate tags from type name and group if not provided
  const tags = NodeClass.tags ?? generateTags(NodeClass);

  return {
    type: NodeClass.type,
    category,
    description: NodeClass.description ?? '',
    inlets,
    outlets,
    tags
  };
}

/**
 * Generate default tags from node type and group.
 */
function generateTags(NodeClass: V2NodeClass): string[] {
  const tags: string[] = [];
  const type = NodeClass.type;

  // Add category from group
  if (NodeClass.group) {
    tags.push(NodeClass.group);
  }

  // Add base type name without ~
  if (type.endsWith('~')) {
    tags.push('audio');
    tags.push(type.slice(0, -1));
  } else {
    tags.push(type);
  }

  return tags;
}

/**
 * Generate schemas for multiple V2 node classes.
 * Automatically registers both the canonical type and any aliases.
 */
export function schemasFromNodes(
  nodes: readonly V2NodeClass[],
  category: string
): Record<string, ObjectSchema> {
  const schemas: Record<string, ObjectSchema> = {};

  for (const node of nodes) {
    const schema = schemaFromNode(node, category);
    schemas[node.type] = schema;

    // Also register aliases pointing to the same schema
    if (node.aliases) {
      for (const alias of node.aliases) {
        schemas[alias] = schema;
      }
    }
  }

  return schemas;
}
