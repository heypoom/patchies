import { MessageSystem, type MessageCallbackFn } from '$lib/messages/MessageSystem';
import { AudioSystem } from '$lib/audio/AudioSystem';
import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
import { GLSystem, type UserUniformValue } from '$lib/canvas/GLSystem';
import { MIDISystem } from '$lib/canvas/MIDISystem';
import { PyodideSystem } from '$lib/python/PyodideSystem';
import { shaderCodeToUniformDefs } from '$lib/canvas/shader-code-to-uniform-def';
import type { Node, Edge } from '@xyflow/svelte';
import type { NodeTypeName } from '$lib/nodes/node-types';

// Canvas type for video output
type CanvasOutput = HTMLCanvasElement | OffscreenCanvas | ImageBitmapRenderingContext;

// Utility function to extract ImageBitmapRenderingContext from various canvas types
function getBitmapContext(canvasOutput: CanvasOutput): ImageBitmapRenderingContext | null {
	if (canvasOutput instanceof HTMLCanvasElement || canvasOutput instanceof OffscreenCanvas) {
		return canvasOutput.getContext('bitmaprenderer') as ImageBitmapRenderingContext;
	}
	return canvasOutput;
}

// Use XYFlow types directly to maintain all properties including position, width, height
export type PatcherNode = Node;
export type PatcherEdge = Edge;

export interface PatchData {
	nodes: PatcherNode[];
	edges: PatcherEdge[];
}

export interface SendMessageOptions {
	nodeId: string;
	inlet?: number;
	message: unknown;
}

export interface SendChannelMessageOptions {
	channel: string;
	message: unknown;
}

export class Patcher {
	public nodes: Map<string, PatcherNode> = new Map();
	public edges: Map<string, PatcherEdge> = new Map();

	public messageSystem: MessageSystem;
	public audioSystem: AudioSystem;
	public audioAnalysisSystem: AudioAnalysisSystem;
	public glSystem: GLSystem;
	public midiSystem: MIDISystem;
	public pyodideSystem: PyodideSystem;

	public audioOutputNode: GainNode | null = null;

	public videoOutputCanvas: CanvasOutput | null = null;
	public videoPreviewOutputs: Map<string, CanvasOutput> = new Map();

	constructor(patchData?: PatchData) {
		// Initialize systems
		this.messageSystem = MessageSystem.getInstance();
		this.audioSystem = AudioSystem.getInstance();
		this.audioAnalysisSystem = AudioAnalysisSystem.getInstance();
		this.glSystem = GLSystem.getInstance();
		this.midiSystem = MIDISystem.getInstance();
		this.pyodideSystem = PyodideSystem.getInstance();

		// Load initial data if provided
		if (patchData) {
			this.loadPatch(patchData);
		}
	}

	// Core graph management
	addNode(node: PatcherNode): void {
		this.nodes.set(node.id, node);
		this.updateSystems();
	}

	removeNode(nodeId: string): void {
		this.nodes.delete(nodeId);

		// Remove edges connected to this node
		const edgesToRemove = Array.from(this.edges.values()).filter(
			(edge) => edge.source === nodeId || edge.target === nodeId
		);

		edgesToRemove.forEach((edge) => this.edges.delete(edge.id));

		// Clean up system resources
		this.messageSystem.unregisterNode(nodeId);
		this.audioSystem.removeAudioObject(nodeId);

		this.updateSystems();
	}

	updateNode(nodeId: string, updates: Partial<PatcherNode>): void {
		const node = this.nodes.get(nodeId);
		if (!node) return;

		const updatedNode = { ...node, ...updates };
		this.nodes.set(nodeId, updatedNode);
		this.updateSystems();
	}

	addEdge(edge: PatcherEdge): void {
		this.edges.set(edge.id, edge);
		this.updateSystems();
	}

	removeEdge(edgeId: string): void {
		this.edges.delete(edgeId);
		this.updateSystems();
	}

	getNodes(): PatcherNode[] {
		return Array.from(this.nodes.values());
	}

	getEdges(): PatcherEdge[] {
		return Array.from(this.edges.values());
	}

	getNode(nodeId: string): PatcherNode | undefined {
		return this.nodes.get(nodeId);
	}

	loadPatch(patchData: PatchData): void {
		// Clear existing data
		this.nodes.clear();
		this.edges.clear();

		// Load new data
		patchData.nodes.forEach((node) => this.nodes.set(node.id, node));
		patchData.edges.forEach((edge) => this.edges.set(edge.id, edge));

		this.updateSystems();
	}

	getPatchData(): PatchData {
		return {
			nodes: this.getNodes(),
			edges: this.getEdges()
		};
	}

	// Public API methods for output management
	setAudioOutput(gainNode: GainNode): void {
		this.audioOutputNode = gainNode;
		this.audioSystem.outGain = gainNode;
	}

	setVideoOutput(canvas: CanvasOutput): void {
		this.videoOutputCanvas = canvas;
		const context = getBitmapContext(canvas);

		if (context) {
			this.glSystem.backgroundOutputCanvasContext = context;
		}
	}

