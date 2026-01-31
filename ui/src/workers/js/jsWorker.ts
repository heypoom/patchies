/**
 * Web Worker for executing JavaScript code in worker nodes.
 * Each worker node gets its own dedicated Worker instance for true threading.
 */

import { match } from 'ts-pattern';
import type { WorkerMessage, WorkerResponse } from '$lib/js-runner/WorkerNodeSystem';
import type { Message } from '$lib/messages/MessageSystem';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';

// Module storage (synced from main thread)
const modules = new Map<string, string>();

// Timer and callback tracking per node
interface NodeState {
  intervals: number[];
  timeouts: number[];
  cleanupCallbacks: (() => void)[];
  messageCallback: ((data: unknown, meta: Omit<Message, 'data'>) => void) | null;
  pendingDelays: Map<number, { timeoutId: number; reject: (err: Error) => void }>;
  delayIdCounter: number;
  // FFT state
  isFFTEnabled: boolean;
  fftRequestCache: Map<string, boolean>;
  fftDataCache: Map<string, { data: Uint8Array | Float32Array; timestamp: number }>;
}

const nodeStates = new Map<string, NodeState>();

function getNodeState(nodeId: string): NodeState {
  if (!nodeStates.has(nodeId)) {
    nodeStates.set(nodeId, {
      intervals: [],
      timeouts: [],
      cleanupCallbacks: [],
      messageCallback: null,
      pendingDelays: new Map(),
      delayIdCounter: 0,
      isFFTEnabled: false,
      fftRequestCache: new Map(),
      fftDataCache: new Map()
    });
  }
  return nodeStates.get(nodeId)!;
}

// VFS URL resolution (same pattern as vfsWorkerUtils.ts)
type PendingVfsRequest = {
  resolve: (url: string) => void;
  reject: (error: Error) => void;
};

const pendingVfsRequests = new Map<string, PendingVfsRequest>();
let vfsRequestIdCounter = 0;

// LLM config proxying (get credentials from main thread, make HTTP call in worker)
type PendingLLMConfig = {
  prompt: string;
  resolve: (result: string) => void;
  reject: (error: Error) => void;
};

const pendingLLMConfigs = new Map<string, PendingLLMConfig>();
let llmRequestIdCounter = 0;

function postResponse(response: WorkerResponse) {
  self.postMessage(response);
}

