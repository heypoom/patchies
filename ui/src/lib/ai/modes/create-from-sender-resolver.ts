import { resolveObjectFromPrompt } from '../single-object-resolver';
import type { AiModeContext, AiModeResult, ModeResolver } from './types';

/** Deterministic pairing rules: sender type → receiver type */
const SENDER_TO_RECEIVER: Record<string, string> = {
  send: 'recv',
  'send~': 'recv~',
  'send.vdo': 'recv.vdo'
};

/**
 * Create-from-sender resolver: Create a matching consumer from a sender node.
 * - If prompt is blank: deterministically create matching receiver with same name.
 * - If prompt is non-blank: call AI with sender context to generate a custom consumer.
 */
export const createFromSenderResolver: ModeResolver = async (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void,
  onProgress?: (status: string) => void
): Promise<AiModeResult> => {
  const { selectedNode } = context;
  if (!selectedNode) throw new Error('No sender node selected');

  const senderType = selectedNode.type ?? '';
  const senderData = (selectedNode.data as Record<string, unknown>) ?? {};
  const senderName = (senderData.name as string) ?? '';

  // Deterministic path: no prompt → just mirror the sender
  if (!prompt.trim()) {
    const receiverType = SENDER_TO_RECEIVER[senderType];
    if (!receiverType) throw new Error(`No matching receiver type for sender "${senderType}"`);

    return {
      kind: 'single',
      type: receiverType,
      data: senderName ? { name: senderName } : {}
    };
  }

  // AI path: generate a custom consumer using the sender's context
  const enrichedPrompt = `Create a consumer object that receives from a "${senderType}" named "${senderName || 'untitled'}". ${prompt}`;

  const result = await resolveObjectFromPrompt(
    enrichedPrompt,
    (objectType) => onProgress?.(`Creating ${objectType}...`),
    signal,
    onThinking
  );

  if (!result) throw new Error('Could not create receiver from prompt');

  return {
    kind: 'single',
    type: result.type,
    data: result.data as Record<string, unknown>
  };
};