	setVideoPreviewOutput(nodeId: string, canvas: CanvasOutput): void {
		this.videoPreviewOutputs.set(nodeId, canvas);
		const context = getBitmapContext(canvas);

		if (context) {
			this.glSystem.previewCanvasContexts[nodeId] = context;
		}
	}

	// Message handling
	sendMessage(options: SendMessageOptions): void {
		const { nodeId, inlet, message } = options;

		// Use inlet number if provided for routing
		const sendOptions = inlet !== undefined ? { to: inlet } : {};

		this.messageSystem.sendMessage(nodeId, message, sendOptions);
	}

	sendChannelMessage(options: SendChannelMessageOptions): void {
		// TODO: Implement named channel messaging in future iteration
		console.warn('Channel messaging not yet implemented', options);
	}

	addMessageListener(nodeId: string, callback: MessageCallbackFn): void {
		const queue = this.messageSystem.registerNode(nodeId);
		queue.addCallback(callback);
	}

	removeMessageListener(nodeId: string, callback: MessageCallbackFn): void {
		const queue = this.messageSystem.registerNode(nodeId);
		queue.removeCallback(callback);
	}

	// System integration
	private updateSystems(): void {
		const nodes = this.getNodes();
		const edges = this.getEdges();

		// Nodes and edges are already in XYFlow format
		// Update all systems with new graph structure
		this.messageSystem.updateEdges(edges);
		this.audioSystem.updateEdges(edges);

		// Update GL system with render-compatible nodes/edges
		this.updateGLSystem(nodes, edges);
	}

	private updateGLSystem(nodes: PatcherNode[], edges: PatcherEdge[]): void {
		// Convert to render graph format for GLSystem
		const renderNodes = nodes
			.filter((node) => node.type && isRenderableNode(node.type))
			.map((node) => ({
				id: node.id,
				type: node.type!,
				data: node.data as Record<string, unknown>
			}));

		const renderEdges = edges
			.filter((edge) => {
				const sourceNode = nodes.find((n) => n.id === edge.source);
				const targetNode = nodes.find((n) => n.id === edge.target);
				return (
					sourceNode &&
					targetNode &&
					sourceNode.type &&
					targetNode.type &&
					isRenderableNode(sourceNode.type) &&
					isRenderableNode(targetNode.type)
				);
			})
			.map((edge) => ({
				id: edge.id,
				source: edge.source,
				target: edge.target,
				sourceHandle: edge.sourceHandle ?? undefined,
				targetHandle: edge.targetHandle ?? undefined
			}));

		this.glSystem.nodes = renderNodes;
		this.glSystem.edges = renderEdges;
	}

	mountNode(nodeId: string): void {
		const node = this.nodes.get(nodeId);
		if (!node) return;

		if (node.type === 'glsl') {
			setTimeout(() => {
				this.glSystem.setPreviewEnabled(nodeId, true);
			}, 10);
		}
	}

	unmountNode(nodeId: string): void {
		const node = this.nodes.get(nodeId);
		if (!node) return;

		// TODO: these logic will be wrong when sub-patches are introduced.
		// We will need to keep it unmounted until the entire subpatch is unmounted.
		if (node.type === 'glsl') {
			this.glSystem.removeNode(nodeId);
			this.removeVideoPreview(nodeId);
		}

		this.messageSystem.unregisterNode(nodeId);
		this.audioSystem.removeAudioObject(nodeId);
		this.videoPreviewOutputs.delete(nodeId);
	}

	removeVideoPreview(nodeId: string) {
		const previewOutput = this.videoPreviewOutputs.get(nodeId);

		if (previewOutput) {
			const context = getBitmapContext(previewOutput);

			if (context) {
				this.glSystem.removePreviewContext(nodeId, context);
			}
		}
	}

	// Node-specific operations
	updateNodeShader(nodeId: string, code: string): void {
		const node = this.nodes.get(nodeId);
		if (!node || node.type !== 'glsl') return;

		const nextData = {
			...node.data,
			code,
			glUniformDefs: shaderCodeToUniformDefs(code)
		};

		// Update node data in Patcher
		this.updateNode(nodeId, { data: nextData });

		// Update GL system
		this.glSystem.upsertNode(nodeId, 'glsl', nextData);
	}

	toggleNodePause(nodeId: string): void {
		const node = this.nodes.get(nodeId);
		if (!node) return;

		if (node.type === 'glsl') {
			this.glSystem.toggleNodePause(nodeId);
		}
	}

	setNodeUniform(nodeId: string, uniformName: string, value: unknown): void {
		const node = this.nodes.get(nodeId);
		if (!node || node.type !== 'glsl') return;

		this.glSystem.setUniformData(nodeId, uniformName, value as UserUniformValue);
	}

	// Cleanup
	destroy(): void {
		// Clean up all nodes using unmountNode for proper cleanup
		this.nodes.forEach((_, nodeId) => {
			this.unmountNode(nodeId);
		});

		this.nodes.clear();
		this.edges.clear();
		this.videoPreviewOutputs.clear();
	}
}

function isRenderableNode(nodeType: string): boolean {
	const renderableTypes: string[] = ['glsl', 'hydra', 'swgl', 'bg.out'] satisfies NodeTypeName[];

	return renderableTypes.includes(nodeType);
}
