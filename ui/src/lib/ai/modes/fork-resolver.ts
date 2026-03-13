import { resolveObjectFromPrompt } from '../single-object-resolver';
import type { AiModeContext, AiModeResult, ModeResolver } from './types';

/**
 * Fork resolver: Create a new object derived from an existing one.
 * The type can change (e.g., fork canvas.dom into canvas) — the router decides
 * the best type from the prompt. The original node is left untouched — fork
 * produces a brand-new standalone node seeded by the source's code/data.
 */
export const forkResolver: ModeResolver = async (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void
): Promise<AiModeResult> => {
  const { selectedNode } = context;
  if (!selectedNode) throw new Error('No node selected for fork');

  const sourceType = selectedNode.type ?? 'unknown';
  const sourceData = (selectedNode.data as Record<string, unknown>) ?? {};

  // Enrich prompt: the AI knows the source material and what to diverge into.
  // Type may change if the prompt implies a different object type.
  const enrichedPrompt = `Fork the existing "${sourceType}" object (current code/data: ${JSON.stringify(sourceData, null, 2)}) and create a new standalone variation: ${prompt}. Choose the most appropriate object type for the result — it may stay as "${sourceType}" or become a different type if the prompt implies it. Produce a complete standalone version — do not reference or depend on the original.`;

  const result = await resolveObjectFromPrompt(
    enrichedPrompt,
    (objectType) => onProgress?.(objectType),
    signal,
    onThinking
  );

  if (!result) throw new Error('Could not fork object from prompt');

  return {
    kind: 'single',
    type: result.type,
    data: result.data as Record<string, unknown>
  };
};
