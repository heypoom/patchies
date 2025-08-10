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
	| 'float[]';

export interface ObjectInlet {
	name?: string;
	type?: ObjectDataType;
	description?: string;

	/** Does this inlet represent an audio parameter in the audio node? **/
	isAudioParam?: boolean;

	/** Floating point precision. */
	precision?: number;

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
				isAudioParam: true
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

	// TODO: make this dynamic!
	fslider: {
		inlets: [{ name: 'min' }, { name: 'max' }, { name: 'value' }],
		outlets: []
	},

	delay: {
		inlets: [
			{ name: 'message', type: 'message', description: 'Message to pass through' },
			{ name: 'delayMs', type: 'float', description: 'How long to delay for, in ms.' }
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
