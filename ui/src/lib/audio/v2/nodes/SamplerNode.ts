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
	readonly audioNode: GainNode;

	audioBuffer: AudioBuffer | null = null;

	private audioContext: AudioContext;
	private destinationNode: MediaStreamAudioDestinationNode;
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
		this.destinationNode = audioContext.createMediaStreamDestination();
	}

	send(key: string, message: unknown): void {
		if (key !== 'message' || !message || typeof message !== 'object') {
			return;
		}

		const msg = message as Record<string, unknown>;

		if (msg.type === 'loop' && typeof msg.start === 'number' && typeof msg.end === 'number') {
			this.handleLoop(msg.start, msg.end);
		} else if (msg.type === 'loopOff') {
			if (this.sourceNode) {
				this.sourceNode.loop = false;
			}
		} else if (msg.type === 'setStart' && typeof msg.value === 'number') {
			this.loopStart = msg.value;
			if (this.sourceNode && this.sourceNode.loop) {
				this.sourceNode.loopStart = msg.value;
			}
		} else if (msg.type === 'setEnd' && typeof msg.value === 'number') {
			this.loopEnd = msg.value;
			if (this.sourceNode && this.sourceNode.loop) {
				this.sourceNode.loopEnd = msg.value;
			}
		} else if (msg.type === 'playbackRate' && typeof msg.value === 'number') {
			this.playbackRate = msg.value;
			if (this.sourceNode) {
				this.sourceNode.playbackRate.value = msg.value;
			}
		} else if (msg.type === 'detune' && typeof msg.value === 'number') {
			this.detune = msg.value;
			if (this.sourceNode) {
				this.sourceNode.detune.value = msg.value;
			}
		} else if (msg.type === 'record') {
			this.handleRecord();
		} else if (msg.type === 'end') {
			if (this.mediaRecorder?.state === 'recording') {
				this.mediaRecorder.stop();
			}
		} else if (msg.type === 'play') {
			this.handlePlay();
		} else if (msg.type === 'stop') {
			this.stopPlayback();
		}
	}

	get destinationStream(): MediaStream {
		return this.destinationNode.stream;
	}

	connect(target: AudioNodeV2): void {
		// Route incoming audio to the destination node for recording
		target.audioNode.connect(this.destinationNode);
	}

	destroy(): void {
		this.stopPlayback();
		if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
			this.mediaRecorder.stop();
		}
		this.audioNode.disconnect();
		this.destinationNode.disconnect();
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
		this.sourceNode = this.audioContext.createBufferSource();
		this.sourceNode.buffer = this.audioBuffer;
		this.sourceNode.loopStart = start;
		this.sourceNode.loopEnd = end;
		this.sourceNode.playbackRate.value = this.playbackRate;
		this.sourceNode.detune.value = this.detune;
		this.sourceNode.loop = true;
		this.sourceNode.connect(this.audioNode);
		this.sourceNode.start(0, start);
	}

	private async handleRecord(): Promise<void> {
		if (this.mediaRecorder) {
			return;
		}

		// Reset loop points
		this.loopStart = 0;
		this.loopEnd = 0;

		const recorder = new MediaRecorder(this.destinationNode.stream);
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
		this.sourceNode = this.audioContext.createBufferSource();
		this.sourceNode.buffer = this.audioBuffer;
		this.sourceNode.playbackRate.value = this.playbackRate;
		this.sourceNode.detune.value = this.detune;
		this.sourceNode.connect(this.audioNode);

		// Clean up when playback ends
		this.sourceNode.onended = () => {
			if (this.sourceNode && this.sourceNode.buffer === this.audioBuffer) {
				this.sourceNode.disconnect();
				this.sourceNode = null;
			}
		};

		// Use stored loop points
		const startTime = this.loopStart ?? 0;
		const duration =
			this.loopEnd !== undefined && this.loopEnd > startTime ? this.loopEnd - startTime : undefined;

		this.sourceNode.start(0, startTime, duration);
	}

	private stopPlayback(): void {
		if (this.sourceNode) {
			try {
				this.sourceNode.stop();
				this.sourceNode.disconnect();
				this.sourceNode = null;
			} catch {
				// Ignore errors if node already stopped
			}
		}
	}
}
