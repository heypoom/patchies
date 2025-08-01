import type regl from 'regl';
import type { GLUniformDef } from '../../types/uniform-config';

export interface RenderNode {
	id: string;
	type: string;
	inputs: string[]; // IDs of input nodes
	outputs: string[]; // IDs of output nodes
	data: { code: string; glUniformDefs: GLUniformDef[] }; // Node-specific data (shader code, etc.)
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

	/** Topologically sorted node IDs */
	sortedNodes: string[];
}

export interface FBONode {
	id: string;
	framebuffer: regl.Framebuffer2D;
	texture: regl.Texture2D;
	renderCommand: regl.DrawCommand;
}

// Message types for worker communication
export type WorkerMessage =
	| { type: 'buildRenderGraph'; nodes: RenderNode[]; edges: RenderEdge[] }
	| { type: 'startAnimation' }
	| { type: 'stopAnimation' }
	| { type: 'setPreviewEnabled'; nodeId: string; enabled: boolean }
	| { type: 'animationFrame'; outputBitmap: ImageBitmap }
	| {
			type: 'previewFrame';
			nodeId: string;
			buffer: ArrayBuffer;
			width: number;
			height: number;
			timestamp: number;
	  }
	| { type: 'updateOutput'; buffer: ArrayBuffer };

// Preview system types
export interface PreviewState {
	[nodeId: string]: boolean; // true = preview enabled, false = disabled
}

// Node type compatibility
export const FBO_COMPATIBLE_TYPES = ['glsl'] as const;
export type FBOCompatibleType = (typeof FBO_COMPATIBLE_TYPES)[number];

export function isFBOCompatible(nodeType?: string): nodeType is FBOCompatibleType {
	return FBO_COMPATIBLE_TYPES.includes(nodeType as FBOCompatibleType);
}
