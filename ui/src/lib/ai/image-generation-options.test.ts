import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { getGeminiImageConfig, getOpenRouterImageOptions } from './image-generation-options';

const serialized = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('image generation options', () => {
  it('uses upstream defaults when options are unset', () => {
    expect(serialized(getGeminiImageConfig(undefined, 'gemini-3-pro-image-preview'))).toEqual({});
    expect(serialized(getOpenRouterImageOptions())).toEqual({});
  });

  it('maps Gemini image and sampling controls without OpenRouter fields', () => {
    const config = getGeminiImageConfig(
      {
        aspectRatio: '16:9',
        resolution: '2K',
        temperature: 0,
        topP: 0.8,
        topK: 20,
        seed: 0,
        quality: 'high',
        size: '2048x2048'
      },
      'gemini-3-pro-image-preview'
    );

    expect(serialized(config)).toEqual({
      httpOptions: {
        extraBody: {
          generationConfig: {
            imageConfig: { aspectRatio: '16:9', imageSize: '2K' }
          }
        }
      },
      temperature: 0,
      topP: 0.8,
      topK: 20,
      seed: 0
    });
  });

  it.each([
    ['gemini-2.5-flash-image', '2K', undefined],
    ['gemini-3.1-flash-lite-image-preview', '4K', undefined],
    ['gemini-3.1-flash-lite-image-preview', '1K', '1K'],
    ['gemini-3.1-flash-image-preview', '512', '512'],
    ['gemini-3-pro-image-preview', '512', undefined]
  ])('uses supported resolution for %s', (model, requested, expected) => {
    const config = getGeminiImageConfig({ resolution: requested }, model);

    const generationConfig = config.httpOptions?.extraBody?.generationConfig as
      | { imageConfig: { imageSize?: string } }
      | undefined;

    expect(generationConfig?.imageConfig.imageSize).toBe(expected);
  });

  it('maps OpenRouter image controls and omits sampling controls', () => {
    const options = getOpenRouterImageOptions({
      aspectRatio: '3:2',
      resolution: '2K',
      quality: 'high',
      outputFormat: 'webp',
      background: 'transparent',
      outputCompression: 0,
      seed: 0,
      temperature: 0.5,
      topK: 20,
      topP: 0.8
    });

    expect(serialized(options)).toEqual({
      aspect_ratio: '3:2',
      resolution: '2K',
      quality: 'high',
      output_format: 'webp',
      background: 'transparent',
      output_compression: 0,
      seed: 0
    });
  });

  it('gives pixel dimensions precedence over ratio and resolution', () => {
    const options = getOpenRouterImageOptions({
      size: ' 1536x1024 ',
      aspectRatio: '1:1',
      resolution: '4K'
    });

    expect(serialized(options)).toEqual({ size: '1536x1024' });
  });

  it('rejects malformed pixel dimensions before making a request', () => {
    expect(() => getOpenRouterImageOptions({ size: '1024' })).toThrow('Pixel dimensions');
    expect(() => getOpenRouterImageOptions({ size: '0x1024' })).toThrow('Pixel dimensions');
  });

  it('omits compression for PNG and transparency for JPEG', () => {
    expect(
      serialized(getOpenRouterImageOptions({ outputFormat: 'png', outputCompression: 80 }))
    ).toEqual({ output_format: 'png' });

    expect(
      serialized(getOpenRouterImageOptions({ outputFormat: 'jpeg', background: 'transparent' }))
    ).toEqual({ output_format: 'jpeg' });
  });
});

describe('Gemini image request', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends image dimensions and sampling options through the installed SDK', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [] }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const ai = new GoogleGenAI({ apiKey: 'test-key' });
    const model = 'gemini-3-pro-image-preview';

    await ai.models.generateContent({
      model,
      contents: 'A landscape',
      config: getGeminiImageConfig(
        { aspectRatio: '16:9', resolution: '2K', temperature: 0, seed: 0 },
        model
      )
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(request.body as string);

    expect(body.generationConfig).toEqual({
      imageConfig: { aspectRatio: '16:9', imageSize: '2K' },
      temperature: 0,
      seed: 0
    });
    expect(body.contents[0].parts).toEqual([{ text: 'A landscape' }]);
  });
});
