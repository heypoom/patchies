/**
 * MediaPipe Pose Landmarker worker.
 */

import { MediaPipeWorkerBase } from '$objects/mediapipe/MediaPipeWorkerBase';
import type { BodyTaskOptions, BodyOutput, TaskOptions } from '$objects/mediapipe/types';

const MODEL_URLS: Record<string, string> = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
  heavy:
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task'
};

class BodyWorker extends MediaPipeWorkerBase<
  import('@mediapipe/tasks-vision').PoseLandmarker,
  import('@mediapipe/tasks-vision').PoseLandmarkerResult
> {
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
      runningMode: 'IMAGE',
      numPoses: opts.numPoses ?? 1
    });
  }

  protected detectFrame(
    task: import('@mediapipe/tasks-vision').PoseLandmarker,
    bitmap: ImageBitmap,
    _timestamp: number
  ) {
    return task.detect(bitmap);
  }

  protected formatResult(raw: import('@mediapipe/tasks-vision').PoseLandmarkerResult): BodyOutput {
    return {
      poses: raw.landmarks.map((lms, i) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        landmarks: lms.map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility ?? 1
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        worldLandmarks: (raw.worldLandmarks[i] ?? []).map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility ?? 1
        }))
      })),
      timestamp: performance.now()
    };
  }
}

new BodyWorker().setupMessageHandler();
