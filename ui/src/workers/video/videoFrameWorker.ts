/**
 * Video Frame Worker
 *
 * Processes VideoFrames from MediaStreamTrackProcessor (webcam capture).
 * Converts VideoFrames to ImageBitmaps with flipY for GPU texture upload.
 *
 * This worker offloads frame processing from the main thread for better performance.
 */

import { match } from 'ts-pattern';

// ============================================================================
// Message Types
// ============================================================================

export type VideoFrameWorkerMessage =
  | {
      type: 'processFrame';
      nodeId: string;
      frame: VideoFrame;
    }
  | {
      type: 'setConfig';
      nodeId: string;
      flipY: boolean;
    }
  | {
      type: 'destroy';
      nodeId: string;
    };

export type VideoFrameWorkerResponse =
  | {
      type: 'frameReady';
      nodeId: string;
      bitmap: ImageBitmap;
      timestamp: number;
    }
  | {
      type: 'error';
      nodeId: string;
      message: string;
    }
  | {
      type: 'destroyed';
      nodeId: string;
    };

// ============================================================================
// Worker State
// ============================================================================

interface NodeConfig {
  flipY: boolean;
}

const nodeConfigs = new Map<string, NodeConfig>();

// ============================================================================
// Frame Processing
// ============================================================================

async function processFrame(nodeId: string, frame: VideoFrame): Promise<void> {
  try {
    const config = nodeConfigs.get(nodeId) ?? { flipY: true };

    // Create ImageBitmap from VideoFrame with flipY for GPU orientation
    const bitmap = await createImageBitmap(frame, {
      imageOrientation: config.flipY ? 'flipY' : 'none'
    });

    // CRITICAL: Close the VideoFrame to release GPU memory
    frame.close();

    const response: VideoFrameWorkerResponse = {
      type: 'frameReady',
      nodeId,
      bitmap,
      timestamp: frame.timestamp ?? performance.now()
    };

    // Transfer the bitmap to avoid copying
    self.postMessage(response, { transfer: [bitmap] });
  } catch (error) {
    // Make sure to close the frame even on error
    frame.close();

    const response: VideoFrameWorkerResponse = {
      type: 'error',
      nodeId,
      message: error instanceof Error ? error.message : 'Failed to process frame'
    };
    self.postMessage(response);
  }
}

function setConfig(nodeId: string, flipY: boolean): void {
  nodeConfigs.set(nodeId, { flipY });
}

function destroy(nodeId: string): void {
  nodeConfigs.delete(nodeId);

  const response: VideoFrameWorkerResponse = {
    type: 'destroyed',
    nodeId
  };
  self.postMessage(response);
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = (event: MessageEvent<VideoFrameWorkerMessage>) => {
  const message = event.data;

  match(message)
    .with({ type: 'processFrame' }, ({ nodeId, frame }) => {
      processFrame(nodeId, frame);
    })
    .with({ type: 'setConfig' }, ({ nodeId, flipY }) => {
      setConfig(nodeId, flipY);
    })
    .with({ type: 'destroy' }, ({ nodeId }) => {
      destroy(nodeId);
    })
    .exhaustive();
};
