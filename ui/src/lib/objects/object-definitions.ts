import type {
	ObjectDataType,
	ObjectInlet,
	ObjectOutlet,
	ObjectMetadata
} from '$lib/objects/v2/object-metadata';
import { AudioRegistry } from '$lib/registry/AudioRegistry';
import { getCompatMetadata } from './v2/query-metadata-compat';

/** Legacy type alias for backwards compatibility. */
export type ObjectDefinition = ObjectMetadata;

// Re-export v2 types for backwards compatibility
export type { ObjectDataType, ObjectInlet, ObjectOutlet };

/** Legacy object definitions. */
export const objectDefinitionsV1: Record<string, ObjectDefinition> = {
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

	// vertical slider
	vslider: {
		inlets: [{ name: 'min' }, { name: 'max' }, { name: 'value' }],
		outlets: []
	},

	// vertical float slider
	vfslider: {
		inlets: [{ name: 'min' }, { name: 'max' }, { name: 'value' }],
		outlets: []
	},

	delay: {
		inlets: [
			{ name: 'message', type: 'message', description: 'Message to pass through' },
			{
				name: 'delay',
				type: 'float',
				description: 'How long to delay for, in ms.',
				precision: 0,
				defaultValue: 1000
			}
		],
		outlets: [{ name: 'out', type: 'message', description: 'Message outlet' }],
		tags: ['helper']
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

	loadbang: {
		inlets: [],
		outlets: [{ name: 'out', type: 'bang', description: 'Bang signal sent on load' }],
		description: 'Sends a bang signal when the object is created',
		tags: ['control']
	},
	metro: {
		inlets: [
			{
				name: 'message',
				type: 'message',
				description: 'Control messages: "start", "stop", or bang to toggle',
				isAudioParam: false
			},
			{
				name: 'interval',
				type: 'int',
				description: 'Interval in milliseconds',
				defaultValue: 1000,
				minNumber: 0,
				isAudioParam: false
			}
		],
		outlets: [{ name: 'out', type: 'bang', description: 'Bang signal sent at regular intervals' }],
		description: 'Metronome that sends bang signals at regular intervals',
		tags: ['control']
	},
	spigot: {
		inlets: [
			{
				name: 'data',
				type: 'message',
				description: 'Data to pass through when allowed.'
			},
			{
				name: 'control',
				type: 'message',
				description: 'Truthy allows data, falsey blocks data. Bang toggles.'
			}
		],
		outlets: [{ name: 'out', type: 'message', description: 'Data output when spigot is open' }],
		description: 'Message gate that allows or blocks data based on condition',
		tags: ['control']
	}
};

/**
 * Check if a node has any signal inlets or outlets (i.e., is an audio node).
 */
function hasSignalPorts(metadata: ObjectMetadata): boolean {
	const hasSignalInlet = metadata.inlets?.some((inlet) => inlet.type === 'signal');
	const hasSignalOutlet = metadata.outlets?.some((outlet) => outlet.type === 'signal');
	return !!(hasSignalInlet || hasSignalOutlet);
}

/**
 * Get all audio object names from both v1 and v2 systems.
 * Audio objects are automatically detected by having signal inlets or outlets.
 */
export function getAudioObjectNames(): string[] {
	const registryV2 = AudioRegistry.getInstance();

	// Get v1 audio objects - detect by signal inlets/outlets
	const audioObjectNamesV1 = Object.keys(objectDefinitionsV1).filter((key) =>
		hasSignalPorts(objectDefinitionsV1[key])
	);

	// Get v2 audio objects - detect by signal inlets/outlets
	const audioObjectNamesV2 = registryV2.getNodeTypes().filter((name) => {
		const metadata = registryV2.getNodeMetadataByType(name);

		return metadata && hasSignalPorts(metadata);
	});

	return [...audioObjectNamesV1, ...audioObjectNamesV2];
}

export const getObjectNameFromExpr = (expr: string): string =>
	expr.trim().toLowerCase().split(' ')?.[0];

/**
 * Get object definition for a given expression.
 */
export const getObjectDefinition = (expr: string): ObjectDefinition | undefined =>
	getCompatMetadata(getObjectNameFromExpr(expr)) as ObjectDefinition;

/**
 * Get all object names from both v1 and v2 systems.
 */
export function getObjectNames(): string[] {
	const v1Names = Object.keys(objectDefinitionsV1);
	const v2AudioObjectNames = AudioRegistry.getInstance().getNodeTypes();

	return [...v1Names, ...v2AudioObjectNames];
}

export type AdsrParamList = [unknown, number, number, number, number, number];
