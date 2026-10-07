import { expect, test, vi } from 'vitest';

import { WorkerLLMProxy } from './WorkerLLMProxy';

const { llm } = vi.hoisted(() => ({ llm: Object.assign(vi.fn(), { turn: vi.fn() }) }));

vi.mock('$lib/ai/google', () => ({ createLLMFunction: () => llm }));

test('forwards conversation options and retained assistant turns to the worker', async () => {
  const proxy = new WorkerLLMProxy();
  const worker = { postMessage: vi.fn() } as unknown as Worker;

  const turn = {
    role: 'assistant',
    content: 'Reply',
    state: { provider: 'gemini', model: 'm', content: 'Reply', raw: { parts: [] } }
  };

  llm.turn.mockResolvedValue(turn);

  const input = [{ role: 'user' as const, content: 'First' }];

  const options = {
    provider: 'gemini' as const,
    model: 'm',
    temperature: 0.4,
    systemPrompt: 'Brief'
  };

  await proxy.handle({
    nodeId: 'worker-1',
    worker,
    requestId: 'request-1',
    input,
    options,
    returnTurn: true
  });

  expect(llm.turn).toHaveBeenCalledWith(input, {
    ...options,
    abortSignal: expect.any(AbortSignal)
  });

  expect(worker.postMessage).toHaveBeenCalledWith({
    type: 'llmConfig',
    nodeId: 'worker-1',
    requestId: 'request-1',
    turn
  });
});

test('aborts requests only for their owning node and reports cancellation', async () => {
  const proxy = new WorkerLLMProxy();
  const worker = { postMessage: vi.fn() } as unknown as Worker;

  llm.mockImplementation(
    (_input, options) =>
      new Promise((_resolve, reject) => {
        options.abortSignal.addEventListener('abort', () => reject(new Error('Cancelled')), {
          once: true
        });
      })
  );

  const pending = proxy.handle({
    nodeId: 'worker-1',
    worker,
    requestId: 'request-2',
    input: 'First'
  });

  proxy.abortRequest('other-node', 'request-2');

  expect(worker.postMessage).not.toHaveBeenCalled();

  proxy.abortNode('worker-1');
  await pending;

  expect(worker.postMessage).toHaveBeenCalledWith({
    type: 'llmConfig',
    nodeId: 'worker-1',
    requestId: 'request-2',
    error: 'Cancelled'
  });
});
