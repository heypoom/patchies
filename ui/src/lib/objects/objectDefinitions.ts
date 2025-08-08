type ObjectDataType =
	| 'any'
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
			{ name: 'gain', type: 'float', description: 'Gain multiplier' }
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Amplified signal' }],
		description: 'Amplifies input by gain factor',
		tags: ['audio']
	},

	osc: {
		inlets: [
			{ name: 'frequency', type: 'float', description: 'Oscillator frequency in Hz' },
			{
				name: 'type',
				type: 'string',
				description: 'Oscillator type (sine, square, sawtooth, triangle)'
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Oscillator output' }],
		description: 'Sine wave oscillator',
		tags: ['audio']
	},

	dac: {
		inlets: [{ name: 'in', type: 'signal', description: 'Audio signal to output' }],
		outlets: [],
		description: 'Digital to analog converter - audio output destination',
		tags: ['audio']
	},

	m2f: {
		inlets: [{ name: 'note', type: 'float', description: 'MIDI note value (0-127)' }],
		outlets: [{ name: 'frequency', type: 'float', description: 'Frequency in Hz' }],
		description: 'Converts MIDI note values to frequency float values',
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

	'-~': {
		inlets: [
			{ name: 'left', type: 'signal', description: 'Left signal input (minuend)' },
			{ name: 'right', type: 'signal', description: 'Right signal input (subtrahend)' }
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Difference of input signals' }],
		description: 'Subtracts right signal from left signal',
		tags: ['audio']
	}
};

export const audioObjectNames = Object.keys(objectDefinitions).filter((key) =>
	objectDefinitions[key].tags?.includes('audio')
);

export const getObjectName = (expr: string): string => expr.trim().toLowerCase().split(' ')?.[0];

// Helper function to get object definition
export function getObjectDefinition(expr: string): ObjectDefinition | undefined {
	const name = getObjectName(expr);

	return objectDefinitions[name];
}

// Helper function to get all object names
export function getObjectNames(): string[] {
	return Object.keys(objectDefinitions);
}

// Helper function to get object names by category
export function getObjectNamesByCategory(category: string): string[] {
	return Object.entries(objectDefinitions)
		.filter(([_, def]) => def.tags === category)
		.map(([name]) => name);
}

// Helper function to validate inlet/outlet types
export function validateMessageType(value: any, expectedType: string): boolean {
	switch (expectedType) {
		case 'any':
			return true;
		case 'bang':
			return value?.type === 'bang';
		case 'float':
			return typeof value === 'number';
		case 'int':
			return typeof value === 'number' && Number.isInteger(value);
		case 'string':
			return typeof value === 'string';
		case 'bool':
			return typeof value === 'boolean';
		case 'int[]':
			return (
				Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isInteger(v))
			);
		case 'float[]':
			return Array.isArray(value) && value.every((v) => typeof v === 'number');
		default:
			return false;
	}
}
