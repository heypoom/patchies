import type { LLMMessage, LLMProvider, LLMStreamOptions } from './types';

export class OpenRouterProvider implements LLMProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async generateText(messages: LLMMessage[], options: LLMStreamOptions = {}): Promise<string> {
    const { signal, onToken, systemPrompt } = options;

    if (signal?.aborted) throw new Error('Request cancelled');

    type OpenAIContentPart =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } };

    const openAIMessages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages.map((m) => {
        const role = m.role === 'model' ? 'assistant' : m.role;

        if (m.images?.length) {
          const parts: OpenAIContentPart[] = [
            ...m.images.map((img) => ({
              type: 'image_url' as const,
              image_url: { url: `data:${img.mimeType};base64,${img.data}` }
            })),
            { type: 'text' as const, text: m.content }
          ];
          return { role, content: parts };
        }

        return { role, content: m.content };
      })
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://patchies.app',
        'X-Title': 'Patchies'
      },
      body: JSON.stringify({ model: this.model, messages: openAIMessages, stream: true }),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let responseText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) throw new Error('Request cancelled');

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            responseText += token;
            onToken?.(token);
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }

    return responseText;
  }
}
