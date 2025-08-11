import { match } from 'ts-pattern';
import { AudioSystem } from './AudioSystem';
import { MessageSystem } from '$lib/messages/MessageSystem';
import { objectDefinitions } from '$lib/objects/object-definitions';

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

	// Find FFT nodes connected to the given node via analysis marker outlets
	private findConnectedFFTNodes(nodeId: string): string[] {
		const connectedSources = this.messageSystem.getConnectedSourceNodes(nodeId);
		const fftNodes: string[] = [];

		for (const sourceId of connectedSources) {
			// Check if this is an object node (starts with 'object-')
			if (sourceId.startsWith('object-')) {
				// Get the audio node data to check if it's an FFT node
				const audioNode = this.audioSystem.nodesById.get(sourceId);
				if (audioNode && audioNode.type === 'fft') {
					fftNodes.push(sourceId);
				}
			}
		}

		return fftNodes;
	}

	// Get analysis data with automatic FFT node detection
	getAnalysisForNode(
		callingNodeId: string,
		{ id, type = 'waveform', format = 'int' }: AudioAnalysisProps
	): AudioAnalysisValue | null {
		let fftNodeId = id;

		// If no ID provided, try to find a connected FFT node
		if (!fftNodeId) {
			const connectedFFTNodes = this.findConnectedFFTNodes(callingNodeId);
			if (connectedFFTNodes.length > 0) {
				fftNodeId = connectedFFTNodes[0]; // Use the first one found
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

	// Backward compatibility method - requires explicit ID
	getAnalysisById(props: AudioAnalysisProps & { id: string }): AudioAnalysisValue | null {
		return this.getAnalysisForNode('', props);
	}

	static getInstance(): AudioAnalysisManager {
		if (!AudioAnalysisManager.instance) {
			AudioAnalysisManager.instance = new AudioAnalysisManager();
		}

		return AudioAnalysisManager.instance;
	}
}
