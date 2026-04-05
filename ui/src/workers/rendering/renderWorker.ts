import { match } from 'ts-pattern';

import type { RenderGraph } from '../../lib/rendering/types.js';
import { FBORenderer } from './fboRenderer.js';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem.js';
import { handleVfsUrlResolved } from './vfsWorkerUtils.js';
import { MediaBunnyService } from './MediaBunnyService.js';
import { PatchStorageService } from '$lib/storage/PatchStorageService.js';

const fboRenderer: FBORenderer = new FBORenderer();

const mediaBunnyService = new MediaBunnyService({
  setBitmap: (nodeId, bitmap) => fboRenderer.setBitmap(nodeId, bitmap),
  postMessage: (message, transfer) => self.postMessage(message, { transfer: transfer ?? [] })
});

let isRunning: boolean = false;

/** Map of source worker nodeId → MessagePort for direct messaging */
const workerRenderPorts = new Map<string, MessagePort>();

self.onmessage = (event) => {
  const { type, ...data } = event.data;

  // Route MediaBunny messages to dedicated service
  if (mediaBunnyService.handleMessage(type, data)) {
    return;
  }

  match(type)
    .with('setPatchId', () => {
      PatchStorageService.getInstance().setPatchId(data.patchId);
    })
    .with('buildRenderGraph', () => handleBuildRenderGraph(data.graph))
    .with('startAnimation', () => handleStartAnimation())
    .with('stopAnimation', () => handleStopAnimation())
    .with('setPreviewEnabled', () => handleSetPreviewEnabled(data.nodeId, data.enabled))
    .with('setOutputEnabled', () => {
      fboRenderer.isOutputEnabled = data.enabled;
    })
    .with('setUniformData', () =>
      fboRenderer.setUniformData(data.nodeId, data.uniformName, data.uniformValue)
    )
    .with('setMouseData', () =>
      fboRenderer.setMouseData(data.nodeId, data.x, data.y, data.z, data.w)
    )
    .with('setPreviewSize', () => fboRenderer.setPreviewSize(data.width, data.height))
    .with('setOutputSize', () => fboRenderer.setOutputSize(data.width, data.height))
    .with('setBitmap', () => fboRenderer.setBitmap(data.nodeId, data.bitmap))
    .with('removeBitmap', () => fboRenderer.removeBitmap(data.nodeId))
    .with('removeUniformData', () => fboRenderer.removeUniformData(data.nodeId))
    .with('sendMessageToNode', () => fboRenderer.sendMessageToNode(data.nodeId, data.message))
    .with('toggleNodePause', () => handleToggleNodePause(data.nodeId))
    .with('capturePreview', () =>
      handleCapturePreview(data.nodeId, data.requestId, data.customSize)
    )
    .with('updateHydra', () => handleUpdateHydra(data.nodeId))
    .with('updateCanvas', () => handleUpdateCanvas(data.nodeId))
    .with('updateTextmode', () => handleUpdateTextmode(data.nodeId))
    .with('updateThree', () => handleUpdateThree(data.nodeId))
    .with('updateRegl', () => handleUpdateRegl(data.nodeId))
    .with('updateSwgl', () => handleUpdateSwgl(data.nodeId))
    .with('updateProjectionMap', () => fboRenderer.updateProjectionMap(data.nodeId, data.surfaces))
    .with('setFFTData', () => handleSetFFTData(data))
    .with('updateJSModule', () => fboRenderer.updateJSModule(data.moduleName, data.code))
    .with('profilerEnable', () => fboRenderer.setProfilingEnabled(data.enabled))
    .with('setRenderFpsCap', () => fboRenderer.setRenderFpsCap(data.fps))
    .with('setMaxPreviewsPerFrame', () => {
      console.log('setMax::hasOutputNode', fboRenderer.isOutputEnabled);

      if (data.max !== undefined) {
        fboRenderer.previewRenderer.maxPreviewsPerFrame = data.max;
      }

      if (data.maxNoOutput !== undefined) {
        fboRenderer.previewRenderer.maxPreviewsPerFrameNoOutput = data.maxNoOutput;
      }
    })
    .with('setVisibleNodes', () => {
      fboRenderer.setVisibleNodes(new Set(data.nodeIds as string[]));
    })
    .with('vfsUrlResolved', () => {
      handleVfsUrlResolved(data);
    })
    .with('captureWorkerVideoFrames', () => {
      handleCaptureWorkerVideoFrames(data.targetNodeId, data.sourceNodeIds, data.resolution);
    })
    .with('captureWorkerVideoFramesBatch', () => {
      handleCaptureWorkerVideoFramesBatch(data.requests);
    })
    .with('captureMediaPipeVideoFramesBatch', () => {
      handleCaptureMediaPipeVideoFramesBatch(data.requests);
    })
    .with('registerWorkerRenderPort', () => {
      handleRegisterWorkerRenderPort(data.nodeId, event.ports[0]);
    })
    .with('unregisterWorkerRenderPort', () => {
      handleUnregisterWorkerRenderPort(data.nodeId);
    })
    .with('syncTransportTime', () => {
      fboRenderer.setTransportTime(data);
    })
    .with('setOverrideOutputNode', () => {
      fboRenderer.overrideOutputNodeId = data.nodeId ?? null;
    })
    .with('channelMessage', () => {
      fboRenderer.sendChannelMessageToNode(data.nodeId, data.channel, data.data, data.sourceNodeId);
    })
    .with('settingsValuesInit', () => {
      fboRenderer.receiveSettingsValues(data.nodeId, data.requestId, data.values);
    })
    .with('settingsValueChanged', () => {
      fboRenderer.receiveSettingsValueChanged(data.nodeId, data.key, data.value);
    });
};

