/**
 * MediaPipe Object Detector worker.
 */

import { MediaPipeWorkerBase } from '$lib/mediapipe/MediaPipeWorkerBase';
import type { DetectTaskOptions, DetectOutput, TaskOptions } from '$lib/mediapipe/types';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite';

class DetectWorker extends MediaPipeWorkerBase<
  import('@mediapipe/tasks-vision').ObjectDetector,
  import('@mediapipe/tasks-vision').ObjectDetectorResult
> {
  protected async initTask(
    vision: import('@mediapipe/tasks-vision').WasmFileset,
    options: TaskOptions
  ) {
    const { ObjectDetector } = await import('@mediapipe/tasks-vision');
    const opts = options as DetectTaskOptions;

    return ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: opts.delegate ?? 'GPU'
      },
      runningMode: 'IMAGE',
      maxResults: opts.maxResults ?? 5,
      scoreThreshold: opts.scoreThreshold ?? 0.5
    });
  }

  protected detectFrame(
    task: import('@mediapipe/tasks-vision').ObjectDetector,
    bitmap: ImageBitmap,
    _timestamp: number
  ) {
    return task.detect(bitmap);
  }

  protected formatResult(
    raw: import('@mediapipe/tasks-vision').ObjectDetectorResult
  ): DetectOutput {
    return {
      detections: raw.detections.map((d) => ({
        label: d.categories[0]?.categoryName ?? 'unknown',
        score: d.categories[0]?.score ?? 0,
        boundingBox: {
          originX: d.boundingBox?.originX ?? 0,
          originY: d.boundingBox?.originY ?? 0,
          width: d.boundingBox?.width ?? 0,
          height: d.boundingBox?.height ?? 0
        }
      })),
      timestamp: performance.now()
    };
  }
}

new DetectWorker().setupMessageHandler();
