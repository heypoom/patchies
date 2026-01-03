import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class SoundfileNode implements AudioNodeV2 {
	static type = 'soundfile~';
	static group: AudioNodeGroup = 'sources';
	static description = 'Loads and plays audio files from URLs or files with drag-drop support';

	static inlets: ObjectInlet[] = [
		{
			name: 'message',
			type: 'message',
			description: 'Control messages: "play", "pause", "stop", or bang to restart'
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Audio output from loaded file' }
	];

	readonly nodeId: string;
	readonly audioNode: MediaElementAudioSourceNode;
	private audioElement: HTMLAudioElement;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;

		// Create and configure audio element
		this.audioElement = new Audio();
		this.audioElement.crossOrigin = 'anonymous';
		this.audioElement.loop = false;

		// Create media element source
		this.audioNode = audioContext.createMediaElementSource(this.audioElement);
	}

	send(key: string, message: unknown): void {
		if (key === 'message' && message && typeof message === 'object') {
			const msg = message as Record<string, unknown>;
			if (msg.type === 'bang') {
				this.audioElement.currentTime = 0;
				this.audioElement.play();
			} else if (msg.type === 'play') {
				this.audioElement.play();
			} else if (msg.type === 'pause') {
				this.audioElement.pause();
			} else if (msg.type === 'stop') {
				this.audioElement.pause();
				this.audioElement.currentTime = 0;
			}
		} else if (key === 'file' && message instanceof File) {
			this.audioElement.src = URL.createObjectURL(message);
		} else if (key === 'url' && typeof message === 'string') {
			this.audioElement.src = message;
		}
	}

	destroy(): void {
		this.audioElement.pause();
		this.audioElement.src = '';
		this.audioNode.disconnect();
	}
}
