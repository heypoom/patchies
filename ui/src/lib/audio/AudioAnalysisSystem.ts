import { match } from 'ts-pattern';
import { AudioSystem } from './AudioSystem';
import { MessageSystem } from '$lib/messages/MessageSystem';
import type { Edge } from '@xyflow/svelte';
import { objectDefinitions } from '$lib/objects/object-definitions';

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

export interface AudioAnalysisPayload {
	nodeId: string;
	analysisType: AudioAnalysisType;
	format: AudioAnalysisFormat;
	array: Uint8Array | Float32Array;

	/** GLSL inlets. Currently applies to GLSL only. */
	inlets?: GlslFFTInletMeta[];
}

export type AudioAnalysisPayloadWithType = AudioAnalysisPayload & {
	type: 'setFFTData';
	nodeType: 'hydra' | 'glsl';
};

export type OnFFTReadyCallback = (data: AudioAnalysisPayload) => void;

export type GlslFFTInletMeta = {
	/** ID of the AnalyserNode that provides the FFT. */
	analyzerNodeId: string;

	/** Which type of audio analysis to perform? */
	analysisType: AudioAnalysisType;

	/** Which inlet is this? */
	inletIndex: number;

	/** What is the name of the sampler2D uniform? */
	uniformName: string;
};

/** Get FFT object's analysis outlet index */
function getFFTAnalysisOutletIndex(): number {
	const fftDef = objectDefinitions.fft;
	const index = fftDef.outlets.findIndex((outlet) => outlet.name === 'analysis');
	return index !== -1 ? index : 1; // fallback to index 1 if not found
}

export class AudioAnalysisSystem {
	private static instance: AudioAnalysisSystem;
	private audioSystem = AudioSystem.getInstance();
	private messageSystem = MessageSystem.getInstance();

	// Cache for FFT node connections: nodeId -> fftNodeId
	private fftConnectionCache = new Map<string, string | null>();

	/** Track which nodes have FFT enabled */
	private fftEnabledNodes = new Set<string>();

	/** Track requested FFT formats per node: nodeId -> Set<"type-format"> */
	private requestedFFTFormats = new Map<string, Set<string>>();

	/** FFT polling interval reference */
	private fftPollingInterval: number | null = null;

	/** Callback for sending FFT data to workers */
	public onFFTDataReady: OnFFTReadyCallback | null = null;

	/** Mapping of GLSL nodeId to inlet metadata. */
	private glslInlets: Map<string, GlslFFTInletMeta[]> = new Map();

	/** Cache FFT object's analysis outlet index */
	private fftAnalysisOutletIndex: number;

	constructor() {
		this.fftAnalysisOutletIndex = getFFTAnalysisOutletIndex();
	}

	getAnalysisForNode(
		consumerNodeId: string,
		{ id, type = 'waveform', format = 'int' }: AudioAnalysisProps = {}
	): AudioAnalysisValue | null {
		// If the user passes an explicit analyzer node id, use that.
		let analyzerNodeId = id;

		// Infer the connected FFT node.
		if (!analyzerNodeId) {
			const _connectedNodeId = this.getAnalyzerAudioNode(consumerNodeId);

			if (_connectedNodeId !== null) {
				analyzerNodeId = _connectedNodeId;
			}
		}

		if (!analyzerNodeId) return null;

		const state = this.audioSystem.nodesById.get(analyzerNodeId);
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

	updateEdges(edges: Edge[]) {
		this.fftConnectionCache.clear();
		this.glslInlets.clear();

		for (const edge of edges) {
			this.setupGlslPolling(edge);
		}
	}

	setupGlslPolling(edge: Edge) {
		const analyzerOutletId = `outlet-${this.fftAnalysisOutletIndex}`;

		const glslNodeId = edge.target;
		const analyzerNodeId = edge.source;

		const isSampler2DOutlet =
			edge.sourceHandle === analyzerOutletId &&
			analyzerNodeId.startsWith('object-') &&
			glslNodeId.startsWith('glsl-') &&
			edge.targetHandle?.includes('video');

		if (!isSampler2DOutlet) return;

		const node = this.audioSystem.nodesById.get(edge.source);
		if (node?.type !== 'fft') return;

		const inletMatch = edge.targetHandle?.match(/video-in-(\d+)-(\w+)-/);
		if (!inletMatch) return;

		const [, inletIndex, uniformName] = inletMatch;

		this.fftEnabledNodes.add(glslNodeId);

		if (!this.glslInlets.has(glslNodeId)) {
			this.glslInlets.set(glslNodeId, []);
		}

		this.glslInlets.get(glslNodeId)?.push({
			analyzerNodeId,
			analysisType: 'waveform',
			inletIndex: parseInt(inletIndex),
			uniformName
		});

		if (!this.requestedFFTFormats.has(glslNodeId)) {
			this.requestedFFTFormats.set(glslNodeId, new Set());
		}

		// Support only waveform-int for now.
		this.requestedFFTFormats.get(glslNodeId)!.add('waveform-int');

		this.startFFTPolling();
	}

	private getAnalyzerAudioNode(nodeId: string): string | null {
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

		this.fftConnectionCache.set(nodeId, fftNodeId);

		return fftNodeId;
	}

	/** Enable FFT for a node */
	enableFFT(nodeId: string) {
		this.fftEnabledNodes.add(nodeId);
		this.startFFTPolling();
	}

	/** Disable FFT for a Hydra node */
	disableFFT(nodeId: string) {
		this.fftEnabledNodes.delete(nodeId);
		this.requestedFFTFormats.delete(nodeId);
		this.glslInlets.delete(nodeId);

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

	/** Poll FFT data and transfer it to Hydra and GLSL renderers. */
	private pollAndTransferFFTData() {
		if (!this.onFFTDataReady) return;

		for (const targetId of this.fftEnabledNodes) {
			const formats = this.requestedFFTFormats.get(targetId);
			if (!formats || formats.size === 0) continue;

			// The GLSL node's inlet has been disconnected. Do not send FFT data.
			if (targetId.startsWith('glsl-') && !this.glslInlets.has(targetId)) continue;

			const inlets = this.glslInlets.get(targetId);

			for (const formatKey of formats) {
				const [type, format] = formatKey.split('-') as [AudioAnalysisType, AudioAnalysisFormat];

				const array = this.getAnalysisForNode(targetId, { type, format });
				if (array === null) continue;

				this.onFFTDataReady({ nodeId: targetId, analysisType: type, format, array, inlets });
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
