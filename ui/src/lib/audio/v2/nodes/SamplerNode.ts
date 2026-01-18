import { match, P } from 'ts-pattern';

import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class SamplerNode implements AudioNodeV2 {
	static type = 'sampler~';
	static group: AudioNodeGroup = 'processors';

	static description =
		'Records audio into a buffer and plays it back with loop points, playback rate, and detune control';

	static inlets: ObjectInlet[] = [
		{
			name: 'message',
			type: 'message',
			description:
				'Control messages: record, play, stop, loop, loopOff, setStart, setEnd, playbackRate, detune'
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Audio output from sampler playback' }
	];

	readonly nodeId: string;
	audioNode: GainNode;

	audioBuffer: AudioBuffer | null = null;

	private audioContext: AudioContext;
	private recordingDestination: MediaStreamAudioDestinationNode;
	private mediaRecorder: MediaRecorder | null = null;
	private sourceNode: AudioBufferSourceNode | null = null;
	private loopStart: number = 0;
	private loopEnd: number = 0;
	private playbackRate: number = 1;
	private detune: number = 0;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;

		// Create main gain node for output
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;

		// Create MediaStreamDestination for recording input
		// This captures audio into a MediaStream for the MediaRecorder
		this.recordingDestination = audioContext.createMediaStreamDestination();
	}

	send(key: string, message: unknown): void {
		if (key !== 'message' || !message || typeof message !== 'object') {
			return;
		}

		const msg = message as Record<string, unknown>;

		match(msg)
			.with({ type: 'record' }, this.handleRecord.bind(this))
			.with({ type: 'end' }, () => {
				if (this.mediaRecorder?.state === 'recording') {
					this.mediaRecorder.stop();
				}
			})
			.with({ type: 'play' }, this.handlePlay.bind(this))
			.with({ type: 'stop' }, this.stopPlayback.bind(this))
			.with({ type: 'loop', start: P.number, end: P.number }, ({ start, end }) => {
				this.handleLoop(start, end);
			})
			.with({ type: 'loopOff' }, () => {
				if (this.sourceNode) {
					this.sourceNode.loop = false;
				}
			})
			.with({ type: 'setStart', value: P.number }, ({ value }) => {
				this.loopStart = value;

				if (this.sourceNode && this.sourceNode.loop) {
					this.sourceNode.loopStart = value;
				}
			})
			.with({ type: 'setEnd', value: P.number }, ({ value }) => {
				this.loopEnd = value;

				if (this.sourceNode && this.sourceNode.loop) {
					this.sourceNode.loopEnd = value;
				}
			})
			.with({ type: 'playbackRate', value: P.number }, ({ value }) => {
				this.playbackRate = value;

				if (this.sourceNode) {
					this.sourceNode.playbackRate.value = value;
				}
			})
			.with({ type: 'detune', value: P.number }, ({ value }) => {
				this.detune = value;

				if (this.sourceNode) {
					this.sourceNode.detune.value = value;
				}
			});
	}

	get destinationStream(): MediaStream {
		return this.recordingDestination.stream;
	}

	connectFrom(source: AudioNodeV2): void {
		// Custom handler for when another node connects TO sampler~
		// Route incoming audio to our recordingDestination for capture
		if (source.audioNode) {
			source.audioNode.connect(this.recordingDestination);
		}
	}

	destroy(): void {
		this.stopPlayback();
		if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
			this.mediaRecorder.stop();
		}
		this.audioNode.disconnect();
		this.recordingDestination.disconnect();
	}

	private handleLoop(start: number, end: number): void {
		if (!this.audioBuffer) {
			return;
		}

		// Stop existing source
		this.stopPlayback();

		// Reset loop points for new recording
		this.loopStart = start;
		this.loopEnd = end;

		// Create new source node
		const newSource = this.audioContext.createBufferSource();
		newSource.buffer = this.audioBuffer;
		newSource.loopStart = start;
		newSource.loopEnd = end;
		newSource.playbackRate.value = this.playbackRate;
		newSource.detune.value = this.detune;
		newSource.loop = true;
		newSource.connect(this.audioNode);

		// Store reference before starting
		this.sourceNode = newSource;

		newSource.start(0, start);
	}

	private async handleRecord(): Promise<void> {
		if (this.mediaRecorder) {
			return;
		}

		// Reset loop points
		this.loopStart = 0;
		this.loopEnd = 0;

		const recorder = new MediaRecorder(this.recordingDestination.stream);
		const recordedChunks: Blob[] = [];

		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				recordedChunks.push(event.data);
			}
		};

		recorder.onstop = async () => {
			try {
				const blob = new Blob(recordedChunks, { type: 'audio/wav' });
				const arrayBuffer = await blob.arrayBuffer();
				this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
				this.mediaRecorder = null;
			} catch (error) {
				console.error('Failed to process recorded audio:', error);
				this.mediaRecorder = null;
			}
		};

		recorder.start();
		this.mediaRecorder = recorder;
	}

	private handlePlay(): void {
		if (!this.audioBuffer) {
			return;
		}

		// Stop existing playback
		this.stopPlayback();

		// Create new source node
		const newSource = this.audioContext.createBufferSource();
		newSource.buffer = this.audioBuffer;
		newSource.playbackRate.value = this.playbackRate;
		newSource.detune.value = this.detune;
		newSource.connect(this.audioNode);

		// Store reference before setting up callback
		this.sourceNode = newSource;

		// Clean up when playback ends naturally
		newSource.onended = () => {
			// Only clean up if this is still the active source
			if (this.sourceNode === newSource) {
				newSource.disconnect();
				this.sourceNode = null;
			}
		};

		// Use stored loop points
		const startTime = this.loopStart ?? 0;
		const duration =
			this.loopEnd !== undefined && this.loopEnd > startTime ? this.loopEnd - startTime : undefined;

		newSource.start(0, startTime, duration);
	}

	private stopPlayback(): void {
		if (!this.sourceNode) return;

		try {
			this.sourceNode.stop();
			this.sourceNode.disconnect();
			this.sourceNode = null;
		} catch {
			// Ignore errors if node already stopped
		}
	}
}
