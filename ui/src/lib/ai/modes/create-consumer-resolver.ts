import { resolveObjectFromPrompt } from '../single-object-resolver';
import type { AiModeContext, AiModeResult, ModeResolver } from './types';

/**
 * Create-consumer resolver: Given any node that produces output, create a consumer for it.
 *
 * Works with ANY producer node — p5, js, canvas, osc~, sort visualizers, etc.
 * The producer node's type and data are injected as context so the AI can generate
 * an appropriate consumer that understands what the producer outputs.
 */
export const createConsumerResolver: ModeResolver = async (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void
): Promise<AiModeResult> => {
  const { selectedNode } = context;
  if (!selectedNode) throw new Error('No source node selected');

  const sourceType = selectedNode.type ?? 'unknown';
  const sourceData = (selectedNode.data as Record<string, unknown>) ?? {};
  const sourceName = (sourceData.name as string) ?? '';
  const sourceCode = (sourceData.code as string) ?? '';

  const contextLines = [
    `Source node type: "${sourceType}"`,
    sourceName ? `Source node name: "${sourceName}"` : '',
    sourceCode
      ? `Source node code:\n\`\`\`\n${sourceCode}\n\`\`\``
      : `Source node data: ${JSON.stringify(sourceData, null, 2)}`
  ]
    .filter(Boolean)
    .join('\n');

  const intent = prompt.trim()
    ? `Create a consumer/receiver for this node. ${prompt}`
    : `Create an appropriate consumer/receiver for this node that handles what it produces.`;

  const enrichedPrompt = `${intent}\n\n${contextLines}`;

  const result = await resolveObjectFromPrompt(
    enrichedPrompt,
    (objectType) => onProgress?.(`Creating ${objectType}...`),
    signal,
    onThinking
  );

  if (!result) throw new Error('Could not create consumer from prompt');

  return {
    kind: 'single',
    type: result.type,
    data: result.data as Record<string, unknown>
  };
};
