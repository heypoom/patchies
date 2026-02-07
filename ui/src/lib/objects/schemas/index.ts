export * from './types';
export * from './trigger';
export * from './p5';
export * from './hydra';
export * from './glsl';
export * from './canvas';
export * from './swgl';

import type { ObjectSchemaRegistry } from './types';
import { triggerSchema } from './trigger';
import { p5Schema } from './p5';
import { hydraSchema } from './hydra';
import { glslSchema } from './glsl';
import { canvasSchema, canvasDomSchema } from './canvas';
import { swglSchema } from './swgl';

/**
 * Registry of all object schemas.
 * Add new schemas here as they are created.
 */
export const objectSchemas: ObjectSchemaRegistry = {
  trigger: triggerSchema,
  p5: p5Schema,
  hydra: hydraSchema,
  glsl: glslSchema,
  canvas: canvasSchema,
  'canvas.dom': canvasDomSchema,
  swgl: swglSchema
};

/**
 * Get schema for an object type.
 */
export function getObjectSchema(type: string) {
  return objectSchemas[type];
}
