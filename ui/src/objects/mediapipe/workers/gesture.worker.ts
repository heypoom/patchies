/**
 * MediaPipe Gesture Recognizer worker.
 */

import { MediaPipeWorkerBase } from '$objects/mediapipe/MediaPipeWorkerBase';
import type { GestureTaskOptions, GestureOutput, TaskOptions } from '$objects/mediapipe/types';
import type { GestureRecognizer, GestureRecognizerResult } from '@mediapipe/tasks-vision';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task';

class GestureWorker extends MediaPipeWorkerBase<GestureRecognizer, GestureRecognizerResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async initTask(vision: any, options: TaskOptions) {
    const { GestureRecognizer } = await import('@mediapipe/tasks-vision');
    const opts = options as GestureTaskOptions;

    return GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: opts.delegate ?? 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: opts.numHands ?? 2
    });
  }

  protected detectFrame(task: GestureRecognizer, bitmap: ImageBitmap, timestamp: number) {
    return task.recognizeForVideo(bitmap, timestamp);
  }

  protected formatResult(raw: GestureRecognizerResult): GestureOutput {
    return {
      gestures: raw.gestures.map((cats, i) => ({
        gesture: cats[0]?.categoryName ?? 'None',
        score: cats[0]?.score ?? 0,
        handedness: (raw.handednesses[i]?.[0]?.categoryName ?? 'Right') as 'Left' | 'Right',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        landmarks: (raw.landmarks[i] ?? []).map((lm: any) => ({ x: lm.x, y: lm.y, z: lm.z })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        worldLandmarks: (raw.worldLandmarks[i] ?? []).map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z
        }))
      })),
      timestamp: performance.now()
    };
  }
}

new GestureWorker().setupMessageHandler();
