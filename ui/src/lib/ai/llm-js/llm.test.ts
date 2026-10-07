import { reactive } from 'vue';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { createLLMFunction } from '../google';
import type { LLMConversationTurn, LLMInput } from './llm-input';

const { provider, getTextProvider, gl } = vi.hoisted(() => ({
  provider: { id: 'gemini', model: 'test-model', generateText: vi.fn(), streamTurn: vi.fn() },
  getTextProvider: vi.fn(),
  gl: { eventBus: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, send: vi.fn() }
}));

vi.mock('../providers', () => ({ getTextProvider }));
vi.mock('$lib/canvas/GLSystem', () => ({ GLSystem: { getInstance: () => gl } }));

beforeEach(() => {
  vi.clearAllMocks();
  getTextProvider.mockReturnValue(provider);
  provider.generateText.mockResolvedValue('Reply');

  provider.streamTurn.mockResolvedValue({
    text: 'Reply',
    toolCalls: [],
    _rawModelTurn: { parts: [{ text: 'Reply', thoughtSignature: 'signed' }] }
  });
});

afterEach(() => vi.unstubAllGlobals());

const history = (): LLMConversationTurn[] => [
  { role: 'user', content: 'First' },
  { role: 'assistant', content: 'Answer' },
  { role: 'user', content: 'Follow-up' }
];

test('forwards ordered history, string shorthand, and options without changing caller input', async () => {
  const llm = createLLMFunction();
  const convo = history();
  const signal = new AbortController().signal;

  expect(
    await llm(convo, {
      provider: 'gemini',
      model: 'test-model',
      systemPrompt: 'Brief',
      temperature: 0.3,
      topK: 8,
      abortSignal: signal
    })
  ).toBe('Reply');

  expect(getTextProvider).toHaveBeenCalledWith('test-model', 'gemini');

  expect(provider.generateText).toHaveBeenCalledWith(
    [
      { role: 'user', content: 'First' },
      { role: 'model', content: 'Answer' },
      { role: 'user', content: 'Follow-up' }
    ],
    { signal, systemPrompt: 'Brief', temperature: 0.3, topK: 8 }
  );

  expect(convo).toEqual(history());

  await llm('One request');

  expect(provider.generateText.mock.calls[1][0]).toEqual([
    { role: 'user', content: 'One request' }
  ]);
});

test.each([
  [[], 'non-empty'],
  [[{ role: 'assistant', content: 'Wrong' }], 'turn 0'],
  [[{ role: 'user', content: 42 }], 'turn 0'],
  [
    [
      { role: 'user', content: 'First' },
      { role: 'user', content: 'Second' }
    ],
    'turn 1'
  ],
  [[{ role: 'user', content: 'First', images: [] }], 'turn 0'],
  [
    [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Answer' }
    ],
    'end with a user'
  ]
])('rejects malformed history before requesting a provider', async (input, error) => {
  await expect(createLLMFunction()(input as LLMInput)).rejects.toThrow(error as string);

  expect(getTextProvider).not.toHaveBeenCalled();
});

test.each([false, true])('replays and snapshots opaque state (reactive=%s)', async (isReactive) => {
  const llm = createLLMFunction();
  const turn = await llm.turn('First');

  const convo: LLMConversationTurn[] = [
    { role: 'user', content: 'First' },
    turn,
    { role: 'user', content: 'Next' }
  ];

  const pending = llm(isReactive ? reactive(convo) : convo);
  (turn.state!.raw as { parts: { text: string }[] }).parts[0].text = 'Edited later';

  expect(await pending).toBe('Reply');

  expect(provider.streamTurn.mock.calls[1][0][1]).toEqual({
    role: 'model',
    content: 'Reply',
    _raw: { parts: [{ text: 'Reply', thoughtSignature: 'signed' }] }
  });

  expect(provider.generateText).not.toHaveBeenCalled();
});

test('rejects changed models and edited assistant text with retained state', async () => {
  const llm = createLLMFunction();
  const turn = await llm.turn('First');

  const convo: LLMConversationTurn[] = [
    { role: 'user', content: 'First' },
    turn,
    { role: 'user', content: 'Next' }
  ];

  provider.model = 'different';

  await expect(llm(convo)).rejects.toThrow('different provider or model');

  provider.model = 'test-model';
  turn.content = 'Edited';

  await expect(llm(convo)).rejects.toThrow('edited reasoning state');
});