async function handleBuildRenderGraph(graph: RenderGraph) {
  try {
    await fboRenderer.buildFBOs(graph);
  } catch (error) {
    if (error instanceof Error) {
      self.postMessage({
        type: 'error',
        message: 'failed to build render graph: ' + error.message
      });
    }
  }
}

function handleStartAnimation() {
  if (!fboRenderer.renderGraph) {
    return;
  }

  if (isRunning) {
    return;
  }

  isRunning = true;

  fboRenderer.startRenderLoop(() => {
    // do not render if there are no nodes and edges
    if (
      fboRenderer.renderGraph?.nodes?.length === 0 &&
      fboRenderer.renderGraph?.edges?.length === 0
    ) {
      return;
    }

    if (fboRenderer.isOutputEnabled) {
      const outputBitmap = fboRenderer.measureOp('transfer', () => fboRenderer.getOutputBitmap());

      if (outputBitmap) {
        self.postMessage({ type: 'animationFrame', outputBitmap }, { transfer: [outputBitmap] });
      }
    }

    if (fboRenderer.shouldProcessPreviews) {
      const previewBitmaps = fboRenderer.measureOp('preview', () =>
        fboRenderer.renderPreviewBitmaps()
      );

      for (const [nodeId, bitmap] of previewBitmaps) {
        self.postMessage({ type: 'previewFrame', nodeId, bitmap }, { transfer: [bitmap] });
      }
    }

    // Harvest any completed async video frame captures
    if (fboRenderer.hasPendingVideoFrames()) {
      const completedBatches = fboRenderer.measureOp('video', () =>
        fboRenderer.harvestVideoFrames()
      );

      if (completedBatches.length > 0) {
        // Collect all bitmaps for transfer
        const transferList: ImageBitmap[] = [];
        for (const batch of completedBatches) {
          for (const frame of batch.frames) {
            if (frame) transferList.push(frame);
          }
        }

        self.postMessage(
          {
            type: 'workerVideoFramesCapturedBatch',
            results: completedBatches.map((b) => ({
              targetNodeId: b.targetNodeId,
              frames: b.frames
            })),
            timestamp: performance.now()
          },
          { transfer: transferList }
        );
      }
    }

    // Record frame timing for profiling
    fboRenderer.recordFrameTime();
  });
}

