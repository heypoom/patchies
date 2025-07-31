// Types for the optimized visual chaining system

export interface RenderNode {
	id: string;
	type: string;
	inputs: string[]; // IDs of input nodes
	outputs: string[]; // IDs of output nodes
	data: any; // Node-specific data (shader code, etc.)
}

export interface RenderEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string;
	targetHandle?: string;
}

export interface RenderGraph {
	nodes: RenderNode[];
	edges: RenderEdge[];
	sortedNodes: string[]; // Topologically sorted node IDs
}

export interface FBONode {
	id: string;
	framebuffer: any; // REGL framebuffer object
	texture: any; // REGL texture object
	renderCommand: any; // REGL draw command
	needsPreview: boolean;
	previewSize: { width: number; height: number };
}

export interface RenderGraphOptions {
	previewSize: { width: number; height: number };
	outputSize: { width: number; height: number };
}

// Message types for worker communication
export type WorkerMessage = 
	| { type: 'ready'; message: string; timestamp: number }
	| { type: 'hello'; message: string; timestamp: number }
	| { type: 'buildRenderGraph'; nodes: any[]; edges: any[] }
	| { type: 'renderFrame'; timestamp: number }
	| { type: 'updatePreview'; nodeId: string; buffer: ArrayBuffer }
	| { type: 'updateOutput'; buffer: ArrayBuffer };

// Node type compatibility
export const FBO_COMPATIBLE_TYPES = ['glsl'] as const;
export type FBOCompatibleType = typeof FBO_COMPATIBLE_TYPES[number];

export function isFBOCompatible(nodeType: string): nodeType is FBOCompatibleType {
	return FBO_COMPATIBLE_TYPES.includes(nodeType as FBOCompatibleType);
}