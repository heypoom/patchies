declare module '@mediapipe/tasks-vision' {
  export interface WasmFileset {
    wasmLoaderPath: string;
    wasmBinaryPath: string;
    assetLoaderPath?: string;
    assetBinaryPath?: string;
  }

  export class FilesetResolver {
    static forVisionTasks(basePath?: string, useModule?: boolean): Promise<WasmFileset>;
  }

  export interface Category {
    categoryName: string;
    displayName?: string;
    score: number;
    index?: number;
  }

  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  export interface BoundingBox {
    originX: number;
    originY: number;
    width: number;
    height: number;
    angle?: number;
  }

  export interface Detection {
    categories: Category[];
    boundingBox?: BoundingBox;
    keypoints?: Array<{ x: number; y: number; label?: string }>;
  }

  export interface Classification {
    categories: Category[];
  }

  export interface VisionMask {
    getAsUint8Array(): Uint8Array;
    getAsFloat32Array(): Float32Array;
  }

  export interface VisionTask {
    close?(): void;
  }

  export class HandLandmarker implements VisionTask {
    static createFromOptions(wasmFileset: WasmFileset, options: unknown): Promise<HandLandmarker>;
    detectForVideo(image: ImageBitmap, timestamp: number): HandLandmarkerResult;
    close?(): void;
  }

  export interface HandLandmarkerResult {
    handednesses: Category[][];
    landmarks: NormalizedLandmark[][];
    worldLandmarks: NormalizedLandmark[][];
  }

  export class PoseLandmarker implements VisionTask {
    static createFromOptions(wasmFileset: WasmFileset, options: unknown): Promise<PoseLandmarker>;
    detectForVideo(image: ImageBitmap, timestamp: number): PoseLandmarkerResult;
    close?(): void;
  }

  export interface PoseLandmarkerResult {
    landmarks: NormalizedLandmark[][];
    worldLandmarks: NormalizedLandmark[][];
  }

  export class FaceDetector implements VisionTask {
    static createFromOptions(wasmFileset: WasmFileset, options: unknown): Promise<FaceDetector>;
    detectForVideo(image: ImageBitmap, timestamp: number): FaceDetectorResult;
    close?(): void;
  }

  export interface FaceDetectorResult {
    detections: Detection[];
  }

  export class FaceLandmarker implements VisionTask {
    static createFromOptions(wasmFileset: WasmFileset, options: unknown): Promise<FaceLandmarker>;
    detectForVideo(image: ImageBitmap, timestamp: number): FaceLandmarkerResult;
    close?(): void;
  }

  export interface FaceLandmarkerResult {
    faceLandmarks: NormalizedLandmark[][];
    faceBlendshapes?: Array<{ categories: Category[] }>;
  }

  export class GestureRecognizer implements VisionTask {
    static createFromOptions(
      wasmFileset: WasmFileset,
      options: unknown
    ): Promise<GestureRecognizer>;
    recognizeForVideo(image: ImageBitmap, timestamp: number): GestureRecognizerResult;
    close?(): void;
  }

  export interface GestureRecognizerResult {
    gestures: Category[][];
    handednesses: Category[][];
    landmarks: NormalizedLandmark[][];
    worldLandmarks: NormalizedLandmark[][];
  }

  export class ImageClassifier implements VisionTask {
    static createFromOptions(wasmFileset: WasmFileset, options: unknown): Promise<ImageClassifier>;
    classifyForVideo(image: ImageBitmap, timestamp: number): ImageClassifierResult;
    close?(): void;
  }

  export interface ImageClassifierResult {
    classifications: Classification[];
  }

  export class ObjectDetector implements VisionTask {
    static createFromOptions(wasmFileset: WasmFileset, options: unknown): Promise<ObjectDetector>;
    detectForVideo(image: ImageBitmap, timestamp: number): ObjectDetectorResult;
    close?(): void;
  }

  export interface ObjectDetectorResult {
    detections: Detection[];
  }

  export class ImageSegmenter implements VisionTask {
    static createFromOptions(wasmFileset: WasmFileset, options: unknown): Promise<ImageSegmenter>;
    segmentForVideo(image: ImageBitmap, timestamp: number): ImageSegmenterResult;
    close?(): void;
  }

  export interface ImageSegmenterResult {
    categoryMask?: VisionMask;
    confidenceMasks?: VisionMask[];
    close?(): void;
  }
}
