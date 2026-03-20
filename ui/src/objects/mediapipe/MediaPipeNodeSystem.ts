/**
 * MediaPipeNodeSystem — singleton manager for MediaPipe vision nodes.
 *
 * Mirrors WorkerNodeSystem's batch video frame delivery pattern.
 * Runs a global rAF loop, collects frames from the render worker via GLSystem,
 * and routes results via MessageSystem.
 */

import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { MessageSystem } from '$lib/messages/MessageSystem';
import type { MediaPipeNodeOptions, TaskOptions, WorkerOutMessage } from './types';
import { GLSystem } from '$lib/canvas/GLSystem';

import HandWorker from './workers/hand.worker?worker';
import BodyWorker from './workers/body.worker?worker';
import FaceWorker from './workers/face.worker?worker';
import SegmentWorker from './workers/segment.worker?worker';
import DetectWorker from './workers/detect.worker?worker';

export type VisionStatus = 'idle' | 'initializing' | 'running' | 'error';

export interface VisionNodeState {
  worker: Worker;
  sourceNodeId: string | null;
  frameCounter: number;
  skipFrames: number;
  status: VisionStatus;
  error?: string;
  fps?: number;
  /** For vision.segment: the node registers itself in GLSystem */
  isSegment: boolean;
}

type StatusCallback = (status: VisionStatus, error?: string, fps?: number) => void;

export class MediaPipeNodeSystem {
  private static instance: MediaPipeNodeSystem | null = null;

  private eventBus = PatchiesEventBus.getInstance();
  private messageSystem = MessageSystem.getInstance();

  private nodes = new Map<string, VisionNodeState>();
  private statusCallbacks = new Map<string, StatusCallback>();

  private currentEdges: Array<{ source: string; target: string; targetHandle?: string | null }> =
    [];

  // Global rAF loop
  private rafId: number | null = null;
  private static readonly FRAME_INTERVAL_MS = 1000 / 30; // 30fps
  private lastFrameTime = 0;

  static getInstance(): MediaPipeNodeSystem {
    if (!this.instance) {
      this.instance = new MediaPipeNodeSystem();
    }
    return this.instance;
  }

  private createWorker(task: MediaPipeNodeOptions['task']): Worker {
    switch (task) {
      case 'hand':
        return new HandWorker();
      case 'body':
        return new BodyWorker();
      case 'face':
        return new FaceWorker();
      case 'segment':
        return new SegmentWorker();
      case 'detect':
        return new DetectWorker();
    }
  }

  register(nodeId: string, options: MediaPipeNodeOptions): void {
    if (this.nodes.has(nodeId)) {
      this.unregister(nodeId);
    }

    const worker = this.createWorker(options.task);
    const isSegment = options.task === 'segment';

    const state: VisionNodeState = {
      worker,
      sourceNodeId: this.findSourceNodeId(nodeId),
      frameCounter: 0,
      skipFrames: Math.max(1, options.skipFrames),
      status: 'initializing',
      isSegment
    };

    this.nodes.set(nodeId, state);

    // Register in GLSystem for segment (video outlet)
    if (isSegment) {
      GLSystem.getInstance().upsertNode(nodeId, 'img', {});
    }

    // Handle worker messages
    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      this.handleWorkerMessage(nodeId, event.data);
    };

    worker.onerror = (err) => {
      this.setStatus(nodeId, 'error', err.message);
    };

    // Initialize
    worker.postMessage({ type: 'init', task: options.task, options: options.taskOptions });

