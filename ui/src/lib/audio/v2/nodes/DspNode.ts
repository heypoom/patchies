import { type AudioNodeV2, type AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { match, P } from 'ts-pattern';
import workletUrl from '../../../audio/dsp-processor?worker&url';

/**
 * DspNode implements the dsp~ (DSP processor) audio node.
 * Executes user-defined JavaScript for sample-level audio processing.
 */
export class DspNode implements AudioNodeV2 {
	static type = 'dsp~';
	static group: AudioNodeGroup = 'processors';
	static description = 'User-programmable DSP processor with dynamic inlets/outlets';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio signal input'
		},
		{
			name: 'code',
			type: 'string',
			description: 'JavaScript code for audio processing'
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Processed audio output' }
	];

	// Output gain
	audioNode: GainNode;

	readonly nodeId: string;

	private workletNode: AudioWorkletNode | null = null;
	private audioContext: AudioContext;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;

		// Create gain node immediately for connections
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;
	}

	async create(params: unknown[]): Promise<void> {
		await this.ensureModule();

		const [, code] = params as [unknown, string];

		try {
			this.workletNode = new AudioWorkletNode(this.audioContext, 'dsp-processor');
			this.workletNode.connect(this.audioNode);

			if (code) {
				this.send('code', code);
			}
		} catch (error) {
			logger.error('Failed to create DSP node:', error);
		}
	}

	async send(key: string, msg: unknown): Promise<void> {
		await this.ensureModule();

		const port = this.workletNode?.port;

		if (!port) {
			logger.warn('cannot send message to dsp~ as worklet port is missing', { key, msg, port });
			return;
		}

		match([key, msg])
			.with(['code', P.string], ([, code]) => {
				port.postMessage({ type: 'set-code', code });
			})
			.with(['inletValues', P.array(P.any)], ([, values]) => {
				port.postMessage({ type: 'set-inlet-values', values: Array.from(values) });
			})
			.with(['messageInlet', P.any], ([, messageData]) => {
				const data = messageData as { inletIndex: number; message: unknown; meta: unknown };

				port.postMessage({
					type: 'message-inlet',
					message: data.message,
					meta: data.meta
				});
			});
	}

	/**
	 * Handle incoming connections - route to worklet input
	 */
	async connectFrom(source: AudioNodeV2): Promise<void> {
		await this.ensureModule();

		if (this.workletNode && source.audioNode) {
			source.audioNode.connect(this.workletNode);
		}
	}

	async ensureModule(): Promise<void> {
		await DspNode.ensureModule(this.audioContext);
	}

	destroy(): void {
		this.workletNode?.disconnect();
		this.audioNode.disconnect();
	}

	private static moduleReady = false;
	private static modulePromise: Promise<void> | null = null;

	private static async ensureModule(audioContext: AudioContext): Promise<void> {
		if (this.moduleReady) return;
		if (this.modulePromise) return this.modulePromise;

		this.modulePromise = (async () => {
			try {
				const processorUrl = new URL(workletUrl, import.meta.url);
				await audioContext.audioWorklet.addModule(processorUrl.href);
				this.moduleReady = true;
			} catch (error) {
				logger.error('cannot add dsp-processor worklet module:', error);
			}
		})();

		return this.modulePromise;
	}

	/** Get the internal worklet node (for UI to access port) */
	get worklet(): AudioWorkletNode | null {
		return this.workletNode;
	}
}
