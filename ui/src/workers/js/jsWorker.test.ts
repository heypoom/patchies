import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { WorkerMessage, WorkerResponse } from '$lib/js-runner/js-worker-types';

beforeEach(() => vi.resetModules());

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('worker emits running and stopped activity for delay and LLM calls', async () => {
  vi.useFakeTimers();

  const sent: WorkerResponse[] = [];

  const worker = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    postMessage: (message: WorkerResponse) => sent.push(message),
    onmessage: null as unknown as (event: { data: WorkerMessage }) => Promise<void>
  };

  vi.stubGlobal('self', worker);
  await import('./jsWorker');

  const dispatch = (data: WorkerMessage) => worker.onmessage({ data });
  const activity = () => sent.filter((message) => message.type === 'callbackRegistered');

  await dispatch({
    type: 'executeCode',
    nodeId: 'worker-test',
    code: 'await delay(1000)',
    processedCode: 'await delay(1000)'
  });

  expect(activity()).toEqual([
    { type: 'callbackRegistered', nodeId: 'worker-test', callbackType: 'async', active: true }
  ]);

  await vi.advanceTimersByTimeAsync(1000);

  expect(activity().at(-1)).toMatchObject({ callbackType: 'async', active: false });
  expect(sent.some((message) => message.type === 'executionComplete')).toBe(true);

  sent.length = 0;

  await dispatch({
    type: 'executeCode',
    nodeId: 'worker-test',
    code: "await llm('Hello')",
    processedCode: "await llm('Hello')"
  });

  const request = sent.find((message) => message.type === 'llmRequest');

  expect(request?.type).toBe('llmRequest');

  if (request?.type !== 'llmRequest') {
    throw new Error('Missing request');
  }

  expect(activity().at(-1)).toMatchObject({ callbackType: 'async', active: true });

  await dispatch({
    type: 'llmConfig',
    nodeId: 'worker-test',
    requestId: request.requestId,
    text: 'Answer'
  });

  await vi.advanceTimersByTimeAsync(0);

  expect(activity().at(-1)).toMatchObject({ callbackType: 'async', active: false });
  expect(sent.some((message) => message.type === 'executionComplete')).toBe(true);
});

test.each(['cleanup', 'destroy', 'executeCode'] as const)(
  'cancels pending LLM requests on %s',
  async (type) => {
    vi.useFakeTimers();

    const sent: WorkerResponse[] = [];

    const worker = {
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      postMessage: (message: WorkerResponse) => sent.push(message),
      onmessage: null as unknown as (event: { data: WorkerMessage }) => Promise<void>
    };

    vi.stubGlobal('self', worker);
    await import('./jsWorker');

    const nodeId = 'worker-cancel-test';
    const code = "await llm('Hello').catch(() => {})";

    await worker.onmessage({ data: { type: 'executeCode', nodeId, code, processedCode: code } });

    const request = sent.find((message) => message.type === 'llmRequest');

    if (!request || request.type !== 'llmRequest') {
      throw new Error('Missing LLM request');
    }

    const data: WorkerMessage =
      type === 'executeCode' ? { type, nodeId, code: '', processedCode: '' } : { type, nodeId };

    await worker.onmessage({ data });
    await vi.advanceTimersByTimeAsync(0);

    expect(sent).toContainEqual({ type: 'llmAbort', nodeId, requestId: request.requestId });

    expect(sent.filter((message) => message.type === 'executionComplete')).toHaveLength(
      type === 'executeCode' ? 2 : 1
    );
  }
);
