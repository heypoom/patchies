/**
 * MediaPipe Image Classifier worker.
 */

import { MediaPipeWorkerBase } from '$objects/mediapipe/MediaPipeWorkerBase';
import type { ClassifyTaskOptions, ClassifyOutput, TaskOptions } from '$objects/mediapipe/types';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/latest/efficientnet_lite0.tflite';

class ClassifyWorker extends MediaPipeWorkerBase<
  import('@mediapipe/tasks-vision').ImageClassifier,
  import('@mediapipe/tasks-vision').ImageClassifierResult
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async initTask(vision: any, options: TaskOptions) {
    const { ImageClassifier } = await import('@mediapipe/tasks-vision');
    const opts = options as ClassifyTaskOptions;

    return ImageClassifier.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: opts.delegate ?? 'GPU'
      },
      runningMode: 'IMAGE',
      maxResults: opts.maxResults ?? 5,
      scoreThreshold: opts.scoreThreshold ?? 0.0
    });
  }

  protected detectFrame(
    task: import('@mediapipe/tasks-vision').ImageClassifier,
    bitmap: ImageBitmap,
    _timestamp: number
  ) {
    return task.classify(bitmap);
  }

  protected formatResult(
    raw: import('@mediapipe/tasks-vision').ImageClassifierResult
  ): ClassifyOutput {
    const cats = raw.classifications[0]?.categories ?? [];
    return {
      classifications: cats.map((c) => ({
        label: c.categoryName,
        score: c.score
      })),
      timestamp: performance.now()
    };
  }
}

new ClassifyWorker().setupMessageHandler();
