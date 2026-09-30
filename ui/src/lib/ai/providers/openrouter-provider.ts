import type {
  LLMMessage,
  LLMProvider,
  LLMStreamOptions,
  ChatTurnMessage,
  StreamTurnOptions,
  StreamTurnResult,
  ToolCall,
  ThinkingCallback
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

    const { text } = await consumeOpenRouterStream(response, onToken, onThinking);

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
      | ({ role: 'assistant'; content: string | null; tool_calls?: OAIToolCall[] } & ReasoningState)
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
          ...getReasoningState(message._raw),
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

    const { text, toolCallAccumulator, reasoningState } = await consumeOpenRouterStream(
      response,
      onChunk,
      onThinking
    );

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

    return { text, toolCalls, _rawModelTurn: reasoningState };
  }
}

interface ReasoningDetail {
  type: string;
  index?: number;
  id?: string | null;
  text?: string;
  summary?: string;
  data?: string;
  signature?: string | null;
  [key: string]: unknown;
}

interface ReasoningState {
  reasoning?: string;
  reasoning_details?: ReasoningDetail[];
}

interface StreamChunk {
  error?: { message?: string; code?: string | number };
  choices?: {
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      reasoning_details?: ReasoningDetail[];
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
  }[];
}

// Only this provider understands the opaque turn state. Gemini state has no matching fields.
const getReasoningState = (raw: unknown): ReasoningState => {
  if (!raw || typeof raw !== 'object') return {};

  const state = raw as ReasoningState;

  if (state.reasoning_details?.length) {
    return { reasoning_details: state.reasoning_details };
  }

  return typeof state.reasoning === 'string' ? { reasoning: state.reasoning } : {};
};

async function* readStreamEvents(response: Response): AsyncGenerator<StreamChunk> {
  if (!response.body) throw new Error('OpenRouter returned an empty response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventLines: string[] = [];
  let ended = false;

  const parseEvent = (): StreamChunk | undefined => {
    const data = eventLines.join('\n');
    eventLines = [];

    if (data === '[DONE]') {
      ended = true;
      return;
    }

    if (!data) return;

    try {
      return JSON.parse(data) as StreamChunk;
    } catch {
      console.warn('OpenRouter: ignored malformed SSE event');
    }
  };

  try {
    while (!ended) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      if (done) lines.push(buffer, '');

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');

        if (line === '') {
          const chunk = parseEvent();

          if (chunk) yield chunk;
          if (ended) break;
        } else if (line.startsWith('data:')) {
          eventLines.push(line.slice(5).replace(/^ /, ''));
        }
      }

      if (done) break;
    }
  } finally {
    // Cancel on DONE, callback failures, or API errors so unread data cannot keep streaming.
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}

async function consumeOpenRouterStream(
  response: Response,
  onText?: (text: string) => void,
  onThinking?: ThinkingCallback
) {
  let text = '';
  let reasoning = '';
  let hasEncryptedReasoning = false;
  let hasReadableReasoning = false;
  const details: ReasoningDetail[] = [];
  const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>();

  onThinking?.('', { newGeneration: true });

  for await (const chunk of readStreamEvents(response)) {
    const choice = chunk.choices?.[0];

    if (chunk.error || choice?.finish_reason === 'error') {
      throw new Error(`OpenRouter stream error: ${chunk.error?.message ?? 'Generation failed'}`);
    }

    if (choice?.finish_reason === 'length') {
      throw new Error('OpenRouter response was truncated because the token limit was reached');
    }

    const delta = choice?.delta;

    if (!delta) continue;

    let readableDetails = '';

    for (const detail of delta.reasoning_details ?? []) {
      // Prefer the block index, then its ID. Metadata-only deltas may omit both.
      const existing =
        detail.index !== undefined
          ? details.find((block) => block.type === detail.type && block.index === detail.index)
          : detail.id
            ? details.find((block) => block.type === detail.type && block.id === detail.id)
            : details.findLast((block) => block.type === detail.type);

      if (existing) {
        for (const [key, value] of Object.entries(detail)) {
          if (value === null || value === undefined) continue;

          if (['text', 'summary', 'data', 'signature'].includes(key) && typeof value === 'string') {
            existing[key] = `${existing[key] ?? ''}${value}`;
          } else {
            existing[key] = value;
          }
        }
      } else {
        details.push({ ...detail });
      }

      if (detail.type === 'reasoning.text') readableDetails += detail.text ?? '';
      if (detail.type === 'reasoning.summary') readableDetails += detail.summary ?? '';

      if (detail.type === 'reasoning.encrypted') hasEncryptedReasoning = true;
    }

    const plaintext = delta.reasoning ?? delta.reasoning_content ?? '';
    reasoning += plaintext;
    const readable = plaintext || readableDetails;

    if (readable) {
      hasReadableReasoning ||= readable.trim().length > 0;
      onThinking?.(readable);
    }

    if (delta.content) {
      text += delta.content;
      onText?.(delta.content);
    }

    for (const toolCall of delta.tool_calls ?? []) {
      const index = toolCall.index ?? 0;

      if (!toolCallAccumulator.has(index)) {
        toolCallAccumulator.set(index, { id: '', name: '', args: '' });
      }

      const accum = toolCallAccumulator.get(index)!;

      if (toolCall.id) accum.id = toolCall.id;
      if (toolCall.function?.name) accum.name += toolCall.function.name;
      if (toolCall.function?.arguments) accum.args += toolCall.function.arguments;
    }
  }

  // Wait until completion: encrypted blocks may precede readable reasoning.
  if (hasEncryptedReasoning && !hasReadableReasoning) {
    onThinking?.('\n\nReasoning is encrypted and cannot be displayed.\n\n');
  }

  const reasoningState: ReasoningState = details.length
    ? { reasoning_details: details }
    : reasoning
      ? { reasoning }
      : {};

  return { text, toolCallAccumulator, reasoningState };
}
