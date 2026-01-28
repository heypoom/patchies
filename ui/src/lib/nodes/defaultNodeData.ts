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
	DEFAULT_TONE_JS_CODE,
	DEFAULT_SONIC_CODE,
	DEFAULT_ELEM_CODE,
	DEFAULT_CSOUND_CODE,
	DEFAULT_TEXTMODE_CODE,
	DEFAULT_THREE_CODE
} from '$lib/canvas/constants';
import { DEFAULT_P5_CODE } from '$lib/p5/constants';
import { DEFAULT_HYDRA_CODE } from '$lib/hydra/constants';
import { DEFAULT_ASSEMBLY_CODE } from '$lib/assembly/constants';
import { DEFAULT_ORCA_WIDTH, DEFAULT_ORCA_HEIGHT } from '$lib/orca/constants';

// TODO: make this type-safe!
export type NodeData = {
	[key: string]: unknown;
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
		.with('textmode', () => ({ code: DEFAULT_TEXTMODE_CODE }))
		.with('textmode.dom', () => ({ code: DEFAULT_TEXTMODE_CODE }))
		.with('canvas.dom', () => ({ code: DEFAULT_JS_CANVAS_CODE }))
		.with('three.dom', () => ({ code: DEFAULT_THREE_CODE }))
		.with('dom', () => ({
			code: '// root is a div element you can manipulate\n// Tailwind CSS is enabled by default, tailwind(false) to disable\nroot.innerHTML = \'<h1 class="px-3 py-1 text-green-400">Hello DOM!</h1>\''
		}))
		.with('vue', () => ({
			code: `const message = ref('Hello Vue!')

 // Tailwind CSS is enabled by default, tailwind(false) to disable
 createApp({
   template: '<div class="px-3 py-1 text-green-400">{{ message }}</div>',
   setup() {
     return { message }
   }
 }).mount(root)`
		}))
		.with('three', () => ({
			code: DEFAULT_THREE_CODE,
			messageInletCount: 1,
			messageOutletCount: 0,
			videoInletCount: 1,
			videoOutletCount: 1
		}))
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
		.with('chuck~', () => ({ expr: DEFAULT_CHUCK_CODE }))
		.with('webcam', () => ({}))
		.with('video', () => ({ loop: true }))
		.with('iframe', () => ({ url: '', width: 400, height: 300 }))
		.with('textbox', () => ({ text: '' }))
		.with('dsp~', () => ({
			title: 'dsp~',
			code: DEFAULT_DSP_JS_CODE,
			messageInletCount: 0,
			messageOutletCount: 0,
			audioInletCount: 1,
			audioOutletCount: 1
		}))
		.with('tone~', () => ({
			code: DEFAULT_TONE_JS_CODE,
			messageInletCount: 1,
			messageOutletCount: 0
		}))
		.with('sonic~', () => ({
			code: DEFAULT_SONIC_CODE,
			messageInletCount: 1,
			messageOutletCount: 0
		}))
		.with('elem~', () => ({ code: DEFAULT_ELEM_CODE, messageInletCount: 1, messageOutletCount: 0 }))
		.with('csound~', () => ({
			expr: DEFAULT_CSOUND_CODE
		}))
		.with('label', () => ({ message: 'label' }))
		.with('link', () => ({ displayText: 'example.com', url: 'http://example.com' }))
		.with('asm', () => ({
			code: DEFAULT_ASSEMBLY_CODE,
			inletCount: 1,
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
		.with('merge~', () => ({ channels: 2 }))
		.with('split~', () => ({ channels: 2 }))
		.with('mic~', () => ({
			deviceId: '',
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true
		}))
		.with('dac~', () => ({ deviceId: '' }))
		.with('meter~', () => ({ smoothing: 0.8, peakHold: true, style: 'bar' }))
		.with('keyboard', () => ({ keybind: '', mode: 'all', trigger: 'keydown', repeat: false }))
		.with('sampler~', () => ({
			hasRecording: false,
			duration: 0,
			loopStart: 0,
			loopEnd: 0,
			loop: false,
			playbackRate: 1,
			detune: 0
		}))
		.with('orca', () => ({
			grid: new Array(DEFAULT_ORCA_WIDTH * DEFAULT_ORCA_HEIGHT).fill('.').join(''),
			width: DEFAULT_ORCA_WIDTH,
			height: DEFAULT_ORCA_HEIGHT,
			bpm: 120,
			frame: 0
		}))
		.with('uxn', () => ({
			code: '',
			showConsole: false,
			showEditor: false,
			consoleOutput: ''
		}))
		.with('mqtt', () => ({
			topics: [],
			decodeAsString: true
		}))
		.with('sse', () => ({
			url: ''
		}))
		.with('tts', () => ({
			voiceName: '',
			rate: 1,
			pitch: 1,
			volume: 1
		}))
		.with('vdo.ninja.push', () => ({
			room: '',
			streamID: '',
			dataOnly: false
		}))
		.with('vdo.ninja.pull', () => ({
			room: '',
			viewStreamID: '',
			dataOnly: false
		}))
		.otherwise(() => ({}));
}
