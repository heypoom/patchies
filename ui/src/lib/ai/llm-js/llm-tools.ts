import Ajv from 'ajv';

import type { ToolDeclaration, ToolCall } from '../providers/types';

export type LLMParameter =
  | 'string'
  | 'number'
  | 'boolean'
  | 'integer'
  | 'object'
  | 'array'
  | Record<string, unknown>;

export interface LLMTool {
  description: string;
  parameters?: Record<string, LLMParameter>;
  run: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

export type LLMTools = Record<string, LLMTool>;
export type LLMToolDefinitions = Record<string, Omit<LLMTool, 'run'>>;

export function prepareLLMTools(tools: LLMTools = {}) {
  const ajv = new Ajv({
    strict: true,
    allErrors: true,
    validateFormats: false
  });

  const declarations: ToolDeclaration[] = [];
  const handlers = new Map<string, (call: ToolCall) => Promise<unknown>>();

  for (const [name, tool] of Object.entries(tools)) {
    const hasInvalidToolDefinition =
      !/^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(name) ||
      !tool ||
      typeof tool.description !== 'string' ||
      !tool.description.trim() ||
      typeof tool.run !== 'function';

    if (hasInvalidToolDefinition) {
      throw new Error(`llm: invalid tool definition "${name}"`);
    }

    const parameters = tool.parameters ?? {};

    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
      throw new Error(`llm: invalid parameters for tool "${name}"`);
    }

    const properties = Object.fromEntries(
      Object.entries(parameters).map(([key, value]) => [
        key,
        typeof value === 'string' ? { type: value } : structuredClone(value)
      ])
    );

    const parametersJsonSchema = {
      type: 'object',
      properties,
      required: Object.keys(properties),
      additionalProperties: false
    };

    const validate = ajv.compile(parametersJsonSchema);
    const run = tool.run;

    declarations.push({
      name,
      description: tool.description,
      parametersJsonSchema
    });

    handlers.set(name, async (call) => {
      if (!validate(call.args)) {
        throw new Error(
          `llm: invalid arguments for tool "${name}": ${ajv.errorsText(validate.errors)}`
        );
      }

      return toToolResult(await run(structuredClone(call.args)));
    });
  }

  return { declarations, handlers };
}

export function toToolResult(value: unknown): unknown {
  if (value === undefined) return null;

  const json = JSON.stringify(value, (_key, item) => {
    const hasInvalidToolResultType =
      ['undefined', 'function', 'symbol', 'bigint'].includes(typeof item) ||
      (typeof item === 'number' && !Number.isFinite(item));

    if (hasInvalidToolResultType) {
      throw new Error('llm: tool results must be JSON-compatible');
    }

    return item;
  });

  return JSON.parse(json);
}

export function awaitLLMOperation<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return operation;
  }

  if (signal.aborted) {
    void operation.catch(() => {});

    return Promise.reject(new Error('Request cancelled'));
  }

  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Request cancelled'));
    signal.addEventListener('abort', abort, { once: true });

    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
