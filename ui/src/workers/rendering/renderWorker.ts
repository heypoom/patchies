import { match } from 'ts-pattern';

import type { RenderGraph } from '../../lib/rendering/types.js';
import { FBORenderer } from './fboRenderer.js';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem.js';
import { handleVfsUrlResolved } from './vfsWorkerUtils.js';

const fboRenderer: FBORenderer = new FBORenderer();

let isRunning: boolean = false;

self.onmessage = (event) => {
  const { type, ...data } = event.data;

  match(type)
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
    .with('setFFTData', () => handleSetFFTData(data))
    .with('updateJSModule', () => fboRenderer.updateJSModule(data.moduleName, data.code))
    .with('enableProfiling', () => fboRenderer.setProfilingEnabled(data.enabled))
    .with('flushFrameStats', () => {
      const stats = fboRenderer.flushFrameStats();

      self.postMessage({ type: 'frameStats', stats });
    })
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
      handleCaptureWorkerVideoFrames(data.targetNodeId, data.sourceNodeIds);
    })
    .with('captureWorkerVideoFramesBatch', () => {
      handleCaptureWorkerVideoFramesBatch(data.requests);
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
      const outputBitmap = fboRenderer.getOutputBitmap();

      if (outputBitmap) {
        self.postMessage({ type: 'animationFrame', outputBitmap }, { transfer: [outputBitmap] });
      }
    }

    if (fboRenderer.shouldProcessPreviews) {
      const previewBitmaps = fboRenderer.renderPreviewBitmaps();

      for (const [nodeId, bitmap] of previewBitmaps) {
        self.postMessage({ type: 'previewFrame', nodeId, bitmap }, { transfer: [bitmap] });
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
function handleCaptureWorkerVideoFrames(targetNodeId: string, sourceNodeIds: (string | null)[]) {
  const frames: (ImageBitmap | null)[] = [];
  const transferList: ImageBitmap[] = [];

  for (const sourceNodeId of sourceNodeIds) {
    if (!sourceNodeId) {
      frames.push(null);
      continue;
    }

    const bitmap = fboRenderer.capturePreviewBitmap(sourceNodeId);
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
 * Deduplicates source node captures to avoid redundant GPU reads.
 *
 * Note: Since ImageBitmaps can only be transferred once, when multiple targets
 * request the same source, only the first target gets the original bitmap.
 * Other targets needing the same source get null (they'll get it next frame).
 *
 * For true deduplication with copies, we'd need async createImageBitmap calls,
 * which would add latency. The current approach prioritizes low latency.
 */
function handleCaptureWorkerVideoFramesBatch(
  requests: Array<{ targetNodeId: string; sourceNodeIds: (string | null)[] }>
) {
  // Collect all unique source node IDs across all requests
  const uniqueSourceIds = new Set<string>();
  for (const request of requests) {
    for (const sourceId of request.sourceNodeIds) {
      if (sourceId) uniqueSourceIds.add(sourceId);
    }
  }

  // Capture each unique source once (the expensive GPU read happens here)
  const capturedBitmaps = new Map<string, ImageBitmap | null>();
  for (const sourceId of uniqueSourceIds) {
    capturedBitmaps.set(sourceId, fboRenderer.capturePreviewBitmap(sourceId));
  }

  // Track which bitmaps have been assigned (can only transfer each once)
  const assignedBitmaps = new Set<ImageBitmap>();

  // Build results for each target node
  const results: Array<{ targetNodeId: string; frames: (ImageBitmap | null)[] }> = [];
  const transferList: ImageBitmap[] = [];

  for (const request of requests) {
    const frames: (ImageBitmap | null)[] = [];

    for (const sourceId of request.sourceNodeIds) {
      if (!sourceId) {
        frames.push(null);
        continue;
      }

      const bitmap = capturedBitmaps.get(sourceId) ?? null;

      // Only assign bitmap to first target that requests it
      if (bitmap && !assignedBitmaps.has(bitmap)) {
        frames.push(bitmap);
        assignedBitmaps.add(bitmap);
        transferList.push(bitmap);
      } else {
        // Bitmap already assigned to another target or was null
        frames.push(null);
      }
    }

    results.push({ targetNodeId: request.targetNodeId, frames });
  }

  self.postMessage(
    {
      type: 'workerVideoFramesCapturedBatch',
      results,
      timestamp: performance.now()
    },
    { transfer: transferList }
  );
}

console.log('[render worker] initialized');