function createWorkerContext(nodeId: string) {
  const state = getNodeState(nodeId);

  const customConsole = {
    log: (...args: unknown[]) =>
      postResponse({ type: 'consoleOutput', nodeId, level: 'log', args }),
    warn: (...args: unknown[]) =>
      postResponse({ type: 'consoleOutput', nodeId, level: 'warn', args }),
    error: (...args: unknown[]) =>
      postResponse({ type: 'consoleOutput', nodeId, level: 'error', args }),
    debug: (...args: unknown[]) =>
      postResponse({ type: 'consoleOutput', nodeId, level: 'debug', args }),
    info: (...args: unknown[]) =>
      postResponse({ type: 'consoleOutput', nodeId, level: 'info', args })
  };

  const send = (data: unknown, options?: { to?: number }) => {
    postResponse({ type: 'sendMessage', nodeId, data, options });
  };

  const onMessage = (callback: (data: unknown, meta: Omit<Message, 'data'>) => void) => {
    state.messageCallback = callback;
    postResponse({ type: 'callbackRegistered', nodeId, callbackType: 'message' });
  };

  const setIntervalFn = (callback: () => void, ms: number): number => {
    const id = self.setInterval(callback, ms);
    state.intervals.push(id);
    postResponse({ type: 'callbackRegistered', nodeId, callbackType: 'interval' });
    return id;
  };

  const setTimeoutFn = (callback: () => void, ms: number): number => {
    const id = self.setTimeout(() => {
      const idx = state.timeouts.indexOf(id);
      if (idx > -1) state.timeouts.splice(idx, 1);
      callback();
    }, ms);
    state.timeouts.push(id);
    postResponse({ type: 'callbackRegistered', nodeId, callbackType: 'timeout' });
    return id;
  };

  const delay = (ms: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const delayId = state.delayIdCounter++;
      const timeoutId = self.setTimeout(() => {
        state.pendingDelays.delete(delayId);
        resolve();
      }, ms);
      state.pendingDelays.set(delayId, { timeoutId, reject });
      postResponse({ type: 'callbackRegistered', nodeId, callbackType: 'timeout' });
    });
  };

  const onCleanup = (callback: () => void) => {
    state.cleanupCallbacks.push(callback);
  };

  const setPortCount = (inletCount = 1, outletCount = 1) => {
    postResponse({ type: 'setPortCount', nodeId, inletCount, outletCount });
  };

  const setTitle = (title: string) => {
    postResponse({ type: 'setTitle', nodeId, title });
  };

  const setRunOnMount = (runOnMount: boolean) => {
    postResponse({ type: 'setRunOnMount', nodeId, runOnMount });
  };

  const setHidePorts = (hidePorts: boolean) => {
    postResponse({ type: 'setHidePorts', nodeId, hidePorts });
  };

  // requestAnimationFrame - not available in workers, but we can use setInterval as fallback
  const requestAnimationFrame = (callback: () => void): number => {
    // Use ~60fps interval as approximation
    return setIntervalFn(() => {
      callback();
    }, 16);
  };

  // FFT function - proxied through main thread (same pattern as hydraRenderer.ts)
  const fft = (options: { type?: 'wave' | 'freq'; format?: 'int' | 'float' } = {}) => {
    const { type = 'wave', format = 'int' } = options;
    const cacheKey = `${type}-${format}`;

    if (!state.isFFTEnabled) {
      self.postMessage({ type: 'fftEnabled', nodeId, enabled: true });
      state.isFFTEnabled = true;
    }

    if (!state.fftRequestCache.has(cacheKey)) {
      self.postMessage({
        type: 'registerFFTRequest',
        nodeId,
        analysisType: type,
        format
      });
      state.fftRequestCache.set(cacheKey, true);
    }

    const cached = state.fftDataCache.get(cacheKey);
    const bins = cached?.data ?? null;

    return new FFTAnalysis(bins, format, 44000);
  };

  // LLM function - gets credentials from main thread, makes HTTP call in worker
  const llm = async (
    prompt: string,
    context?: { imageNodeId?: string; abortSignal?: AbortSignal }
  ): Promise<string> => {
    const requestId = `llm-${nodeId}-${++llmRequestIdCounter}`;

    return new Promise((resolve, reject) => {
      pendingLLMConfigs.set(requestId, { prompt, resolve, reject });

      // Request LLM config (API key + optionally captured image) from main thread
      self.postMessage({
        type: 'llmRequest',
        requestId,
        nodeId,
        prompt,
        imageNodeId: context?.imageNodeId
      });

      // Handle abort signal
      if (context?.abortSignal) {
        context.abortSignal.addEventListener('abort', () => {
          pendingLLMConfigs.delete(requestId);
          reject(new Error('LLM request aborted'));
        });
      }
    });
  };

  // getVfsUrl - proxied through main thread (same pattern as vfsWorkerUtils.ts)
  const getVfsUrl = async (path: string): Promise<string> => {
    const requestId = `vfs-${nodeId}-${++vfsRequestIdCounter}`;

    return new Promise((resolve, reject) => {
      pendingVfsRequests.set(requestId, { resolve, reject });

      self.postMessage({
        type: 'resolveVfsUrl',
        requestId,
        nodeId,
        path
      });
    });
  };

  return {
    console: customConsole,
    send,
    onMessage,
    setInterval: setIntervalFn,
    setTimeout: setTimeoutFn,
    delay,
    onCleanup,
    setPortCount,
    setTitle,
    setRunOnMount,
    setHidePorts,
    requestAnimationFrame,
    fft,
    llm,
    getVfsUrl
  };
}

function cleanupNode(nodeId: string) {
  const state = nodeStates.get(nodeId);
  if (!state) return;

  // Run cleanup callbacks
  for (const cb of state.cleanupCallbacks) {
    try {
      cb();
    } catch {
      // Ignore cleanup errors
    }
  }
  state.cleanupCallbacks = [];

  // Clear intervals
  for (const id of state.intervals) {
    self.clearInterval(id);
  }
  state.intervals = [];

  // Clear timeouts
  for (const id of state.timeouts) {
    self.clearTimeout(id);
  }
  state.timeouts = [];

  // Clear pending delays and reject them
  for (const { timeoutId, reject } of state.pendingDelays.values()) {
    self.clearTimeout(timeoutId);
    reject(new Error('delay() is stopped by user'));
  }
  state.pendingDelays.clear();

  // Clear message callback
  state.messageCallback = null;

  // Clear FFT state
  state.isFFTEnabled = false;
  state.fftDataCache.clear();
  state.fftRequestCache.clear();
}

async function executeCode(nodeId: string, processedCode: string) {
  const ctx = createWorkerContext(nodeId);

  const moduleProviderUrl = 'https://esm.sh/';

  const codeWithWrapper = `
    const inner = async () => {
      var recv = onMessage;
      var esm = (name) => import('${moduleProviderUrl}' + name);

      ${processedCode}
    }

    return inner()
  `;

  const functionParams = [
    'console',
    'send',
    'onMessage',
    'setInterval',
    'setTimeout',
    'delay',
    'requestAnimationFrame',
    'onCleanup',
    'fft',
    'llm',
    'setPortCount',
    'setRunOnMount',
    'setTitle',
    'setHidePorts',
    'getVfsUrl'
  ];

  const functionArgs = [
    ctx.console,
    ctx.send,
    ctx.onMessage,
    ctx.setInterval,
    ctx.setTimeout,
    ctx.delay,
    ctx.requestAnimationFrame,
    ctx.onCleanup,
    ctx.fft,
    ctx.llm,
    ctx.setPortCount,
    ctx.setRunOnMount,
    ctx.setTitle,
    ctx.setHidePorts,
    ctx.getVfsUrl
  ];

  try {
    const userFunction = new Function(...functionParams, codeWithWrapper);
    await userFunction(...functionArgs);
    postResponse({ type: 'executionComplete', nodeId, success: true });
  } catch (error) {
    handleCodeError(nodeId, processedCode, error);
    const message = error instanceof Error ? error.message : String(error);
    postResponse({ type: 'executionComplete', nodeId, success: false, error: message });
  }
}

