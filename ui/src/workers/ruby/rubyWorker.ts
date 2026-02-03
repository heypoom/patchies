/**
 * Web Worker for executing Ruby code using ruby.wasm.
 * Each Ruby node gets its own dedicated Worker instance.
 */

import { match } from 'ts-pattern';
import type { Message } from '$lib/messages/MessageSystem';

import {
  createDirectChannelHandler,
  type DirectChannelHandler,
  type RenderConnection
} from '../shared/directChannelHandler';

// Message types sent from main thread to worker
export type RubyWorkerMessage = { nodeId: string } & (
  | { type: 'executeCode'; code: string }
  | { type: 'incomingMessage'; data: unknown; meta: Omit<Message, 'data'> }
  | { type: 'cleanup' }
  | { type: 'destroy' }
  | { type: 'setRenderPort' }
  | { type: 'updateRenderConnections'; connections: RenderConnection[] }
  | { type: 'setWorkerPort'; targetNodeId?: string; sourceNodeId?: string }
  | { type: 'updateWorkerConnections'; connections: RenderConnection[] }
);

// Message types sent from worker to main thread
export type RubyWorkerResponse = { nodeId: string } & (
  | { type: 'ready' }
  | { type: 'vmInitializing' }
  | { type: 'vmReady' }
  | { type: 'executionComplete'; success: boolean; error?: string }
  | { type: 'consoleOutput'; level: 'log' | 'warn' | 'error' | 'debug' | 'info'; args: unknown[] }
  | { type: 'sendMessage'; data: unknown; options?: { to?: number; excludeTargets?: string[] } }
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
  directChannel: DirectChannelHandler;
}

const nodeStates = new Map<string, NodeState>();

