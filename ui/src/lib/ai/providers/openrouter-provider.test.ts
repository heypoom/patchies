import { afterEach, describe, expect, test, vi } from 'vitest';
import { OpenRouterProvider } from './openrouter-provider';
import type { ChatTurnMessage, ThinkingCallback } from './types';

const provider = new OpenRouterProvider('test-key', 'test-model');
const delta = (value: Record<string, unknown>) => ({ choices: [{ delta: value }] });

function mockStream(events: unknown[], options: { fragmentBytes?: boolean; done?: boolean } = {}) {
  const payload =
    ': OPENROUTER PROCESSING\r\n\r\n' +
    events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join('') +
    (options.done === false ? '' : 'data: [DONE]\r\n\r\n');
  const bytes = new TextEncoder().encode(payload);
  const fetchMock = vi.fn().mockImplementation(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            if (options.fragmentBytes) {
              for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
            } else {
              controller.enqueue(bytes);
            }

            controller.close();
          }
        })
      )
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

for (const method of ['generateText', 'streamTurn'] as const) {
  describe(method, () => {
    const run = (onThinking?: ThinkingCallback, onText?: (text: string) => void) =>
      provider[method]([{ role: 'user', content: 'Test' }], {
        onThinking,
        onToken: onText,
        onChunk: onText
      });

    test('streams plaintext deltas without changing whitespace across byte boundaries', async () => {
      mockStream(
        [
          delta({ reasoning: 'The' }),
          delta({ reasoning_content: ' user wants café.\n' }),
          delta({ content: 'Done 🎉' })
        ],
        { fragmentBytes: true }
      );
      const thoughts = vi.fn();
      const text = vi.fn();

      await run(thoughts, text);

      expect(thoughts.mock.calls).toEqual([
        ['', { newGeneration: true }],
        ['The'],
        [' user wants café.\n']
      ]);
      expect(text).toHaveBeenCalledWith('Done 🎉');
    });

    test('displays text and summary blocks without duplicating plaintext', async () => {
      mockStream([
        delta({
          reasoning: 'Think',
          reasoning_details: [{ type: 'reasoning.text', text: 'Think', index: 0 }]
        }),
        delta({ reasoning_details: [{ type: 'reasoning.text', text: ' carefully.', index: 0 }] }),
        delta({
          reasoning_details: [{ type: 'reasoning.summary', summary: '\nSummary.', index: 1 }]
        })
      ]);
      const thoughts = vi.fn();

      await run(thoughts);

      expect(thoughts.mock.calls.slice(1)).toEqual([['Think'], [' carefully.'], ['\nSummary.']]);
    });

    test('shows one notice for encrypted-only reasoning without exposing ciphertext', async () => {
      mockStream([
        delta({ reasoning_details: [{ type: 'reasoning.encrypted', data: 'secret-a', index: 0 }] }),
        delta({ reasoning_details: [{ type: 'reasoning.encrypted', data: 'secret-b', index: 0 }] })
      ]);
      const thoughts = vi.fn();

      await run(thoughts);

      expect(thoughts.mock.calls.slice(1)).toEqual([
        ['\n\nReasoning is encrypted and cannot be displayed.\n\n']
      ]);
    });

    test.each([
      { reasoning: 'Readable.' },
      {
        reasoning_details: [
          { type: 'reasoning.text', text: 'Readable.', signature: 'private-signature', index: 1 }
        ]
      },
      { reasoning_details: [{ type: 'reasoning.summary', summary: 'Readable.', index: 1 }] }
    ])('suppresses the encrypted notice with readable reasoning: %j', async (readable) => {
      const encrypted = {
        reasoning_details: [{ type: 'reasoning.encrypted', data: 'secret', index: 0 }]
      };

      for (const events of [
        [delta(encrypted), delta(readable)],
        [delta(readable), delta(encrypted)],
        [
          delta({
            ...readable,
            reasoning_details: [
              ...(readable.reasoning_details ?? []),
              ...encrypted.reasoning_details
            ]
          })
        ]
      ]) {
        mockStream(events);
        const thoughts = vi.fn();

        await run(thoughts);

        expect(thoughts.mock.calls.slice(1)).toEqual([['Readable.']]);
      }
    });

    test.each([false, true])(
      'rejects an API error after HTTP 200, partial output: %s',
      async (partial) => {
        mockStream([
          ...(partial ? [delta({ content: 'Partial' })] : []),
          {
            error: { code: 'server_error', message: 'Provider disconnected' },
            choices: [{ delta: {}, finish_reason: 'error' }]
          }
        ]);

        await expect(run()).rejects.toThrow('OpenRouter stream error: Provider disconnected');
      }
    );

    test('rejects error finish reasons without an error object', async () => {
      mockStream([{ choices: [{ delta: {}, finish_reason: 'error' }] }]);

      await expect(run()).rejects.toThrow('Generation failed');
    });

    test('rejects truncated responses rather than applying partial output', async () => {
      mockStream([{ choices: [{ delta: { content: 'Partial' }, finish_reason: 'length' }] }]);

      await expect(run()).rejects.toThrow('token limit');
    });

    test('does not swallow consumer callback errors', async () => {
      mockStream([delta({ content: 'Answer' })]);

      await expect(
        run(undefined, () => {
          throw new Error('Consumer failed');
        })
      ).rejects.toThrow('Consumer failed');
    });

    test('flushes a final event without a newline and stops at DONE', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(`data: ${JSON.stringify(delta({ content: 'Final' }))}`))
      );

      const text = vi.fn();
      await run(undefined, text);

      expect(text).toHaveBeenCalledExactlyOnceWith('Final');

      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              `data: [DONE]\n\ndata: ${JSON.stringify(delta({ content: 'Unexpected' }))}\n\n`
            )
        )
      );
      text.mockClear();
      await run(undefined, text);

      expect(text).not.toHaveBeenCalled();
    });
  });
}