function handleStopAnimation() {
  isRunning = false;
  fboRenderer.stopRenderLoop();
}

function handleSetPreviewEnabled(nodeId: string, enabled: boolean) {
  fboRenderer.setPreviewEnabled(nodeId, enabled);

  self.postMessage({ type: 'previewToggled', nodeId, enabled });
}

function handleToggleNodePause(nodeId: string) {
  fboRenderer.toggleNodePause(nodeId);
}

function handleSetFFTData(payload: AudioAnalysisPayloadWithType) {
  const { nodeType, nodeId } = payload;

  match(nodeType)
    .with('hydra', () => {
      const hydraRenderer = fboRenderer.hydraByNode.get(nodeId);
      if (!hydraRenderer) return;

      hydraRenderer.setFFTData(payload);
    })
    .with('canvas', () => {
      const canvasRenderer = fboRenderer.canvasByNode.get(nodeId);
      if (!canvasRenderer) return;

      canvasRenderer.setFFTData(payload);
    })
    .with('textmode', () => {
      const textmodeRenderer = fboRenderer.textmodeByNode.get(nodeId);
      if (!textmodeRenderer) return;

      textmodeRenderer.setFFTData(payload);
    })
    .with('three', () => {
      const threeRenderer = fboRenderer.threeByNode.get(nodeId);
      if (!threeRenderer) return;

      threeRenderer.setFFTData(payload);
    })
    .with('regl', () => {
      const reglRenderer = fboRenderer.reglByNode.get(nodeId);
      if (!reglRenderer) return;

      reglRenderer.setFFTData(payload);
    })
    .with('swgl', () => {
      const swglRenderer = fboRenderer.swglByNode.get(nodeId);
      if (!swglRenderer) return;

      swglRenderer.setFFTData(payload);
    })
    .with('glsl', () => {
      fboRenderer.setFFTAsGlslUniforms(payload);
    })
    .exhaustive();
}

function handleUpdateHydra(nodeId: string) {
  const hydraRenderer = fboRenderer.hydraByNode.get(nodeId);
  if (!hydraRenderer) return;

  hydraRenderer.updateCode();
}

function handleUpdateCanvas(nodeId: string) {
  const canvasRenderer = fboRenderer.canvasByNode.get(nodeId);
  if (!canvasRenderer) return;

  canvasRenderer.updateCode();
}

function handleUpdateTextmode(nodeId: string) {
  const textmodeRenderer = fboRenderer.textmodeByNode.get(nodeId);
  if (!textmodeRenderer) return;

  textmodeRenderer.updateCode();
}

function handleUpdateThree(nodeId: string) {
  const threeRenderer = fboRenderer.threeByNode.get(nodeId);
  if (!threeRenderer) return;

  threeRenderer.updateCode();
}

function handleUpdateRegl(nodeId: string) {
  const reglRenderer = fboRenderer.reglByNode.get(nodeId);
  if (!reglRenderer) return;

  reglRenderer.updateCode();
}

function handleUpdateSwgl(nodeId: string) {
  const swglRenderer = fboRenderer.swglByNode.get(nodeId);
  if (!swglRenderer) return;

  swglRenderer.updateCode();
}

function handleCapturePreview(nodeId: string, requestId?: string, customSize?: [number, number]) {
  const bitmap = fboRenderer.capturePreviewBitmap(nodeId, customSize);

  if (bitmap) {
    self.postMessage(
      {
        type: 'previewFrameCaptured',
        success: true,
        nodeId,
        requestId,
        bitmap
      },
      { transfer: [bitmap] }
    );
    return;
  }

  self.postMessage({
    type: 'previewFrameCaptured',
    success: false,
    nodeId,
    requestId
  });
}

