/**
 * Handlers for LLM-backed chat subtasks.
 *
 * Subtasks return structured data to the chat loop. They do not queue
 * ActionCards or mutate the canvas directly.
 */

import { editObjectFromPrompt } from '../edit-object-resolver';
import { resolveMultipleObjectsFromPrompt } from '../multi-object-resolver';
import { getTextProvider } from '../providers';
import { generateObjectConfigForType, resolveObjectFromPrompt } from '../single-object-resolver';
import type { AiObjectNode, SimplifiedEdge } from '../types';
import { assertKnownCanvasObjectType } from './object-type-validation';

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function assertPrompt(prompt: unknown): string {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('prompt must be a non-empty string');
  }

  return prompt;
}

export async function resolveGenerateObjectDataSubtask(
  args: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onThinking: (thought: string) => void
): Promise<{ type: string; data: Record<string, unknown> }> {
  const prompt = assertPrompt(args.prompt);
  const type = typeof args.type === 'string' && args.type.trim() ? args.type : null;

  const result = type
    ? await generateObjectConfigForType(
        getTextProvider(),
        prompt,
        assertKnownCanvasObjectType(type),
        signal,
        onThinking
      )
    : await resolveObjectFromPrompt(prompt, undefined, signal, onThinking);

  if (!result) {
    throw new Error('Could not generate object data');
  }

  return {
    type: assertKnownCanvasObjectType(result.type),
    data: result.data as Record<string, unknown>
  };
}

export async function resolveGenerateObjectGraphSubtask(
  args: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onThinking: (thought: string) => void
): Promise<{ nodes: AiObjectNode[]; edges: SimplifiedEdge[] }> {
  const prompt = assertPrompt(args.prompt);
  const result = await resolveMultipleObjectsFromPrompt(prompt, undefined, signal, onThinking);

  if (!result || result.nodes.length === 0) {
    throw new Error('Could not generate object graph');
  }

  return {
    nodes: result.nodes,
    edges: result.edges
  };
}

export async function resolveRewriteObjectDataSubtask(
  args: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onThinking: (thought: string) => void
): Promise<{ type: string; data: Record<string, unknown> }> {
  const type = assertKnownCanvasObjectType(args.type);
  const existingData = assertRecord(args.existingData, 'existingData');
  const prompt = assertPrompt(args.prompt);
  const errors = Array.isArray(args.errors)
    ? args.errors.filter((error): error is string => typeof error === 'string')
    : [];

  const fullPrompt =
    errors.length > 0
      ? `Fix these errors while applying the user request.\n\nErrors:\n${errors.map((error) => `- ${error}`).join('\n')}\n\nUser request: ${prompt}`
      : prompt;

  const result = await editObjectFromPrompt(fullPrompt, type, existingData, signal, onThinking);

  if (!result) {
    throw new Error('Could not rewrite object data');
  }

  return {
    type: assertKnownCanvasObjectType(result.type),
    data: result.data as Record<string, unknown>
  };
}
