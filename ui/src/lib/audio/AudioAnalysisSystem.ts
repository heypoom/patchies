import { match } from 'ts-pattern';
import { AudioSystem } from './AudioSystem';
import { MessageSystem } from '$lib/messages/MessageSystem';

export type AudioAnalysisType = 'waveform' | 'frequency';
export type AudioAnalysisFormat = 'int' | 'float';
export type AudioAnalysisValue = Uint8Array<ArrayBuffer> | Float32Array<ArrayBuffer>;

type HydraRenderWorkerMessage =
	| { type: 'fftEnabled'; enabled: boolean; nodeId: string }
	| {
			type: 'registerFFTRequest';
			nodeId: string;
			analysisType: AudioAnalysisType;
			format: AudioAnalysisFormat;
	  };

export interface AudioAnalysisProps {
	id?: string;
	type?: AudioAnalysisType;
	format?: AudioAnalysisFormat;
}

export type OnFFTReadyCallback = (
	nodeId: string,
	analysisType: AudioAnalysisType,
	format: AudioAnalysisFormat,
	array: Uint8Array | Float32Array
) => void;

export class AudioAnalysisSystem {
	private static instance: AudioAnalysisSystem;
	private audioSystem = AudioSystem.getInstance();
	private messageSystem = MessageSystem.getInstance();

	// Cache for FFT node connections: nodeId -> fftNodeId
	private fftConnectionCache = new Map<string, string | null>();

	/** Track which Hydra nodes have FFT enabled */
	private fftEnabledNodes = new Set<string>();

	/** Track requested FFT formats per node: nodeId -> Set<"type-format"> */
	private requestedFFTFormats = new Map<string, Set<string>>();

	/** FFT polling interval reference */
	private fftPollingInterval: number | null = null;

	/** Callback for sending FFT data to workers */
	public onFFTDataReady: OnFFTReadyCallback | null = null;

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

	updateEdges() {
		this.fftConnectionCache.clear();
	}

	private getFFTNode(nodeId: string): string | null {
		if (this.fftConnectionCache.has(nodeId)) {
			return this.fftConnectionCache.get(nodeId) ?? null;
		}

		const connectedSourceIds = this.messageSystem.getConnectedSourceNodes(nodeId);
		let fftNodeId: string | null = null;

		for (const sourceId of connectedSourceIds) {
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

	/** Enable FFT for a Hydra node */
	enableFFT(nodeId: string) {
		this.fftEnabledNodes.add(nodeId);
		this.startFFTPolling();
	}

	/** Disable FFT for a Hydra node */
	disableFFT(nodeId: string) {
		this.fftEnabledNodes.delete(nodeId);
		this.requestedFFTFormats.delete(nodeId);

		if (this.fftEnabledNodes.size === 0) {
			this.stopFFTPolling();
		}
	}

	/** Register that a Hydra node has requested a specific FFT format */
	registerFFTRequest(nodeId: string, type: AudioAnalysisType, format: AudioAnalysisFormat) {
		if (!this.requestedFFTFormats.has(nodeId)) {
			this.requestedFFTFormats.set(nodeId, new Set());
		}

		this.requestedFFTFormats.get(nodeId)!.add(`${type}-${format}`);
	}

	/** Start polling FFT data for Hydra nodes at 24fps as per spec */
	private startFFTPolling() {
		if (this.fftPollingInterval !== null) return;

		this.fftPollingInterval = window.setInterval(() => {
			this.pollAndTransferFFTData();
		}, 1000 / 24); // 24fps
	}

	/** Stop FFT polling when no Hydra nodes need it */
	private stopFFTPolling() {
		if (this.fftPollingInterval !== null) {
			clearInterval(this.fftPollingInterval);
			this.fftPollingInterval = null;
		}
	}

	/** Poll FFT data and transfer it to Hydra workers */
	private pollAndTransferFFTData() {
		if (!this.onFFTDataReady) return;

		for (const nodeId of this.fftEnabledNodes) {
			const requestedFormats = this.requestedFFTFormats.get(nodeId);
			if (!requestedFormats || requestedFormats.size === 0) continue;

			for (const formatKey of requestedFormats) {
				const [type, format] = formatKey.split('-') as [AudioAnalysisType, AudioAnalysisFormat];
				const data = this.getAnalysisForNode(nodeId, { type, format });

				if (data) {
					this.onFFTDataReady(nodeId, type, format, data);
				}
			}
		}
	}

	handleRenderWorkerMessage(data: HydraRenderWorkerMessage) {
		match(data)
			.with({ type: 'fftEnabled' }, ({ enabled, nodeId }) => {
				if (enabled) {
					this.enableFFT(nodeId);
				} else {
					this.disableFFT(nodeId);
				}
			})
			.with({ type: 'registerFFTRequest' }, ({ nodeId, analysisType, format }) => {
				this.registerFFTRequest(nodeId, analysisType, format);
			});
	}

	static getInstance(): AudioAnalysisSystem {
		if (!AudioAnalysisSystem.instance) {
			AudioAnalysisSystem.instance = new AudioAnalysisSystem();
		}

		return AudioAnalysisSystem.instance;
	}
}
