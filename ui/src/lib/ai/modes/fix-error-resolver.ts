import { editObjectFromPrompt } from '../edit-object-resolver';
import { getNodeErrors } from '$lib/utils/logger';
import type { AiModeContext, AiModeResult, ModeResolver } from './types';

/**
 * Fix-error resolver: Fix code errors using console output as context.
 * Reuses editObjectFromPrompt with error messages injected into the prompt.
 * The user's text prompt is optional — if blank, the AI infers the fix from errors.
 *
 * consoleErrors can be passed explicitly in context, or are read automatically
 * from the logger using the selected node's ID.
 */
export const fixErrorResolver: ModeResolver = async (
  prompt: string,
  context: AiModeContext,
  signal: AbortSignal,
  onThinking: (thought: string) => void
): Promise<AiModeResult> => {
  const { selectedNode } = context;
  if (!selectedNode) throw new Error('No node selected for fix-error');

  const nodeType = selectedNode.type ?? 'unknown';
  const existingData = (selectedNode.data as Record<string, unknown>) ?? {};

  const errors = context.consoleErrors ?? getNodeErrors(selectedNode.id);

  const errorContext =
    errors.length > 0 ? `Fix these errors:\n${errors.join('\n')}` : 'Fix any errors in this code';

  const fullPrompt = prompt.trim()
    ? `${errorContext}\n\nAdditional instructions: ${prompt}`
    : errorContext;

  const result = await editObjectFromPrompt(fullPrompt, nodeType, existingData, signal, onThinking);

  if (!result) throw new Error('Could not fix errors');

  return {
    kind: 'edit',
    nodeId: selectedNode.id,
    data: result.data as Record<string, unknown>
  };
};
