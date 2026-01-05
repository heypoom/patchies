import { type AudioNodeV2, type AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import type { AudioDevice } from '$lib/uxn/devices/AudioDevice';

/**
 * UxnAudioNode implements the audio output for Uxn emulator.
 * This node receives audio from the Uxn Audio Device and routes it to the audio pipeline.
 */
export class UxnAudioNode implements AudioNodeV2 {
	static type = 'uxn';
	static group: AudioNodeGroup = 'sources';
	static description = 'Uxn audio output';

	static inlets: ObjectInlet[] = [];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Audio output from Uxn' }
	];

	readonly nodeId: string;
	audioNode: GainNode;

	private audioContext: AudioContext;
	private audioDevice: AudioDevice | null = null;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;

		// Create gain node for audio output
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;
	}

	create(params: unknown[]): void {
		// params[0] should be the AudioDevice instance
		const [audioDevice] = params as [AudioDevice];
		if (audioDevice) {
			this.audioDevice = audioDevice;
			audioDevice.setAudioNode(this, this.audioContext);
		}
	}

	send(): void {
		// Audio device is controlled via dei/deo, not messages
	}

	getAudioParam(): AudioParam | null {
		return this.audioNode.gain;
	}

	destroy(): void {
		if (this.audioDevice) {
			this.audioDevice.stop();
		}
		this.audioNode.disconnect();
	}
}
