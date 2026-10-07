import type { LLMOptions } from './llm-input';
import { awaitLLMOperation } from './llm-tools';

/** One model generation, with fresh accumulated text and a bounded callback lifetime. */
export async function streamLLMResponse<T>(
  operation: (onChunk?: (delta: string) => void) => Promise<T>,
  options: Pick<LLMOptions, 'onChunk' | 'abortSignal'>
): Promise<T> {
  if (options.onChunk !== undefined && typeof options.onChunk !== 'function') {
    throw new Error('llm: onChunk must be a function');
  }

  let active = true;
  let text = '';
  let callbackFailed = false;
  let callbackError: unknown;

  const onChunk = (delta: string) => {
    if (!active || options.abortSignal?.aborted || callbackFailed) return;

    text += delta;

    try {
      options.onChunk?.(delta, text);
    } catch (error) {
      callbackFailed = true;
      callbackError = error;
      throw error;
    }
  };

  try {
    if (options.onChunk) {
      onChunk('');
    }

    const result = await awaitLLMOperation(
      operation(options.onChunk ? onChunk : undefined),
      options.abortSignal
    );

    if (callbackFailed) {
      throw callbackError;
    }

    return result;
  } catch (error) {
    throw callbackFailed ? callbackError : error;
  } finally {
    active = false;
  }
}
