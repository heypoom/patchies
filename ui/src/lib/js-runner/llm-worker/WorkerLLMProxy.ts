import type { LLMToolDefinitions, LLMTools } from '$lib/ai/llm-js/llm-tools';
import { createLLMFunction } from '$lib/ai/google';
import type { LLMInput, LLMOptions } from '$lib/ai/llm-js/llm-input';
import type { WorkerMessage } from '../js-worker-types';

interface PendingToolResult {
  nodeId: string;
  requestId: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
}

interface LLMProxyRequest {
  nodeId: string;
  worker: Worker;
  requestId: string;
  input: LLMInput;
  options?: Omit<LLMOptions, 'abortSignal' | 'tools'> & { tools?: LLMToolDefinitions };
  returnTurn?: boolean;
}

/**
 * Proxies llm() calls from worker threads to the main-thread AI provider.
 * Manages per-request AbortControllers so in-flight requests can be cancelled
 * when a node is destroyed.
 */
export class WorkerLLMProxy {
  private nextToolId = 0;

  private toolResults = new Map<string, PendingToolResult>();
  private abortControllers = new Map<string, AbortController>(); // requestId -> controller
  private requestsByNode = new Map<string, Set<string>>(); // nodeId -> Set<requestId>

  async handle({
    nodeId,
    worker,
    requestId,
    input,
    options,
    returnTurn = false
  }: LLMProxyRequest): Promise<void> {
    const abortController = new AbortController();

    this.abortControllers.set(requestId, abortController);

    if (!this.requestsByNode.has(nodeId)) {
      this.requestsByNode.set(nodeId, new Set());
    }

    this.requestsByNode.get(nodeId)!.add(requestId);

    try {
      const llm = createLLMFunction();

      const tools: LLMTools = Object.fromEntries(
        Object.entries(options?.tools ?? {}).map(([name, definition]) => [
          name,
          {
            ...definition,
            run: (args: Record<string, unknown>) =>
              new Promise((resolve, reject) => {
                const callId = `tool-${++this.nextToolId}`;

                const abort = () => {
                  this.toolResults.delete(callId);
                  reject(new Error('Request cancelled'));
                };

                const cleanup = () => abortController.signal.removeEventListener('abort', abort);

                this.toolResults.set(callId, { nodeId, requestId, resolve, reject, cleanup });
                abortController.signal.addEventListener('abort', abort, { once: true });

                const toolCall = {
                  type: 'llmToolCall',
                  nodeId,
                  requestId,
                  callId,
                  name,
                  args
                } satisfies WorkerMessage;

                try {
                  worker.postMessage(toolCall);
                } catch (error) {
                  this.toolResults.delete(callId);
                  cleanup();
                  reject(error);
                }
              })
          }
        ])
      );

      const { tools: definitions, ...otherOptions } = options ?? {};

      const context = {
        ...otherOptions,
        ...(definitions ? { tools } : {}),
        abortSignal: abortController.signal
      };

      const result = returnTurn ? await llm.turn(input, context) : await llm(input, context);

      const config = {
        type: 'llmConfig',
        nodeId,
        requestId,
        ...(typeof result === 'string' ? { text: result } : { turn: result })
      } satisfies WorkerMessage;

      worker.postMessage(config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const config = {
        type: 'llmConfig',
        nodeId,
        requestId,
        error: errorMessage
      } satisfies WorkerMessage;

      worker.postMessage(config);
    } finally {
      this.abortControllers.delete(requestId);

      this.requestsByNode.get(nodeId)?.delete(requestId);
    }
  }

  handleToolResult(
    nodeId: string,
    response: { requestId: string; callId: string; result?: unknown; error?: string }
  ): void {
    const pending = this.toolResults.get(response.callId);

    if (!pending || pending.nodeId !== nodeId || pending.requestId !== response.requestId) {
      return;
    }

    this.toolResults.delete(response.callId);
    pending.cleanup();

    if (response.error !== undefined) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response.result);
    }
  }

  abortRequest(nodeId: string, requestId: string): void {
    if (!this.requestsByNode.get(nodeId)?.has(requestId)) return;

    this.abortControllers.get(requestId)?.abort();
  }

  /** Abort all in-flight requests for a node (call on destroy). */
  abortNode(nodeId: string): void {
    const pending = this.requestsByNode.get(nodeId);
    if (!pending) return;

    for (const requestId of pending) {
      this.abortControllers.get(requestId)?.abort();
      this.abortControllers.delete(requestId);
    }

    this.requestsByNode.delete(nodeId);
  }
}
