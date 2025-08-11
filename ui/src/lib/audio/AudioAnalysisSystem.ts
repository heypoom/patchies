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

export class AudioAnalysisSystem {
	private static instance: AudioAnalysisSystem;
	private audioSystem = AudioSystem.getInstance();
	private messageSystem = MessageSystem.getInstance();

	// Cache for FFT node connections: nodeId -> fftNodeId
	private fftConnectionCache = new Map<string, string | null>();

	getAnalysisForNode(
		callingNodeId: string,
		{ id, type = 'waveform', format = 'int' }: AudioAnalysisProps = {}
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

	// Clear the cache when edges change
	updateEdges() {
		this.fftConnectionCache.clear();
	}

	private getFFTNode(nodeId: string): string | null {
		// Check cache first
		if (this.fftConnectionCache.has(nodeId)) {
			return this.fftConnectionCache.get(nodeId) ?? null;
		}

		// Compute connection and cache it
		const connectedSources = this.messageSystem.getConnectedSourceNodes(nodeId);
		let fftNodeId: string | null = null;

		for (const sourceId of connectedSources) {
			if (sourceId.startsWith('object-')) {
				const node = this.audioSystem.nodesById.get(sourceId);

				if (node?.type === 'fft') {
					fftNodeId = sourceId;
					break;
				}
			}
		}

		// Cache the result (including null)
		this.fftConnectionCache.set(nodeId, fftNodeId);
		return fftNodeId;
	}

	static getInstance(): AudioAnalysisSystem {
		if (!AudioAnalysisSystem.instance) {
			AudioAnalysisSystem.instance = new AudioAnalysisSystem();
		}

		return AudioAnalysisSystem.instance;
	}
}
