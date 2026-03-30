import type {
  LLMMessage,
  LLMProvider,
  LLMStreamOptions,
  ChatTurnMessage,
  StreamTurnOptions,
  StreamTurnResult,
  ToolCall
} from './types';

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model = 'gemini-3-flash-preview'
  ) {}

  async generateText(messages: LLMMessage[], options: LLMStreamOptions = {}): Promise<string> {
    const { signal, onThinking, onToken, systemPrompt, temperature, topK } = options;

    if (signal?.aborted) throw new Error('Request cancelled');

    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const contents = messages.map((message) => ({
      role: message.role,
      parts: [
        ...(message.images ?? []).map((img) => ({
          inlineData: { mimeType: img.mimeType, data: img.data }
        })),
        { text: message.content }
      ]
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Gemini SDK config type
    const config: Record<string, any> = {
      thinkingConfig: { includeThoughts: true },
      abortSignal: signal
    };

    if (systemPrompt) config.systemInstruction = systemPrompt;
    if (temperature !== undefined) config.temperature = temperature;
    if (topK !== undefined) config.topK = topK;

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

  async streamTurn(
    messages: ChatTurnMessage[],
    options: StreamTurnOptions
  ): Promise<StreamTurnResult> {
    const { systemPrompt, tools = [], signal, onChunk, onThinking } = options;

    if (signal?.aborted) throw new Error('Request cancelled');

    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    // Convert ChatTurnMessage[] to Gemini contents[]
    const contents = messages.map((msg) => {
      // Model turn with _raw: use preserved parts directly (preserves thought_signature)
      if (msg.role === 'model' && msg._raw) {
        const raw = msg._raw as { parts: Record<string, unknown>[] };

        return { role: 'model', parts: raw.parts };
      }

      // User turn with tool results
      if (msg.role === 'user' && msg.toolResults?.length) {
        return {
          role: 'user',
          parts: msg.toolResults.map((toolResult) => ({
            functionResponse: {
              name: toolResult.name,
              response:
                toolResult.result !== null && typeof toolResult.result === 'object'
                  ? (toolResult.result as Record<string, unknown>)
                  : { value: toolResult.result }
            }
          }))
        };
      }

      // Regular message (text + optional images/youtubeUrls)
      return {
        role: msg.role,
        parts: [
          ...(msg.images ?? []).map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data }
          })),

          ...(msg.youtubeUrls ?? []).map((url) => ({
            fileData: { fileUri: url }
          })),

          { text: msg.content }
        ]
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Gemini SDK config type
    const config: Record<string, any> = {
      thinkingConfig: { includeThoughts: true },
      abortSignal: signal
    };

    if (systemPrompt) {
      config.systemInstruction = systemPrompt;
    }

    if (tools.length > 0) {
      config.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parametersJsonSchema
          }))
        }
      ];
    }

    const stream = await ai.models.generateContentStream({ model: this.model, contents, config });

    const turnParts: Record<string, unknown>[] = [];
    let text = '';

    const abortPromise = signal
      ? new Promise<never>((_, reject) => {
          if (signal.aborted) reject(new Error('Request cancelled'));
          signal.addEventListener('abort', () => reject(new Error('Request cancelled')), {
            once: true
          });
        })
      : null;

    const consumeStream = async () => {
      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new Error('Request cancelled');
        }

        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (part.thought) {
            if (part.text && onThinking) {
              onThinking(part.text);
            }

            turnParts.push(part as Record<string, unknown>);
          } else if (part.functionCall) {
            turnParts.push(part as Record<string, unknown>);
          } else if (part.text) {
            text += part.text;

            onChunk?.(part.text);
            turnParts.push({ text: part.text });
          }
        }
      }
    };

    await (abortPromise ? Promise.race([consumeStream(), abortPromise]) : consumeStream());

    const toolCalls: ToolCall[] = turnParts
      .filter((part) => 'functionCall' in part)
      .map((part) => {
        const functionCall = (
          part as { functionCall: { name?: string; args?: Record<string, unknown> } }
        ).functionCall;

        return {
          id: crypto.randomUUID(),
          name: functionCall.name ?? '',
          args: functionCall.args ?? {}
        };
      });

    return { text, toolCalls, _rawModelTurn: { parts: turnParts } };
  }
}
