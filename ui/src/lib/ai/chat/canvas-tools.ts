/**
 * Derives Gemini tool definitions from mode descriptors.
 * Tool names use underscores because Gemini function names must be valid identifiers.
 */

import { modeDescriptors } from '../modes/descriptors';
import type { AiPromptMode } from '../modes/types';
import type { ChatNodeContext } from './resolver';

/** Convert mode id (e.g. "fix-error") → Gemini tool name (e.g. "fix_error") */
export const modeToToolName = (mode: string): string => mode.replace(/-/g, '_');

/** Convert Gemini tool name back → mode id */
export const toolNameToMode = (name: string): AiPromptMode =>
  name.replace(/_/g, '-') as AiPromptMode;

/**
 * Build the functionDeclarations array to pass to Gemini config.tools.
 *
 * When `nodeContext` is provided (a node is selected), injects the actual node
 * ID as an enum into node-scoped tool schemas so the model cannot hallucinate IDs.
 */
export const buildCanvasToolDeclarations = (nodeContext?: ChatNodeContext | null) =>
  Object.values(modeDescriptors)
    .filter((d) => d.availableInChat && d.chatToolDescription && d.chatToolSchema)
    .map((d) => {
      let parameters = d.chatToolSchema!;

      if (nodeContext && parameters.properties?.nodeId) {
        parameters = {
          ...parameters,
          properties: {
            ...parameters.properties,
            nodeId: {
              type: 'string',
              description: `ID of the node (must be "${nodeContext.nodeId}")`,
              enum: [nodeContext.nodeId]
            }
          }
        };
      }

      return {
        name: modeToToolName(d.id),
        description: d.chatToolDescription!,
        parametersJsonSchema: parameters
      };
    });