test('captures a frame only for the final user turn and snapshots history before capture', async () => {
  const convo = history();
  let captured: (event: unknown) => void = () => {};

  gl.eventBus.addEventListener.mockImplementation((_name, handler) => {
    captured = handler;
  });

  gl.send.mockImplementation((_name, event) => {
    convo[0].content = 'Changed while capturing';
    captured({ requestId: event.requestId, success: true, bitmap: { width: 2, height: 2 } });
  });

  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: () => 'data:image/jpeg;base64,frame'
    })
  });

  await createLLMFunction()(convo, { imageNodeId: 'canvas-1' });

  expect(provider.generateText.mock.calls[0][0]).toEqual([
    { role: 'user', content: 'First' },
    { role: 'model', content: 'Answer' },
    { role: 'user', content: 'Follow-up', images: [{ mimeType: 'image/jpeg', data: 'frame' }] }
  ]);

  expect(convo[2]).toEqual({ role: 'user', content: 'Follow-up' });
});

test('does not request AI for an already aborted signal and propagates provider errors', async () => {
  const controller = new AbortController();
  controller.abort();

  await expect(createLLMFunction()('First', { abortSignal: controller.signal })).rejects.toThrow(
    'cancelled'
  );

  expect(getTextProvider).not.toHaveBeenCalled();

  provider.generateText.mockRejectedValue(new Error('Provider unavailable'));
  await expect(createLLMFunction()('First')).rejects.toThrow('Provider unavailable');
});

test('executes tools and preserves their signed trace across later conversation calls', async () => {
  const llm = createLLMFunction();

  const run = vi.fn().mockImplementation(async (args) => {
    const applied = args.color;
    args.color = 'changed-by-handler';

    return { applied };
  });

  const tools = {
    setColor: {
      description: 'Choose a color',
      parameters: { color: { type: 'string', enum: ['blue', 'red'] } },
      run
    }
  };

  provider.streamTurn.mockReset();

  provider.streamTurn.mockResolvedValueOnce({
    text: '',
    toolCalls: [{ id: 'call-1', name: 'setColor', args: { color: 'blue' } }],
    _rawModelTurn: { signed: 'tool-signature' }
  });

  provider.streamTurn.mockResolvedValue({
    text: 'Done',
    toolCalls: [],
    _rawModelTurn: { signed: 'final-signature' }
  });

  const turn = await llm.turn('Make it blue', { tools });

  expect(run).toHaveBeenCalledTimes(1);
  expect(turn.content).toBe('Done');
  expect(turn.state?.steps).toEqual([
    {
      role: 'model',
      content: '',
      toolCalls: [{ id: 'call-1', name: 'setColor', args: { color: 'blue' } }],
      _raw: { signed: 'tool-signature' }
    },
    {
      role: 'user',
      content: '',
      toolResults: [{ callId: 'call-1', name: 'setColor', result: { applied: 'blue' } }]
    }
  ]);

  await llm([{ role: 'user', content: 'Make it blue' }, turn, { role: 'user', content: 'Next' }], {
    tools
  });

  expect(provider.streamTurn.mock.calls.at(-1)![0]).toEqual([
    { role: 'user', content: 'Make it blue' },
    ...turn.state!.steps!,
    { role: 'model', content: 'Done', _raw: { signed: 'final-signature' } },
    { role: 'user', content: 'Next' }
  ]);
});

test.each([
  [{ color: 42 }, 'invalid arguments'],
  [{ color: 'green' }, 'invalid arguments'],
  [{ color: 'blue', surprise: true }, 'invalid arguments']
])('rejects invalid tool arguments before executing handlers', async (args, error) => {
  const run = vi.fn();

  provider.streamTurn.mockResolvedValue({
    text: '',
    toolCalls: [{ id: 'c1', name: 'setColor', args }],
    _rawModelTurn: {}
  });

  await expect(
    createLLMFunction()('First', {
      tools: {
        setColor: {
          description: 'Set color',
          parameters: { color: { type: 'string', enum: ['blue'] } },
          run
        }
      }
    })
  ).rejects.toThrow(error);

  expect(run).not.toHaveBeenCalled();
});

