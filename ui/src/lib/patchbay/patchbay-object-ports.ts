import type { Node } from '@xyflow/svelte';

import { visibleUniformInletDefs } from '$lib/canvas/shader-code-to-uniform-def';
import { objectSchemas } from '$lib/objects/schemas';
import { deriveHandleId, type HandleType, type PortDirection } from '$lib/utils/handle-id';

import type { ObjectSchema, InletSchema, OutletSchema } from '$lib/objects/schemas';
import type {
  PatchbayObjectPortSet,
  PatchbayObjectPorts,
  PatchbaySection
} from './patchbay-parser';
import type { GLUniformDef } from '../../types/uniform-config';

type MinimalNode = Pick<Node, 'id' | 'type' | 'data'>;
type SchemaPort = InletSchema | OutletSchema;

export function getPatchbayObjectPorts(nodes: MinimalNode[]): PatchbayObjectPorts {
  const objects: PatchbayObjectPorts = new Map();

  for (const node of nodes) {
    const type = getNodeObjectType(node);
    const schema = type ? objectSchemas[type] : undefined;
    if (!schema && node.type !== 'glsl') continue;

    objects.set(node.id, getNodePorts(node, schema));
  }

  return objects;
}

function getNodeObjectType(node: MinimalNode): string | undefined {
  if (node.type === 'object') {
    const name = (node.data as { name?: unknown } | undefined)?.name;
    return typeof name === 'string' ? name : undefined;
  }

  return node.type;
}

function getNodePorts(node: MinimalNode, schema: ObjectSchema | undefined): PatchbayObjectPortSet {
  const ports: PatchbayObjectPortSet = {
    message: { inlets: [], outlets: [] },
    audio: { inlets: [], outlets: [] },
    video: { inlets: [], outlets: [] }
  };

  if (schema) {
    addSchemaPorts(ports, 'inlet', schema.inlets);
    addSchemaPorts(ports, 'outlet', schema.outlets);
  }

  if (node.type === 'glsl') {
    addGlslUniformPorts(ports, node.data);
  }

  return ports;
}

function addSchemaPorts(
  ports: PatchbayObjectPortSet,
  direction: PortDirection,
  schemaPorts: SchemaPort[]
): void {
  schemaPorts.forEach((port, index) => {
    const section = getCompatibleSection(port);
    if (!section) return;

    const key = direction === 'inlet' ? 'inlets' : 'outlets';
    ports[section]![key]!.push(getPortHandle(direction, port, index));
  });
}

function addGlslUniformPorts(
  ports: PatchbayObjectPortSet,
  data: MinimalNode['data'] | undefined
): void {
  const uniformDefs = Array.isArray(
    (data as { glUniformDefs?: unknown } | undefined)?.glUniformDefs
  )
    ? (data as { glUniformDefs: GLUniformDef[] }).glUniformDefs
    : [];

  for (const { def, uniformIndex } of visibleUniformInletDefs(uniformDefs)) {
    const section: PatchbaySection = def.type === 'sampler2D' ? 'video' : 'message';
    ports[section]!.inlets!.push(
      deriveHandleId({
        port: 'inlet',
        type: section,
        id: `${uniformIndex}-${def.name}-${def.type}`
      })
    );
  }
}

function getCompatibleSection(port: SchemaPort): PatchbaySection | undefined {
  if (port.type === 'signal' || ('isAudioParam' in port && port.isAudioParam)) return 'audio';

  const explicitHandleType = port.handle?.handleType;
  if (
    explicitHandleType === 'message' ||
    explicitHandleType === 'audio' ||
    explicitHandleType === 'video'
  ) {
    return explicitHandleType;
  }

  if (port.type === 'video') return 'video';
  if (port.type === 'analysis') return undefined;
  return 'message';
}

function getPortHandle(direction: PortDirection, port: SchemaPort, index: number): string {
  const explicitHandle = port.handle;
  if (explicitHandle) {
    return deriveHandleId({
      port: direction,
      type: explicitHandle.handleType,
      id: explicitHandle.handleId
    });
  }

  return deriveHandleId({
    port: direction,
    type: getHandleType(port),
    id: index
  });
}

function getHandleType(port: SchemaPort): HandleType | undefined {
  if (port.type === 'signal') return 'audio';
  if (port.type === 'video') return 'video';
  if (port.type === 'analysis') return 'analysis';
  return 'message';
}
