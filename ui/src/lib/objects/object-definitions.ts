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
				options: ['sine', 'square', 'sawtooth', 'triangle']
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
