export interface ObjectInlet {
	name?: string;
	type?: 'any' | 'bang' | 'float' | 'int' | 'string' | 'bool' | 'int[]' | 'float[]';
	description?: string;
}

export interface ObjectOutlet {
	name?: string;
	type?: 'any' | 'bang' | 'float' | 'int' | 'string' | 'bool' | 'int[]' | 'float[]';
	description?: string;
}

export interface ObjectDefinition {
	inlets: ObjectInlet[];
	outlets: ObjectOutlet[];
	description?: string;
	category?: string;
}

export const objectDefinitions: Record<string, ObjectDefinition> = {
	// Audio processing objects
	gain: {
		inlets: [
			{ name: 'value', type: 'float', description: 'Input value to amplify' },
			{ name: 'gain', type: 'float', description: 'Gain multiplier (default: 1.0)' }
		],
		outlets: [{ name: 'out', type: 'float', description: 'Amplified output value' }],
		description: 'Amplifies input by gain factor',
		category: 'audio'
	},

	clip: {
		inlets: [
			{ name: 'value', type: 'float', description: 'Value to clip' },
			{ name: 'min', type: 'float', description: 'Minimum value' },
			{ name: 'max', type: 'float', description: 'Maximum value' }
		],
		outlets: [{ name: 'clipped', type: 'float', description: 'Clipped value' }],
		description: 'Clips input value between min and max',
		category: 'math'
	},

	// Math objects
	add: {
		inlets: [
			{ name: 'a', type: 'float', description: 'First operand' },
			{ name: 'b', type: 'float', description: 'Second operand' }
		],
		outlets: [{ name: 'sum', type: 'float', description: 'Sum of inputs' }],
		description: 'Adds two numbers together',
		category: 'math'
	},

	multiply: {
		inlets: [
			{ name: 'a', type: 'float', description: 'First operand' },
			{ name: 'b', type: 'float', description: 'Second operand' }
		],
		outlets: [{ name: 'product', type: 'float', description: 'Product of inputs' }],
		description: 'Multiplies two numbers together',
		category: 'math'
	},

	// Utility objects
	metro: {
		inlets: [
			{ name: 'interval', type: 'float', description: 'Time interval in milliseconds' },
			{ name: 'start', type: 'bang', description: 'Start the metro' },
			{ name: 'stop', type: 'bang', description: 'Stop the metro' }
		],
		outlets: [{ name: 'tick', type: 'bang', description: 'Periodic tick output' }],
		description: 'Periodic timer that outputs bangs',
		category: 'time'
	},

	// Message objects
	print: {
		inlets: [{ name: 'value', type: 'any', description: 'Value to print' }],
		outlets: [],
		description: 'Prints value to console',
		category: 'debug'
	},

	// Visual node aliases that will transform to actual visual nodes
	bang: {
		inlets: [],
		outlets: [{ name: 'out', type: 'bang', description: 'Bang output' }],
		description: 'Bang button (transforms to visual bang node)',
		category: 'ui'
	},

	msg: {
		inlets: [
			{ name: 'set', type: 'any', description: 'Set message content' },
			{ name: 'trigger', type: 'bang', description: 'Trigger message send' }
		],
		outlets: [{ name: 'out', type: 'any', description: 'Message output' }],
		description: 'Message box (transforms to visual message node)',
		category: 'ui'
	}
};

// Helper function to get object definition
export function getObjectDefinition(name: string): ObjectDefinition | undefined {
	return objectDefinitions[name];
}

// Helper function to get all object names
export function getObjectNames(): string[] {
	return Object.keys(objectDefinitions);
}

// Helper function to get object names by category
export function getObjectNamesByCategory(category: string): string[] {
	return Object.entries(objectDefinitions)
		.filter(([_, def]) => def.category === category)
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
			return typeof value === 'number' && !Number.isInteger(value);
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
