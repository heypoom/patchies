import { resolveObjectFromPrompt } from '../single-object-resolver';
import { getObjectSpecificInstructions } from '../object-prompts';
import type { AiModeContext, AiModeResult, ModeResolver } from './types';

/**
 * Create-producer resolver: Given any node that consumes input, create a producer for it.
 *
 * Works with ANY consumer node — recv, js, p5, canvas, osc~, sort visualizers, etc.
 * The consumer node's type and data are injected as context so the AI can generate
 * an appropriate producer that outputs what the consumer expects to receive.
 */
export const createProducerResolver: ModeResolver = async (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void
): Promise<AiModeResult> => {
  const { selectedNode } = context;
  if (!selectedNode) throw new Error('No consumer node selected');

  const consumerType = selectedNode.type ?? 'unknown';
  const consumerData = (selectedNode.data as Record<string, unknown>) ?? {};

  const consumerName = (consumerData.name as string) ?? '';
  const consumerCode = (consumerData.code as string) ?? '';

  const consumerInstructions = getObjectSpecificInstructions(consumerType);

  const contextLines = [
    `Consumer node type: "${consumerType}"`,
    consumerInstructions ? `Consumer node documentation:\n${consumerInstructions}` : '',
    consumerName ? `Consumer node name: "${consumerName}"` : '',
    consumerCode
      ? `Consumer node code:\n\`\`\`\n${consumerCode}\n\`\`\``
      : `Consumer node data: ${JSON.stringify(consumerData, null, 2)}`
  ]
    .filter(Boolean)
    .join('\n');

  const intent = prompt.trim()
    ? `Create a sender/source for this node. ${prompt}`
    : `Create an appropriate sender/source for this node that produces what it expects to receive.`;

  const enrichedPrompt = `${intent}\n\n${contextLines}`;

  const result = await resolveObjectFromPrompt(
    enrichedPrompt,
    (objectType) => onProgress?.(objectType),
    signal,
    onThinking
  );

  if (!result) throw new Error('Could not create sender from prompt');

  return {
    kind: 'single',
    type: result.type,
    data: result.data as Record<string, unknown>
  };
};
