import { match } from 'ts-pattern';
import { MessageSystem } from '$lib/messages/MessageSystem';
import type { Edge } from '@xyflow/svelte';
import { AudioService } from './v2/AudioService';
import {
	ANALYSIS_KEY,
	FFT_POLLING_FPS_FOCUSED,
	FFT_POLLING_FPS_UNFOCUSED,
	GLSL_FFT_WAVEFORM_UNIFORM_NAME
} from './v2/constants/fft';
import { getObjectType } from '$lib/objects/get-type';
import { BrowserFocusService } from '$lib/browser/BrowserFocusService';

export type AudioAnalysisType = 'wave' | 'freq';
export type AudioAnalysisFormat = 'int' | 'float';
export type AudioAnalysisValue = Uint8Array<ArrayBufferLike> | Float32Array<ArrayBufferLike>;

type RenderWorkerMessage =
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
	sampleRate: number;

	/** GLSL inlets. Currently applies to GLSL only. */
	inlets?: GlslFFTInletMeta[];
}

export type AudioAnalysisPayloadWithType = AudioAnalysisPayload & {
	type: 'setFFTData';
	nodeType: 'hydra' | 'glsl' | 'canvas' | 'textmode' | 'three';
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

export class AudioAnalysisSystem {
	private static instance: AudioAnalysisSystem;
	private audioService = AudioService.getInstance();
	private messageSystem = MessageSystem.getInstance();
	private browserFocus = BrowserFocusService.getInstance();

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

	/** Object pool for typed arrays to avoid allocations on every poll */
	private arrayPool = new Map<string, Uint8Array | Float32Array>();

	/** Unsubscribe function for focus listener */
	private unsubscribeFocus: (() => void) | null = null;

	private getPooledArray(
		analyzerNodeId: string,
		type: AudioAnalysisType,
		format: 'int',
		size: number
	): Uint8Array<ArrayBuffer>;

	private getPooledArray(
		analyzerNodeId: string,
		type: AudioAnalysisType,
		format: 'float',
		size: number
	): Float32Array<ArrayBuffer>;

	/** Get or create a pooled typed array for FFT analysis */
	private getPooledArray(
		analyzerNodeId: string,
		type: AudioAnalysisType,
		format: AudioAnalysisFormat,
		size: number
	): Uint8Array<ArrayBuffer> | Float32Array<ArrayBuffer> {
		const poolKey = `${analyzerNodeId}-${type}-${format}`;
		let array = this.arrayPool.get(poolKey);

		// Create new array if not in pool or wrong size
		if (!array || array.length !== size) {
			array = format === 'int' ? new Uint8Array(size) : new Float32Array(size);

			this.arrayPool.set(poolKey, array);
		}

		return array as Uint8Array<ArrayBuffer> | Float32Array<ArrayBuffer>;
	}

	getAnalysisForNode(
		consumerNodeId: string,
		{ id, type = 'wave', format = 'int' }: AudioAnalysisProps = {}
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

		const node = this.audioService.getNodeById(analyzerNodeId);
		if (!node || getObjectType(node) !== 'fft~') return null;

		const analyser = node.audioNode as AnalyserNode;

		// Use pooled arrays to avoid allocation churn during frequent polling
		return match([type, format])
			.with(['wave', 'int'], () => {
				const list = this.getPooledArray(analyzerNodeId!, 'wave', 'int', analyser.fftSize);
				analyser.getByteTimeDomainData(list);

				return list;
			})
			.with(['wave', 'float'], () => {
				const list = this.getPooledArray(analyzerNodeId!, 'wave', 'float', analyser.fftSize);
				analyser.getFloatTimeDomainData(list);

				return list;
			})
			.with(['freq', 'int'], () => {
				const list = this.getPooledArray(analyzerNodeId!, 'freq', 'int', analyser.fftSize);
				analyser.getByteFrequencyData(list);

				return list;
			})
			.with(['freq', 'float'], () => {
				const list = this.getPooledArray(analyzerNodeId!, 'freq', 'float', analyser.fftSize);
				analyser.getFloatFrequencyData(list);

				return list;
			})
			.exhaustive();
	}

	updateEdges(edges: Edge[]) {
		this.fftConnectionCache.clear();
		this.glslInlets.clear();
		this.arrayPool.clear();

		for (const edge of edges) {
			this.setupGlslPolling(edge);
		}
	}

	setupGlslPolling(edge: Edge) {
		const glslNodeId = edge.target;
		const analyzerNodeId = edge.source;

		const isSampler2DOutlet =
			edge.sourceHandle?.startsWith(ANALYSIS_KEY) &&
			analyzerNodeId.startsWith('object-') &&
			glslNodeId.startsWith('glsl-') &&
			edge.targetHandle?.includes('video');

		if (!isSampler2DOutlet) return;

		const node = this.audioService.getNodeById(analyzerNodeId);
		if (!node || getObjectType(node) !== 'fft~') return;

		const inletMatch = edge.targetHandle?.match(/video-in-(\d+)-(\w+)-/);
		if (!inletMatch) return;

		const [, inletIndex, uniformName] = inletMatch;

		this.fftEnabledNodes.add(glslNodeId);

		if (!this.glslInlets.has(glslNodeId)) {
			this.glslInlets.set(glslNodeId, []);
		}

		// Do frequency analysis by default.
		// If the uniform name is set as "waveTexture" then we do time-domain analysis.
		const analysisType: AudioAnalysisType =
			uniformName === GLSL_FFT_WAVEFORM_UNIFORM_NAME ? 'wave' : 'freq';

		this.glslInlets.get(glslNodeId)?.push({
			analyzerNodeId,
			analysisType,
			inletIndex: parseInt(inletIndex),
			uniformName
		});

		if (!this.requestedFFTFormats.has(glslNodeId)) {
			this.requestedFFTFormats.set(glslNodeId, new Set());
		}

		this.requestedFFTFormats.get(glslNodeId)!.add(analysisType + '-int');

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
				const node = this.audioService.getNodeById(sourceId);

				if (node && getObjectType(node) === 'fft~') {
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

	/** Disable FFT for a node */
	disableFFT(nodeId: string) {
		this.fftEnabledNodes.delete(nodeId);
		this.requestedFFTFormats.delete(nodeId);
		this.glslInlets.delete(nodeId);

		// Clean up pooled arrays for this node to prevent memory leaks
		this.clearArrayPoolForNode(nodeId);

		if (this.fftEnabledNodes.size === 0) {
			this.stopFFTPolling();
		}
	}

	/** Remove pooled arrays associated with a specific node */
	private clearArrayPoolForNode(nodeId: string): void {
		const keysToDelete: string[] = [];

		for (const key of this.arrayPool.keys()) {
			if (key.startsWith(nodeId + '-')) {
				keysToDelete.push(key);
			}
		}

		for (const key of keysToDelete) {
			this.arrayPool.delete(key);
		}
	}

	/** Register that a node has requested a specific FFT format */
	registerFFTRequest(nodeId: string, type: AudioAnalysisType, format: AudioAnalysisFormat) {
		if (!this.requestedFFTFormats.has(nodeId)) {
			this.requestedFFTFormats.set(nodeId, new Set());
		}

		this.requestedFFTFormats.get(nodeId)!.add(`${type}-${format}`);
	}

	/** Start polling FFT data for nodes with adaptive rate based on focus */
	private startFFTPolling() {
		if (this.fftPollingInterval !== null) return;

		const fps = this.browserFocus.isWindowFocused
			? FFT_POLLING_FPS_FOCUSED
			: FFT_POLLING_FPS_UNFOCUSED;

		this.fftPollingInterval = window.setInterval(() => {
			this.pollAndTransferFFTData();
		}, 1000 / fps);

		// Subscribe to focus changes if not already subscribed
		if (!this.unsubscribeFocus) {
			this.unsubscribeFocus = this.browserFocus.onFocusChange(() => {
				this.restartPollingWithNewRate();
			});
		}
	}

	/** Stop FFT polling when no nodes need it */
	private stopFFTPolling() {
		if (this.fftPollingInterval !== null) {
			clearInterval(this.fftPollingInterval);
			this.fftPollingInterval = null;
		}

		// Unsubscribe from focus changes
		if (this.unsubscribeFocus) {
			this.unsubscribeFocus();
			this.unsubscribeFocus = null;
		}
	}

	/** Poll FFT data and transfer it to renderers. */
	private pollAndTransferFFTData() {
		// Skip polling entirely when tab is hidden - no one can see the visualizations anyway
		if (!this.browserFocus.isDocumentVisible) return;

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
				if (array === null || array.length === 0) continue;

				this.onFFTDataReady({
					nodeId: targetId,
					analysisType: type,
					format,
					array,
					inlets,
					sampleRate: this.sampleRate
				});
			}
		}
	}

	handleRenderWorkerMessage(data: RenderWorkerMessage) {
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

	get sampleRate(): number {
		return this.audioService.getAudioContext().sampleRate;
	}

	/** Restart polling with the appropriate rate based on focus state */
	private restartPollingWithNewRate(): void {
		if (this.fftPollingInterval === null) return;

		// Stop current polling
		clearInterval(this.fftPollingInterval);
		this.fftPollingInterval = null;

		// Restart with new rate
		const fps = this.browserFocus.isWindowFocused
			? FFT_POLLING_FPS_FOCUSED
			: FFT_POLLING_FPS_UNFOCUSED;
		this.fftPollingInterval = window.setInterval(() => {
			this.pollAndTransferFFTData();
		}, 1000 / fps);
	}

	static getInstance(): AudioAnalysisSystem {
		if (!AudioAnalysisSystem.instance) {
			AudioAnalysisSystem.instance = new AudioAnalysisSystem();
		}

		return AudioAnalysisSystem.instance;
	}
}