/**
 * Handles code execution errors with line number extraction for inline highlighting.
 * Uses parseJSError for cross-browser error parsing (Chrome, Firefox, Safari).
 */
function handleCodeError(nodeId: string, code: string, error: unknown): void {
  const errorInfo = parseJSError(error, countLines(code));

  if (errorInfo) {
    postResponse({
      type: 'consoleOutput',
      nodeId,
      level: 'error',
      args: [errorInfo.message],
      lineErrors: errorInfo.lineErrors
    });
    return;
  }

  // Fallback: no line info available
  const errorMessage = error instanceof Error ? error.message : String(error);
  postResponse({
    type: 'consoleOutput',
    nodeId,
    level: 'error',
    args: [errorMessage]
  });
}

// Handle VFS URL resolution response from main thread
function handleVfsUrlResolved(data: {
  requestId: string;
  nodeId: string;
  url?: string;
  error?: string;
}) {
  const pending = pendingVfsRequests.get(data.requestId);
  if (!pending) return;

  pendingVfsRequests.delete(data.requestId);

  if (data.error) {
    pending.reject(new Error(data.error));
    return;
  }

  if (data.url) {
    pending.resolve(data.url);
    return;
  }

  pending.reject(new Error('Invalid VFS resolution response'));
}

// Handle LLM config from main thread and make HTTP call
async function handleLLMConfig(data: {
  requestId: string;
  nodeId: string;
  apiKey?: string;
  imageBase64?: string;
  error?: string;
}) {
  const pending = pendingLLMConfigs.get(data.requestId);
  if (!pending) return;

  pendingLLMConfigs.delete(data.requestId);

  if (data.error) {
    pending.reject(new Error(data.error));
    return;
  }

  if (!data.apiKey) {
    pending.reject(new Error('No API key provided'));
    return;
  }

  try {
    // Import GoogleGenAI dynamically and make the HTTP call in the worker
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: data.apiKey });

    type ContentItem = { text: string } | { inlineData: { mimeType: string; data: string } };
    const contents: ContentItem[] = [];

    // Add image if provided
    if (data.imageBase64) {
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: data.imageBase64
        }
      });
    }

    // Add text prompt
    contents.push({ text: pending.prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents
    });

    pending.resolve(response.text ?? '');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pending.reject(new Error(message));
  }
}

// Handle FFT data from main thread
function handleFFTData(
  nodeId: string,
  payload: { analysisType: string; format: string; array: Uint8Array | Float32Array }
) {
  const state = nodeStates.get(nodeId);
  if (!state) return;

  const cacheKey = `${payload.analysisType}-${payload.format}`;
  state.fftDataCache.set(cacheKey, {
    data: payload.array,
    timestamp: performance.now()
  });
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { nodeId } = event.data;

  match(event.data)
    .with({ type: 'executeCode' }, async ({ processedCode }) => {
      cleanupNode(nodeId);
      await executeCode(nodeId, processedCode);
    })
    .with({ type: 'incomingMessage' }, ({ data, meta }) => {
      const state = nodeStates.get(nodeId);
      if (state?.messageCallback) {
        try {
          state.messageCallback(data, meta);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          postResponse({
            type: 'consoleOutput',
            nodeId,
            level: 'error',
            args: [`Error in recv(): ${message}`]
          });
        }
      }
    })
    .with({ type: 'updateModule' }, ({ moduleName, code }) => {
      if (code === null) {
        modules.delete(moduleName);
      } else {
        modules.set(moduleName, code);
      }
    })
    .with({ type: 'cleanup' }, () => {
      cleanupNode(nodeId);
    })
    .with({ type: 'destroy' }, () => {
      cleanupNode(nodeId);
      nodeStates.delete(nodeId);
    })
    .with({ type: 'vfsUrlResolved' }, (data) => {
      handleVfsUrlResolved(
        data as { requestId: string; nodeId: string; url?: string; error?: string }
      );
    })
    .with({ type: 'llmConfig' }, (data) => {
      handleLLMConfig(
        data as {
          requestId: string;
          nodeId: string;
          apiKey?: string;
          imageBase64?: string;
          error?: string;
        }
      );
    })
    .with({ type: 'setFFTData' }, (data) => {
      handleFFTData(
        nodeId,
        data as { analysisType: string; format: string; array: Uint8Array | Float32Array }
      );
    })
    .otherwise(() => {});
};

console.log('[js worker] initialized');