function createNodeState(nodeId: string): NodeState {
  const state: Omit<NodeState, 'directChannel'> & { directChannel?: DirectChannelHandler } = {
    messageCallback: null,
    cleanupCallbacks: []
  };

  state.directChannel = createDirectChannelHandler({
    nodeId,
    onIncomingMessage: (data, meta) => {
      if (state.messageCallback) {
        state.messageCallback(data, meta);
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      postResponse({
        type: 'consoleOutput',
        nodeId,
        level: 'error',
        args: [message]
      });
    }
  });

  return state as NodeState;
}

function getNodeState(nodeId: string): NodeState {
  if (!nodeStates.has(nodeId)) {
    nodeStates.set(nodeId, createNodeState(nodeId));
  }
  return nodeStates.get(nodeId)!;
}

function postResponse(response: RubyWorkerResponse) {
  self.postMessage(response);
}

/**
 * Safely invokes a callback, handling both sync and async errors.
 * Used for recv() handlers and other user callbacks.
 */
function invokeCallbackSafely(
  nodeId: string,
  callback: () => unknown,
  errorPrefix = 'Error in recv()'
): void {
  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    postResponse({
      type: 'consoleOutput',
      nodeId,
      level: 'error',
      args: [`${errorPrefix}: ${message}`]
    });
  };

  try {
    const result = callback();

    // Handle async callbacks that return a promise
    if (result instanceof Promise) {
      result.catch(handleError);
    }
  } catch (error) {
    handleError(error);
  }
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
    const renderTargets = state.directChannel.sendToRenderTargets(data, options);
    const workerTargets = state.directChannel.sendToWorkerTargets(data, options);

    // Send via main thread, excluding targets we've already handled directly
    const excludeTargets = [...renderTargets, ...workerTargets];

    postResponse({ type: 'sendMessage', nodeId, data, options: { ...options, excludeTargets } });
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

    // Helper functions for Ruby to call (since typeof is an operator)
    // @ts-expect-error - dynamic global assignment
    globalThis.__rubyHelpers = {
      typeof: (x: unknown) => typeof x,
      isArray: (x: unknown) => Array.isArray(x),
      isNull: (x: unknown) => x === null
    };

    // Wrap user code with helper methods that call JS functions
    // Using correct ruby.wasm JS interop syntax: obj.method(args) or obj.call(:method, args)
    // Note: We use "emit" instead of "send" because "send" is a Ruby built-in method
    const wrappedCode = `
require "js"

$__ctx = JS.global[:__rubyContext]
$__helpers = JS.global[:__rubyHelpers]

# Convert JS values to native Ruby values
def js_to_ruby(val)
  return nil if val.nil?
  return val unless val.is_a?(JS::Object)

  type = $__helpers.call(:typeof, val).to_s
  case type
  when "number"
    str = val.to_s
    str.include?(".") ? str.to_f : str.to_i
  when "string"
    val.to_s
  when "boolean"
    val.to_s == "true"
  when "undefined"
    nil
  when "object"
    # Check if null (typeof null === "object" in JS)
    if $__helpers.call(:isNull, val).to_s == "true"
      nil
    elsif $__helpers.call(:isArray, val).to_s == "true"
      # Convert array
      len = val[:length].to_i
      (0...len).map { |i| js_to_ruby(val[i]) }
    else
      # Convert object to hash
      keys = JS.global[:Object].call(:keys, val)
      len = keys[:length].to_i
      hash = {}
      (0...len).each do |i|
        key = keys[i].to_s
        hash[key] = js_to_ruby(val[key])
      end
      hash
    end
  else
    val.to_s
  end
end

# Helper methods for Patchies integration
# Use call(:method_name, args) syntax to invoke JS functions
def emit(data, to: nil)
  if to.nil?
    $__ctx.call(:send, data)
  else
    $__ctx.call(:send, data, JS.eval("return { to: " + to.to_s + " }"))
  end
end

def recv(&block)
  $__recv_callback = block
  $__ctx.call(:onMessage, proc { |data, meta|
    # Convert JS values to native Ruby values
    ruby_data = js_to_ruby(data)
    ruby_meta = js_to_ruby(meta)
    $__recv_callback.call(ruby_data, ruby_meta)
  })
end

def set_port_count(inlet_count = 1, outlet_count = 1)
  $__ctx.call(:setPortCount, inlet_count, outlet_count)
end

def set_title(title)
  $__ctx.call(:setTitle, title.to_s)
end

def flash
  $__ctx.call(:flash)
end

def on_cleanup(&block)
  $__ctx.call(:onCleanup, block)
end

# Override puts to use our console
$__console = $__ctx[:console]
def puts(*args)
  args.each do |arg|
    $__console.call(:log, arg.to_s)
  end
  nil
end

def p(*args)
  args.each do |arg|
    $__console.call(:log, arg.inspect)
  end
  args.length == 1 ? args[0] : args
end

def warn(*args)
  args.each do |arg|
    $__console.call(:warn, arg.to_s)
  end
  nil
end

# User code starts here
${code}
`;

    const result = await rubyVM.evalAsync(wrappedCode);

    // Log result if it's not nil/undefined
    if (result !== undefined && result !== null) {
      try {
        const jsResult = result.toJS?.() ?? result.toString();
        if (jsResult !== null && jsResult !== undefined && jsResult !== 'nil') {
          const strResult = String(jsResult);
          // Don't log nil or undefined results
          if (strResult !== 'nil' && strResult !== 'undefined') {
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
        invokeCallbackSafely(nodeId, () => state.messageCallback!(data, meta));
      }
    })
    .with({ type: 'cleanup' }, () => {
      cleanupNode(nodeId);
    })
    .with({ type: 'destroy' }, () => {
      const state = nodeStates.get(nodeId);
      cleanupNode(nodeId);
      state?.directChannel.cleanup();
      nodeStates.delete(nodeId);
    })
    .with({ type: 'setRenderPort' }, () => {
      const state = getNodeState(nodeId);
      state.directChannel.handleSetRenderPort(event.ports[0]);
    })
    .with({ type: 'updateRenderConnections' }, ({ connections }) => {
      const state = getNodeState(nodeId);
      state.directChannel.handleUpdateRenderConnections(connections);
    })
    .with({ type: 'setWorkerPort' }, ({ targetNodeId, sourceNodeId }) => {
      const state = getNodeState(nodeId);
      state.directChannel.handleSetWorkerPort(event.ports[0], targetNodeId, sourceNodeId);
    })
    .with({ type: 'updateWorkerConnections' }, ({ connections }) => {
      const state = getNodeState(nodeId);
      state.directChannel.handleUpdateWorkerConnections(connections);
    })
    .otherwise(() => {});
};

// Signal that worker is ready
postResponse({ type: 'ready', nodeId: '' });
console.log('[ruby worker] initialized');
