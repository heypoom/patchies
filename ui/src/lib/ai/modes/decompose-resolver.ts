import { resolveMultipleObjectsFromPrompt } from '../multi-object-resolver';
import type { AiModeContext, AiModeResult, ModeResolver } from './types';

/**
 * Decompose resolver: Split one complex object into 2+ connected objects.
 * Reuses the multi-object resolver with the node's existing code injected as context.
 */
export const decomposeResolver: ModeResolver = async (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void
): Promise<AiModeResult> => {
  const { selectedNode } = context;
  if (!selectedNode) throw new Error('No node selected for decompose');

  const nodeType = selectedNode.type ?? 'unknown';
  const nodeData = (selectedNode.data as Record<string, unknown>) ?? {};
  const code = (nodeData.code as string) ?? JSON.stringify(nodeData, null, 2);

  const enrichedPrompt = `Decompose this existing "${nodeType}" object into multiple focused objects connected by edges.

Current code:
\`\`\`
${code}
\`\`\`

How to split: ${prompt || 'Break it into logical, focused parts'}`;

  const result = await resolveMultipleObjectsFromPrompt(
    enrichedPrompt,
    (objectTypes) => onProgress?.(objectTypes.join(', ')),
    signal,
    onThinking
  );

  if (!result || result.nodes.length === 0) throw new Error('Could not decompose object');

  return {
    kind: 'multi',
    nodes: result.nodes,
    edges: result.edges
  };
};
