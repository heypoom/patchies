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
	DEFAULT_CHUCK_CODE,
	DEFAULT_DSP_JS_CODE,
	DEFAULT_TONE_JS_CODE
} from '$lib/canvas/constants';
import { DEFAULT_P5_CODE } from '$lib/p5/constants';
import { DEFAULT_HYDRA_CODE } from '$lib/hydra/constants';
import { DEFAULT_ASSEMBLY_CODE } from '$lib/assembly/constants';

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
		.with('toggle', () => ({ value: false }))
		.with('slider', () => ({
			min: 0,
			max: 100,
			defaultValue: 50,
			isFloat: false
		}))
		.with('bchrn', () => ({ currentPreset: DEFAULT_BUTTERCHURN_PRESET }))
		.with('p5', () => ({ code: DEFAULT_P5_CODE }))
		.with('hydra', () => ({
			code: DEFAULT_HYDRA_CODE,
			messageInletCount: 1,
			messageOutletCount: 0,
			videoInletCount: 1,
			videoOutletCount: 1
		}))
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
		.with('webcam', () => ({}))
		.with('video', () => ({ loop: true }))
		.with('textbox', () => ({ text: '' }))
		.with('dsp~', () => ({
			title: 'dsp~',
			code: DEFAULT_DSP_JS_CODE,
			messageInletCount: 0,
			messageOutletCount: 0,
			audioInletCount: 1,
			audioOutletCount: 1
		}))
		.with('tone~', () => ({ code: DEFAULT_TONE_JS_CODE, messageInletCount: 1 }))
		.with('label', () => ({ message: 'label' }))
		.with('link', () => ({ displayText: 'example.com', url: 'http://example.com' }))
		.with('asm', () => ({
			code: DEFAULT_ASSEMBLY_CODE,
			inletCount: 3,
			outletCount: 3,
			showMemoryViewer: false,
			machineConfig: {
				isRunning: false,
				delayMs: 100,
				stepBy: 1
			}
		}))
		.with('asm.value', () => ({
			machineId: 0,
			address: 0,
			size: 8,
			format: 'hex',
			signed: false
		}))
		.with('asm.mem', () => ({
			values: [],
			format: 'hex',
			rows: 6
		}))
		.otherwise(() => ({}));
}
