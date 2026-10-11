import type { TTSProviderType } from '../../stores/ai-settings.store';

export interface SpeechOptions {
  provider: TTSProviderType;
  streaming?: boolean;
  model: string;
  text: string;
  voiceName: string;
  style: string;
}

interface SpeechResponse {
  error?: { message?: string };
  steps?: {
    type: string;
    content?: { type: string; data?: string; mime_type?: string }[];
  }[];
}

export const getSpeechCacheKey = (options: SpeechOptions) =>
  JSON.stringify([
    options.provider,
    options.model,
    options.text,
    options.voiceName,
    options.provider === 'gemini' ? options.style : ''
  ]);

export async function synthesizeSpeech({
  apiKey,
  signal,
  onChunk,
  ...options
}: SpeechOptions & {
  apiKey: string;
  signal?: AbortSignal;
  onChunk?: (chunk: Uint8Array<ArrayBuffer>) => Promise<void>;
}): Promise<Blob> {
  if (options.provider === 'paxa') {
    return synthesizePaxaSpeech({ ...options, apiKey, signal, onChunk });
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    signal,
    body: JSON.stringify({
      model: options.model,
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: options.text,
              ...(options.style.trim() && {
                annotations: [{ type: 'speech_metadata', style: options.style }]
              })
            }
          ]
        }
      ],
      response_format: { type: 'audio', mime_type: 'audio/wav' },
      generation_config: { speech_config: [{ voice: options.voiceName }] }
    })
  });

  const data: SpeechResponse = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error?.message || `Request failed: ${response.statusText || response.status}`
    );
  }

  const audio = data.steps
    ?.filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === 'audio')
    .at(-1);

  if (!audio?.data) {
    throw new Error('Gemini returned no audio content.');
  }

  const bytes = Uint8Array.from(atob(audio.data), (character) => character.charCodeAt(0));

  return new Blob([bytes], { type: audio.mime_type || 'audio/wav' });
}

async function synthesizePaxaSpeech({
  apiKey,
  signal,
  text,
  model,
  voiceName,
  streaming = false,
  onChunk
}: SpeechOptions & {
  apiKey: string;
  signal?: AbortSignal;
  onChunk?: (chunk: Uint8Array<ArrayBuffer>) => Promise<void>;
}): Promise<Blob> {
  const response = await fetch('https://api.paxalabs.com/v1/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    signal,
    body: JSON.stringify({
      text,
      model,
      voice: voiceName,
      format: streaming ? 'mp3' : 'wav',
      stream: streaming
    })
  });

  const requestId = response.headers.get('x-request-id');
  const correlation = requestId ? ` (request ${requestId})` : '';

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    const code = problem.title || `HTTP ${response.status}`;
    throw new Error(`Paxa: ${code}${correlation}`);
  }

  if (streaming && response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    const cancel = () => {
      void reader.cancel().catch(() => {});
    };
    signal?.addEventListener('abort', cancel, { once: true });

    try {
      while (true) {
        signal?.throwIfAborted();
        const { done, value } = await reader.read();
        signal?.throwIfAborted();
        if (done) break;
        if (!value.byteLength) continue;

        chunks.push(value);
        await onChunk?.(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
      reader.releaseLock();
    }

    const audio = new Blob(chunks, { type: 'audio/mpeg' });

    if (!audio.size) {
      throw new Error(
        `Paxa returned no audio content. HTTP ${response.status}, 0 bytes${correlation}`
      );
    }

    return audio;
  }

  const audio = await response.blob();

  if (!audio.size) {
    throw new Error(
      `Paxa returned no audio content. HTTP ${response.status}, 0 bytes${correlation}`
    );
  }

  return audio;
}
