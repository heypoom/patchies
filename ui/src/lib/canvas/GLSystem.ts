import { buildRenderGraph, type REdge, type RNode } from '$lib/rendering/graphUtils';
import type { RenderGraph, RenderNode } from '$lib/rendering/types';
import RenderWorker from '$workers/rendering/renderWorker?worker';

import * as ohash from 'ohash';
import { previewVisibleMap, isGlslPlaying } from '../../stores/renderer.store';
import { get } from 'svelte/store';
import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
import { IpcSystem } from './IpcSystem';
import { isExternalTextureNode } from './node-types';
import { MessageSystem, type Message } from '$lib/messages/MessageSystem';
import { PatchiesEventBus } from '../eventbus/PatchiesEventBus';
import {
	AudioAnalysisSystem,
	type AudioAnalysisPayloadWithType,
	type OnFFTReadyCallback
} from '$lib/audio/AudioAnalysisSystem';

export type UserUniformValue = number | boolean | number[];

export class GLSystem {
	/** Web worker for offscreen rendering. */
	public renderWorker: Worker;

	public ipcSystem = IpcSystem.getInstance();
	public messageSystem = MessageSystem.getInstance();
	public eventBus = PatchiesEventBus.getInstance();
	public audioAnalysis = AudioAnalysisSystem.getInstance();

	/** Rendering context for the background output that covers the entire screen. */
	public backgroundOutputCanvasContext: ImageBitmapRenderingContext | null = null;

	/** Mapping of nodeId to rendering context for preview */
	public previewCanvasContexts: Record<string, ImageBitmapRenderingContext | null> = {};

	/** Stores FBO-compatible nodes */
	public nodes: RNode[] = [];

	/** Stores FBO-compatible edges */
	public edges: REdge[] = [];

	private static instance: GLSystem;
	private hashes = { nodes: '', edges: '', graph: '' };
	private renderGraph: RenderGraph | null = null;

	/** Cache for outgoing video connections to avoid recalculating on every frame */
	private outgoingConnectionsCache = new Map<string, boolean>();

	public outputSize: [width: number, height: number] = [800, 600];

	public previewSize: [width: number, height: number] = [
		this.outputSize[0] / 4,
		this.outputSize[1] / 4
	];

	static getInstance() {
		if (!GLSystem.instance) {
			GLSystem.instance = new GLSystem();
		}

		// @ts-expect-error -- expose globally for debugging
		window.glSystem = GLSystem.instance;

		return GLSystem.instance;
	}

	constructor() {
		this.renderWorker = new RenderWorker();
		this.renderWorker.addEventListener('message', this.handleRenderWorkerMessage.bind(this));
		this.audioAnalysis.onFFTDataReady = this.sendFFTDataToWorker.bind(this);
	}

	handleRenderWorkerMessage = async (event: MessageEvent) => {
		const { data } = event;

		if (!data) return;

		if (data.type === 'animationFrame' && data.outputBitmap) {
			if (this.ipcSystem.outputWindow !== null) {
				this.ipcSystem.sendRenderOutput(data.outputBitmap);
			} else {
				this.backgroundOutputCanvasContext?.transferFromImageBitmap(data.outputBitmap);
			}
		}

		// Handle preview frames
		if (data.type === 'previewFrame' && data.buffer) {
			const { nodeId, buffer, width, height } = data;

			const context = this.previewCanvasContexts[nodeId];
			if (!context) return;

			try {
				const uint8Array = new Uint8Array(buffer);
				const imageData = new ImageData(new Uint8ClampedArray(uint8Array), width, height);

				const bitmap = await createImageBitmap(imageData);
				context.transferFromImageBitmap(bitmap);
			} catch (error) {
				console.error('Failed to create ImageBitmap for preview:', error);
			}
		}

		// Render worker (e.g. Hydra) is sending message back to the main thread.
		if (data.type === 'sendMessageFromNode') {
			this.messageSystem.sendMessage(data.fromNodeId, data.data);
		}

		// A block has requested a preview frame capture from a node.
		if (data.type === 'previewFrameCaptured') {
			this.eventBus.dispatch(data);
		}

		// Handle FFT mechanism
		this.audioAnalysis.handleRenderWorkerMessage(data);
	};

	start() {
		if (get(isGlslPlaying)) return;

		this.send('startAnimation');
		isGlslPlaying.set(true);
	}

	stop() {
		if (!get(isGlslPlaying)) return;

		this.send('stopAnimation');
		isGlslPlaying.set(false);
	}

	setOutputEnabled(enabled: boolean) {
		this.send('setOutputEnabled', { enabled });
	}

	setPreviewEnabled(nodeId: string, enabled: boolean) {
		this.send('setPreviewEnabled', { nodeId, enabled });
	}

	togglePreview(nodeId: string) {
		const visibleMap = get(previewVisibleMap);

		visibleMap[nodeId] = !visibleMap[nodeId];
		previewVisibleMap.set(visibleMap);

		this.setPreviewEnabled(nodeId, visibleMap[nodeId]);
	}

	/** Toggle pause state for a node */
	toggleNodePause(nodeId: string) {
		this.send('toggleNodePause', { nodeId });
	}

	send<T>(type: string, data?: T) {
		this.renderWorker.postMessage({ type, ...data });
	}

	upsertNode(id: string, type: RenderNode['type'], data: Record<string, unknown>): boolean {
		const nodeIndex = this.nodes.findIndex((node) => node.id === id);

		if (nodeIndex === -1) {
			this.nodes.push({ id: id, type, data });
		} else {
			const node = this.nodes[nodeIndex];
			this.nodes[nodeIndex] = { ...node, type, data };
		}

		return this.updateRenderGraph();
	}

