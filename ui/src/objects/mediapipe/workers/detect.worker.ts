/**
 * MediaPipe Object Detector worker.
 */

import { MediaPipeWorkerBase } from '$objects/mediapipe/MediaPipeWorkerBase';
import type { DetectTaskOptions, DetectOutput, TaskOptions } from '$objects/mediapipe/types';
import type { ObjectDetector, ObjectDetectorResult } from '@mediapipe/tasks-vision';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite';

class DetectWorker extends MediaPipeWorkerBase<ObjectDetector, ObjectDetectorResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async initTask(vision: any, options: TaskOptions) {
    const { ObjectDetector } = await import('@mediapipe/tasks-vision');
    const opts = options as DetectTaskOptions;

    return ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: opts.delegate ?? 'GPU'
      },
      runningMode: 'VIDEO',
      maxResults: opts.maxResults ?? 5,
      scoreThreshold: opts.scoreThreshold ?? 0.5
    });
  }

  protected detectFrame(task: ObjectDetector, bitmap: ImageBitmap, timestamp: number) {
    return task.detectForVideo(bitmap, timestamp);
  }

  protected formatResult(raw: ObjectDetectorResult, timestamp: number): DetectOutput {
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
      timestamp
    };
  }
}

new DetectWorker().setupMessageHandler();
