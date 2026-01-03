import type {
	ObjectDataType,
	ObjectInlet,
	ObjectOutlet,
	ObjectMetadata
} from '$lib/objects/v2/object-metadata';
import { AudioService } from '$lib/audio/v2/AudioService';

/**
 * Legacy type alias for backwards compatibility.
 * Use NodeMetadata in new code.
 */
export type ObjectDefinition = ObjectMetadata;

// Re-export v2 types for backwards compatibility
export type { ObjectDataType, ObjectInlet, ObjectOutlet };

/** Legacy object definitions. */
export const objectDefinitionsV1: Record<string, ObjectDefinition> = {
	'gain~': {
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

	'dac~': {
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

	// alias of 'soundfile~ url'
	'soundurl~': { inlets: [{ name: 'url' }], outlets: [] },

	'fft~': {
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
				type: 'analysis',
				description: 'Marker to indicate where to get the FFT data from.'
			}
		],
		description: 'Analyzes audio signals and provides frequency and amplitude data',
		tags: ['audio']
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

	'mic~': {
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

	'lowpass~': {
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

	'highpass~': {
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

	'bandpass~': {
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

	'allpass~': {
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
				description: 'Quality factor',
				defaultValue: 1,
				isAudioParam: true,
				minNumber: 0.0001,
				maxNumber: 1000,
				maxPrecision: 2
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal' }],
		description: 'All-pass filter passes all frequencies but shifts their phase',
		tags: ['audio']
	},

	'notch~': {
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
				description: 'Quality factor (narrowness of notch)',
				defaultValue: 1,
				isAudioParam: true,
				minNumber: 0.0001,
				maxNumber: 1000,
				maxPrecision: 2
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal' }],
		description: 'Notch filter attenuates frequencies around the center frequency',
		tags: ['audio']
	},

	'lowshelf~': {
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
				name: 'gain',
				type: 'float',
				description: 'Gain in dB',
				defaultValue: 0,
				isAudioParam: true,
				minNumber: -40,
				maxNumber: 40,
				maxPrecision: 1
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal' }],
		description: 'Low shelf filter boosts or cuts frequencies below the cutoff frequency',
		tags: ['audio']
	},

	'highshelf~': {
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
				name: 'gain',
				type: 'float',
				description: 'Gain in dB',
				defaultValue: 0,
				isAudioParam: true,
				minNumber: -40,
				maxNumber: 40,
				maxPrecision: 1
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal' }],
		description: 'High shelf filter boosts or cuts frequencies above the cutoff frequency',
		tags: ['audio']
	},

	'peaking~': {
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
				maxNumber: 30,
				maxPrecision: 2
			},
			{
				name: 'gain',
				type: 'float',
				description: 'Gain in dB',
				defaultValue: 0,
				isAudioParam: true,
				minNumber: -40,
				maxNumber: 40,
				maxPrecision: 1
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal' }],
		description: 'Peaking filter boosts or cuts frequencies around the center frequency',
		tags: ['audio']
	},

	'compressor~': {
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

	'pan~': {
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
				description: 'Delay time in milliseconds',
				defaultValue: 1000,
				isAudioParam: true,
				minNumber: 0,
				precision: 0
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Delayed signal' }],
		description: 'Delay-line node with configurable delay time in milliseconds',
		tags: ['audio']
	},

	'soundfile~': {
		inlets: [
			{
				name: 'message',
				type: 'message',
				description: 'Control messages: "play", "pause", "stop", or bang to restart'
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Audio output from loaded file' }],
		description:
			'Loads and plays audio files from local files or URLs with drag-drop and file picker',
		tags: ['audio']
	},

	'waveshaper~': {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Audio signal to process' },
			{
				name: 'curve',
				type: 'float[]',
				description: 'Array of numbers or Float32Array to set as waveshaper curve',
				defaultValue: [0, 1],
				isAudioParam: false,
				maxDisplayLength: 8
			},
			{
				name: 'oversample',
				type: 'string',
				description: 'Oversample setting: "none", "2x", or "4x"',
				defaultValue: 'none',
				isAudioParam: false,
				options: ['none', '2x', '4x']
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Waveshaped signal' }],
		description: 'WaveShaperNode for distortion and waveshaping effects',
		tags: ['audio']
	},

	'convolver~': {
		inlets: [
			{ name: 'in', type: 'signal', description: 'Audio signal to process' },
			{
				name: 'message',
				type: 'message',
				description: 'AudioBuffer for impulse response',
				isAudioParam: false
			},
			{
				name: 'normalize',
				type: 'bool',
				description: 'Whether to normalize the impulse response',
				defaultValue: true,
				isAudioParam: false
			}
		],
		outlets: [{ name: 'out', type: 'signal', description: 'Convolved signal with reverb effect' }],
		description: 'ConvolverNode for reverb and acoustic modeling using impulse responses',
		tags: ['audio']
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
	const audioService = AudioService.getInstance();

	// Get v1 audio objects - detect by signal inlets/outlets
	const v1Audio = Object.keys(objectDefinitionsV1).filter((key) =>
		hasSignalPorts(objectDefinitionsV1[key])
	);

	// Get v2 audio objects - detect by signal inlets/outlets
	const v2Audio = audioService.getAllNodeNames().filter((name) => {
		const metadata = audioService.getNodeMetadata(name);
		return metadata && hasSignalPorts(metadata);
	});

	return [...v1Audio, ...v2Audio];
}

export const getObjectNameFromExpr = (expr: string): string =>
	expr.trim().toLowerCase().split(' ')?.[0];

/**
 * Get object definition for a given expression.
 * Checks both v2 and v1 systems.
 */
export function getObjectDefinition(expr: string): ObjectDefinition | undefined {
	const name = getObjectNameFromExpr(expr);
	const audioService = AudioService.getInstance();

	// Try v2 first
	const v2Metadata = audioService.getNodeMetadata(name);
	if (v2Metadata) {
		return v2Metadata;
	}

	// Fall back to v1
	return objectDefinitionsV1[name];
}

/**
 * Get all object names from both v1 and v2 systems.
 */
export function getObjectNames(): string[] {
	const v1Names = Object.keys(objectDefinitionsV1);

	const audioService = AudioService.getInstance();
	const v2AudioNodeNames = audioService.getAllNodeNames();

	return [...v1Names, ...v2AudioNodeNames];
}

export type AdsrParamList = [unknown, number, number, number, number, number];
