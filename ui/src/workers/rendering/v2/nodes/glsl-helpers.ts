import { match } from 'ts-pattern';

import type { GLUniformDef } from '../../../../types/uniform-config';

/**
 * Validates if a value matches the expected uniform type.
 */
export const isValidGlslUniformValue = (value: unknown, type: GLUniformDef['type']): boolean =>
	match(type)
		.with('bool', () => typeof value === 'boolean')
		.with('float', () => typeof value === 'number')
		.with('int', () => typeof value === 'number')
		.with('vec2', () => Array.isArray(value) && value.length === 2)
		.with('vec3', () => Array.isArray(value) && value.length === 3)
		.with('vec4', () => Array.isArray(value) && value.length === 4)
		.with('sampler2D', () => value === null || value === undefined)
		.otherwise(() => false);

/**
 * Gets the default value for a uniform type.
 */
export const getDefaultGlslUniformValue = (type: GLUniformDef['type']): unknown =>
	match(type)
		.with('bool', () => true)
		.with('float', () => 0.0)
		.with('int', () => 0)
		.with('vec2', () => [0, 0])
		.with('vec3', () => [0, 0, 0])
		.with('vec4', () => [0, 0, 0, 0])
		.with('sampler2D', () => null)
		.otherwise(() => null);
