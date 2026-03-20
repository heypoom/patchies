/**
 * MediaPipe Hand Landmarker worker.
 */

import { MediaPipeWorkerBase } from '$lib/mediapipe/MediaPipeWorkerBase';
import type { HandTaskOptions, HandOutput, TaskOptions } from '$lib/mediapipe/types';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

class HandWorker extends MediaPipeWorkerBase<
  import('@mediapipe/tasks-vision').HandLandmarker,
  import('@mediapipe/tasks-vision').HandLandmarkerResult
> {
  protected async initTask(
    vision: import('@mediapipe/tasks-vision').WasmFileset,
    options: TaskOptions
  ) {
    const { HandLandmarker } = await import('@mediapipe/tasks-vision');
    const opts = options as HandTaskOptions;

    return HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: opts.delegate ?? 'GPU'
      },
      runningMode: 'IMAGE',
      numHands: opts.numHands ?? 2
    });
  }

  protected detectFrame(
    task: import('@mediapipe/tasks-vision').HandLandmarker,
    bitmap: ImageBitmap,
    _timestamp: number
  ) {
    return task.detect(bitmap);
  }

  protected formatResult(raw: import('@mediapipe/tasks-vision').HandLandmarkerResult): HandOutput {
    return {
      hands: raw.handednesses.map((cat, i) => ({
        handedness: (cat[0]?.categoryName ?? 'Right') as 'Left' | 'Right',
        score: cat[0]?.score ?? 0,
        landmarks: (raw.landmarks[i] ?? []).map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })),
        worldLandmarks: (raw.worldLandmarks[i] ?? []).map((lm) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z
        }))
      })),
      timestamp: performance.now()
    };
  }
}

new HandWorker().setupMessageHandler();
