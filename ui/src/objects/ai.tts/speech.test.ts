import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSpeechCacheKey, synthesizeSpeech } from './speech';

const options = {
  provider: 'gemini' as const,
  model: 'gemini-3.8-flash-lite-tts',
  text: 'Have a wonderful day!',
  voiceName: 'Puck',
  style: 'cheerful and friendly',
  apiKey: 'test-key'
};

afterEach(() => vi.unstubAllGlobals());

describe('Gemini speech synthesis', () => {
  it('sends configured settings and decodes the last model audio block', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        steps: [
          { type: 'user_input', content: [{ type: 'audio', data: btoa('input') }] },
          {
            type: 'model_output',
            content: [
              { type: 'audio', data: btoa('first') },
              {
                type: 'audio',
                data: btoa(String.fromCharCode(82, 73, 70, 70, 0, 255)),
                mime_type: 'audio/wav'
              }
            ]
          }
        ]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const audio = await synthesizeSpeech(options);

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(request.method).toBe('POST');
    expect(request.headers['x-goog-api-key']).toBe('test-key');

    expect(JSON.parse(request.body)).toEqual({
      model: options.model,
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: options.text,
              annotations: [{ type: 'speech_metadata', style: options.style }]
            }
          ]
        }
      ],
      response_format: { type: 'audio', mime_type: 'audio/wav' },
      generation_config: { speech_config: [{ voice: 'Puck' }] }
    });

    expect(audio.type).toBe('audio/wav');
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(
      new Uint8Array([82, 73, 70, 70, 0, 255])
    );
  });

  it('omits empty speaking style annotations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        steps: [{ type: 'model_output', content: [{ type: 'audio', data: btoa('RIFF') }] }]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await synthesizeSpeech({ ...options, style: ' ' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input[0].content[0]).not.toHaveProperty(
      'annotations'
    );
  });

  it('preserves Google permission errors for the error toast', async () => {
    const message = 'Requests to this API method are blocked.';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: { code: 403, message, status: 'PERMISSION_DENIED' }
          },
          { status: 403 }
        )
      )
    );

    await expect(synthesizeSpeech(options)).rejects.toThrow(message);
  });

  it('reports HTTP status for non-JSON errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));

    await expect(synthesizeSpeech(options)).rejects.toThrow('Request failed: 503');
  });

  it.each([{}, { steps: [] }, { steps: [{ type: 'model_output', content: [] }] }])(
    'reports missing audio: %j',
    async (response) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)));

      await expect(synthesizeSpeech(options)).rejects.toThrow('Gemini returned no audio content.');
    }
  );

  it('passes cancellation through to the network request', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, request) => Promise.reject(request.signal.reason))
    );

    await expect(synthesizeSpeech({ ...options, signal: controller.signal })).rejects.toMatchObject(
      { name: 'AbortError' }
    );
  });

  it('invalidates cached audio when model, text, voice, or style changes', () => {
    const key = getSpeechCacheKey(options);

    expect(getSpeechCacheKey({ ...options })).toBe(key);

    for (const field of ['model', 'text', 'voiceName', 'style'] as const) {
      expect(getSpeechCacheKey({ ...options, [field]: 'changed' })).not.toBe(key);
    }
  });
});

describe('Paxa speech synthesis', () => {
  const paxaOptions = {
    ...options,
    provider: 'paxa' as const,
    model: 'paxa-tts-flash-v1',
    voiceName: 'khanomkrok'
  };

  it('uses the Paxa key and binary audio without Gemini style annotations', async () => {
    const bytes = new Uint8Array([82, 73, 70, 70, 0, 255]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'audio/wav' } }));
    vi.stubGlobal('fetch', fetchMock);

    const audio = await synthesizeSpeech(paxaOptions);
    const [url, request] = fetchMock.mock.calls[0];

    expect(url).toBe('https://api.paxalabs.com/v1/tts');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key'
    });

    expect(JSON.parse(request.body)).toEqual({
      text: options.text,
      model: 'paxa-tts-flash-v1',
      voice: 'khanomkrok',
      format: 'wav',
      stream: false
    });

    expect(audio.type).toBe('audio/wav');
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(bytes);
  });

  it('reports stable problem codes and request IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { title: 'insufficient_credits', detail: 'This wording may change.' },
            { status: 402, headers: { 'x-request-id': 'request-123' } }
          )
        )
    );

    await expect(synthesizeSpeech(paxaOptions)).rejects.toThrow(
      'Paxa: insufficient_credits (request request-123)'
    );
  });

  it('reports non-JSON failures and empty audio', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(null));
    vi.stubGlobal('fetch', fetchMock);

    await expect(synthesizeSpeech(paxaOptions)).rejects.toThrow('Paxa: HTTP 503');
    await expect(synthesizeSpeech(paxaOptions)).rejects.toThrow('Paxa returned no audio content.');
  });

  it('identifies a successful response with zero bytes and preserves its request ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 200,
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': '0',
            'x-request-id': 'empty-audio-123'
          }
        })
      )
    );

    await expect(synthesizeSpeech(paxaOptions)).rejects.toThrow(
      'Paxa returned no audio content. HTTP 200, 0 bytes (request empty-audio-123)'
    );
  });

  it('passes cancellation to Paxa', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, request) => Promise.reject(request.signal.reason))
    );

    await expect(
      synthesizeSpeech({ ...paxaOptions, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('separates providers in the cache and ignores Paxa speaking style', () => {
    const key = getSpeechCacheKey(paxaOptions);

    expect(getSpeechCacheKey({ ...paxaOptions, provider: 'gemini' })).not.toBe(key);
    expect(getSpeechCacheKey({ ...paxaOptions, style: 'ignored style' })).toBe(key);
  });
});

describe('Paxa streaming delivery', () => {
  const options = {
    provider: 'paxa' as const,
    model: 'paxa-tts-flash-v1',
    voiceName: 'khanomkrok',
    text: 'สวัสดีครับ',
    style: '',
    apiKey: 'test-key',
    streaming: true
  };

  it('delivers chunks before EOF and retains complete audio for cached playback', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start: (value) => {
        controller = value;
      }
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body));
    vi.stubGlobal('fetch', fetchMock);
    const onChunk = vi.fn().mockResolvedValue(undefined);
    let finished = false;

    const result = synthesizeSpeech({ ...options, onChunk }).then((audio) => {
      finished = true;
      return audio;
    });
    controller.enqueue(new Uint8Array([1, 2]));
    await vi.waitFor(() => expect(onChunk).toHaveBeenCalledWith(new Uint8Array([1, 2])));

    expect(finished).toBe(false);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      stream: true,
      format: 'mp3'
    });

    controller.enqueue(new Uint8Array([3, 4]));
    controller.close();
    const audio = await result;

    expect(audio.type).toBe('audio/mpeg');
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('cancels a reader waiting for the next chunk', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    const controller = new AbortController();
    const result = synthesizeSpeech({ ...options, signal: controller.signal });
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });

    await vi.waitFor(() => expect(body.locked).toBe(true));
    controller.abort();
    await assertion;

    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it('rejects a broken stream instead of returning partial audio', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start: (value) => {
        controller = value;
      }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    const onChunk = vi.fn().mockResolvedValue(undefined);
    const result = synthesizeSpeech({ ...options, onChunk });
    const assertion = expect(result).rejects.toThrow('stream disconnected');

    controller.enqueue(new Uint8Array([1]));
    await vi.waitFor(() => expect(onChunk).toHaveBeenCalledOnce());
    controller.error(new Error('stream disconnected'));
    await assertion;

    expect(body.locked).toBe(false);
  });
});
