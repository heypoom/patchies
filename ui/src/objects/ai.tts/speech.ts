import type { TTSProviderType } from '../../stores/ai-settings.store';

export interface SpeechOptions {
  provider: TTSProviderType;
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
  ...options
}: SpeechOptions & { apiKey: string; signal?: AbortSignal }): Promise<Blob> {
  if (options.provider === 'paxa') {
    return synthesizePaxaSpeech({ ...options, apiKey, signal });
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
  voiceName
}: SpeechOptions & { apiKey: string; signal?: AbortSignal }): Promise<Blob> {
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
      format: 'wav',
      stream: false
    })
  });

  const requestId = response.headers.get('x-request-id');
  const correlation = requestId ? ` (request ${requestId})` : '';

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    const code = problem.title || `HTTP ${response.status}`;
    throw new Error(`Paxa: ${code}${correlation}`);
  }

  const audio = await response.blob();

  if (!audio.size) {
    throw new Error(
      `Paxa returned no audio content. HTTP ${response.status}, 0 bytes${correlation}`
    );
  }

  return audio;
}