test('rejects oversized tool batches, unknown tools, and handler failures', async () => {
  const run = vi.fn().mockRejectedValue(new Error('Handler failed'));
  const options = { tools: { read: { description: 'Read', run } }, maxToolCalls: 1 };
  const call = { id: 'c1', name: 'read', args: {} };

  provider.streamTurn.mockResolvedValue({
    text: '',
    toolCalls: [call, { ...call, id: 'c2' }],
    _rawModelTurn: {}
  });

  await expect(createLLMFunction()('First', options)).rejects.toThrow('maxToolCalls');
  expect(run).not.toHaveBeenCalled();

  provider.streamTurn.mockResolvedValue({
    text: '',
    toolCalls: [{ ...call, name: 'missing' }],
    _rawModelTurn: {}
  });

  await expect(createLLMFunction()('First', options)).rejects.toThrow('unknown tool');
  expect(run).not.toHaveBeenCalled();

  provider.streamTurn.mockResolvedValue({ text: '', toolCalls: [call], _rawModelTurn: {} });

  await expect(createLLMFunction()('First', options)).rejects.toThrow('Handler failed');
});

test('bounds repeated calls and rejects invalid tool definitions and results', async () => {
  const run = vi.fn().mockReturnValue(undefined);

  provider.streamTurn.mockResolvedValue({
    text: '',
    toolCalls: [{ id: 'c1', name: 'read', args: {} }],
    _rawModelTurn: {}
  });

  await expect(
    createLLMFunction()('First', { tools: { read: { description: 'Read', run } }, maxToolCalls: 2 })
  ).rejects.toThrow('maxToolCalls');

  expect(run).toHaveBeenCalledTimes(2);
  expect(provider.streamTurn.mock.calls[1][0][2].toolResults[0].result).toBeNull();

  provider.streamTurn.mockClear();

  await expect(
    createLLMFunction()('First', {
      tools: { read: { description: 'Read', parameters: { value: { type: 'nonsense' } }, run } }
    })
  ).rejects.toThrow();

  expect(provider.streamTurn).not.toHaveBeenCalled();

  run.mockReturnValue({ nested: () => {} });

  provider.streamTurn.mockResolvedValue({
    text: '',
    toolCalls: [{ id: 'c1', name: 'read', args: {} }],
    _rawModelTurn: {}
  });

  await expect(
    createLLMFunction()('First', { tools: { read: { description: 'Read', run } } })
  ).rejects.toThrow('JSON-compatible');
});

test('cancels while a handler is running and never asks for another model turn', async () => {
  const controller = new AbortController();

  const run = vi.fn().mockImplementation(() => {
    controller.abort();
    return new Promise(() => {});
  });

  provider.streamTurn.mockResolvedValue({
    text: '',
    toolCalls: [{ id: 'c1', name: 'read', args: {} }],
    _rawModelTurn: {}
  });

  await expect(
    createLLMFunction()('First', {
      tools: { read: { description: 'Read', run } },
      abortSignal: controller.signal
    })
  ).rejects.toThrow('cancelled');

  expect(provider.streamTurn).toHaveBeenCalledTimes(1);
});

test('validates nested schemas and executes multiple tools in model order', async () => {
  const order: string[] = [];

  const tools = {
    colors: {
      description: 'Set colors',
      parameters: {
        config: {
          type: 'object',
          properties: { colors: { type: 'array', items: { type: 'string' }, minItems: 1 } },
          required: ['colors'],
          additionalProperties: false
        }
      },
      run: async () => {
        order.push('colors');
        return { done: true };
      }
    },
    read: {
      description: 'Read',
      run: () => {
        order.push('read');
        return 120;
      }
    }
  };

  provider.streamTurn.mockResolvedValueOnce({
    text: '',
    toolCalls: [
      { id: 'c1', name: 'colors', args: { config: { colors: ['blue'] } } },
      { id: 'c2', name: 'read', args: {} }
    ],
    _rawModelTurn: {}
  });

  provider.streamTurn.mockResolvedValue({
    text: 'Done',
    toolCalls: [],
    _rawModelTurn: {}
  });

  expect(await createLLMFunction()('First', { tools })).toBe('Done');
  expect(order).toEqual(['colors', 'read']);
});
