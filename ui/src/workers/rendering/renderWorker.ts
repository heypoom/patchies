import { match } from 'ts-pattern';

import { PatchStorageService } from '$lib/storage/PatchStorageService';
import { handleVfsTextResolved } from '$lib/glsl-include/vfs-resolver';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';

import { FBORenderer } from './fboRenderer';
import { handleVfsPathsResolved, handleVfsUrlResolved } from './vfsWorkerUtils';
import { MediaBunnyService } from './MediaBunnyService';
import { RenderWorkerLifecycle } from './RenderWorkerLifecycle';

import type { RenderGraph } from '../../lib/rendering/types';

export function installRenderWorkerRuntime() {
  const fboRenderer: FBORenderer = new FBORenderer();

  const mediaBunnyService = new MediaBunnyService({
    setBitmap: (nodeId, bitmap) => fboRenderer.setBitmap(nodeId, bitmap),
    postMessage: (message, transfer) => self.postMessage(message, { transfer: transfer ?? [] })
  });

  const lifecycle = new RenderWorkerLifecycle();

  const resolveCaptureSource = fboRenderer.videoSources.resolveCaptureSource.bind(
    fboRenderer.videoSources
  );

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
      .with('buildRenderGraph', () =>
        handleBuildRenderGraph(data.graph, new Set(data.connectedVideoOutputNodeIds ?? []))
      )
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
        fboRenderer.setMouseData(data.nodeId, data.x, data.y, data.z, data.w, data.buttons)
      )
      .with('zoomShaderParkOrbit', () => fboRenderer.zoomShaderParkOrbit(data.nodeId, data.deltaY))
      .with('sendThreeWheelData', () =>
        fboRenderer.sendThreeWheelData(data.nodeId, {
          x: data.x,
          y: data.y,
          deltaX: data.deltaX,
          deltaY: data.deltaY,
          deltaMode: data.deltaMode
        })
      )
      .with('resetThreeOrbitControls', () => fboRenderer.resetThreeOrbitControls(data.nodeId))
      .with('setOutputSize', () => fboRenderer.setOutputSize(data.width, data.height))
      .with('setBackgroundSize', () => fboRenderer.setBackgroundSize(data.width, data.height))
      .with('setBitmap', () => fboRenderer.setBitmap(data.nodeId, data.bitmap))
      .with('setElementImage', () =>
        fboRenderer.setElementImage(data.nodeId, data.elementImage, data.width, data.height)
      )
      .with('setFloatTexture', () => {
        const textureData = data.data;

        if (!(textureData instanceof Float32Array)) {
          console.warn('[renderWorker] Invalid setFloatTexture payload: data must be Float32Array');
          return;
        }

        const buffer = textureData.buffer;
        const textureFormat = data.textureFormat ?? 'rgba32f';

        if (buffer instanceof SharedArrayBuffer) {
          fboRenderer.setFloatTexture(
            data.nodeId,
            data.width,
            data.height,
            textureData,
            textureFormat
          );

          return;
        }

        try {
          fboRenderer.setFloatTexture(
            data.nodeId,
            data.width,
            data.height,
            textureData,
            textureFormat
          );
        } finally {
          self.postMessage(
            {
              type: 'floatTextureBufferReleased',
              nodeId: data.nodeId,
              buffer
            },
            { transfer: [buffer] }
          );
        }
      })
      .with('setVideoFrame', () => {
        const frame = data.frame;

        if (!(frame?.data instanceof Uint8ClampedArray)) {
          console.warn(
            '[renderWorker] Invalid setVideoFrame payload: data must be Uint8ClampedArray'
          );
          return;
        }

        fboRenderer.setVideoFrame(data.nodeId, frame.width, frame.height, frame.data);
      })
      .with('removeBitmap', () => fboRenderer.videoTextures.removeBitmap(data.nodeId))
      .with('removeUniformData', () => fboRenderer.uniformDataByNode.delete(data.nodeId))
      .with('sendMessageToNode', () => fboRenderer.sendMessageToNode(data.nodeId, data.message))
      .with('toggleNodePause', () => fboRenderer.toggleNodePause(data.nodeId))
      .with('capturePreview', () =>
        handleCapturePreview(data.nodeId, data.requestId, data.customSize)
      )
      .with('updateProjectionMap', () =>
        fboRenderer.updateProjectionMap(data.nodeId, data.surfaces)
      )
      .with('setFFTData', () => handleSetFFTData(data))
      .with('updateJSModule', () => fboRenderer.updateJSModule(data.moduleName, data.code))
      .with('profilerEnable', () => fboRenderer.setProfilingEnabled(data.enabled))
      .with('setRenderFpsCap', () => fboRenderer.setRenderFpsCap(data.fps))
      .with('setCookStatsEnabled', () => fboRenderer.setCookStatsEnabled(data.enabled))
      .with('setMaxPreviewsPerFrame', () => {
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
      .with('setAllPreviewsDisabled', () => {
        fboRenderer.previewRenderer.setAllPreviewsDisabled(data.disabled as boolean);
      })
      .with('setPreviewScaleMultiplier', () => {
        fboRenderer.previewRenderer.setPreviewScaleMultiplier(data.multiplier as number);
      })
      .with('vfsUrlResolved', () => {
        handleVfsUrlResolved(data);
      })
      .with('vfsPathsResolved', () => {
        handleVfsPathsResolved(data);
      })
      .with('vfsTextResolved', () => {
        handleVfsTextResolved(data);
      })
      .with('captureWorkerVideoFrames', () => {
        handleCaptureWorkerVideoFrames(
          data.targetNodeId,
          data.requestId,
          data.sourceNodeIds,
          data.resolution,
          data.format
        );
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
        fboRenderer.setOverrideOutputNode(data.nodeId ?? null);
      })
      .with('channelMessage', () => {
        fboRenderer.sendChannelMessageToNode(
          data.nodeId,
          data.channel,
          data.data,
          data.sourceNodeId
        );
      })
      .with('settingsValuesInit', () => {
        fboRenderer.settingsRegistry.receiveValues(data.nodeId, data.requestId, data.values);
      })
      .with('settingsValueChanged', () => {
        fboRenderer.settingsRegistry.receiveValueChanged(data.nodeId, data.key, data.value);
      });
  };

  // Serializes buildFBOs calls: only one runs at a time, and if a new request
  // arrives while one is in-flight, the latest graph is queued and built after
  // the current build finishes. This prevents race conditions when setPortCount
  // messages trigger rebuilds during the initial build's async Phase 2.
  let buildInProgress = false;

  let pendingBuild: {
    graph: RenderGraph;
    connectedVideoOutputNodeIds: Set<string>;
  } | null = null;

  async function handleBuildRenderGraph(
    graph: RenderGraph,
    connectedVideoOutputNodeIds: Set<string> = new Set()
  ) {
    if (buildInProgress) {
      // A build is running — queue the latest graph (drop any previously queued one)
      pendingBuild = { graph, connectedVideoOutputNodeIds };
      return;
    }

    buildInProgress = true;

    try {
      await fboRenderer.buildFBOs(graph, connectedVideoOutputNodeIds);

      startRenderLoopIfReady();
    } catch (error) {
      if (error instanceof Error) {
        self.postMessage({
          type: 'error',
          message: 'failed to build render graph: ' + error.message
        });
      }
    } finally {
      buildInProgress = false;

      // If a new graph was queued while we were building, build it now
      if (pendingBuild) {
        const next = pendingBuild;

        pendingBuild = null;
        handleBuildRenderGraph(next.graph, next.connectedVideoOutputNodeIds);
      }
    }
  }

  function handleStartAnimation() {
    lifecycle.requestStart();
    startRenderLoopIfReady();
  }

  function startRenderLoopIfReady() {
    if (!lifecycle.takeStart(Boolean(fboRenderer.renderGraph))) return;

    fboRenderer.startRenderLoop(() => {
      // do not render if there are no nodes and edges
      if (
        fboRenderer.renderGraph?.nodes?.length === 0 &&
        fboRenderer.renderGraph?.edges?.length === 0
      ) {
        return;
      }

      if (fboRenderer.isOutputEnabled) {
        // Profiler: forcibly forces gl sync to measure GL rendering time.
        // Never do this outside of profiling, as it slows down rendering!
        if (fboRenderer.isProfilingEnabled) {
          fboRenderer.profiler.measureOp('finish', () => fboRenderer.gl.finish());
        }

        const outputBitmap = fboRenderer.profiler.measureOp('transfer', () =>
          fboRenderer.offscreenCanvas.transferToImageBitmap()
        );

        if (outputBitmap) {
          self.postMessage({ type: 'animationFrame', outputBitmap }, { transfer: [outputBitmap] });
        }
      }

      if (fboRenderer.shouldProcessPreviews) {
        const previewBitmaps = fboRenderer.profiler.measureOp('preview', () =>
          fboRenderer.renderPreviewBitmaps()
        );

        for (const [nodeId, bitmap] of previewBitmaps) {
          self.postMessage({ type: 'previewFrame', nodeId, bitmap }, { transfer: [bitmap] });
        }
      }

      // Harvest any completed async video frame captures
      if (fboRenderer.captureRenderer.hasPendingVideoFrames()) {
        const completedBatches = fboRenderer.profiler.measureOp('video', () =>
          fboRenderer.captureRenderer.harvestVideoFrameBatches()
        );

        if (completedBatches.length > 0) {
          // Transfer bitmap handles or raw pixel buffers without cloning.
          const transferList: Transferable[] = [];

          for (const batch of completedBatches) {
            for (const frame of batch.frames) {
              if (frame instanceof ImageBitmap) transferList.push(frame);
              else if (frame) transferList.push(frame.data.buffer as ArrayBuffer);
            }
          }

          self.postMessage(
            {
              type: 'workerVideoFramesCapturedBatch',
              results: completedBatches.map((b) => ({
                targetNodeId: b.targetNodeId,
                requestId: b.requestId,
                frames: b.frames
              })),
              timestamp: performance.now()
            },
            { transfer: transferList }
          );
        }
      }

      // Record frame timing for profiling
      fboRenderer.profiler.recordFrameTime();
    });
  }

  function handleStopAnimation() {
    lifecycle.stop();
    fboRenderer.stopRenderLoop();
  }

  function handleSetPreviewEnabled(nodeId: string, enabled: boolean) {
    fboRenderer.setPreviewEnabled(nodeId, enabled);

    self.postMessage({ type: 'previewToggled', nodeId, enabled });
  }

  function handleSetFFTData(payload: AudioAnalysisPayloadWithType) {
    // GLSL consumes FFT as textures
    if (payload.nodeType === 'glsl') {
      if (fboRenderer.fftTextures.update(payload)) {
        fboRenderer.cookState.markDirty(payload.nodeId, 'fft');
      }

      return;
    }

    fboRenderer.nodeRenderers.setFFTData(payload);
  }

  function handleCapturePreview(nodeId: string, requestId?: string, customSize?: [number, number]) {
    const bitmap = fboRenderer.captureRenderer.capturePreviewBitmap(
      nodeId,
      resolveCaptureSource,
      customSize
    );

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
    requestId: string | undefined,
    sourceNodeIds: (string | null)[],
    resolution?: [number, number],
    format: 'raw' | 'bitmap' = 'raw'
  ) {
    if (format === 'raw') {
      fboRenderer.captureRenderer.initiateVideoFrameCaptureAsync(
        [{ targetNodeId, requestId, sourceNodeIds, resolution, format }],
        resolveCaptureSource,
        fboRenderer.fboNodes,
        fboRenderer.videoTextures.destinationTextures
      );

      return;
    }

    const frames: (ImageBitmap | null)[] = [];
    const transferList: ImageBitmap[] = [];

    for (const sourceNodeId of sourceNodeIds) {
      if (!sourceNodeId) {
        frames.push(null);
        continue;
      }

      const bitmap = fboRenderer.captureRenderer.capturePreviewBitmap(
        sourceNodeId,
        resolveCaptureSource,
        resolution
      );
      frames.push(bitmap);

      if (bitmap) {
        transferList.push(bitmap);
      }
    }

    self.postMessage(
      {
        type: 'workerVideoFramesCaptured',
        targetNodeId,
        requestId,
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
      requestId?: string;
      sourceNodeIds: (string | null)[];
      resolution?: [number, number];
      format?: 'raw' | 'bitmap';
    }>
  ) {
    // Initiate async captures - results will be harvested in the render loop
    fboRenderer.captureRenderer.initiateVideoFrameCaptureAsync(
      requests,
      resolveCaptureSource,
      fboRenderer.fboNodes,
      fboRenderer.videoTextures.destinationTextures
    );
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

        const bitmap = fboRenderer.captureRenderer.capturePreviewBitmap(
          sourceNodeId,
          resolveCaptureSource,
          request.resolution
        );
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
}
