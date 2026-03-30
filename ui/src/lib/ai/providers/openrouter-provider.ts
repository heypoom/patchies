import { OpenRouter } from '@openrouter/sdk';
import type {
  LLMMessage,
  LLMProvider,
  LLMStreamOptions,
  ChatTurnMessage,
  StreamTurnOptions,
  StreamTurnResult,
  ToolCall
} from './types';

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

  async streamTurn(
    messages: ChatTurnMessage[],
    options: StreamTurnOptions
  ): Promise<StreamTurnResult> {
    const { systemPrompt, tools = [], signal, onChunk } = options;

    type OAIMessage =
      | { role: 'system'; content: string }
      | { role: 'user'; content: string | { type: string; [k: string]: unknown }[] }
      | { role: 'assistant'; content: string | null; tool_calls?: OAIToolCall[] }
      | { role: 'tool'; content: string; tool_call_id: string };

    type OAIToolCall = {
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    };

    const oaiMessages: OAIMessage[] = [];

    if (systemPrompt) oaiMessages.push({ role: 'system', content: systemPrompt });

    for (const msg of messages) {
      if (msg.role === 'model') {
        oaiMessages.push({
          role: 'assistant',
          content: msg.content || null,
          ...(msg.toolCalls?.length
            ? {
                tool_calls: msg.toolCalls.map((tc) => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: { name: tc.name, arguments: JSON.stringify(tc.args) }
                }))
              }
            : {})
        });
      } else if (msg.toolResults?.length) {
        for (const tr of msg.toolResults) {
          oaiMessages.push({
            role: 'tool',
            content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
            tool_call_id: tr.callId
          });
        }
      } else if (msg.images?.length) {
        oaiMessages.push({
          role: 'user',
          content: [
            ...msg.images.map((img) => ({
              type: 'image_url',
              image_url: { url: `data:${img.mimeType};base64,${img.data}` }
            })),
            { type: 'text', text: msg.content }
          ]
        });
      } else {
        oaiMessages.push({ role: 'user', content: msg.content });
      }
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: oaiMessages,
      stream: true
    };

    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parametersJsonSchema }
      }));
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://patchies.app',
        'X-Title': 'Patchies'
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    let text = '';
    const accumulator = new Map<number, { id: string; name: string; args: string }>();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') break;

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            text += delta.content;
            onChunk?.(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx: number = tc.index ?? 0;
              if (!accumulator.has(idx)) {
                accumulator.set(idx, { id: tc.id ?? '', name: '', args: '' });
              }
              const acc = accumulator.get(idx)!;
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name += tc.function.name;
              if (tc.function?.arguments) acc.args += tc.function.arguments;
            }
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }

    const toolCalls: ToolCall[] = Array.from(accumulator.entries())
      .sort(([a], [b]) => a - b)
      .map(([, tc]) => ({
        id: tc.id || crypto.randomUUID(),
        name: tc.name,
        args: (() => {
          try {
            return JSON.parse(tc.args) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      }));

    return { text, toolCalls, _rawModelTurn: null };
  }
}
