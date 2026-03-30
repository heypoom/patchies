import { OpenRouter } from '@openrouter/sdk';
import type { LLMMessage, LLMProvider, LLMStreamOptions } from './types';

export class OpenRouterProvider implements LLMProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';

  private readonly client: OpenRouter;

  constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.client = new OpenRouter({
      apiKey,
      httpReferer: 'https://patchies.app',
      appTitle: 'Patchies'
    });
  }

  async generateText(messages: LLMMessage[], options: LLMStreamOptions = {}): Promise<string> {
    const { signal, onToken, systemPrompt } = options;

    type Role = 'user' | 'assistant' | 'system';
    const input = messages.map((m) => {
      const role = (m.role === 'model' ? 'assistant' : m.role) as Role;

      if (m.images?.length) {
        return {
          role,
          content: [
            ...m.images.map((img) => ({
              type: 'input_image' as const,
              detail: 'auto' as const,
              imageUrl: `data:${img.mimeType};base64,${img.data}`
            })),
            { type: 'input_text' as const, text: m.content }
          ]
        };
      }

      return { role, content: m.content };
    });

    const result = this.client.callModel(
      { model: this.model, instructions: systemPrompt, input },
      { signal }
    );

    if (onToken) {
      let responseText = '';
      for await (const delta of result.getTextStream()) {
        responseText += delta;
        onToken(delta);
      }
      return responseText;
    }

    return result.getText();
  }
}
