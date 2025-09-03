import { match } from 'ts-pattern';
import {
	DEFAULT_JS_CODE,
	DEFAULT_GLSL_CODE,
	DEFAULT_STRUDEL_CODE,
	DEFAULT_AI_IMAGE_PROMPT,
	DEFAULT_BUTTERCHURN_PRESET,
	DEFAULT_JS_CANVAS_CODE,
	DEFAULT_SWISSGL_CODE,
	DEFAULT_PYTHON_CODE,
	DEFAULT_CHUCK_CODE
} from '$lib/canvas/constants';
import { DEFAULT_P5_CODE } from '$lib/p5/constants';
import { DEFAULT_HYDRA_CODE } from '$lib/hydra/constants';

// TODO: make this type-safe!
export type NodeData = {
	[key: string]: any;
};

export function getDefaultNodeData(nodeType: string): NodeData {
	return match(nodeType)
		.with('object', () => ({ expr: '', name: '', params: [] }))
		.with('js', () => ({ code: DEFAULT_JS_CODE, showConsole: true }))
		.with('python', () => ({ code: DEFAULT_PYTHON_CODE, showConsole: true }))
		.with('glsl', () => ({ code: DEFAULT_GLSL_CODE }))
		.with('strudel', () => ({ code: DEFAULT_STRUDEL_CODE }))
		.with('ai.img', () => ({ prompt: DEFAULT_AI_IMAGE_PROMPT }))
		.with('ai.txt', () => ({ prompt: 'Write a creative story about...' }))
		.with('msg', () => ({ message: '' }))
		.with('button', () => ({}))
		.with('slider', () => ({
			min: 0,
			max: 100,
			defaultValue: 50,
			isFloat: false
		}))
		.with('bchrn', () => ({ currentPreset: DEFAULT_BUTTERCHURN_PRESET }))
		.with('p5', () => ({ code: DEFAULT_P5_CODE }))
		.with('hydra', () => ({ code: DEFAULT_HYDRA_CODE }))
		.with('swgl', () => ({ code: DEFAULT_SWISSGL_CODE }))
		.with('canvas', () => ({ code: DEFAULT_JS_CANVAS_CODE }))
		.with('ai.music', () => ({}))
		.with('ai.tts', () => ({}))
		.with('bg.out', () => ({}))
		.with('midi.in', () => ({
			deviceId: '',
			channel: 0,
			events: ['noteOn', 'noteOff', 'controlChange', 'programChange', 'pitchBend']
		}))
		.with('midi.out', () => ({
			deviceId: '',
			channel: 1,
			event: 'noteOn',
			data: { note: 60, velocity: 127 }
		}))
		.with('markdown', () => ({ markdown: 'hello' }))
		.with('expr', () => ({ expr: '' }))
		.with('expr~', () => ({ expr: 's' }))
		.with('chuck', () => ({ expr: DEFAULT_CHUCK_CODE }))
		.otherwise(() => ({}));
}
