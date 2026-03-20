/**
 * MediaPipe Pose Landmarker worker.
 */

import { MediaPipeWorkerBase } from '$objects/mediapipe/MediaPipeWorkerBase';
import type { BodyTaskOptions, BodyOutput, TaskOptions } from '$objects/mediapipe/types';
import type { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

const MODEL_URLS: Record<string, string> = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
  heavy:
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task'
};

type Landmark = { x: number; y: number; z: number; visibility: number };

class BodyWorker extends MediaPipeWorkerBase<PoseLandmarker, PoseLandmarkerResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async initTask(vision: any, options: TaskOptions) {
    const { PoseLandmarker } = await import('@mediapipe/tasks-vision');

    const opts = options as BodyTaskOptions;
    const modelUrl = MODEL_URLS[opts.model ?? 'lite'] ?? MODEL_URLS.lite;

    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: opts.delegate ?? 'GPU'
      },
      runningMode: 'VIDEO',
      numPoses: opts.numPoses ?? 1
    });
  }

  protected detectFrame(task: PoseLandmarker, bitmap: ImageBitmap, timestamp: number) {
    return task.detectForVideo(bitmap, timestamp);
  }

  protected formatResult(raw: PoseLandmarkerResult): BodyOutput {
    return {
      poses: raw.landmarks.map((lms, i) => ({
        landmarks: lms.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (lm: any): Landmark => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility ?? 1
          })
        ),

        worldLandmarks: (raw.worldLandmarks[i] ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (lm: any): Landmark => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility ?? 1
          })
        )
      })),
      timestamp: performance.now()
    };
  }
}

new BodyWorker().setupMessageHandler();
