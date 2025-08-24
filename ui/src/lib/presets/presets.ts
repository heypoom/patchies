import { GLSL_PRESETS } from './glsl.presets';
import { HYDRA_PRESETS } from './hydra.presets';
import { P5_PRESETS } from './p5.presets';
import { JS_PRESETS } from './js.presets';
import { SLIDER_PRESETS } from './slider.presets';
import { EXPR_DSP_PRESETS } from './expr-dsp.presets';

/**
 * Presets are pre-configured nodes with custom default data.
 * When a preset is selected, it creates a node of the specified type with the given data.
 */
export const PRESETS: Record<string, { type: string; data: unknown }> = {
	...GLSL_PRESETS,
	...P5_PRESETS,
	...HYDRA_PRESETS,
	...JS_PRESETS,
	...SLIDER_PRESETS,
	...EXPR_DSP_PRESETS
};
