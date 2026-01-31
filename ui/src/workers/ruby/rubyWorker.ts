/**
 * Web Worker for executing Ruby code using ruby.wasm.
 * Each Ruby node gets its own dedicated Worker instance.
 */

import { match } from 'ts-pattern';
import type { Message } from '$lib/messages/MessageSystem';

// Message types sent from main thread to worker
export type RubyWorkerMessage = { nodeId: string } & (
  | { type: 'executeCode'; code: string }
  | { type: 'incomingMessage'; data: unknown; meta: Omit<Message, 'data'> }
  | { type: 'cleanup' }
  | { type: 'destroy' }
);

// Message types sent from worker to main thread
export type RubyWorkerResponse = { nodeId: string } & (
  | { type: 'ready' }
  | { type: 'vmInitializing' }
  | { type: 'vmReady' }
  | { type: 'executionComplete'; success: boolean; error?: string }
  | { type: 'consoleOutput'; level: 'log' | 'warn' | 'error' | 'debug' | 'info'; args: unknown[] }
  | { type: 'sendMessage'; data: unknown; options?: { to?: number } }
  | { type: 'setPortCount'; inletCount: number; outletCount: number }
  | { type: 'setTitle'; title: string }
  | { type: 'callbackRegistered'; callbackType: 'message' }
  | { type: 'flash' }
);

// Ruby VM type (from @ruby/wasm-wasi)
interface RubyVM {
  evalAsync(code: string): Promise<RubyValue>;
}

interface RubyValue {
  toJS(): unknown;
  toString(): string;
}

// Global Ruby VM instance (cached across executions)
let rubyVM: RubyVM | null = null;
let vmInitPromise: Promise<void> | null = null;

// State per node
interface NodeState {
  messageCallback: ((data: unknown, meta: Omit<Message, 'data'>) => void) | null;
  cleanupCallbacks: (() => void)[];
}

const nodeStates = new Map<string, NodeState>();

function getNodeState(nodeId: string): NodeState {
  if (!nodeStates.has(nodeId)) {
    nodeStates.set(nodeId, {
      messageCallback: null,
      cleanupCallbacks: []
    });
  }
  return nodeStates.get(nodeId)!;
}

function postResponse(response: RubyWorkerResponse) {
  self.postMessage(response);
}

/**
 * Initialize the Ruby VM (only once per worker)
 */
async function initRubyVM(nodeId: string): Promise<void> {
  if (rubyVM) return;

  if (vmInitPromise) {
    await vmInitPromise;
    return;
  }

  vmInitPromise = (async () => {
    postResponse({ type: 'vmInitializing', nodeId });

    try {
      const { DefaultRubyVM } = await import(
        // @ts-expect-error - CDN import
        'https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.8.1/dist/browser/+esm'
      );

      const response = await fetch(
        'https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi@2.8.1/dist/ruby+stdlib.wasm'
      );
      const module = await WebAssembly.compileStreaming(response);
      const { vm } = await DefaultRubyVM(module);

      rubyVM = vm;
      postResponse({ type: 'vmReady', nodeId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      postResponse({
        type: 'consoleOutput',
        nodeId,
        level: 'error',
        args: [`Failed to initialize Ruby VM: ${message}`]
      });
      throw error;
    }
  })();

  await vmInitPromise;
}

/**
 * Create context functions available to Ruby code (via JavaScript interop)
 */
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

  const onCleanup = (callback: () => void) => {
    state.cleanupCallbacks.push(callback);
  };

  const setPortCount = (inletCount = 1, outletCount = 1) => {
    postResponse({ type: 'setPortCount', nodeId, inletCount, outletCount });
  };

  const setTitle = (title: string) => {
    postResponse({ type: 'setTitle', nodeId, title });
  };

  const flash = () => {
    postResponse({ type: 'flash', nodeId });
  };

  return {
    console: customConsole,
    send,
    onMessage,
    onCleanup,
    setPortCount,
    setTitle,
    flash
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

  // Clear message callback
  state.messageCallback = null;
}

/**
 * Execute Ruby code
 */
async function executeCode(nodeId: string, code: string) {
  const ctx = createWorkerContext(nodeId);

  try {
    // Initialize Ruby VM if needed
    await initRubyVM(nodeId);

    if (!rubyVM) {
      throw new Error('Ruby VM not initialized');
    }

    // Store context in globalThis so Ruby can access it via JS interop
    // @ts-expect-error - dynamic global assignment
    globalThis.__rubyContext = ctx;

    // Wrap user code with helper methods that call JS functions
    const wrappedCode = `
# Helper methods for Patchies integration
def send(data, to: nil)
  JS.global[:__rubyContext][:send].call(data.to_js, { to: to }.to_js)
end

def recv(&block)
  # Store the callback - it will be called from JS when messages arrive
  $__recv_callback = block
  JS.global[:__rubyContext][:onMessage].call(
    ->(data, meta) { $__recv_callback.call(data, meta) }.to_js
  )
end

def set_port_count(inlet_count = 1, outlet_count = 1)
  JS.global[:__rubyContext][:setPortCount].call(inlet_count, outlet_count)
end

def set_title(title)
  JS.global[:__rubyContext][:setTitle].call(title.to_s)
end

def flash
  JS.global[:__rubyContext][:flash].call
end

def on_cleanup(&block)
  JS.global[:__rubyContext][:onCleanup].call(block.to_js)
end

# Override puts to use our console
def puts(*args)
  args.each do |arg|
    JS.global[:__rubyContext][:console][:log].call(arg.to_s)
  end
  nil
end

def p(*args)
  args.each do |arg|
    JS.global[:__rubyContext][:console][:log].call(arg.inspect)
  end
  args.length == 1 ? args[0] : args
end

def warn(*args)
  args.each do |arg|
    JS.global[:__rubyContext][:console][:warn].call(arg.to_s)
  end
  nil
end

# User code starts here
${code}
`;

    const result = await rubyVM.evalAsync(wrappedCode);

    // Log result if it's not nil
    if (result !== undefined && result !== null) {
      try {
        const jsResult = result.toJS?.() ?? result.toString();
        if (jsResult !== null && jsResult !== undefined && jsResult !== 'nil') {
          // Don't log nil results
          if (String(jsResult) !== 'nil') {
            ctx.console.log(jsResult);
          }
        }
      } catch {
        // Result might not be convertible, that's ok
      }
    }

    postResponse({ type: 'executionComplete', nodeId, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.console.error(`Ruby error: ${message}`);
    postResponse({ type: 'executionComplete', nodeId, success: false, error: message });
  }
}

// Handle incoming messages from main thread
self.onmessage = async (event: MessageEvent<RubyWorkerMessage>) => {
  const { nodeId } = event.data;

  match(event.data)
    .with({ type: 'executeCode' }, async ({ code }) => {
      cleanupNode(nodeId);
      await executeCode(nodeId, code);
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
    .with({ type: 'cleanup' }, () => {
      cleanupNode(nodeId);
    })
    .with({ type: 'destroy' }, () => {
      cleanupNode(nodeId);
      nodeStates.delete(nodeId);
    })
    .otherwise(() => {});
};

// Signal that worker is ready
postResponse({ type: 'ready', nodeId: '' });
console.log('[ruby worker] initialized');
