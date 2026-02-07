export * from './types';
export * from './trigger';
export * from './p5';

import type { ObjectSchemaRegistry } from './types';
import { triggerSchema } from './trigger';
import { p5Schema } from './p5';

/**
 * Registry of all object schemas.
 * Add new schemas here as they are created.
 */
export const objectSchemas: ObjectSchemaRegistry = {
  trigger: triggerSchema,
  p5: p5Schema
};

/**
 * Get schema for an object type.
 */
export function getObjectSchema(type: string) {
  return objectSchemas[type];
}
