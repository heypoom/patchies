import { buildRenderGraph, type REdge, type RNode } from '$lib/rendering/graphUtils';
import type { RenderGraph } from '$lib/rendering/types';
import RenderWorker from '$workers/rendering/renderWorker?worker';

import * as ohash from 'ohash';
import { previewVisibleMap, isGlslPlaying } from '../../stores/renderer.store';
import { get } from 'svelte/store';
import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';

export class GLSystem {
	/** Web worker for offscreen rendering. */
	public renderWorker: Worker;

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
	}

	handleRenderWorkerMessage = async (event: MessageEvent) => {
		const { data } = event;

		if (data.type === 'animationFrame' && data.outputBitmap) {
			this.backgroundOutputCanvasContext?.transferFromImageBitmap(data.outputBitmap);
		}

		// Handle preview frames
		if (data.type === 'previewFrame' && data.buffer) {
			const { nodeId, buffer, width, height } = data;

			const context = this.previewCanvasContexts[nodeId];
			if (!context) return;

			const uint8Array = new Uint8Array(buffer);
			const imageData = new ImageData(new Uint8ClampedArray(uint8Array), width, height);
			const bitmap = await createImageBitmap(imageData);

			context.transferFromImageBitmap(bitmap);
		}
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

	send<T>(type: string, data?: T) {
		this.renderWorker.postMessage({ type, ...data });
	}

	upsertNode(id: string, type: string, data: Record<string, unknown>) {
		const nodeIndex = this.nodes.findIndex((node) => node.id === id);

		if (nodeIndex === -1) {
			this.nodes.push({ id: id, type, data });
		} else {
			const node = this.nodes[nodeIndex];
			this.nodes[nodeIndex] = { ...node, type, data };
		}

		this.updateRenderGraph();
	}

	removeNode(nodeId: string) {
		this.nodes = this.nodes.filter((node) => node.id !== nodeId);
		this.updateRenderGraph();
	}

	updateEdges(edges: REdge[]) {
		this.edges = edges;
		this.updateRenderGraph();

		const hasOutputNode = edges.some((edge) => edge.target.startsWith('bg.out'));
		isBackgroundOutputCanvasEnabled.set(hasOutputNode);
		this.setOutputEnabled(hasOutputNode);
	}

	private updateRenderGraph() {
		if (!this.hasFlowGraphChanged(this.nodes, this.edges)) return;

		const graph = buildRenderGraph(this.nodes, this.edges);
		if (!this.hasHashChanged('graph', graph)) return;

		this.send('buildRenderGraph', { graph });
		this.renderGraph = graph;
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
}