test('replays complete structured reasoning in the next tool turn', async () => {
  mockStream([
    delta({
      reasoning: 'Think',
      reasoning_details: [
        { type: 'reasoning.text', text: 'Think', index: 0, id: 'r0', format: 'anthropic-claude-v1' }
      ]
    }),
    delta({
      reasoning_details: [
        { type: 'reasoning.text', text: ' carefully', signature: 'sig-', index: 0 }
      ]
    }),
    delta({ reasoning_details: [{ type: 'reasoning.text', signature: 'complete', index: 0 }] }),
    delta({
      reasoning_details: [{ type: 'reasoning.encrypted', data: 'opaque-', index: 1, id: 'r1' }]
    }),
    delta({ reasoning_details: [{ type: 'reasoning.encrypted', data: 'complete', index: 1 }] }),
    delta({
      tool_calls: [{ index: 0, id: 'call1', function: { name: 'lookup', arguments: '{"query":' } }]
    }),
    delta({ tool_calls: [{ index: 0, function: { arguments: '"test"}' } }] })
  ]);

  const first = await provider.streamTurn([{ role: 'user', content: 'Look up test' }], {});

  expect(first.toolCalls).toEqual([{ id: 'call1', name: 'lookup', args: { query: 'test' } }]);

  const reasoningDetails = [
    {
      type: 'reasoning.text',
      text: 'Think carefully',
      signature: 'sig-complete',
      index: 0,
      id: 'r0',
      format: 'anthropic-claude-v1'
    },
    { type: 'reasoning.encrypted', data: 'opaque-complete', index: 1, id: 'r1' }
  ];

  expect(first._rawModelTurn).toEqual({ reasoning_details: reasoningDetails });

  const fetchMock = mockStream([delta({ content: 'Found it' })]);
  const history: ChatTurnMessage[] = [
    { role: 'model', content: first.text, toolCalls: first.toolCalls, _raw: first._rawModelTurn },
    {
      role: 'user',
      content: '',
      toolResults: [{ callId: 'call1', name: 'lookup', result: 'Result' }]
    }
  ];

  await provider.streamTurn(history, {});

  const request = JSON.parse(fetchMock.mock.calls[0][1].body);

  expect(request.messages[0]).toEqual({
    role: 'assistant',
    content: null,
    reasoning_details: reasoningDetails,
    tool_calls: [
      { id: 'call1', type: 'function', function: { name: 'lookup', arguments: '{"query":"test"}' } }
    ]
  });
  expect(request.messages[1]).toEqual({ role: 'tool', content: 'Result', tool_call_id: 'call1' });
});

test('replays plaintext reasoning when structured blocks are absent', async () => {
  mockStream([delta({ reasoning: 'One' }), delta({ reasoning_content: ' thought' })]);

  const first = await provider.streamTurn([{ role: 'user', content: 'Test' }], {});
  const fetchMock = mockStream([]);

  await provider.streamTurn([{ role: 'model', content: 'Answer', _raw: first._rawModelTurn }], {});

  expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0]).toEqual({
    role: 'assistant',
    content: 'Answer',
    reasoning: 'One thought'
  });
});

test('preserves distinct blocks identified by ID when indices are absent', async () => {
  mockStream([
    delta({
      reasoning_details: [{ type: 'reasoning.text', text: 'First.', id: 'a', format: 'unknown' }]
    }),
    delta({
      reasoning_details: [{ type: 'reasoning.text', text: 'Second', id: 'b', format: 'unknown' }]
    }),
    delta({ reasoning_details: [{ type: 'reasoning.text', text: ' block.', id: 'b' }] }),
    delta({ reasoning_details: [{ type: 'reasoning.text', signature: 'signature' }] })
  ]);

  const result = await provider.streamTurn([{ role: 'user', content: 'Test' }], {});

  expect(result._rawModelTurn).toEqual({
    reasoning_details: [
      { type: 'reasoning.text', text: 'First.', id: 'a', format: 'unknown' },
      {
        type: 'reasoning.text',
        text: 'Second block.',
        signature: 'signature',
        id: 'b',
        format: 'unknown'
      }
    ]
  });
});
