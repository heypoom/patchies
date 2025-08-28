export type ObjectDataType =
	| 'any'
	| 'message'
	| 'signal'
	| 'bang'
	| 'float'
	| 'int'
	| 'string'
	| 'bool'
	| 'int[]'
	| 'float[]'
	| 'marker';

export interface ObjectInlet {
	name?: string;
	type?: ObjectDataType;
	description?: string;

	/** Does this inlet represent an audio parameter in the audio node? **/
	isAudioParam?: boolean;

	/** Floating point precision for displays. */
	precision?: number;

	/** Maximum floating point precision. */
	maxPrecision?: number;

	/** Default value. */
	defaultValue?: unknown;

	/** Valid values */
	options?: unknown[];

	minNumber?: number;
	maxNumber?: number;

	/** Custom validator. */
	validator?: (value: unknown) => boolean;

	/** Custom formatter. */
	formatter?: (value: unknown) => string | null;
}

export interface ObjectOutlet {
	name?: string;
	type?: ObjectDataType;
	description?: string;
}

export interface ObjectDefinition {
	inlets: ObjectInlet[];
	outlets: ObjectOutlet[];
	description?: string;
	tags?: string[];
}

export const objectDefinitions: Record<string, ObjectDefinition> = {
	gain: {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Signal to amplify' },
			{
				name: 'gain',
				type: 'float',
				description: 'Gain multiplier',
				precision: 2,
				isAudioParam: true
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Amplified signal' }],
		description: 'Amplifies input by gain factor',
		tags: ['audio']
	},

	osc: {
		inlets: [
			{
				name: 'frequency',
				type: 'float',
				description: 'Oscillator frequency in hertz',
				defaultValue: 440,
				isAudioParam: true,
				maxPrecision: 2
			},
			{
				name: 'type',
				type: 'string',
				description: 'Type of oscillator',
				defaultValue: 'sine',
				options: ['sine', 'square', 'sawtooth', 'triangle'],

				formatter(value) {
					if (Array.isArray(value)) return 'custom';

					return String(value);
				},

				validator(value) {
					// Custom!
					if (Array.isArray(value)) return true;

					return !!(typeof value === 'string' && this.options?.includes(value));
				}
			},
			{
				name: 'detune',
				type: 'float',
				description: 'Detune amount in cents',
				defaultValue: 0,
				isAudioParam: true
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Oscillator output' }],
		description: 'Oscillator generates audio signals',
		tags: ['audio']
	},

	dac: {
		inlets: [{ name: 'in', type: 'signal', description: 'Audio signal to output' }],
		outlets: [],
		description: 'Send sounds to speakers',
		tags: ['audio']
	},

	mtof: {
		inlets: [{ name: 'note', type: 'float', description: 'MIDI note value (0-127)' }],
		outlets: [{ name: 'frequency', type: 'float', description: 'Frequency in Hz' }],
		description: 'Converts MIDI note values to frequency float values',
		tags: ['helper']
	},

	fslider: {
		inlets: [{ name: 'min' }, { name: 'max' }, { name: 'value' }],
		outlets: []
	},

	fft: {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Audio signal to analyze' },
			{
				name: 'fftSize',
				type: 'float',
				description: 'Size of the FFT bin. Must be a power of 2, from 32 to 32768.',
				defaultValue: 256,
				options: [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]
			}
		],
		outlets: [
			{ name: 'out', type: 'signal', description: 'Audio data from the input' },
			{
				name: 'analysis',
				type: 'marker',
				description: 'Marker to indicate where to get the FFT data from.'
			}
		],
		description: 'Analyzes audio signals and provides frequency and amplitude data',
		tags: ['audio']
	},

	delay: {
		inlets: [
			{ name: 'message', type: 'message', description: 'Message to pass through' },
			{ name: 'delay', type: 'float', description: 'How long to delay for, in ms.', precision: 0 }
		],
		outlets: [{ name: 'out', type: 'any', description: 'Message outlet' }],
		tags: ['helper']
	},

	'+~': {
		inlets: [
			{ name: 'left', type: 'signal', description: 'Left signal input' },
			{ name: 'right', type: 'signal', description: 'Right signal input' }
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Sum of input signals' }],
		description: 'Adds two audio signals together',
		tags: ['audio']
	},

	adsr: {
		inlets: [
			{
				name: 'trigger',
				type: 'message',
				description: 'Trigger the ADSR envelope. 0 = release, 1 = attack.'
			},
			{
				name: 'peak',
				type: 'float',
				description: 'Peak value',
				defaultValue: 1,
				minNumber: 0,
				maxPrecision: 2
			},
			{
				name: 'attack',
				type: 'float',
				description: 'Attack time in ms',
				defaultValue: 100,
				minNumber: 0,
				precision: 0
			},
			{
				name: 'decay',
				type: 'float',
				description: 'Decay time in ms',
				defaultValue: 200,
				minNumber: 0,
				precision: 0
			},
			{
				name: 'sustain',
				type: 'float',
				description: 'Sustain value',
				defaultValue: 0.5,
				minNumber: 0,
				maxPrecision: 2
			},
			{
				name: 'release',
				type: 'float',
				description: 'Release time in ms',
				defaultValue: 300,
				precision: 0
			}
		],
		outlets: [{ name: 'out', type: 'message', description: 'ADSR envelope message' }],
		description: 'ADSR envelope generator with trigger and parameter control inlets',
		tags: ['envelope']
	},

	mic: {
		inlets: [
			{
				name: 'message',
				type: 'message',
				description: 'Control messages. Bang to restart.'
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Microphone audio output' }],
		description: 'Captures audio from microphone',
		tags: ['audio']
	},

	lpf: {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Signal to filter' },
			{
				name: 'frequency',
				type: 'float',
				description: 'Cutoff frequency in Hz',
				defaultValue: 1000,
				isAudioParam: true,
				minNumber: 0,
				maxNumber: 22050,
				maxPrecision: 1
			},
			{
				name: 'Q',
				type: 'float',
				description: 'Quality factor (resonance)',
				defaultValue: 1,
				isAudioParam: true,
				minNumber: 0.0001,
				maxNumber: 1000,
				maxPrecision: 2
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal' }],
		description: 'Low-pass filter allows frequencies below cutoff to pass through',
		tags: ['audio']
	},

	hpf: {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Signal to filter' },
			{
				name: 'frequency',
				type: 'float',
				description: 'Cutoff frequency in Hz',
				defaultValue: 1000,
				isAudioParam: true,
				minNumber: 0,
				maxNumber: 22050,
				maxPrecision: 1
			},
			{
				name: 'Q',
				type: 'float',
				description: 'Quality factor (resonance)',
				defaultValue: 1,
				isAudioParam: true,
				minNumber: 0.0001,
				maxNumber: 1000,
				maxPrecision: 2
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal' }],
		description: 'High-pass filter allows frequencies above cutoff to pass through',
		tags: ['audio']
	},

	bpf: {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Signal to filter' },
			{
				name: 'frequency',
				type: 'float',
				description: 'Center frequency in Hz',
				defaultValue: 1000,
				isAudioParam: true,
				minNumber: 0,
				maxNumber: 22050,
				maxPrecision: 1
			},
			{
				name: 'Q',
				type: 'float',
				description: 'Quality factor (bandwidth)',
				defaultValue: 1,
				isAudioParam: true,
				minNumber: 0.0001,
				maxNumber: 1000,
				maxPrecision: 2
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal' }],
		description:
			'Band-pass filter allows frequencies within a range around center frequency to pass through',
		tags: ['audio']
	},

	compressor: {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Signal to compress' },
			{
				name: 'threshold',
				type: 'float',
				description: 'The decibel value above which compression starts',
				defaultValue: -24,
				isAudioParam: true,
				minNumber: -200,
				maxNumber: 0,
				maxPrecision: 1
			},
			{
				name: 'knee',
				type: 'float',
				description: 'Decibel range above threshold for smooth transition',
				defaultValue: 30,
				isAudioParam: true,
				minNumber: 0,
				maxNumber: 40,
				maxPrecision: 1
			},
			{
				name: 'ratio',
				type: 'float',
				description: 'Amount of dB change in input for 1 dB change in output',
				defaultValue: 12,
				isAudioParam: true,
				minNumber: 0,
				maxNumber: 20,
				maxPrecision: 1
			},
			{
				name: 'attack',
				type: 'float',
				description: 'Time in seconds to reduce gain by 10dB',
				defaultValue: 0.003,
				isAudioParam: true,
				minNumber: 0,
				maxNumber: 1,
				maxPrecision: 4
			},
			{
				name: 'release',
				type: 'float',
				description: 'Time in seconds to increase gain by 10dB',
				defaultValue: 0.25,
				isAudioParam: true,
				minNumber: 0,
				maxNumber: 1,
				maxPrecision: 4
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Compressed signal' }],
		description: 'Dynamic range compressor for audio signals',
		tags: ['audio']
	},

	pan: {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Audio signal to position in stereo field' },
			{
				name: 'pan',
				type: 'float',
				description: 'Stereo position: -1 (left) to 1 (right)',
				defaultValue: 0,
				isAudioParam: true,
				minNumber: -1,
				maxNumber: 1,
				maxPrecision: 2,
				precision: 2
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Stereo positioned signal' }],
		description: 'Controls the left-right stereo positioning of audio',
		tags: ['audio']
	},

	'sig~': {
		inlets: [
			{
				name: 'offset',
				type: 'float',
				description: 'Constant signal value',
				defaultValue: 1.0,
				isAudioParam: true,
				maxPrecision: 3
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Constant signal output' }],
		description: 'Outputs a constant signal value',
		tags: ['audio']
	},

	'delay~': {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Audio signal to delay' },
			{
				name: 'delayTime',
				type: 'float',
				description: 'Delay time in seconds',
				defaultValue: 0,
				isAudioParam: true,
				minNumber: 0,
				maxPrecision: 4
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Delayed signal' }],
		description: 'Delay-line node with configurable delay time',
		tags: ['audio']
	}
};

export const audioObjectNames = Object.keys(objectDefinitions).filter((key) =>
	objectDefinitions[key].tags?.includes('audio')
);

export const getObjectNameFromExpr = (expr: string): string =>
	expr.trim().toLowerCase().split(' ')?.[0];

// Helper function to get object definition
export function getObjectDefinition(expr: string): ObjectDefinition | undefined {
	const name = getObjectNameFromExpr(expr);

	return objectDefinitions[name];
}

// Helper function to get all object names
export const getObjectNames = () => Object.keys(objectDefinitions);

export type AdsrParamList = [unknown, number, number, number, number, number];