    this.startLoop();
  }

  unregister(nodeId: string): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    state.worker.postMessage({ type: 'destroy' });
    state.worker.terminate();

    if (state.isSegment) {
      GLSystem.getInstance().removeNode(nodeId);
    }

    this.nodes.delete(nodeId);
    this.statusCallbacks.delete(nodeId);

    if (this.nodes.size === 0 && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  updateSettings(nodeId: string, settings: Partial<TaskOptions>): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    if ('skipFrames' in settings && settings.skipFrames != null) {
      state.skipFrames = Math.max(1, settings.skipFrames as number);
    }

    state.worker.postMessage({ type: 'updateSettings', settings });
    this.setStatus(nodeId, 'initializing');
  }

  onStatusChange(nodeId: string, callback: StatusCallback): void {
    this.statusCallbacks.set(nodeId, callback);
  }

  offStatusChange(nodeId: string): void {
    this.statusCallbacks.delete(nodeId);
  }

  updateConnections(
    edges: Array<{ source: string; target: string; targetHandle?: string | null }>
  ): void {
    this.currentEdges = edges;

    for (const [nodeId, state] of this.nodes) {
      state.sourceNodeId = this.findSourceNodeId(nodeId);
    }
  }

  deliverVideoFrames(nodeId: string, frames: (ImageBitmap | null)[], timestamp: number): void {
    const state = this.nodes.get(nodeId);
    if (!state) {
      frames.forEach((f) => f?.close());
      return;
    }

    const bitmap = frames[0];
    if (!bitmap) {
      console.debug('[MediaPipe] null bitmap for', nodeId, '— source node may not be rendering');
      frames.forEach((f) => f?.close());
      return;
    }

    // Close unused frames
    for (let i = 1; i < frames.length; i++) {
      frames[i]?.close();
    }

    state.worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]);
  }

  private findSourceNodeId(nodeId: string): string | null {
    const edge = this.currentEdges.find(
      (e) => e.target === nodeId && (e.targetHandle === 'video-in' || e.targetHandle === null)
    );

    return edge?.source ?? null;
  }

  private handleWorkerMessage(nodeId: string, msg: WorkerOutMessage): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    if (msg.type === 'ready') {
      this.setStatus(nodeId, 'running');
    } else if (msg.type === 'error') {
      this.setStatus(nodeId, 'error', msg.message);
    } else if (msg.type === 'fps') {
      if (state.status === 'running') {
        state.fps = msg.value;
        this.statusCallbacks.get(nodeId)?.(state.status, state.error, msg.value);
      }
    } else if (msg.type === 'result') {
      // Route message out via MessageSystem (outlet 0)
      this.messageSystem.sendMessage(nodeId, msg.data, { to: 0 });
      if (state.status !== 'running') {
        this.setStatus(nodeId, 'running');
      }
    } else if (msg.type === 'segmentBitmap') {
      // vision.segment: push greyscale mask bitmap to GLSystem for video outlet
      GLSystem.getInstance().setBitmap(nodeId, msg.bitmap);

      // Optionally also emit message on outlet 1
      if (msg.messageData) {
        this.messageSystem.sendMessage(nodeId, msg.messageData, { to: 1 });
      }

      if (state.status !== 'running') {
        this.setStatus(nodeId, 'running');
      }
    }
  }

  private setStatus(nodeId: string, status: VisionStatus, error?: string): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    state.status = status;
    state.error = error;
    this.statusCallbacks.get(nodeId)?.(status, error, state.fps);
  }

  private startLoop(): void {
    if (this.rafId !== null) return;

    const loop = (now: number) => {
      const hasNodes = this.nodes.size > 0;
      if (!hasNodes) {
        this.rafId = null;
        return;
      }

      if (now - this.lastFrameTime >= MediaPipeNodeSystem.FRAME_INTERVAL_MS) {
        this.requestBatchedFrames();
        this.lastFrameTime = now;
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  private requestBatchedFrames(): void {
    const requests: Array<{
      targetNodeId: string;
      sourceNodeIds: (string | null)[];
      resolution?: [number, number];
    }> = [];

    for (const [nodeId, state] of this.nodes) {
      // Skip if no source connected
      if (!state.sourceNodeId) {
        console.debug(
          '[MediaPipe] no source for',
          nodeId,
          '— check edge targetHandle is "video-in"'
        );
        continue;
      }

      // Frame skipping
      state.frameCounter++;
      if (state.frameCounter % state.skipFrames !== 0) continue;

      requests.push({
        targetNodeId: nodeId,
        sourceNodeIds: [state.sourceNodeId]
      });
    }

    if (requests.length === 0) return;

    this.eventBus.dispatch({
      type: 'requestMediaPipeVideoFramesBatch',
      requests
    });
  }
}
