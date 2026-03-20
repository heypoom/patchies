/**
 * MediaPipe Image Segmenter worker.
 * Outputs a greyscale mask as an ImageBitmap for the video outlet,
 * and optionally emits raw mask data as a message.
 */

import { MediaPipeWorkerBase } from '$objects/mediapipe/MediaPipeWorkerBase';
import type { SegmentTaskOptions, SegmentOutput, TaskOptions } from '$objects/mediapipe/types';
import type { WorkerOutMessage } from '$objects/mediapipe/types';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

// Override processFrame for segment — needs to post segmentBitmap not result
class SegmentWorker extends MediaPipeWorkerBase<
  import('@mediapipe/tasks-vision').ImageSegmenter,
  import('@mediapipe/tasks-vision').ImageSegmenterResult
> {
  private segmentOptions: SegmentTaskOptions | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async initTask(vision: any, options: TaskOptions) {
    const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
    this.segmentOptions = options as SegmentTaskOptions;
    const opts = options as SegmentTaskOptions;

    return ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: opts.delegate ?? 'GPU'
      },
      runningMode: 'IMAGE',
      outputCategoryMask: opts.maskType === 'category',
      outputConfidenceMasks: opts.maskType === 'confidence'
    });
  }

  protected detectFrame(
    task: import('@mediapipe/tasks-vision').ImageSegmenter,
    bitmap: ImageBitmap,
    _timestamp: number
  ) {
    return task.segment(bitmap);
  }

  protected formatResult(
    _raw: import('@mediapipe/tasks-vision').ImageSegmenterResult
  ): SegmentOutput {
    // Not used — segment worker overrides processFrame
    return { width: 0, height: 0, mask: new Uint8Array(0), maskType: 'category', timestamp: 0 };
  }

  // Override processFrame to produce segmentBitmap
  processFrame(bitmap: ImageBitmap, timestamp: number): void {
    if (!this.task || this.segmentOptions === null) {
      bitmap.close();
      return;
    }

    const width = bitmap.width;
    const height = bitmap.height;

    try {
      const raw = this.detectFrame(this.task, bitmap, timestamp);
      const isCategoryMask = this.segmentOptions.maskType === 'category';

      const maskData = isCategoryMask
        ? raw.categoryMask?.getAsUint8Array()
        : raw.confidenceMasks?.[0]?.getAsFloat32Array();

      if (!maskData) {
        bitmap.close();
        return;
      }

      // Build greyscale pixel data for ImageBitmap
      const imageData = new ImageData(width, height);
      const pixels = imageData.data;

      if (isCategoryMask) {
        const uint8 = maskData as Uint8Array;
        for (let i = 0; i < uint8.length; i++) {
          const v = uint8[i] > 0 ? 255 : 0;
          pixels[i * 4] = v;
          pixels[i * 4 + 1] = v;
          pixels[i * 4 + 2] = v;
          pixels[i * 4 + 3] = 255;
        }
      } else {
        const float32 = maskData as Float32Array;
        for (let i = 0; i < float32.length; i++) {
          const v = Math.round(float32[i] * 255);
          pixels[i * 4] = v;
          pixels[i * 4 + 1] = v;
          pixels[i * 4 + 2] = v;
          pixels[i * 4 + 3] = 255;
        }
      }

      createImageBitmap(imageData).then((maskBitmap) => {
        const msg: WorkerOutMessage = { type: 'segmentBitmap', bitmap: maskBitmap };

        if (this.segmentOptions?.outputMessage) {
          const cloned = isCategoryMask
            ? new Uint8Array(maskData as Uint8Array)
            : new Float32Array(maskData as Float32Array);

          (msg as { messageData?: SegmentOutput }).messageData = {
            width,
            height,
            mask: cloned,
            maskType: this.segmentOptions.maskType,
            timestamp
          };
        }

        self.postMessage(msg, { transfer: [maskBitmap] });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (raw as any).close?.();
      bitmap.close();
    } catch (err) {
      bitmap.close();
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', message });
    }
  }
}

new SegmentWorker().setupMessageHandler();
