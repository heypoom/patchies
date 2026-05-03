/**
 * Helpers for legacy mode tool names.
 *
 * ChatView no longer exposes resolver-backed mode tools. AiObjectPrompt still
 * uses the mode resolver path directly, outside chat tool declarations.
 */

import type { AiPromptMode } from '../modes/types';

/** Convert mode id (e.g. "fix-error") → Gemini tool name (e.g. "fix_error") */
export const modeToToolName = (mode: string): string => mode.replace(/-/g, '_');

/** Convert Gemini tool name back → mode id */
export const toolNameToMode = (name: string): AiPromptMode =>
  name.replace(/_/g, '-') as AiPromptMode;
