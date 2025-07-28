import { GLSL_PRESETS } from './glsl.presets';

/**
 * Presets are pre-configured nodes with custom default data.
 * When a preset is selected, it creates a node of the specified type with the given data.
 */
export const PRESETS: Record<string, { type: string; data: unknown }> = {
	...GLSL_PRESETS
};
