import { objectSchemas } from '$lib/objects/schemas';

const META_OBJECT_TYPE = 'object';

export function assertKnownCanvasObjectType(type: unknown): string {
  if (typeof type !== 'string' || !type.trim()) {
    throw new Error('Object type must be a non-empty string');
  }

  if (type !== META_OBJECT_TYPE && !objectSchemas[type]) {
    throw new Error(`Unknown object type "${type}"`);
  }

  return type;
}
