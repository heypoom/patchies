/**
 * Shared TypeScript types for MediaPipe Vision nodes.
 */

// ============================================================
// Task identifiers
// ============================================================

export type MediaPipeTask = 'hand' | 'body' | 'face' | 'segment' | 'detect';

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
}

export interface SegmentTaskOptions {
  maskType: 'category' | 'confidence';
  outputMessage: boolean;
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
  | DetectTaskOptions;

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
    landmarks: Point3D[];
    blendshapes?: Array<{ categoryName: string; score: number }>;
    transformationMatrix?: number[];
  }>;
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

export type TaskResult = HandOutput | BodyOutput | FaceOutput | SegmentOutput | DetectOutput;

// ============================================================
// Worker message protocol
// ============================================================

export type WorkerInMessage =
  | { type: 'init'; task: MediaPipeTask; options: TaskOptions }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }
  | { type: 'updateSettings'; settings: Partial<TaskOptions> }
  | { type: 'destroy' };

export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'result'; data: TaskResult }
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
