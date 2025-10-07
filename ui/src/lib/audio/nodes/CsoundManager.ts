import type { CsoundObj } from '@csound/browser';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import { match, P } from 'ts-pattern';

export class CsoundManager {
	private csound: CsoundObj | null = null;
	private audioContext: AudioContext;
	private outputNode: GainNode;
	private inputNode: GainNode;
	private initialized = false;
	private isPaused = false;

	constructor(
		nodeId: string,
		audioContext: AudioContext,
		outputNode: GainNode,
		inputNode: GainNode
	) {
		this.audioContext = audioContext;
		this.outputNode = outputNode;
		this.inputNode = inputNode;
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
				node.connect(this.outputNode);
			}

			this.initialized = true;
		} catch (error) {
			console.error('Failed to initialize Csound:', error);
		}
	}

	async handleMessage(key: string, value: unknown): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (!this.csound) return;

		try {
			await match([key, value])
				.with(['code', P.string], async ([, code]) => this.runCode(code))
				.with(['messageInlet', { inletIndex: P.number, message: P.any, meta: P.any }], ([, data]) =>
					this.handleInletMessage(data.inletIndex, data.message)
				)
				.otherwise(() => {});
		} catch (error) {
			console.error('Error in CsoundManager:', error);
		}
	}

	private async runCode(code: string) {
		if (!this.csound) return;

		try {
			await this.csound.stop();
			await this.csound.reset();

			const csd = `
        <CsoundSynthesizer>
          <CsOptions>
          -o dac
          --port=10000
          </CsOptions>

          <CsInstruments>
            sr=48000
            ksmps=64
            nchnls=2
            0dbfs=1

            ${code}
          </CsInstruments>
        </CsoundSynthesizer>
      `;

			await this.csound.compileCSD(csd);
			await this.csound.start();
		} catch (error) {
			console.error('Error compiling/running Csound code:', error);
		}
	}

	private async handleInletMessage(inletIndex: number, message: unknown) {
		if (!this.csound) return;

		try {
			await match(message)
				.with({ type: 'bang' }, async () => {
					if (this.isPaused) {
						await this.resume();
					}

					await this.csound!.inputMessage('i 1 0 1');
				})
				.with({ type: 'pause' }, () => this.pause())
				.with({ type: 'play' }, () => this.resume())
				.with({ type: 'stop' }, () => this.csound!.stop())
				.with({ type: 'reset' }, () => this.csound!.reset())
				.with({ type: 'setControlChannel', channel: P.string, value: P.number }, (m) => {
					this.csound!.setControlChannel(m.channel, m.value);
				})
				.with(P.number, (value) => {
					this.csound!.setControlChannel(`ch${inletIndex}`, value);
				})
				.with(P.string, (scoreEvent) => this.csound!.inputMessage(scoreEvent))
				.otherwise(() => {});
		} catch (error) {
			console.error('Error handling inlet message:', error);
		}
	}

	async pause() {
		if (!this.csound || this.isPaused) return;

		try {
			await this.csound.pause();
			this.isPaused = true;
		} catch (error) {
			console.error('Error pausing Csound:', error);
		}
	}

	async resume() {
		if (!this.csound || !this.isPaused) return;

		try {
			await this.csound.resume();
			this.isPaused = false;
		} catch (error) {
			console.error('Error resuming Csound:', error);
		}
	}

	getIsPaused(): boolean {
		return this.isPaused;
	}

	async destroy() {
		if (!this.csound) return;

		try {
			await this.csound.stop();
			await this.csound.reset();
		} catch (error) {
			console.error('Error destroying Csound:', error);
		}
	}
}

export const createCsoundMessageHandler =
	(manager: CsoundManager | undefined): MessageCallbackFn =>
	async (data, meta) => {
		if (!manager) return;

		const inletIndex = meta.inlet ?? 0;

		await manager.handleMessage('messageInlet', {
			inletIndex,
			message: data,
			meta
		});
	};
