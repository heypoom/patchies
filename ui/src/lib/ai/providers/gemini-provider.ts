import type { LLMMessage, LLMProvider, LLMStreamOptions } from './types';

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model = 'gemini-2.5-flash-preview-04-17'
  ) {}

  async generateText(messages: LLMMessage[], options: LLMStreamOptions = {}): Promise<string> {
    const { signal, onThinking, onToken, systemPrompt } = options;

    if (signal?.aborted) throw new Error('Request cancelled');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const contents = messages.map((m) => ({
      role: m.role,
      parts: [
        ...(m.images ?? []).map((img) => ({
          inlineData: { mimeType: img.mimeType, data: img.data }
        })),
        { text: m.content }
      ]
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Gemini SDK config type
    const config: Record<string, any> = {
      thinkingConfig: { includeThoughts: true },
      abortSignal: signal
    };

    if (systemPrompt) {
      config.systemInstruction = systemPrompt;
    }

    const response = await ai.models.generateContentStream({
      model: this.model,
      contents,
      config
    });

    let responseText = '';

    for await (const chunk of response) {
      if (signal?.aborted) throw new Error('Request cancelled');

      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.thought && part.text) {
          onThinking?.(part.text);
        } else if (part.text) {
          responseText += part.text;
          onToken?.(part.text);
        }
      }
    }

    return responseText;
  }
}
