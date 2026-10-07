import type { AsyncActivityTracker } from '../AsyncActivityTracker';
import { prepareLLMTools, type LLMToolDefinitions } from '$lib/ai/llm-js/llm-tools';
import type { ToolCall } from '$lib/ai/providers/types';
import type { LLMConversationTurn, LLMInput, LLMOptions } from '$lib/ai/llm-js/llm-input';
import { normalizeLLMInput } from '$lib/ai/llm-js/llm-input';
import type { WorkerResponse } from '../js-worker-types';

interface LLMResponse {
  requestId: string;
  text?: string;
  turn?: LLMConversationTurn;
  error?: string;
}

interface LLMPendingSession {
  resolve: (value: string | LLMConversationTurn) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
  returnTurn: boolean;
  nodeId: string;
  handlers: Map<string, (call: ToolCall) => Promise<unknown>>;
}

export class WorkerLLMClient {
  private nextId = 0;
  private pending = new Map<string, LLMPendingSession>();

  constructor(private postMessage: (message: WorkerResponse) => void) {}

  abortNode(nodeId: string): void {
    for (const [requestId, pending] of this.pending) {
      if (pending.nodeId !== nodeId) continue;

      this.pending.delete(requestId);
      pending.cleanup();
      this.postMessage({ type: 'llmAbort', nodeId: pending.nodeId, requestId });
      pending.reject(new Error('LLM request aborted'));
    }
  }

  createFunction(nodeId: string, activity: AsyncActivityTracker) {
    const llm = async (input: LLMInput, options?: LLMOptions): Promise<string> =>
      (await activity.run(() => this.request(nodeId, input, options))) as string;

    llm.turn = async (input: LLMInput, options?: LLMOptions): Promise<LLMConversationTurn> =>
      (await activity.run(() => this.request(nodeId, input, options, true))) as LLMConversationTurn;

    return llm;
  }

  private async request(
    nodeId: string,
    input: LLMInput,
    options: LLMOptions = {},
    returnTurn = false
  ) {
    normalizeLLMInput(input);

    const { abortSignal, tools, ...wireOptions } = options;
    const { handlers } = prepareLLMTools(tools);

    const definitions: LLMToolDefinitions = Object.fromEntries(
      Object.entries(tools ?? {}).map(([name, tool]) => [
        name,
        {
          description: tool.description,
          ...(tool.parameters ? { parameters: structuredClone(tool.parameters) } : {})
        }
      ])
    );

    if (abortSignal?.aborted) {
      throw new Error('LLM request aborted');
    }

    const requestId = `llm-${nodeId}-${++this.nextId}`;
    const snapshot = structuredClone(input);

    return new Promise<string | LLMConversationTurn>((resolve, reject) => {
      const abort = () => {
        this.pending.delete(requestId);
        abortSignal?.removeEventListener('abort', abort);
        this.postMessage({ type: 'llmAbort', nodeId, requestId });
        reject(new Error('LLM request aborted'));
      };

      const cleanup = () => abortSignal?.removeEventListener('abort', abort);

      this.pending.set(requestId, { resolve, reject, cleanup, returnTurn, nodeId, handlers });
      abortSignal?.addEventListener('abort', abort, { once: true });

      try {
        this.postMessage({
          type: 'llmRequest',
          nodeId,
          requestId,
          input: snapshot,
          options: { ...wireOptions, ...(tools ? { tools: definitions } : {}) },
          returnTurn
        });
      } catch (error) {
        this.pending.delete(requestId);
        cleanup();
        reject(error);
      }
    });
  }

  async handleToolCall(message: {
    requestId: string;
    callId: string;
    name: string;
    args: Record<string, unknown>;
  }): Promise<void> {
    const pending = this.pending.get(message.requestId);
    if (!pending) return;

    let response: { result?: unknown; error?: string };

    try {
      const handler = pending.handlers.get(message.name);

      if (!handler) {
        throw new Error(`llm: unknown tool "${message.name}"`);
      }

      response = {
        result: await handler({
          id: message.callId,
          name: message.name,
          args: message.args
        })
      };
    } catch (error) {
      response = { error: error instanceof Error ? error.message : String(error) };
    }

    if (!this.pending.has(message.requestId)) return;

    this.postMessage({
      type: 'llmToolResult',
      nodeId: pending.nodeId,
      requestId: message.requestId,
      callId: message.callId,
      ...response
    });
  }

  handleResponse(response: LLMResponse): void {
    const pending = this.pending.get(response.requestId);

    if (!pending) return;

    this.pending.delete(response.requestId);
    pending.cleanup();

    if (response.error !== undefined) {
      pending.reject(new Error(response.error));
    } else if (pending.returnTurn) {
      if (response.turn) {
        pending.resolve(response.turn);
      } else {
        pending.reject(new Error('LLM response is missing its assistant turn'));
      }
    } else {
      pending.resolve(response.text ?? '');
    }
  }
}
