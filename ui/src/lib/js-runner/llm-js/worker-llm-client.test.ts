import { expect, test, vi } from 'vitest';

import { AsyncActivityTracker } from '../AsyncActivityTracker';
import { WorkerLLMClient } from './worker-llm-client';

test('aborts every request for a node and suppresses its late tool results', async () => {
  const send = vi.fn();
  const client = new WorkerLLMClient(send);

  const controller = new AbortController();
  const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

  const llm = client.createFunction('worker-1', new AsyncActivityTracker(() => {}));
  const otherLlm = client.createFunction('worker-2', new AsyncActivityTracker(() => {}));

  let finish!: (value: number) => void;

  const run = vi.fn(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      })
  );

  const text = llm('First', {
    abortSignal: controller.signal,
    tools: { read: { description: 'Read tempo', run } }
  });

  const turn = llm.turn('Second');
  const other = otherLlm('Third');

  const rejectedText = expect(text).rejects.toThrow('LLM request aborted');
  const rejectedTurn = expect(turn).rejects.toThrow('LLM request aborted');

  const toolCall = {
    requestId: 'llm-worker-1-1',
    callId: 'tool-1',
    name: 'read',
    args: {}
  };

  const executing = client.handleToolCall(toolCall);

  client.abortNode('worker-1');
  await Promise.all([rejectedText, rejectedTurn]);

  expect(send.mock.calls.slice(3).map(([message]) => message)).toEqual([
    { type: 'llmAbort', nodeId: 'worker-1', requestId: 'llm-worker-1-1' },
    { type: 'llmAbort', nodeId: 'worker-1', requestId: 'llm-worker-1-2' }
  ]);

  expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));

  controller.abort();
  client.abortNode('worker-1');
  client.handleResponse({ requestId: 'llm-worker-1-1', text: 'Late' });
  finish(120);
  await executing;
  await client.handleToolCall(toolCall);

  expect(send).toHaveBeenCalledTimes(5);
  expect(run).toHaveBeenCalledTimes(1);

  client.handleResponse({ requestId: 'llm-worker-2-3', text: 'Still active' });
  await expect(other).resolves.toBe('Still active');
});

test('sends history and options, returns state intact, and removes abort listeners on completion', async () => {
  const send = vi.fn();
  const client = new WorkerLLMClient(send);
  const llm = client.createFunction('worker-1', new AsyncActivityTracker(() => {}));
  const controller = new AbortController();
  const input = [{ role: 'user' as const, content: 'First' }];

  const pending = llm.turn(input, {
    provider: 'openrouter',
    model: 'test-model',
    temperature: 0.4,
    topK: 5,
    systemPrompt: 'Brief',
    abortSignal: controller.signal
  });

  input[0].content = 'Changed';

  expect(send.mock.calls[0][0]).toEqual({
    type: 'llmRequest',
    nodeId: 'worker-1',
    requestId: 'llm-worker-1-1',
    input: [{ role: 'user', content: 'First' }],
    returnTurn: true,
    options: {
      provider: 'openrouter',
      model: 'test-model',
      temperature: 0.4,
      topK: 5,
      systemPrompt: 'Brief'
    }
  });

  const turn = {
    role: 'assistant' as const,
    content: 'Answer',
    state: {
      provider: 'openrouter',
      model: 'test-model',
      content: 'Answer',
      raw: { reasoning_details: [{ type: 'reasoning.encrypted', data: 'opaque' }] }
    }
  };

  client.handleResponse({ requestId: 'llm-worker-1-1', turn });

  expect(await pending).toEqual(turn);

  controller.abort();

  expect(send).toHaveBeenCalledTimes(1);
});

test('cancels the main-thread request and ignores a late response', async () => {
  const send = vi.fn();
  const client = new WorkerLLMClient(send);
  const controller = new AbortController();
  const llm = client.createFunction('worker-1', new AsyncActivityTracker(() => {}));

  const pending = llm('First', {
    abortSignal: controller.signal
  });

  const rejected = expect(pending).rejects.toThrow('aborted');
  controller.abort();
  await rejected;

  expect(send.mock.calls[1][0]).toEqual({
    type: 'llmAbort',
    nodeId: 'worker-1',
    requestId: 'llm-worker-1-1'
  });

  client.handleResponse({ requestId: 'llm-worker-1-1', text: 'Late' });
});

test('rejects invalid requests locally and propagates main-thread errors', async () => {
  const send = vi.fn();
  const client = new WorkerLLMClient(send);
  const llm = client.createFunction('worker-1', new AsyncActivityTracker(() => {}));

  await expect(llm([])).rejects.toThrow('non-empty');

  expect(send).not.toHaveBeenCalled();

  const pending = llm('First');
  client.handleResponse({ requestId: 'llm-worker-1-1', error: 'Provider failed' });

  await expect(pending).rejects.toThrow('Provider failed');
});

test('returns handler errors and suppresses late tool results after cancellation', async () => {
  const send = vi.fn();
  const client = new WorkerLLMClient(send);
  const controller = new AbortController();
  const run = vi.fn().mockRejectedValueOnce(new Error('Cannot read tempo'));
  const llm = client.createFunction('worker-1', new AsyncActivityTracker(() => {}));

  const pending = llm('First', {
    abortSignal: controller.signal,
    tools: { readTempo: { description: 'Read tempo', run } }
  });

  const rejected = expect(pending).rejects.toThrow('aborted');

  await client.handleToolCall({
    requestId: 'llm-worker-1-1',
    callId: 'tool-1',
    name: 'readTempo',
    args: {}
  });

  expect(send.mock.calls[1][0]).toMatchObject({
    type: 'llmToolResult',
    error: 'Cannot read tempo'
  });

  let finish: (result: unknown) => void = () => {};

  run.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );

  const toolCall = client.handleToolCall({
    requestId: 'llm-worker-1-1',
    callId: 'tool-2',
    name: 'readTempo',
    args: {}
  });

  controller.abort();
  finish({ bpm: 120 });

  await toolCall;
  await rejected;

  expect(send).toHaveBeenCalledTimes(3);
  expect(send.mock.calls[2][0].type).toBe('llmAbort');
});

test('reports activity through overlapping text and turn requests until both settle', async () => {
  const changed = vi.fn();
  const client = new WorkerLLMClient(vi.fn());
  const llm = client.createFunction('worker-1', new AsyncActivityTracker(changed));

  const text = llm('First');
  const turn = llm.turn('Second');
  const failed = expect(turn).rejects.toThrow('Provider failed');

  expect(changed.mock.calls).toEqual([[true]]);

  client.handleResponse({ requestId: 'llm-worker-1-1', text: 'Answer' });
  await expect(text).resolves.toBe('Answer');

  expect(changed.mock.calls).toEqual([[true]]);

  client.handleResponse({ requestId: 'llm-worker-1-2', error: 'Provider failed' });
  await failed;

  expect(changed.mock.calls).toEqual([[true], [false]]);
});
