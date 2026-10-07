import { streamLLMResponse } from './llm-stream';
import type { LLMConversationTurn, LLMOptions, LLMReasoningState } from './llm-input';
import type { ChatTurnMessage, LLMProvider } from '../providers/types';
import { awaitLLMOperation, prepareLLMTools } from './llm-tools';

export async function generateLLMTurn({
  provider,
  messages,
  options = {},
  preparedTools
}: {
  provider: LLMProvider;
  messages: ChatTurnMessage[];
  options?: LLMOptions;
  preparedTools?: ReturnType<typeof prepareLLMTools>;
}): Promise<LLMConversationTurn> {
  const maxToolCalls = options.maxToolCalls ?? 8;
  const { declarations, handlers } = preparedTools ?? prepareLLMTools(options.tools);

  if (!Number.isInteger(maxToolCalls) || maxToolCalls < 1) {
    throw new Error('llm: maxToolCalls must be a positive integer');
  }

  const history: ChatTurnMessage[] = [];

  for (const message of messages) {
    if (!message._raw) {
      history.push(message);
      continue;
    }

    const state = message._raw as LLMReasoningState;

    if (state.provider !== provider.id || state.model !== provider.model) {
      throw new Error('llm: reasoning state belongs to a different provider or model');
    }

    history.push(...(state.steps ?? []), { ...message, _raw: state.raw });
  }

  const steps: ChatTurnMessage[] = [];
  let toolCalls = 0;

  while (true) {
    if (options.abortSignal?.aborted) {
      throw new Error('Request cancelled');
    }

    const result = await streamLLMResponse(
      (onChunk) =>
        provider.streamTurn(history, {
          tools: declarations,
          signal: options.abortSignal,
          systemPrompt: options.systemPrompt,
          temperature: options.temperature,
          topK: options.topK,
          ...(onChunk ? { onChunk } : {})
        }),
      options
    );

    const modelTurn: ChatTurnMessage = {
      role: 'model',
      content: result.text,
      _raw: result._rawModelTurn
    };

    if (!result.toolCalls.length) {
      return {
        role: 'assistant',
        content: result.text,
        state: {
          provider: provider.id,
          model: provider.model,
          content: result.text,
          raw: result._rawModelTurn,
          ...(steps.length ? { steps } : {})
        }
      };
    }

    if (toolCalls + result.toolCalls.length > maxToolCalls) {
      throw new Error(`llm: exceeded maxToolCalls (${maxToolCalls})`);
    }

    // Validate every requested name before any handler in this batch can have side effects.
    for (const call of result.toolCalls) {
      if (!handlers.has(call.name)) {
        throw new Error(`llm: unknown tool "${call.name}"`);
      }
    }

    modelTurn.toolCalls = result.toolCalls;

    const toolResults = [];

    for (const call of result.toolCalls) {
      if (options.abortSignal?.aborted) {
        throw new Error('Request cancelled');
      }

      const handler = handlers.get(call.name)!;
      const result = await awaitLLMOperation(handler(call), options.abortSignal);

      toolResults.push({ callId: call.id, name: call.name, result });
      toolCalls++;
    }

    const resultsTurn: ChatTurnMessage = { role: 'user', content: '', toolResults };

    history.push(modelTurn, resultsTurn);
    steps.push(modelTurn, resultsTurn);
  }
}
