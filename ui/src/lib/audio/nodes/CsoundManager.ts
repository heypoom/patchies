import { Csound } from '@csound/browser';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

type CsoundObj = any;

export class CsoundManager {
	private csound: CsoundObj | null = null;
	private audioContext: AudioContext;
	private outputNode: GainNode;
	private inputNode: GainNode;
	private initialized = false;
	private currentCode = '';

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

		try {
			this.csound = await Csound();
			await this.csound.setOption('-odac');
			await this.csound.setOption('-iadc');
			await this.csound.setOption('-+rtaudio=null');
			await this.csound.setOption('-d');

			const audioWorkletNode = await this.csound.getAudioContext();
			if (audioWorkletNode) {
				audioWorkletNode.connect(this.outputNode);
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
			if (key === 'code' && typeof value === 'string') {
				this.currentCode = value;
				await this.runCode(value);
			} else if (key === 'messageInlet' && typeof value === 'object' && value !== null) {
				const data = value as { inletIndex: number; message: unknown; meta: unknown };
				await this.handleInletMessage(data.inletIndex, data.message);
			}
		} catch (error) {
			console.error('Error in CsoundManager:', error);
		}
	}

	private async runCode(code: string) {
		if (!this.csound) return;

		try {
			await this.csound.reset();
			await this.csound.setOption('-odac');
			await this.csound.setOption('-iadc');

			const csd = `
<CsoundSynthesizer>
<CsOptions>
-odac -iadc -d
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 128
nchnls = 2
0dbfs = 1

${code}

</CsInstruments>
<CsScore>
f0 86400
</CsScore>
</CsoundSynthesizer>
`;

			await this.csound.compileOrc(csd);
			await this.csound.start();
		} catch (error) {
			console.error('Error compiling/running Csound code:', error);
		}
	}

	private async handleInletMessage(inletIndex: number, message: unknown) {
		if (!this.csound) return;

		try {
			if (typeof message === 'object' && message !== null && 'type' in message) {
				const msg = message as { type: string; [key: string]: unknown };

				if (msg.type === 'bang') {
					await this.csound.inputMessage('i 1 0 1');
				} else if (msg.type === 'event' && typeof msg.instr === 'number') {
					const instr = msg.instr;
					const start = typeof msg.start === 'number' ? msg.start : 0;
					const dur = typeof msg.dur === 'number' ? msg.dur : 1;
					const params = Array.isArray(msg.params) ? msg.params.join(' ') : '';

					await this.csound.inputMessage(`i ${instr} ${start} ${dur} ${params}`);
				}
			} else if (typeof message === 'number') {
				await this.csound.setControlChannel(`inlet${inletIndex}`, message);
			} else if (typeof message === 'string') {
				await this.csound.setStringChannel(`inlet${inletIndex}`, message);
			}
		} catch (error) {
			console.error('Error handling inlet message:', error);
		}
	}

	async destroy() {
		if (this.csound) {
			try {
				await this.csound.stop();
				await this.csound.reset();
			} catch (error) {
				console.error('Error destroying Csound:', error);
			}
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
