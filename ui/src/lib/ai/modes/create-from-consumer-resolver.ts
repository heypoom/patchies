import { resolveObjectFromPrompt } from '../single-object-resolver';
import type { AiModeContext, AiModeResult, ModeResolver } from './types';

/** Deterministic pairing rules: consumer type → sender type */
const CONSUMER_TO_SENDER: Record<string, string> = {
  recv: 'send',
  'recv~': 'send~',
  'recv.vdo': 'send.vdo'
};

/**
 * Create-from-consumer resolver: Create a matching sender from a consumer node.
 * - If prompt is blank: deterministically create matching sender with same name.
 * - If prompt is non-blank: call AI with consumer context to generate a custom sender.
 */
export const createFromConsumerResolver: ModeResolver = async (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void
): Promise<AiModeResult> => {
  const { selectedNode } = context;
  if (!selectedNode) throw new Error('No consumer node selected');

  const consumerType = selectedNode.type ?? '';
  const consumerData = (selectedNode.data as Record<string, unknown>) ?? {};
  const consumerName = (consumerData.name as string) ?? '';

  // Deterministic path: no prompt → just mirror the consumer
  if (!prompt.trim()) {
    const senderType = CONSUMER_TO_SENDER[consumerType];
    if (!senderType) throw new Error(`No matching sender type for consumer "${consumerType}"`);

    return {
      kind: 'single',
      type: senderType,
      data: consumerName ? { name: consumerName } : {}
    };
  }

  // AI path: generate a custom sender using the consumer's context
  const enrichedPrompt = `Create a sender object that sends to a "${consumerType}" named "${consumerName || 'untitled'}". ${prompt}`;

  const result = await resolveObjectFromPrompt(
    enrichedPrompt,
    (objectType) => onProgress?.(`Creating ${objectType}...`),
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
