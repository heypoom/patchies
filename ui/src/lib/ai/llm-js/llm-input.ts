import type { LLMTools } from './llm-tools';
import type { AIProviderType } from '../../../stores/ai-settings.store';
import type { ChatTurnMessage } from '../providers/types';

export interface LLMConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  state?: LLMReasoningState;
}

export interface LLMReasoningState {
  provider: string;
  model: string;
  content: string;
  raw: unknown;
  steps?: ChatTurnMessage[];
}

export type LLMInput = string | LLMConversationTurn[];

export interface LLMOptions {
  imageNodeId?: string;
  abortSignal?: AbortSignal;
  model?: string;
  temperature?: number;
  topK?: number;
  provider?: AIProviderType;
  systemPrompt?: string;
  tools?: LLMTools;
  maxToolCalls?: number;
}

export function normalizeLLMInput(input: LLMInput): ChatTurnMessage[] {
  if (typeof input === 'string') {
    return [{ role: 'user', content: input }];
  }

  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('llm: expected a string or a non-empty conversation array');
  }

  const messages: ChatTurnMessage[] = [];

  for (let index = 0; index < input.length; index++) {
    const turn = input[index];
    const expectedRole = index % 2 === 0 ? 'user' : 'assistant';

    if (!turn || typeof turn !== 'object' || turn.role !== expectedRole) {
      throw new Error(`llm: conversation turn ${index} must have role "${expectedRole}"`);
    }

    if (typeof turn.content !== 'string') {
      throw new Error(`llm: conversation turn ${index} must have string content`);
    }

    if (Object.keys(turn).some((key) => key !== 'role' && key !== 'content' && key !== 'state')) {
      throw new Error(`llm: conversation turn ${index} supports only role, content, and state`);
    }

    if (turn.state !== undefined) {
      const hasInvalidReasoning =
        turn.role !== 'assistant' ||
        !turn.state ||
        typeof turn.state !== 'object' ||
        typeof turn.state.provider !== 'string' ||
        typeof turn.state.model !== 'string' ||
        turn.state.content !== turn.content ||
        !('raw' in turn.state) ||
        (turn.state.steps !== undefined && !Array.isArray(turn.state.steps));

      if (hasInvalidReasoning) {
        throw new Error(`llm: conversation turn ${index} has invalid or edited reasoning state`);
      }
    }

    messages.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      content: turn.content,
      ...(turn.state ? { _raw: structuredClone(turn.state) } : {})
    });
  }

  if (messages.at(-1)?.role !== 'user') {
    throw new Error('llm: conversation must end with a user turn');
  }

  return messages;
}
