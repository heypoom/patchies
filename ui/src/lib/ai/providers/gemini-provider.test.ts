import { expect, test, vi } from 'vitest';
import { GeminiProvider } from './gemini-provider';

const { generateContentStream } = vi.hoisted(() => ({ generateContentStream: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContentStream };
  }
}));

test('retains signed text and signature-only stream parts and replays them unchanged', async () => {
  const parts = [
    { text: 'Answer', thoughtSignature: 'text-signature' },
    { text: '', thoughtSignature: 'final-signature' }
  ];

  generateContentStream.mockImplementation(async function* () {
    for (const part of parts) {
      yield { candidates: [{ content: { parts: [part] } }] };
    }
  });

  const controller = new AbortController();
  const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

  const provider = new GeminiProvider('test-key', 'test-model');

  const result = await provider.streamTurn([{ role: 'user', content: 'First' }], {
    temperature: 0.3,
    topK: 8,
    systemPrompt: 'Brief',
    signal: controller.signal
  });

  expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));

  expect(result.text).toBe('Answer');
  expect(result._rawModelTurn).toEqual({ parts });

  await provider.streamTurn(
    [
      { role: 'user', content: 'First' },
      { role: 'model', content: result.text, _raw: result._rawModelTurn },
      { role: 'user', content: 'Next' }
    ],
    {}
  );

  expect(generateContentStream.mock.calls[1][0].contents).toEqual([
    { role: 'user', parts: [{ text: 'First' }] },
    { role: 'model', parts },
    { role: 'user', parts: [{ text: 'Next' }] }
  ]);

  expect(generateContentStream.mock.calls[0][0].config).toMatchObject({
    temperature: 0.3,
    topK: 8,
    systemInstruction: 'Brief'
  });
});

test('runs a tool loop with JSON Schema declarations and replays signed tool calls', async () => {
  const { generateLLMTurn } = await import('../llm-js/llm-tool-loop');

  generateContentStream.mockReset();

  const signedPart = {
    functionCall: { name: 'readTempo', args: {} },
    thoughtSignature: 'tool-signature'
  };

  generateContentStream.mockImplementationOnce(async function* () {
    yield { candidates: [{ content: { parts: [signedPart] } }] };
  });

  generateContentStream.mockImplementation(async function* () {
    yield {
      candidates: [
        { content: { parts: [{ text: '120 BPM', thoughtSignature: 'final-signature' }] } }
      ]
    };
  });

  const provider = new GeminiProvider('test-key', 'test-model');
  const run = vi.fn().mockReturnValue({ bpm: 120 });

  const turn = await generateLLMTurn({
    provider,
    messages: [{ role: 'user', content: 'Read tempo' }],
    options: { tools: { readTempo: { description: 'Read tempo', run } } }
  });

  expect(turn.content).toBe('120 BPM');
  expect(run).toHaveBeenCalledWith({});

  expect(generateContentStream.mock.calls[0][0].config.tools).toEqual([
    {
      functionDeclarations: [
        {
          name: 'readTempo',
          description: 'Read tempo',
          parametersJsonSchema: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false
          }
        }
      ]
    }
  ]);

  expect(generateContentStream.mock.calls[1][0].contents).toEqual([
    { role: 'user', parts: [{ text: 'Read tempo' }] },
    { role: 'model', parts: [signedPart] },
    { role: 'user', parts: [{ functionResponse: { name: 'readTempo', response: { bpm: 120 } } }] }
  ]);
});

test.each([
  { result: { bpm: 120 }, response: { bpm: 120 } },
  { result: [120, 140], response: { value: [120, 140] } },
  { result: [], response: { value: [] } },
  { result: null, response: { value: null } },
  { result: 'ready', response: { value: 'ready' } },
  { result: 120, response: { value: 120 } },
  { result: false, response: { value: false } }
])('sends tool result $result as a Gemini response object', async ({ result, response }) => {
  generateContentStream.mockReset();

  generateContentStream.mockImplementation(async function* () {
    yield { candidates: [{ content: { parts: [{ text: 'Done' }] } }] };
  });

  const provider = new GeminiProvider('test-key', 'test-model');

  await provider.streamTurn(
    [{ role: 'user', content: '', toolResults: [{ callId: 'call-1', name: 'read', result }] }],
    {}
  );

  expect(generateContentStream.mock.calls[0][0].contents).toEqual([
    { role: 'user', parts: [{ functionResponse: { name: 'read', response } }] }
  ]);
});
