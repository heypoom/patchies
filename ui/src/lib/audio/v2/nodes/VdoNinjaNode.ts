import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * VdoNinjaPullNode - Audio node for receiving audio from VDO.Ninja streams.
 * Accepts a MediaStream and outputs audio to the pipeline.
 */
export class VdoNinjaPullNode implements AudioNodeV2 {
	static type = 'vdo.ninja.pull';
	static group: AudioNodeGroup = 'sources';
	static description = 'Receives audio from VDO.Ninja WebRTC streams';

	static inlets: ObjectInlet[] = [];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Audio output from remote stream' }
	];

	readonly nodeId: string;
	audioNode: GainNode;

	private audioContext: AudioContext;
	private mediaStreamSource: MediaStreamAudioSourceNode | null = null;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;
	}

	/**
	 * Set the MediaStream to receive audio from.
	 * Can be called multiple times to switch streams.
	 */
	setMediaStream(stream: MediaStream | null): void {
		// Disconnect existing source
		if (this.mediaStreamSource) {
			this.mediaStreamSource.disconnect();
			this.mediaStreamSource = null;
		}

		if (stream) {
			// Get audio tracks from the stream
			const audioTracks = stream.getAudioTracks();

			if (audioTracks.length > 0) {
				// Create a new stream with just audio tracks
				const audioStream = new MediaStream(audioTracks);
				this.mediaStreamSource = this.audioContext.createMediaStreamSource(audioStream);
				this.mediaStreamSource.connect(this.audioNode);
			}
		}
	}

	/**
	 * Add a single audio track to the node.
	 */
	addAudioTrack(track: MediaStreamTrack): void {
		if (track.kind !== 'audio') return;

		// Disconnect existing source if any
		if (this.mediaStreamSource) {
			this.mediaStreamSource.disconnect();
		}

		const audioStream = new MediaStream([track]);
		this.mediaStreamSource = this.audioContext.createMediaStreamSource(audioStream);
		this.mediaStreamSource.connect(this.audioNode);
	}

	destroy(): void {
		if (this.mediaStreamSource) {
			this.mediaStreamSource.disconnect();
			this.mediaStreamSource = null;
		}

		this.audioNode.disconnect();
	}
}
