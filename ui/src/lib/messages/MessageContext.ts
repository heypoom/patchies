import type { AudioAnalysisProps } from '$lib/audio/AudioAnalysisSystem';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';
import { logger } from '$lib/utils/logger';
import { MessageQueue, MessageSystem, type MessageCallbackFn } from './MessageSystem';

export type SendMessageOptions = {
  /**
   * Which outlet to send the message to?
   * Number refers to the outlet index.
   */
  to?: number;

  /**
   * Target node IDs to exclude from routing (already handled via direct channels).
   * Used internally by worker nodes to prevent duplicate messages.
   */
  excludeTargets?: string[];
};

export interface UserFnRunContext {
  /** Sends messages. */
  send: (data: unknown, options?: SendMessageOptions) => void;

  /** Receives messages. */
  onMessage: (callback: MessageCallbackFn) => void;

  /** Schedules setInterval with cleanup. */
  setInterval: (callback: () => void, ms: number) => number;

  /** Schedules setTimeout with cleanup. */
  setTimeout: (callback: () => void, ms: number) => number;

  /** Abortable delay that resolves immediately when timers are cleared. */
  delay: (ms: number) => Promise<void>;

  /** Schedules requestAnimationFrame with cleanup. */
  requestAnimationFrame: (callback: () => void) => number;

  /** Disables dragging in canvas. */
  noDrag: () => void;

  /** Hides the video output port in canvas/p5 nodes. */
  noOutput?: () => void;

  /** Get audio analysis data */
  fft?: (options: AudioAnalysisProps) => FFTAnalysis;

  /** Sets the number of inlets and outlets for the node. */
  setPortCount?: (inletCount?: number, outletCount?: number) => void;

  /** Sets the title of the node. */
  setTitle?: (title: string) => void;

  /** Registers a cleanup callback that runs when the node is unmounted or code is re-executed. */
  onCleanup: (callback: () => void) => void;
}

export class MessageContext {
  public queue: MessageQueue;
  public messageSystem: MessageSystem;
  public nodeId: string;

  public messageCallback: MessageCallbackFn | null = null;
  private intervals: number[] = [];
  private timeouts: number[] = [];
  private animationFrames: number[] = [];
  private cleanupCallbacks: (() => void)[] = [];
  private pendingDelays: Map<number, { timeoutId: number; reject: (err: Error) => void }> =
    new Map();
  private delayIdCounter = 0;

  public onSend: UserFnRunContext['send'] = () => {};
  public onMessageCallbackRegistered = () => {};
  public onIntervalCallbackRegistered = () => {};
  public onTimeoutCallbackRegistered = () => {};
  public onAnimationFrameCallbackRegistered = () => {};

  // Cache for lazy-loaded AudioAnalysisSystem (only loaded in browser, not workers)
  private static audioAnalysisSystemPromise: Promise<
    typeof import('$lib/audio/AudioAnalysisSystem')
  > | null = null;

  private static audioAnalysisSystemModule: typeof import('$lib/audio/AudioAnalysisSystem') | null =
    null;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.messageSystem = MessageSystem.getInstance();

    // Register this node with the message system
    this.queue = this.messageSystem.registerNode(nodeId);

    // Set up the onMessage callback forwarding
    this.queue.addCallback(this.messageCallbackHandler.bind(this));

