/**
 * MediaPipe Image Classifier worker.
 */

import { MediaPipeWorkerBase } from '$objects/mediapipe/MediaPipeWorkerBase';
import type { ClassifyTaskOptions, ClassifyOutput, TaskOptions } from '$objects/mediapipe/types';
import type { ImageClassifier, ImageClassifierResult } from '@mediapipe/tasks-vision';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/latest/efficientnet_lite0.tflite';

class ClassifyWorker extends MediaPipeWorkerBase<ImageClassifier, ImageClassifierResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async initTask(vision: any, options: TaskOptions) {
    const { ImageClassifier } = await import('@mediapipe/tasks-vision');

    const opts = options as ClassifyTaskOptions;

    return ImageClassifier.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: opts.delegate ?? 'GPU'
      },
      runningMode: 'VIDEO',
      maxResults: opts.maxResults ?? 5,
      scoreThreshold: opts.scoreThreshold ?? 0.0
    });
  }

  protected detectFrame(task: ImageClassifier, bitmap: ImageBitmap, timestamp: number) {
    return task.classifyForVideo(bitmap, timestamp);
  }

  protected formatResult(raw: ImageClassifierResult, timestamp: number): ClassifyOutput {
    const categories = raw.classifications[0]?.categories ?? [];

    return {
      classifications: categories.map((c) => ({
        label: c.categoryName,
        score: c.score
      })),
      timestamp
    };
  }
}

new ClassifyWorker().setupMessageHandler();
