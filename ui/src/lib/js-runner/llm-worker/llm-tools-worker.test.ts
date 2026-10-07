import { expect, test, vi } from 'vitest';

import { AsyncActivityTracker } from '../AsyncActivityTracker';
import { WorkerLLMClient } from './worker-llm-client';
import { WorkerLLMProxy } from './WorkerLLMProxy';
import type { WorkerMessage } from '../js-worker-types';

const { provider } = vi.hoisted(() => ({
  provider: { id: 'gemini', model: 'test-model', generateText: vi.fn(), streamTurn: vi.fn() }
}));

vi.mock('$lib/ai/providers', () => ({ getTextProvider: () => provider }));
vi.mock('$lib/canvas/GLSystem', () => ({ GLSystem: {} }));

test('keeps callbacks in the worker and transfers only definitions, arguments, and results', async () => {
  const proxy = new WorkerLLMProxy();
  const wire = vi.fn();

  const worker = {
    postMessage: (message: WorkerMessage) => {
      structuredClone(message);

      if (message.type === 'llmToolCall') {
        void client.handleToolCall(message);
      }

      if (message.type === 'llmConfig') {
        client.handleResponse(message);
      }
    }
  } as unknown as Worker;

  const client = new WorkerLLMClient((message) => {
    wire(structuredClone(message));

    if (message.type === 'llmRequest') {
      void proxy.handle({
        nodeId: message.nodeId,
        worker,
        requestId: message.requestId,
        input: message.input,
        options: message.options,
        returnTurn: message.returnTurn
      });
    }

    if (message.type === 'llmToolResult') {
      proxy.handleToolResult(message.nodeId, message);
    }

    if (message.type === 'llmAbort') {
      proxy.abortRequest(message.nodeId, message.requestId);
    }
  });

  const run = vi.fn().mockResolvedValue({ bpm: 120 });

  provider.streamTurn.mockResolvedValueOnce({
    text: '',
    toolCalls: [{ id: 'call-1', name: 'readTempo', args: {} }],
    _rawModelTurn: { signed: true }
  });

  provider.streamTurn.mockResolvedValue({ text: '120 BPM', toolCalls: [], _rawModelTurn: {} });

  const turn = await client
    .createFunction('worker-1', new AsyncActivityTracker(() => {}))
    .turn('Read tempo', { tools: { readTempo: { description: 'Read tempo', run } } });

  expect(run).toHaveBeenCalledWith({});
  expect(turn.content).toBe('120 BPM');

  expect(turn.state?.steps?.[1].toolResults).toEqual([
    { callId: 'call-1', name: 'readTempo', result: { bpm: 120 } }
  ]);

  expect(wire.mock.calls[0][0].options.tools).toEqual({ readTempo: { description: 'Read tempo' } });
  expect(wire.mock.calls[1][0]).toMatchObject({ type: 'llmToolResult', result: { bpm: 120 } });
});