/**
 * Capture video frames from source nodes for a worker node.
 * This captures bitmaps from each connected source and sends them back to the main thread.
 */
function handleCaptureWorkerVideoFrames(
  targetNodeId: string,
  sourceNodeIds: (string | null)[],
  resolution?: [number, number]
) {
  const frames: (ImageBitmap | null)[] = [];
  const transferList: ImageBitmap[] = [];

  for (const sourceNodeId of sourceNodeIds) {
    if (!sourceNodeId) {
      frames.push(null);
      continue;
    }

    const bitmap = fboRenderer.capturePreviewBitmap(sourceNodeId, resolution);
    frames.push(bitmap);

    if (bitmap) {
      transferList.push(bitmap);
    }
  }

  self.postMessage(
    {
      type: 'workerVideoFramesCaptured',
      targetNodeId,
      frames,
      timestamp: performance.now()
    },
    { transfer: transferList }
  );
}

/**
 * Capture video frames for multiple worker nodes in a single batched request.
 * Uses async PBO reads to avoid blocking the GPU pipeline.
 *
 * Flow:
 * 1. Initiate async PBO reads for all unique source nodes
 * 2. Results are harvested in the render loop when GPU is done
 * 3. Completed frames are sent via workerVideoFramesCapturedBatch message
 */
function handleCaptureWorkerVideoFramesBatch(
  requests: Array<{
    targetNodeId: string;
    sourceNodeIds: (string | null)[];
    resolution?: [number, number];
  }>
) {
  // Initiate async captures - results will be harvested in the render loop
  fboRenderer.initiateVideoFrameCaptureAsync(requests);
}

/**
 * Capture video frames for multiple MediaPipe nodes in a single batched request.
 * Uses synchronous bitmap capture (same as handleCaptureWorkerVideoFrames),
 * responds with mediaPipeVideoFramesCapturedBatch.
 */
function handleCaptureMediaPipeVideoFramesBatch(
  requests: Array<{
    targetNodeId: string;
    sourceNodeIds: (string | null)[];
    resolution?: [number, number];
  }>
) {
  const results: Array<{
    targetNodeId: string;
    frames: (ImageBitmap | null)[];
  }> = [];

  const transferList: ImageBitmap[] = [];

  for (const request of requests) {
    const frames: (ImageBitmap | null)[] = [];

    for (const sourceNodeId of request.sourceNodeIds) {
      if (!sourceNodeId) {
        frames.push(null);
        continue;
      }

      const bitmap = fboRenderer.capturePreviewBitmap(sourceNodeId, request.resolution);
      frames.push(bitmap);

      if (bitmap) {
        transferList.push(bitmap);
      }
    }

    results.push({ targetNodeId: request.targetNodeId, frames });
  }

  self.postMessage(
    {
      type: 'mediaPipeVideoFramesCapturedBatch',
      results,
      timestamp: performance.now()
    },
    { transfer: transferList }
  );
}

/**
 * Register a MessagePort from a worker node for direct messaging.
 * Messages received on this port are routed directly to FBORenderer.
 */
function handleRegisterWorkerRenderPort(nodeId: string, port: MessagePort) {
  workerRenderPorts.set(nodeId, port);

  port.onmessage = (e) => {
    const { targetNodeId, inlet, inletKey, data, fromNodeId } = e.data;

    fboRenderer.sendMessageToNode(targetNodeId, {
      data,
      source: fromNodeId,
      inlet,
      inletKey
    });
  };

  port.start();
}

/**
 * Unregister a worker's render port when the worker is destroyed.
 */
function handleUnregisterWorkerRenderPort(nodeId: string) {
  const port = workerRenderPorts.get(nodeId);
  if (port) {
    port.close();
    workerRenderPorts.delete(nodeId);
  }
}

console.log('[render worker] initialized');
