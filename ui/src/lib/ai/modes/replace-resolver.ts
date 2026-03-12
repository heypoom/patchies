import { resolveObjectFromPrompt } from '../single-object-resolver';
import type { AiModeContext, AiModeResult, ModeResolver } from './types';

/**
 * Replace resolver: Turn object X into a different type Y.
 * Uses the same two-stage routing as single-object, but injects the old node's
 * type and data into the prompt so the AI can preserve relevant properties.
 */
export const replaceResolver: ModeResolver = async (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void
): Promise<AiModeResult> => {
  const { selectedNode } = context;
  if (!selectedNode) throw new Error('No node selected for replace');

  const oldType = selectedNode.type ?? 'unknown';
  const oldData = (selectedNode.data as Record<string, unknown>) ?? {};

  // Enrich prompt with old node context so router and generator can be aware
  const enrichedPrompt = `Replace the existing "${oldType}" object (current data: ${JSON.stringify(oldData, null, 2)}) with: ${prompt}`;

  const result = await resolveObjectFromPrompt(
    enrichedPrompt,
    (objectType) => onProgress?.(`Replacing with ${objectType}...`),
    signal,
    onThinking
  );

  if (!result) throw new Error('Could not resolve replacement object from prompt');

  return {
    kind: 'replace',
    nodeId: selectedNode.id,
    newType: result.type,
    newData: result.data as Record<string, unknown>
  };
};
