/**
 * Shared TypeScript types for MediaPipe Vision nodes.
 */

// ============================================================
// Task identifiers
// ============================================================

export type MediaPipeTask =
  | 'hand'
  | 'body'
  | 'face'
  | 'segment'
  | 'detect'
  | 'gesture'
  | 'classify';

// ============================================================
// Task options (per node settings stored in node data)
// ============================================================

export interface HandTaskOptions {
  numHands: number;
  model: 'lite' | 'full';
  delegate: 'GPU' | 'CPU';
  skipFrames: number;
}

export interface BodyTaskOptions {
  numPoses: number;
  model: 'lite' | 'full' | 'heavy';
  delegate: 'GPU' | 'CPU';
  skipFrames: number;
}

export interface FaceTaskOptions {
  numFaces: number;
  blendshapes: boolean;
  delegate: 'GPU' | 'CPU';
  skipFrames: number;
  mode?: 'landmarks' | 'detect';
}

export interface GestureTaskOptions {
  numHands: number;
  delegate: 'GPU' | 'CPU';
  skipFrames: number;
}

export interface ClassifyTaskOptions {
  maxResults: number;
  scoreThreshold: number;
  delegate: 'GPU' | 'CPU';
  skipFrames: number;
}

export interface SegmentTaskOptions {
  maskType: 'category' | 'confidence';
  outputMessage: boolean;
  model: 'general' | 'landscape';
  delegate: 'GPU' | 'CPU';
  skipFrames: number;
}

export interface DetectTaskOptions {
  maxResults: number;
  scoreThreshold: number;
  delegate: 'GPU' | 'CPU';
  skipFrames: number;
}

export type TaskOptions =
  | HandTaskOptions
  | BodyTaskOptions
  | FaceTaskOptions
  | SegmentTaskOptions
  | DetectTaskOptions
  | GestureTaskOptions
  | ClassifyTaskOptions;

// ============================================================
// Output data shapes
// ============================================================

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Point4D {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface HandOutput {
  hands: Array<{
    handedness: 'Left' | 'Right';
    score: number;
    landmarks: Point3D[];
    worldLandmarks: Point3D[];
  }>;

  timestamp: number;
}

export interface BodyOutput {
  poses: Array<{
    landmarks: Point4D[];
    worldLandmarks: Point4D[];
  }>;

  timestamp: number;
}

export interface FaceOutput {
  faces: Array<{
    landmarks?: Point3D[];
    blendshapes?: Array<{ categoryName: string; score: number }>;
    transformationMatrix?: number[];
    boundingBox?: { originX: number; originY: number; width: number; height: number };
    score?: number;
    keypoints?: Array<{ x: number; y: number; label?: string }>;
  }>;
  timestamp: number;
}

export interface GestureOutput {
  gestures: Array<{
    gesture: string;
    score: number;
    handedness: 'Left' | 'Right';
    landmarks: Point3D[];
    worldLandmarks: Point3D[];
  }>;
  timestamp: number;
}

export interface ClassifyOutput {
  classifications: Array<{ label: string; score: number }>;
  timestamp: number;
}

export interface SegmentOutput {
  width: number;
  height: number;
  mask: Uint8Array | Float32Array;
  maskType: 'category' | 'confidence';
  timestamp: number;
}

export interface DetectOutput {
  detections: Array<{
    label: string;
    score: number;
    boundingBox: { originX: number; originY: number; width: number; height: number };
  }>;
  timestamp: number;
}

export type TaskResult =
  | HandOutput
  | BodyOutput
  | FaceOutput
  | SegmentOutput
  | DetectOutput
  | GestureOutput
  | ClassifyOutput;

// ============================================================
// Worker message protocol
// ============================================================

export interface DirectChannelConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
  inletKey?: string;
}

export type WorkerInMessage =
  | { type: 'init'; task: MediaPipeTask; options: TaskOptions }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }
  | { type: 'updateSettings'; settings: Partial<TaskOptions> }
  | { type: 'destroy' }
  | { type: 'setRenderPort'; nodeId: string }
  | { type: 'setWorkerPort'; nodeId: string; targetNodeId?: string; sourceNodeId?: string }
  | { type: 'updateRenderConnections'; nodeId: string; connections: DirectChannelConnection[] }
  | { type: 'updateWorkerConnections'; nodeId: string; connections: DirectChannelConnection[] };

export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'result'; data: TaskResult; excludeTargets?: string[] }
  | { type: 'segmentBitmap'; bitmap: ImageBitmap; messageData?: SegmentOutput }
  | { type: 'fps'; value: number };

// ============================================================
// MediaPipeNodeSystem registration options
// ============================================================

export interface MediaPipeNodeOptions {
  task: MediaPipeTask;
  taskOptions: TaskOptions;
  skipFrames: number;
}
