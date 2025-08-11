import { match } from 'ts-pattern';
import { AudioSystem } from './AudioSystem';

export type AudioAnalysisType = 'waveform' | 'frequency';
export type AudioAnalysisFormat = 'int' | 'float';
export type AudioAnalysisValue = Uint8Array<ArrayBuffer> | Float32Array<ArrayBuffer>;

export type AudioAnalysisProps = {
	id: string;
	type?: AudioAnalysisType;
	format?: AudioAnalysisFormat;
};

export class AudioAnalysisManager {
	private static instance: AudioAnalysisManager;
	private audioSystem = AudioSystem.getInstance();

	getAnalysisById({
		id,
		type = 'waveform',
		format = 'int'
	}: AudioAnalysisProps): AudioAnalysisValue | null {
		const state = this.audioSystem.nodesById.get(id);
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

	static getInstance(): AudioAnalysisManager {
		if (!AudioAnalysisManager.instance) {
			AudioAnalysisManager.instance = new AudioAnalysisManager();
		}

		return AudioAnalysisManager.instance;
	}
}
