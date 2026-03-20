/**
 * MediaPipe Face Landmarker worker.
 */

import { MediaPipeWorkerBase } from '$lib/mediapipe/MediaPipeWorkerBase';
import type { FaceTaskOptions, FaceOutput, TaskOptions } from '$lib/mediapipe/types';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

class FaceWorker extends MediaPipeWorkerBase<
  import('@mediapipe/tasks-vision').FaceLandmarker,
  import('@mediapipe/tasks-vision').FaceLandmarkerResult
> {
  protected async initTask(
    vision: import('@mediapipe/tasks-vision').WasmFileset,
    options: TaskOptions
  ) {
    const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
    const opts = options as FaceTaskOptions;

    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: opts.delegate ?? 'GPU'
      },
      runningMode: 'IMAGE',
      numFaces: opts.numFaces ?? 1,
      outputFaceBlendshapes: opts.blendshapes ?? false,
      outputFacialTransformationMatrixes: false
    });
  }

  protected detectFrame(
    task: import('@mediapipe/tasks-vision').FaceLandmarker,
    bitmap: ImageBitmap,
    _timestamp: number
  ) {
    return task.detect(bitmap);
  }

  protected formatResult(raw: import('@mediapipe/tasks-vision').FaceLandmarkerResult): FaceOutput {
    return {
      faces: raw.faceLandmarks.map((lms, i) => {
        const face: FaceOutput['faces'][number] = {
          landmarks: lms.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }))
        };

        if (raw.faceBlendshapes?.[i]) {
          face.blendshapes = raw.faceBlendshapes[i].categories.map((c) => ({
            categoryName: c.categoryName,
            score: c.score
          }));
        }

        return face;
      }),
      timestamp: performance.now()
    };
  }
}

new FaceWorker().setupMessageHandler();
