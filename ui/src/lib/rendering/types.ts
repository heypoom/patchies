import type regl from 'regl';
import type { GLUniformDef } from '../../types/uniform-config';

export type RenderNode = {
	id: string;
	inputs: string[]; // IDs of input nodes
	outputs: string[]; // IDs of output nodes
	inletMap: Map<number, string>; // Maps inlet index to source node ID
} & (
	| { type: 'glsl'; data: { code: string; glUniformDefs: GLUniformDef[] } }
	| { type: 'hydra'; data: { code: string } }
	| { type: 'swgl'; data: { code: string } }
	| { type: 'canvas'; data: { code: string } }
	| { type: 'img'; data: unknown }
	| { type: 'bg.out'; data: unknown }
);

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

	/** ID of the node connected to bg.out (final output node) */
	outputNodeId: string | null;
}

export type UserParam = number | boolean | regl.Texture2D | regl.Framebuffer;

export interface RenderParams {
	lastTime: number;
	iFrame: number;
	mouseX: number;
	mouseY: number;
	mouseZ: number;
	mouseW: number;
	userParams: UserParam[];
}

export type RenderFunction = (renderParams: RenderParams) => void;

export interface FBONode {
	id: string;
	framebuffer: regl.Framebuffer2D;
	texture: regl.Texture2D;
	render: RenderFunction;
	cleanup?: () => void;
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

export type PreviewState = Record<string, boolean>;

export const FBO_COMPATIBLE_TYPES: RenderNode['type'][] = [
	'glsl',
	'hydra',
	'swgl',
	'canvas',
	'img'
];

export const isFBOCompatible = (nodeType?: string): nodeType is RenderNode['type'] =>
	FBO_COMPATIBLE_TYPES.includes(nodeType as RenderNode['type']);
