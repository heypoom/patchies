import type {
  LLMMessage,
  LLMProvider,
  LLMStreamOptions,
  ChatTurnMessage,
  StreamTurnOptions,
  StreamTurnResult,
  ToolCall
} from './types';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

const HEADERS = {
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://patchies.app',
  'X-Title': 'Patchies'
};

export class OpenRouterProvider implements LLMProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  private get authHeaders() {
    return { ...HEADERS, Authorization: `Bearer ${this.apiKey}` };
  }

  async generateText(messages: LLMMessage[], options: LLMStreamOptions = {}): Promise<string> {
    const { signal, onThinking, onToken, systemPrompt, temperature, topK } = options;

    type OAIMessage =
      | { role: 'system'; content: string }
      | { role: 'user'; content: string | { type: string; [k: string]: unknown }[] }
      | { role: 'assistant'; content: string };

    const oaiMessages: OAIMessage[] = [];

    if (systemPrompt) {
      oaiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const m of messages) {
      if (m.images?.length) {
        oaiMessages.push({
          role: 'user',
          content: [
            ...m.images.map((img) => ({
              type: 'image_url',
              image_url: { url: `data:${img.mimeType};base64,${img.data}` }
            })),
            { type: 'text', text: m.content }
          ]
        });
      } else if (m.role === 'model') {
        oaiMessages.push({ role: 'assistant', content: m.content });
      } else {
        oaiMessages.push({ role: 'user', content: m.content });
      }
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: oaiMessages,
      stream: true,
      reasoning: {}
    };

    if (temperature !== undefined) body.temperature = temperature;
    if (topK !== undefined) body.top_k = topK;

    const response = await fetch(OPENROUTER_API, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    let text = '';

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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

          const reasoning = delta.reasoning ?? delta.reasoning_content;

          if (reasoning) {
            onThinking?.(reasoning);
          }

          if (delta.content) {
            text += delta.content;

            onToken?.(delta.content);
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }

    return text;
  }

  async streamTurn(
    messages: ChatTurnMessage[],
    options: StreamTurnOptions
  ): Promise<StreamTurnResult> {
    const { systemPrompt, tools = [], signal, onChunk, onThinking } = options;

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

    if (systemPrompt) {
      oaiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const message of messages) {
      if (message.role === 'model') {
        oaiMessages.push({
          role: 'assistant',
          content: message.content || null,
          ...(message.toolCalls?.length
            ? {
                tool_calls: message.toolCalls.map((toolCall) => ({
                  id: toolCall.id,
                  type: 'function' as const,
                  function: {
                    name: toolCall.name,
                    arguments: JSON.stringify(toolCall.args)
                  }
                }))
              }
            : {})
        });
      } else if (message.toolResults?.length) {
        for (const toolResult of message.toolResults) {
          oaiMessages.push({
            role: 'tool',
            content:
              typeof toolResult.result === 'string'
                ? toolResult.result
                : JSON.stringify(toolResult.result),
            tool_call_id: toolResult.callId
          });
        }
      } else if (message.images?.length) {
        oaiMessages.push({
          role: 'user',
          content: [
            ...message.images.map((image) => ({
              type: 'image_url',
              image_url: { url: `data:${image.mimeType};base64,${image.data}` }
            })),
            { type: 'text', text: message.content }
          ]
        });
      } else {
        oaiMessages.push({ role: 'user', content: message.content });
      }
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: oaiMessages,
      stream: true,
      reasoning: {}
    };

    if (tools.length > 0) {
      body.tools = tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parametersJsonSchema
        }
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
    const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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

          const reasoning = delta.reasoning ?? delta.reasoning_content;

          if (reasoning) {
            onThinking?.(reasoning);
          }

          if (delta.content) {
            text += delta.content;
            onChunk?.(delta.content);
          }

          if (delta.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              const index: number = toolCall.index ?? 0;

              if (!toolCallAccumulator.has(index)) {
                toolCallAccumulator.set(index, { id: toolCall.id ?? '', name: '', args: '' });
              }

              const accum = toolCallAccumulator.get(index)!;

              if (toolCall.id) accum.id = toolCall.id;
              if (toolCall.function?.name) accum.name += toolCall.function.name;
              if (toolCall.function?.arguments) accum.args += toolCall.function.arguments;
            }
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }

    const toolCalls: ToolCall[] = Array.from(toolCallAccumulator.entries())
      .sort(([a], [b]) => a - b)
      .map(([, toolCall]) => ({
        id: toolCall.id || crypto.randomUUID(),
        name: toolCall.name,

        args: (() => {
          try {
            return JSON.parse(toolCall.args) as Record<string, unknown>;
          } catch (err) {
            console.warn(
              `OpenRouter: failed to parse tool call args for "${toolCall.name}":`,
              toolCall.args,
              err
            );
            return {};
          }
        })()
      }));

    // _rawModelTurn is null because OpenRouter's chat completions API does not
    // expose per-turn state (e.g. thought_signature) needed for multi-turn thinking.
    return { text, toolCalls, _rawModelTurn: null };
  }
}