	setUniformData(nodeId: string, uniformName: string, uniformValue: UserUniformValue) {
		this.send('setUniformData', {
			nodeId,
			uniformName,
			uniformValue
		});
	}

	removeNode(nodeId: string) {
		const node = this.nodes.find((n) => n.id === nodeId);
		if (!node) return;

		// Cleanup persistent external texture.
		if (isExternalTextureNode(node.type as RenderNode['type'])) {
			this.removeBitmap(nodeId);
		}

		// Cleanup persistent uniform data for GLSL nodes.
		if (node.type === 'glsl') {
			this.removeUniformData(nodeId);
		}

		this.nodes = this.nodes.filter((node) => node.id !== nodeId);

		// Disable sending FFT analysis to the said node.
		this.audioAnalysis.disableFFT(nodeId);

		// Clear connection cache for this node
		this.outgoingConnectionsCache.delete(nodeId);

		this.updateRenderGraph();
	}

	removePreviewContext(nodeId: string, context: ImageBitmapRenderingContext) {
		if (this.previewCanvasContexts[nodeId] === context) {
			this.previewCanvasContexts[nodeId] = null;
		}
	}

	updateEdges(edges: REdge[]) {
		this.edges = edges;
		this.updateRenderGraph();

		const hasOutputNode = edges.some((edge) => edge.target.startsWith('bg.out'));

		if (this.ipcSystem.outputWindow === null) {
			isBackgroundOutputCanvasEnabled.set(hasOutputNode);
		}

		this.setOutputEnabled(hasOutputNode);
	}

	private updateRenderGraph() {
		if (!this.hasFlowGraphChanged(this.nodes, this.edges)) return false;

		const graph = buildRenderGraph(this.nodes, this.edges);
		if (!this.hasHashChanged('graph', graph)) return false;

		this.send('buildRenderGraph', { graph });
		this.renderGraph = graph;

		// Clear connection cache when render graph changes
		this.outgoingConnectionsCache.clear();

		return true;
	}

	// TODO: optimize this!
	hasFlowGraphChanged(nodes: RNode[], edges: REdge[]) {
		return this.hasHashChanged('nodes', nodes) || this.hasHashChanged('edges', edges);
	}

	hasHashChanged<K extends keyof GLSystem['hashes'], T>(key: K, object: T) {
		const hash = ohash.hash(object);
		if (this.hashes[key] === hash) return false;

		this.hashes[key] = hash;
		return true;
	}

	setPreviewSize(width: number, height: number) {
		this.previewSize = [width, height];

		for (const nodeId in this.previewCanvasContexts) {
			const context = this.previewCanvasContexts[nodeId];

			if (context) {
				const canvas = context.canvas;
				canvas.width = width;
				canvas.height = height;

				// re-create the context to accommodate the new size
				delete this.previewCanvasContexts[nodeId];

				this.previewCanvasContexts[nodeId] = canvas.getContext(
					'bitmaprenderer'
				) as ImageBitmapRenderingContext;
			}
		}

		this.send('setPreviewSize', { width, height });
	}

	setOutputSize(width: number, height: number) {
		this.outputSize = [width, height];
		this.send('setOutputSize', { width, height });
	}

	async setBitmapSource(nodeId: string, source: ImageBitmapSource) {
		this.setBitmap(nodeId, await createImageBitmap(source));
	}

	setBitmap(nodeId: string, bitmap: ImageBitmap) {
		this.renderWorker.postMessage(
			{
				type: 'setBitmap',
				nodeId,
				bitmap
			},
			{ transfer: [bitmap] }
		);
	}

	removeBitmap(nodeId: string) {
		this.send('removeBitmap', { nodeId });
	}

	removeUniformData(nodeId: string) {
		this.send('removeUniformData', { nodeId });
	}

	sendMessageToNode(nodeId: string, message: Message) {
		this.send('sendMessageToNode', { nodeId, message });
	}

	/**
	 * Check if a node has outgoing connections to GPU video nodes (glsl, hydra, swgl)
	 * Used to optimize bitmap transfers - no need to send bitmaps if nothing consumes them
	 * Results are cached to avoid recalculation on every frame
	 */
	public hasOutgoingVideoConnections(nodeId: string): boolean {
		if (this.outgoingConnectionsCache.has(nodeId)) {
			return this.outgoingConnectionsCache.get(nodeId)!;
		}

		let hasConnections = false;

		if (this.renderGraph) {
			const hasOutgoingVideoEdges = this.renderGraph.edges.some(
				(edge) => edge.source === nodeId && /(video-out|video-in|sampler2D)/.test(edge.id)
			);

			const isOutputNode = this.renderGraph.outputNodeId === nodeId;

			hasConnections = hasOutgoingVideoEdges || isOutputNode;
		}

		this.outgoingConnectionsCache.set(nodeId, hasConnections);

		return hasConnections;
	}

	/** Callback for when AudioAnalysisSystem has FFT data ready */
	sendFFTDataToWorker: OnFFTReadyCallback = (payload) => {
		const node = this.nodes.find((n) => n.id === payload.nodeId);
		if (!node) return;

		const payloadWithType: AudioAnalysisPayloadWithType = {
			...payload,
			type: 'setFFTData',
			nodeType: node.type as 'hydra' | 'glsl'
		};

		this.renderWorker.postMessage(payloadWithType, { transfer: [payloadWithType.array.buffer] });
	};
}
