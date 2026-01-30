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
  | { type: 'textmode'; data: { code: string } }
  | { type: 'three'; data: { code: string } }
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

// Message types for worker communication (main -> worker)
export type WorkerMessage =
  | { type: 'buildRenderGraph'; nodes: RenderNode[]; edges: RenderEdge[] }
  | { type: 'startAnimation' }
  | { type: 'stopAnimation' }
  | { type: 'setPreviewEnabled'; nodeId: string; enabled: boolean }
  | { type: 'animationFrame'; outputBitmap: ImageBitmap }
  | { type: 'updateOutput'; buffer: ArrayBuffer };

export type MouseScope = 'local' | 'global';

// Message types from render worker (worker -> main)
export type RenderWorkerMessage =
  | { type: 'previewFrame'; nodeId: string; bitmap: ImageBitmap }
  | { type: 'animationFrame'; outputBitmap: ImageBitmap }
  | {
      type: 'shaderError';
      nodeId: string;
      error: string;
      stack?: string;
      lineErrors?: Record<number, string>;
    }
  | {
      type: 'consoleOutput';
      nodeId: string;
      level: 'log' | 'warn' | 'error';
      message?: string;
      args?: unknown[];
      lineErrors?: Record<number, string>;
    }
  | {
      type: 'sendMessageFromNode';
      fromNodeId: string;
      data: unknown;
      options?: { outlet?: number };
    }
  | {
      type: 'setPortCount';
      nodeId: string;
      portType: 'message';
      inletCount: number;
      outletCount: number;
    }
  | { type: 'setTitle'; nodeId: string; title: string }
  | { type: 'setHidePorts'; nodeId: string; hidePorts: boolean }
  | { type: 'setDragEnabled'; nodeId: string; dragEnabled: boolean }
  | { type: 'setVideoOutputEnabled'; nodeId: string; videoOutputEnabled: boolean }
  | { type: 'setMouseScope'; nodeId: string; scope: MouseScope }
  | {
      type: 'previewFrameCaptured';
      success: boolean;
      nodeId: string;
      requestId?: string;
      bitmap?: ImageBitmap;
    }
  | { type: 'fftEnabled'; nodeId: string; enabled: boolean }
  | { type: 'registerFFTRequest'; nodeId: string; analysisType: string; format: string }
  | { type: 'previewToggled'; nodeId: string; enabled: boolean }
  | { type: 'frameStats'; stats: unknown }
  | { type: 'error'; message: string }
  | { type: 'resolveVfsUrl'; requestId: string; nodeId: string; path: string };

export type PreviewState = Record<string, boolean>;

export const FBO_COMPATIBLE_TYPES: RenderNode['type'][] = [
  'glsl',
  'hydra',
  'swgl',
  'canvas',
  'textmode',
  'three',
  'img'
];

export const isFBOCompatible = (nodeType?: string): nodeType is RenderNode['type'] =>
  FBO_COMPATIBLE_TYPES.includes(nodeType as RenderNode['type']);
