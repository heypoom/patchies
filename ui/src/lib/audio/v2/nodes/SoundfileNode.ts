import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { match, P } from 'ts-pattern';

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
		const element = this.audioElement;

		match([key, message])
			.with(['message', { type: P.string }], ([, msg]) => {
				match(msg)
					.with({ type: 'bang' }, () => {
						element.currentTime = 0;
						element.play();
					})
					.with({ type: 'play' }, () => element.play())
					.with({ type: 'pause' }, () => element.pause())
					.with({ type: 'stop' }, () => {
						element.pause();
						element.currentTime = 0;
					});
			})
			.with(['file', P.instanceOf(File)], ([, file]) => {
				element.src = URL.createObjectURL(file);
			})
			.with(['url', P.string], ([, url]) => {
				element.src = url;
			});
	}

	destroy(): void {
		this.audioElement.pause();

		// Clean up blobs created by createObjectURL
		if (this.audioElement.src.startsWith('blob:')) {
			URL.revokeObjectURL(this.audioElement.src);
		}

		this.audioElement.src = '';
		this.audioNode.disconnect();
	}
}
