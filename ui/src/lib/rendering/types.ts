import type regl from 'regl';
import type { ProfilerCategory, RenderFrameStats, TimingStats } from '$lib/profiler/types';
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
  | { type: 'regl'; data: { code: string } }
  | { type: 'projmap'; data: { surfaces: import('$objects/projmap/types').ProjMapSurface[] } }
  | { type: 'img'; data: unknown }
  | { type: 'bg.out'; data: unknown }
  | { type: 'send.vdo'; data: { channel: string } }
  | { type: 'recv.vdo'; data: { channel: string } }
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
  /** Previous frame's transport time for delta computation */
  prevTransportTime: number;

  iFrame: number;
  mouseX: number;
  mouseY: number;
  mouseZ: number;
  mouseW: number;
  userParams: UserParam[];

  /** Global transport time in seconds for synchronized timing */
  transportTime: number;
}

export type RenderFunction = (renderParams: RenderParams) => void;

export interface FBONode {
  id: string;
  framebuffer: regl.Framebuffer2D;
  texture: regl.Texture2D;
  render: RenderFunction;
  cleanup?: () => void;

  /** Fingerprint of the node data used to build this renderer (for diffing on graph rebuild) */
  dataFingerprint?: string;

  /** The node type that this FBO was built for */
  nodeType?: RenderNode['type'];
}

// Message types for worker communication (main -> worker)
export type WorkerMessage =
  | { type: 'buildRenderGraph'; nodes: RenderNode[]; edges: RenderEdge[] }
  | { type: 'startAnimation' }
  | { type: 'stopAnimation' }
  | { type: 'setPreviewEnabled'; nodeId: string; enabled: boolean }
  | { type: 'animationFrame'; outputBitmap: ImageBitmap }
  | { type: 'updateOutput'; buffer: ArrayBuffer }
  | {
      type: 'captureWorkerVideoFrames';
      targetNodeId: string;
      sourceNodeIds: (string | null)[];
    }
  | {
      type: 'captureWorkerVideoFramesBatch';
      requests: Array<{
        targetNodeId: string;
        sourceNodeIds: (string | null)[];
      }>;
    }
  | {
      type: 'captureMediaPipeVideoFramesBatch';
      requests: Array<{
        targetNodeId: string;
        sourceNodeIds: (string | null)[];
        resolution?: [number, number];
      }>;
    }
  // Settings API responses (main → render worker)
  | {
      type: 'settingsValuesInit';
      nodeId: string;
      requestId: string;
      values: Record<string, unknown>;
    }
  | { type: 'settingsValueChanged'; nodeId: string; key: string; value: unknown };

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
      options?: { outlet?: number; to?: number | string };
    }
  | {
      type: 'setPortCount';
      nodeId: string;
      portType: 'message' | 'video';
      inletCount: number;
      outletCount: number;
    }
  | { type: 'setTitle'; nodeId: string; title: string }
  | { type: 'setHidePorts'; nodeId: string; hidePorts: boolean }
  | { type: 'setDragEnabled'; nodeId: string; dragEnabled: boolean }
  | { type: 'setVideoOutputEnabled'; nodeId: string; videoOutputEnabled: boolean }
  | { type: 'setMouseScope'; nodeId: string; scope: MouseScope }
  | {
      type: 'setInteraction';
      nodeId: string;
      mode: 'drag' | 'pan' | 'wheel' | 'interact';
      enabled: boolean;
    }
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
  | { type: 'drawStats'; nodeId: string; category: ProfilerCategory; stats: TimingStats }
  | { type: 'renderFrameStats'; stats: RenderFrameStats }
  | { type: 'error'; message: string }
  | { type: 'resolveVfsUrl'; requestId: string; nodeId: string; path: string }
  | { type: 'resolveVfsText'; requestId: string; nodeId: string; path: string }
  | {
      type: 'workerVideoFramesCaptured';
      targetNodeId: string;
      frames: (ImageBitmap | null)[];
      timestamp: number;
    }
  | {
      type: 'workerVideoFramesCapturedBatch';
      results: Array<{
        targetNodeId: string;
        frames: (ImageBitmap | null)[];
      }>;
      timestamp: number;
    }
  | {
      type: 'mediaPipeVideoFramesCapturedBatch';
      results: Array<{
        targetNodeId: string;
        frames: (ImageBitmap | null)[];
      }>;
      timestamp: number;
    }
  | {
      type: 'mediaBunnyMetadata';
      nodeId: string;
      metadata: {
        duration: number;
        width: number;
        height: number;
        frameRate: number;
        codec: string;
        hasAudio: boolean;
      };
    }
  | { type: 'mediaBunnyFirstFrame'; nodeId: string }
  | { type: 'mediaBunnyTimeUpdate'; nodeId: string; currentTime: number }
  | { type: 'mediaBunnyEnded'; nodeId: string }
  | { type: 'mediaBunnyError'; nodeId: string; error: string }
  | {
      type: 'clockCommand';
      command:
        | { action: 'play' }
        | { action: 'pause' }
        | { action: 'stop' }
        | { action: 'setBpm'; value: number }
        | { action: 'setTimeSignature'; numerator: number; denominator: number }
        | { action: 'seek'; value: number };
    }
  | { type: 'subscribeChannel'; nodeId: string; channel: string }
  | { type: 'unsubscribeChannel'; nodeId: string; channel: string }
  | { type: 'settingsDefine'; nodeId: string; requestId: string; schema: unknown[] }
  | { type: 'settingsClear'; nodeId: string };

export type PreviewState = Record<string, boolean>;

export const FBO_COMPATIBLE_TYPES: RenderNode['type'][] = [
  'glsl',
  'hydra',
  'swgl',
  'canvas',
  'textmode',
  'three',
  'regl',
  'projmap',
  'img',
  'send.vdo',
  'recv.vdo'
];

export const isFBOCompatible = (nodeType?: string): nodeType is RenderNode['type'] =>
  FBO_COMPATIBLE_TYPES.includes(nodeType as RenderNode['type']);
