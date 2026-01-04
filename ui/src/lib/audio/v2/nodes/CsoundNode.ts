import { type AudioNodeV2, type AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { match, P } from 'ts-pattern';
import type { CsoundObj } from '@csound/browser';

/**
 * CsoundNode implements the csound~ audio node.
 * Executes Csound code for sound synthesis and processing.
 */
export class CsoundNode implements AudioNodeV2 {
	static type = 'csound~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Csound synthesis and audio processing';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio signal input'
		},
		{
			name: 'msg',
			type: 'message',
			description: 'Control messages'
		}
	];

	static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal', description: 'Audio output' }];

	// Output gain node
	audioNode: GainNode;

	readonly nodeId: string;

	private inputNode: GainNode;
	private audioContext: AudioContext;

	// Csound state
	private csound: CsoundObj | null = null;
	private initialized = false;
	private isProgramLoaded = false;
	private isPaused = true;
	private optionsString = '';
	private codeString = '';

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;

		// Create gain nodes immediately for connections
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;

		this.inputNode = audioContext.createGain();
		this.inputNode.gain.value = 1.0;
	}

	async create(params: unknown[]): Promise<void> {
		const [, code] = params as [unknown, string];

		await this.initialize();

		if (code) {
			await this.setCode(code);
		}
	}

	async send(key: string, value: unknown): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (!this.csound) return;

		try {
			await match([key, value])
				.with(['code', P.string], async ([, code]) => this.setCode(code))
				.with(['run', P.string], async ([, code]) => this.runCode(code))
				.with(['messageInlet', { inletIndex: P.number, message: P.any, meta: P.any }], ([, data]) =>
					this.handleInletMessage(data.inletIndex, data.message)
				)
				.run();
		} catch (error) {
			logger.error('error in csound~ send:', error);
		}
	}

	/**
	 * Handle incoming connections - route to input node
	 */
	connectFrom(source: AudioNodeV2): void {
		if (source.audioNode) {
			source.audioNode.connect(this.inputNode);
		}
	}

	async initialize() {
		if (this.initialized) return;
		if (typeof window === 'undefined') return;

		const { Csound } = await import('@csound/browser');

		try {
			const csound = await Csound({
				audioContext: this.audioContext,
				autoConnect: false
			});

			if (!csound) return;

			this.csound = csound;

			const node = await this.csound.getNode();

			if (node) {
				node.connect(this.audioNode);
			}

			this.initialized = true;
		} catch (error) {
			logger.error('failed to initialize csound~:', error);
		}
	}

	async setCode(code: string) {
		if (!this.csound) return;

		this.codeString = code;

		try {
			await this.csound.stop();
			await this.csound.reset();

			let processedCode = code;

			if (!code.includes('<CsInstruments>')) {
				processedCode = `<CsInstruments>
    		  sr = 48000
          ksmps = 64
          nchnls = 2
          0dbfs = 1

				${processedCode}
			</CsInstruments>`;
			}

			let defaultCsOptions = '';

			if (!code.includes('<CsOptions>')) {
				defaultCsOptions = `<CsOptions>
		  	-odac
			</CsOptions>`;
			}

			const csd = `
        <CsoundSynthesizer>
          ${processedCode}

          ${defaultCsOptions}
        </CsoundSynthesizer>
      `;

			await this.csound.compileCSD(csd);
			await this.setOptions(this.optionsString);
		} catch (error) {
			logger.error('error compiling/running csound~ code:', error);
		}
	}

	async runCode(code: string) {
		if (!this.csound) return;

		await this.setCode(code);
		await this.csound.start();
		this.isPaused = false;
		this.isProgramLoaded = true;
	}

	async setOptions(options: string) {
		if (!this.csound) return;

		this.optionsString = options;

		const trimmedOptions = options.split(' ').map((option) => option.trim());

		for (const option of trimmedOptions) {
			await this.csound.setOption(option);
		}
	}

	private async handleInletMessage(inletIndex: number, message: unknown) {
		if (!this.csound) return;

		try {
			await match(message)
				.with({ type: 'bang' }, async () => {
					await this.resume();

					if (this.codeString) {
						await this.runCode(this.codeString);
					}
				})
				.with({ type: 'pause' }, () => this.pause())
				.with({ type: 'play' }, () => this.resume())
				.with({ type: 'stop' }, () => this.csound!.stop())
				.with({ type: 'reset' }, () => this.csound!.reset())
				.with({ type: 'setChannel', channel: P.string, value: P.number }, async (m) => {
					await this.csound!.setControlChannel(m.channel, m.value);
				})
				.with({ type: 'setChannel', channel: P.string, value: P.string }, async (m) => {
					await this.csound!.setStringChannel(m.channel, m.value);
				})
				.with({ type: 'setOptions', value: P.string }, async (m) => {
					await this.setOptions(m.value);
					await this.csound!.reset();
				})
				.with({ type: 'noteOn', note: P.number, velocity: P.number }, async (m) => {
					await this.ensureMidi();
					await this.csound!.midiMessage(144, m.note, m.velocity);
				})
				.with({ type: 'noteOff', note: P.number, velocity: P.number }, async (m) => {
					await this.ensureMidi();
					await this.csound!.midiMessage(128, m.note, m.velocity);
				})
				.with({ type: 'readScore', value: P.string }, async (m) => {
					await this.csound!.readScore(m.value);
				})
				.with({ type: 'eval', code: P.string }, async (m) => {
					await this.csound!.evalCode(m.code);
				})
				.with(P.number, async (value) => {
					await this.csound!.setControlChannel(String(inletIndex), value);
				})
				.with(P.string, async (m) => {
					if (m.startsWith('-')) {
						await this.setOptions(m);
						await this.csound!.reset();
						return;
					}

					await this.csound!.inputMessage(m);
				})
				.run();
		} catch (error) {
			logger.error('error handling csound~ inlet message:', error);
		}
	}

	async pause() {
		if (!this.csound || this.isPaused) return;

		try {
			await this.csound.pause();
			this.isPaused = true;
		} catch (error) {
			logger.error('error pausing csound~:', error);
		}
	}

	async resume() {
		if (!this.csound || !this.isPaused) return;

		if (!this.isProgramLoaded && this.codeString) {
			await this.runCode(this.codeString);
		}

		try {
			await this.csound.resume();
			this.isPaused = false;
		} catch (error) {
			logger.error('error resuming csound~:', error);
		}
	}

	getIsPaused(): boolean {
		return this.isPaused;
	}

	async ensureMidi() {
		if (this.optionsString.includes('-M0')) return;

		await this.setOptions(`${this.optionsString} -M0`);
		await this.runCode(this.codeString);
	}

	async destroy() {
		if (!this.csound) return;

		try {
			await this.csound.stop();
			await this.csound.reset();
			await this.csound.terminateInstance();
		} catch (error) {
			logger.error('error destroying csound~:', error);
		}

		this.audioNode.disconnect();
		this.inputNode.disconnect();
	}
}
