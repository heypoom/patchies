/**
 * Shared resolver router — used by both AiPromptController (quick edit) and
 * chat/resolver.ts (tool calls) so resolver logic is never duplicated.
 */

import { resolveObjectFromPrompt } from '../single-object-resolver';
import { resolveMultipleObjectsFromPrompt } from '../multi-object-resolver';
import { editObjectFromPrompt } from '../edit-object-resolver';
import { replaceResolver } from './replace-resolver';
import { fixErrorResolver } from './fix-error-resolver';
import { createConsumerResolver } from './create-consumer-resolver';
import { createProducerResolver } from './create-producer-resolver';
import { decomposeResolver } from './decompose-resolver';
import type { AiModeContext, AiModeResult, AiPromptMode } from './types';

export async function runModeResolver(
  mode: AiPromptMode,
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void
): Promise<AiModeResult> {
  switch (mode) {
    case 'single': {
      const result = await resolveObjectFromPrompt(
        prompt,
        (objectType) => onProgress?.(objectType),
        signal,
        onThinking
      );
      if (!result) throw new Error('Could not resolve object from prompt');
      return { kind: 'single', type: result.type, data: result.data as Record<string, unknown> };
    }

    case 'multi': {
      const result = await resolveMultipleObjectsFromPrompt(
        prompt,
        (objectTypes) => onProgress?.(Array.from(new Set(objectTypes)).join(', ')),
        signal,
        onThinking
      );
      if (!result || result.nodes.length === 0)
        throw new Error('Could not resolve objects from prompt');
      return { kind: 'multi', nodes: result.nodes, edges: result.edges };
    }

    case 'edit': {
      const { selectedNode } = context;
      if (!selectedNode) throw new Error('No node selected for edit');
      const result = await editObjectFromPrompt(
        prompt,
        selectedNode.type ?? 'unknown',
        (selectedNode.data as Record<string, unknown>) ?? {},
        signal,
        onThinking
      );
      if (!result) throw new Error('Could not edit object');
      return {
        kind: 'edit',
        nodeId: selectedNode.id,
        data: result.data as Record<string, unknown>
      };
    }

    case 'replace':
      return replaceResolver(prompt, context, signal, onThinking, onProgress);

    case 'fix-error':
      return fixErrorResolver(prompt, context, signal, onThinking);

    case 'create-consumer':
      return createConsumerResolver(prompt, context, signal, onThinking, onProgress);

    case 'create-producer':
      return createProducerResolver(prompt, context, signal, onThinking, onProgress);

    case 'decompose':
      return decomposeResolver(prompt, context, signal, onThinking, onProgress);

    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}
