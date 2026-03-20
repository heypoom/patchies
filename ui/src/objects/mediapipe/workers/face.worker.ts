/**
 * MediaPipe Face Landmarker / Face Detector worker.
 * Supports two modes:
 *   - 'landmarks' (default): 478-point face mesh via FaceLandmarker
 *   - 'detect': fast bounding-box detection via FaceDetector
 */

import { MediaPipeWorkerBase } from '$objects/mediapipe/MediaPipeWorkerBase';
import type { FaceTaskOptions, FaceOutput, TaskOptions } from '$objects/mediapipe/types';

const LANDMARK_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

const DETECT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class FaceWorker extends MediaPipeWorkerBase<any, any> {
  private faceOptions: FaceTaskOptions | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async initTask(vision: any, options: TaskOptions) {
    const opts = options as FaceTaskOptions;
    this.faceOptions = opts;

    if (opts.mode === 'detect') {
      const { FaceDetector } = await import('@mediapipe/tasks-vision');
      return FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: DETECT_MODEL_URL,
          delegate: opts.delegate ?? 'GPU'
        },
        runningMode: 'VIDEO'
      });
    } else {
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: LANDMARK_MODEL_URL,
          delegate: opts.delegate ?? 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: opts.numFaces ?? 1,
        outputFaceBlendshapes: opts.blendshapes ?? false,
        outputFacialTransformationMatrixes: false
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected detectFrame(task: any, bitmap: ImageBitmap, timestamp: number) {
    return task.detectForVideo(bitmap, timestamp);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected formatResult(raw: any): FaceOutput {
    if (this.faceOptions?.mode === 'detect') {
      return {
        faces: raw.detections.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) => ({
            boundingBox: d.boundingBox
              ? {
                  originX: d.boundingBox.originX,
                  originY: d.boundingBox.originY,
                  width: d.boundingBox.width,
                  height: d.boundingBox.height
                }
              : undefined,

            score: d.categories[0]?.score ?? 0,

            keypoints: d.keypoints?.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (kp: any) => ({ x: kp.x, y: kp.y, label: kp.label })
            )
          })
        ),
        timestamp: performance.now()
      };
    }

    // landmarks mode (FaceLandmarkerResult)
    return {
      faces: raw.faceLandmarks.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (lms: any, i: number) => {
          const face: FaceOutput['faces'][number] = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            landmarks: lms.map((lm: any) => ({ x: lm.x, y: lm.y, z: lm.z }))
          };

          if (raw.faceBlendshapes?.[i]) {
            face.blendshapes = raw.faceBlendshapes[i].categories.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (c: any) => ({
                categoryName: c.categoryName,
                score: c.score
              })
            );
          }

          return face;
        }
      ),
      timestamp: performance.now()
    };
  }
}

new FaceWorker().setupMessageHandler();
