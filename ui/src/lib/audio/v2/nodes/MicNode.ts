import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export interface MicSettings {
	deviceId?: string;
	echoCancellation?: boolean;
	noiseSuppression?: boolean;
	autoGainControl?: boolean;
}

export const DEFAULT_MIC_SETTINGS: MicSettings = {
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true
};

export class MicNode implements AudioNodeV2 {
	static type = 'mic~';
	static group: AudioNodeGroup = 'sources';
	static description = 'Captures audio from microphone with bang to restart';

	static inlets: ObjectInlet[] = [
		{
			name: 'message',
			type: 'message',
			description: 'Control messages. Bang to restart microphone input.'
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Microphone audio output' }
	];

	readonly nodeId: string;
	audioNode: GainNode;

	private audioContext: AudioContext;
	private mediaStream: MediaStream | null = null;
	private mediaStreamSource: MediaStreamAudioSourceNode | null = null;

	settings: MicSettings = { ...DEFAULT_MIC_SETTINGS };

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;

		// Request microphone on creation
		this.restartMic();
	}

	send(key: string, message: unknown): void {
		// Handle bang message to restart microphone
		if (key === 'message' && message === 'bang') {
			this.restartMic();
		}
	}

	/** Update mic settings and restart with new constraints */
	updateSettings(newSettings: Partial<MicSettings>): void {
		this.settings = { ...this.settings, ...newSettings };
		this.restartMic();
	}

	destroy(): void {
		// Stop all microphone tracks
		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop());
		}

		// Disconnect stream source
		if (this.mediaStreamSource) {
			this.mediaStreamSource.disconnect();
		}

		// Disconnect main node
		this.audioNode.disconnect();
	}

	async restartMic(): Promise<void> {
		// Clean up existing mic resources
		if (this.mediaStreamSource) {
			this.mediaStreamSource.disconnect();
		}

		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop());
		}

		try {
			const constraints: MediaTrackConstraints = {
				...(this.settings.deviceId && { deviceId: { exact: this.settings.deviceId } }),
				sampleRate: { ideal: 48000 },
				echoCancellation: this.settings.echoCancellation,
				noiseSuppression: this.settings.noiseSuppression,
				autoGainControl: this.settings.autoGainControl
			};

			const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
			const streamSource = this.audioContext.createMediaStreamSource(stream);

			streamSource.connect(this.audioNode);

			this.mediaStream = stream;
			this.mediaStreamSource = streamSource;
		} catch (error) {
			console.error('Failed to restart microphone:', error);
		}
	}
}
