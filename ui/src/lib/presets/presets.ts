import { GLSL_PRESETS } from './glsl.presets';
import { HYDRA_PRESETS } from './hydra.presets';
import { P5_PRESETS } from './p5.presets';
import { JS_PRESETS } from './js.presets';
import { SLIDER_PRESETS } from './slider.presets';
import { EXPR_DSP_PRESETS } from './expr-dsp.presets';
import { CHUCK_DEMO_PRESETS } from './chuck.preset';
import { AI_TXT_PRESETS } from './ai-txt.preset';
import { TONE_JS_PRESETS } from './tone.preset';
import { SONIC_PRESETS } from './sonic.preset';
import { ELEMENTARY_PRESETS } from './elementary.preset';
import { CANVAS_PRESETS } from './canvas.preset';
import { JS_DSP_PRESETS } from './js-dsp.presets';
import { KEYBOARD_PRESETS } from './keyboard.presets';
import { ORCA_PRESETS } from './orca.presets';

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
	...EXPR_DSP_PRESETS,
	...CHUCK_DEMO_PRESETS,
	...AI_TXT_PRESETS,
	...TONE_JS_PRESETS,
	...SONIC_PRESETS,
	...ELEMENTARY_PRESETS,
	...CANVAS_PRESETS,
	...JS_DSP_PRESETS,
	...KEYBOARD_PRESETS,
	...ORCA_PRESETS
};
