import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export interface DacSettings {
	deviceId: string;
}

export const DEFAULT_DAC_SETTINGS: DacSettings = {
	deviceId: ''
};

/**
 * DacNode implements the dac~ (digital-to-analog converter) audio node.
 * Routes audio signals to the computer's audio output (speakers/headphones).
 *
 * Each dac~ creates its own gain node that automatically connects to the shared
 * outGain, allowing multiple dac~ nodes to exist in a patch.
 */
export class DacNode implements AudioNodeV2 {
	static type = 'dac~';
	static group: AudioNodeGroup = 'destinations';
	static description = 'Send sounds to speakers';

	static inlets: ObjectInlet[] = [
		{ name: 'in', type: 'signal', description: 'Audio signal to output' }
	];

	static outlets: ObjectOutlet[] = [];

	readonly nodeId: string;
	audioNode: GainNode;

	private audioContext: AudioContext;
	settings: DacSettings = { ...DEFAULT_DAC_SETTINGS };

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;
	}

	create(): void {}
	send(): void {}

	/** Update output device - requires setSinkId on AudioContext (Chrome 110+) */
	async updateSettings(newSettings: Partial<DacSettings>): Promise<void> {
		this.settings = { ...this.settings, ...newSettings };

		// setSinkId is available on AudioContext in modern browsers
		if (newSettings.deviceId && 'setSinkId' in this.audioContext) {
			try {
				await (
					this.audioContext as AudioContext & { setSinkId: (id: string) => Promise<void> }
				).setSinkId(newSettings.deviceId);
			} catch (error) {
				console.error('Failed to set audio output device:', error);
			}
		}
	}

	getAudioParam(): AudioParam | null {
		return null;
	}
}
