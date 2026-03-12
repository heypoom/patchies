/**
 * Derives Gemini tool definitions from mode descriptors.
 * Tool names use underscores because Gemini function names must be valid identifiers.
 */

import { modeDescriptors } from '../modes/descriptors';
import type { AiPromptMode } from '../modes/types';

/** Convert mode id (e.g. "fix-error") → Gemini tool name (e.g. "fix_error") */
export const modeToToolName = (mode: string): string => mode.replace(/-/g, '_');

/** Convert Gemini tool name back → mode id */
export const toolNameToMode = (name: string): AiPromptMode =>
  name.replace(/_/g, '-') as AiPromptMode;

/** Build the functionDeclarations array to pass to Gemini config.tools */
export const buildCanvasToolDeclarations = () =>
  Object.values(modeDescriptors)
    .filter((d) => d.availableInChat && d.chatToolDescription && d.chatToolSchema)
    .map((d) => ({
      name: modeToToolName(d.id),
      description: d.chatToolDescription!,
      parameters: d.chatToolSchema!
    }));