    // Lets you use `fft()` methods
    this.preloadAudioAnalysisSystem();
  }

  messageCallbackHandler: MessageCallbackFn = (data, meta) => {
    this.messageCallback?.(data, meta);
  };

  send(data: unknown, options: SendMessageOptions = {}) {
    this.messageSystem.sendMessage(this.nodeId, data, options);
    this.onSend(data, options);
  }

  // Create the onMessage function for this node
  createOnMessageFunction() {
    return (callback: MessageCallbackFn) => {
      // Always update the callback - this allows re-registering
      this.messageCallback = callback;
      this.onMessageCallbackRegistered();
    };
  }

  // Create the interval function for this node
  createSetIntervalFunction() {
    return (callback: () => void, ms: number) => {
      const intervalId = this.messageSystem.createInterval(callback, ms);
      this.intervals.push(intervalId);
      this.onIntervalCallbackRegistered();
      return intervalId;
    };
  }

  // Create the timeout function for this node
  createSetTimeoutFunction() {
    return (callback: () => void, ms: number) => {
      const timeoutId = window.setTimeout(() => {
        // Remove from tracking array since it fired
        const index = this.timeouts.indexOf(timeoutId);
        if (index > -1) this.timeouts.splice(index, 1);
        callback();
      }, ms);
      this.timeouts.push(timeoutId);
      this.onTimeoutCallbackRegistered();
      return timeoutId;
    };
  }

  // Create the requestAnimationFrame function for this node
  createRequestAnimationFrameFunction() {
    return (callback: () => void) => {
      const animationFrameId = this.messageSystem.createAnimationFrame(callback);
      this.animationFrames.push(animationFrameId);
      this.onAnimationFrameCallbackRegistered();
      return animationFrameId;
    };
  }

  // Create the onCleanup function for this node
  createOnCleanupFunction() {
    return (callback: () => void) => {
      this.cleanupCallbacks.push(callback);
    };
  }

  // Create an abortable delay function for this node
  createDelayFunction() {
    return (ms: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        const delayId = this.delayIdCounter++;
        const timeoutId = window.setTimeout(() => {
          this.pendingDelays.delete(delayId);
          resolve();
        }, ms);
        this.pendingDelays.set(delayId, { timeoutId, reject });
        this.onTimeoutCallbackRegistered();
      });
    };
  }

  // Create an fft function that automatically infers connected FFT nodes
  createFFTFunction() {
    if (typeof window === 'undefined') return null;

    return (options: AudioAnalysisProps) => {
      if (!MessageContext.audioAnalysisSystemModule) {
        logger.warn('AudioAnalysisSystem not loaded yet, FFT data unavailable!');

        return new FFTAnalysis(null, options?.format ?? null, 48000);
      }

      // Use the preloaded AudioAnalysisSystem module loaded in constructor
      // This breaks the import chain that was causing 2MB+ of audio nodes to be bundled in workers
      const analysis = MessageContext.audioAnalysisSystemModule.AudioAnalysisSystem.getInstance();

      const bins = analysis.getAnalysisForNode(this.nodeId, options);
      const sampleRate = analysis.sampleRate;

      return new FFTAnalysis(bins, options?.format ?? null, sampleRate);
    };
  }

  // Get all the context functions to inject
  getContext(): UserFnRunContext {
    const fft = this.createFFTFunction();

    return {
      send: this.send.bind(this),
      onMessage: this.createOnMessageFunction(),
      setInterval: this.createSetIntervalFunction(),
      setTimeout: this.createSetTimeoutFunction(),
      delay: this.createDelayFunction(),
      requestAnimationFrame: this.createRequestAnimationFrameFunction(),
      onCleanup: this.createOnCleanupFunction(),
      noDrag: () => {},
      ...(fft && { fft })
    };
  }

  // Clear all timers (intervals, timeouts, delays, and animation frames) for code re-execution
  clearTimers() {
    // Clear all intervals created by this node
    for (const intervalId of this.intervals) {
      this.messageSystem.clearInterval(intervalId);
    }

    this.intervals = [];

    // Clear all timeouts created by this node
    for (const timeoutId of this.timeouts) {
      window.clearTimeout(timeoutId);
    }

    this.timeouts = [];

    // Clear all pending delays and reject them (so awaiting code aborts)
    for (const { timeoutId, reject } of this.pendingDelays.values()) {
      window.clearTimeout(timeoutId);
      reject(new Error('delay() is stopped by user'));
    }

    this.pendingDelays.clear();

    // Clear all animation frames created by this node
    for (const animationFrameId of this.animationFrames) {
      this.messageSystem.clearAnimationFrame(animationFrameId);
    }

    this.animationFrames = [];
  }

  // Run all user-registered cleanup callbacks
  runCleanupCallbacks() {
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (e) {
        logger.warn('Error in cleanup callback:', e);
      }
    }

    this.cleanupCallbacks = [];
  }

  // Clear only animation frames (for code re-execution)
  clearAnimationFrames() {
    // Clear all animation frames created by this node
    for (const animationFrameId of this.animationFrames) {
      this.messageSystem.clearAnimationFrame(animationFrameId);
    }

    this.animationFrames = [];
  }

  // Clean up when the node is destroyed
  destroy() {
    this.runCleanupCallbacks();
    this.clearTimers();
    this.queue.removeCallback(this.messageCallbackHandler.bind(this));

    // Unregister the node
    this.messageSystem.unregisterNode(this.nodeId);

    // Clear callback
    this.messageCallback = null;
  }

  private preloadAudioAnalysisSystem() {
    // Preload AudioAnalysisSystem in browser context (but NOT in workers)
    // If we load this in workers, it will bloat the bundle by 5MB+
    // This ensures it's available synchronously when fft() is called
    if (typeof window !== 'undefined' && !MessageContext.audioAnalysisSystemPromise) {
      MessageContext.audioAnalysisSystemPromise = import('$lib/audio/AudioAnalysisSystem').then(
        (module) => {
          MessageContext.audioAnalysisSystemModule = module;

          return module;
        }
      );
    }
  }
}
