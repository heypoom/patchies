import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { MessageSystem, type MessageCallbackFn } from '$lib/messages/MessageSystem';
import { match } from 'ts-pattern';
import type { RubyWorkerMessage, RubyWorkerResponse } from '../../workers/ruby/rubyWorker';
import RubyWorker from '../../workers/ruby/rubyWorker?worker';

interface WorkerInstance {
  worker: Worker;
  messageCallback: MessageCallbackFn;
  isVMReady: boolean;
}

/**
 * RubyNodeSystem manages dedicated Web Workers for Ruby nodes.
 * Each Ruby node gets its own Worker instance with a shared Ruby VM.
 */
export class RubyNodeSystem {
  private static instance: RubyNodeSystem | null = null;

  private eventBus = PatchiesEventBus.getInstance();
  private messageSystem = MessageSystem.getInstance();
  private workers = new Map<string, WorkerInstance>();

  static getInstance(): RubyNodeSystem {
    if (!RubyNodeSystem.instance) {
      RubyNodeSystem.instance = new RubyNodeSystem();
    }
    return RubyNodeSystem.instance;
  }

  /**
   * Create a new Ruby worker for a node
   */
  async create(nodeId: string): Promise<void> {
    if (this.workers.has(nodeId)) {
      return;
    }

    const worker = new RubyWorker();

    // Create message callback to forward messages to worker
    const messageCallback: MessageCallbackFn = (data, meta) => {
      worker.postMessage({
        type: 'incomingMessage',
        nodeId,
        data,
        meta
      } satisfies RubyWorkerMessage);
    };

    // Register with MessageSystem to receive messages
    const queue = this.messageSystem.registerNode(nodeId);
    queue.addCallback(messageCallback);

    const instance: WorkerInstance = {
      worker,
      messageCallback,
      isVMReady: false
    };

    this.workers.set(nodeId, instance);

    // Set up message handler
    worker.onmessage = (event: MessageEvent<RubyWorkerResponse>) => {
      this.handleWorkerResponse(nodeId, event.data);
    };

    worker.onerror = (error) => {
      console.error(`[RubyNodeSystem] Worker error for node ${nodeId}:`, error);
      this.eventBus.dispatch({
        type: 'consoleOutput',
        nodeId,
        messageType: 'error',
        timestamp: Date.now(),
        args: [`Worker error: ${error.message}`]
      });
    };
  }

  /**
   * Execute Ruby code in a node's worker
   */
  async executeCode(nodeId: string, code: string): Promise<void> {
    const instance = this.workers.get(nodeId);
    if (!instance) {
      throw new Error(`No worker found for node ${nodeId}`);
    }

    return new Promise((resolve, reject) => {
      const handleComplete = (event: MessageEvent<RubyWorkerResponse>) => {
        if (event.data.nodeId !== nodeId) return;

        match(event.data)
          .with({ type: 'executionComplete' }, ({ success, error }) => {
            instance.worker.removeEventListener('message', handleComplete);
            if (success) {
              resolve();
            } else {
              reject(new Error(error || 'Execution failed'));
            }
          })
          .otherwise(() => {});
      };

      instance.worker.addEventListener('message', handleComplete);

      instance.worker.postMessage({
        type: 'executeCode',
        nodeId,
        code
      } satisfies RubyWorkerMessage);
    });
  }

  /**
   * Clean up a node's running tasks (callbacks, etc.)
   */
  cleanup(nodeId: string): void {
    const instance = this.workers.get(nodeId);
    if (!instance) return;

    instance.worker.postMessage({
      type: 'cleanup',
      nodeId
    } satisfies RubyWorkerMessage);
  }

  /**
   * Destroy a node's worker
   */
  destroy(nodeId: string): void {
    const instance = this.workers.get(nodeId);
    if (!instance) return;

    // Remove message callback from queue
    const queue = this.messageSystem.registerNode(nodeId);
    queue.removeCallback(instance.messageCallback);

    // Send destroy message and terminate worker
    instance.worker.postMessage({
      type: 'destroy',
      nodeId
    } satisfies RubyWorkerMessage);

    instance.worker.terminate();
    this.workers.delete(nodeId);
  }

  /**
   * Handle responses from the worker
   */
  private handleWorkerResponse(nodeId: string, response: RubyWorkerResponse): void {
    const instance = this.workers.get(nodeId);

    match(response)
      .with({ type: 'ready' }, () => {
        // Worker is ready
      })
      .with({ type: 'vmInitializing' }, () => {
        this.eventBus.dispatch({
          type: 'consoleOutput',
          nodeId,
          messageType: 'log',
          timestamp: Date.now(),
          args: ['Initializing Ruby VM...']
        });
      })
      .with({ type: 'vmReady' }, () => {
        if (instance) {
          instance.isVMReady = true;
        }
        this.eventBus.dispatch({
          type: 'consoleOutput',
          nodeId,
          messageType: 'log',
          timestamp: Date.now(),
          args: ['Ruby VM ready']
        });
      })
      .with({ type: 'consoleOutput' }, ({ level, args }) => {
        // Dispatch console output event
        const messageType =
          level === 'error'
            ? 'error'
            : level === 'warn'
              ? 'warn'
              : level === 'debug'
                ? 'debug'
                : 'log';
        this.eventBus.dispatch({
          type: 'consoleOutput',
          nodeId,
          messageType,
          timestamp: Date.now(),
          args
        });
      })
      .with({ type: 'sendMessage' }, ({ data, options }) => {
        // Send message through MessageSystem
        this.messageSystem.sendMessage(nodeId, data, options ?? {});
      })
      .with({ type: 'setPortCount' }, ({ inletCount, outletCount }) => {
        this.eventBus.dispatch({
          type: 'nodePortCountUpdate',
          nodeId,
          portType: 'message',
          inletCount,
          outletCount
        });
      })
      .with({ type: 'setTitle' }, ({ title }) => {
        this.eventBus.dispatch({ type: 'nodeTitleUpdate', nodeId, title });
      })
      .with({ type: 'callbackRegistered' }, ({ callbackType }) => {
        this.eventBus.dispatch({ type: 'workerCallbackRegistered', nodeId, callbackType });
      })
      .with({ type: 'flash' }, () => {
        this.eventBus.dispatch({ type: 'workerFlash', nodeId });
      })
      .with({ type: 'executionComplete' }, () => {
        // Handled by executeCode promise
      })
      .otherwise(() => {});
  }
}
