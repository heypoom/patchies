import { match } from 'ts-pattern';
import { AudioSystem } from './AudioSystem';
import { MessageSystem } from '$lib/messages/MessageSystem';

export type AudioAnalysisType = 'waveform' | 'frequency';
export type AudioAnalysisFormat = 'int' | 'float';
export type AudioAnalysisValue = Uint8Array<ArrayBuffer> | Float32Array<ArrayBuffer>;

export type AudioAnalysisProps = {
	id?: string;
	type?: AudioAnalysisType;
	format?: AudioAnalysisFormat;
};

export class AudioAnalysisManager {
	private static instance: AudioAnalysisManager;
	private audioSystem = AudioSystem.getInstance();
	private messageSystem = MessageSystem.getInstance();

	getAnalysisForNode(
		callingNodeId: string,
		{ id, type = 'waveform', format = 'int' }: AudioAnalysisProps
	): AudioAnalysisValue | null {
		// If the user passes an explicit analyzer node id, use that.
		let fftNodeId = id;

		// Infer the connected FFT node.
		if (!fftNodeId) {
			const connectedNodeId = this.getFFTNode(callingNodeId);

			if (connectedNodeId !== null) {
				fftNodeId = connectedNodeId;
			}
		}

		if (!fftNodeId) return null;

		const state = this.audioSystem.nodesById.get(fftNodeId);
		if (state?.type !== 'fft') return null;

		const { node } = state;

		return match([type, format])
			.with(['waveform', 'int'], () => {
				const list = new Uint8Array(node.fftSize);
				node.getByteTimeDomainData(list);
				return list;
			})
			.with(['waveform', 'float'], () => {
				const list = new Float32Array(node.fftSize);
				node.getFloatTimeDomainData(list);
				return list;
			})
			.with(['frequency', 'int'], () => {
				const list = new Uint8Array(node.fftSize);
				node.getByteFrequencyData(list);
				return list;
			})
			.with(['frequency', 'float'], () => {
				const list = new Float32Array(node.fftSize);
				node.getFloatFrequencyData(list);
				return list;
			})
			.exhaustive();
	}

	private getFFTNode(nodeId: string): string | null {
		const connectedSources = this.messageSystem.getConnectedSourceNodes(nodeId);

		for (const sourceId of connectedSources) {
			if (sourceId.startsWith('object-')) {
				const node = this.audioSystem.nodesById.get(sourceId);

				if (node?.type === 'fft') {
					return sourceId;
				}
			}
		}

		return null;
	}

	static getInstance(): AudioAnalysisManager {
		if (!AudioAnalysisManager.instance) {
			AudioAnalysisManager.instance = new AudioAnalysisManager();
		}

		return AudioAnalysisManager.instance;
	}
}
