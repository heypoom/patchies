import { getObjectSpecificInstructions } from '../object-descriptions';
import { OBJECT_TYPE_LIST } from '../object-descriptions-types';
import { JS_ENABLED_OBJECTS, jsRunnerInstructions } from '../object-prompts/shared-jsrunner';
import { buildCanvasToolDeclarations, toolNameToMode } from './canvas-tools';
import { runModeResolver } from '../modes/run-resolver';
import { getModeDescriptor } from '../modes/descriptors';
import type { AiModeContext, AiPromptMode, AiModeDescriptor, AiModeResult } from '../modes/types';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  thinking?: string;
}

export interface ChatNodeContext {
  nodeId: string;
  nodeType: string;
  nodeData?: Record<string, unknown>;
  consoleErrors?: string[];
}

/** A resolved tool call ready for the user to apply or dismiss */
export interface ChatAction {
  id: string;
  mode: AiPromptMode;
  descriptor: AiModeDescriptor;
  result: AiModeResult;
  state: 'pending' | 'applied' | 'dismissed';
}

/** Minimal node shape needed to build AiModeContext from a tool call */
export interface ChatNode {
  id: string;
  type?: string;
  data: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You are a helpful AI assistant embedded in Patchies, a visual node-based programming environment for audio-visual creative coding. Users connect nodes (P5.js, Hydra, Strudel, GLSL, JavaScript, audio DSP objects) to build real-time audio-visual patches.

Help with:
- Writing and debugging code for node types (P5.js, Hydra, GLSL shaders, JavaScript, audio DSP, etc.)
- Node connections, signal routing, and patch architecture
- Audio DSP concepts (oscillators, filters, envelopes, effects)
- Creative coding techniques and algorithms

When you can perform a canvas action (create, edit, replace, fix errors, etc.) on the user's behalf, use the available tools. Only use tools when the user clearly wants a mutation — don't use them for explanations or questions.

Keep answers concise and practical. Format code for the relevant node type.

## Available Object Types

${OBJECT_TYPE_LIST}`;

/**
 * Streams a chat message response. Calls onChunk for each text chunk and
 * onAction when a canvas tool call has been resolved (ready to apply/dismiss).
 *
 * @param getNodeById - Looks up a node by ID for tool context (required for edit/replace/fix modes)
 * @param onAction    - Fired when a tool resolver completes with a pending ChatAction
 */
export async function streamChatMessage(
  messages: ChatMessage[],
  nodeContext: ChatNodeContext | null,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onThinking?: (thought: string) => void,
  getNodeById?: (nodeId: string) => ChatNode | undefined,
  onAction?: (action: ChatAction) => void
): Promise<string> {
  const apiKey = localStorage.getItem('gemini-api-key');

  if (!apiKey) {
    throw new Error('Gemini API key is not set. Please set it in the settings.');
  }

  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  let systemInstruction = SYSTEM_PROMPT;

  if (nodeContext) {
    systemInstruction += `\n\nThe user currently has a "${nodeContext.nodeType}" node selected (ID: "${nodeContext.nodeId}"). When performing canvas actions on this node, use nodeId "${nodeContext.nodeId}".`;

    if (nodeContext.nodeData && Object.keys(nodeContext.nodeData).length > 0) {
      try {
        const serialized = JSON.stringify(nodeContext.nodeData, null, 2);
        systemInstruction += `\nCurrent node data:\n${serialized}`;
      } catch {
        // ignore if data isn't serializable
      }
    }

    if (nodeContext.consoleErrors && nodeContext.consoleErrors.length > 0) {
      systemInstruction += `\n\nThe selected node currently has the following console errors:\n${nodeContext.consoleErrors.map((e) => `- ${e}`).join('\n')}`;
    }

    if (JS_ENABLED_OBJECTS.has(nodeContext.nodeType)) {
      systemInstruction += `\n\n## JSRunner Runtime Functions\n\n${jsRunnerInstructions}`;
    }

    const objectInstructions = getObjectSpecificInstructions(nodeContext.nodeType);

    if (objectInstructions) {
      systemInstruction += `\n\n## ${nodeContext.nodeType} Reference\n\n${objectInstructions}`;
    }
  }

  const contents: { role: string; parts: Record<string, unknown>[] }[] = messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  const GET_OBJECT_INSTRUCTIONS = 'get_object_instructions';

  const contextToolDeclaration = {
    name: GET_OBJECT_INSTRUCTIONS,
    description:
      'Fetch detailed instructions and API reference for a specific Patchies object type. Call this before writing code for a type you need more details about.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'The object type (e.g. "p5", "glsl", "tone~", "strudel")'
        }
      },
      required: ['type']
    }
  };

  const canvasDeclarations = onAction ? buildCanvasToolDeclarations(nodeContext) : [];
  const tools = [{ functionDeclarations: [contextToolDeclaration, ...canvasDeclarations] }];

  let fullText = '';

  // Multi-turn loop: runs until the model produces a pure text response (no function calls)
  while (true) {
    if (signal?.aborted) throw new Error('Request cancelled');

    const stream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction,
        thinkingConfig: { includeThoughts: true },
        tools
      }
    });

    // Collect ALL parts (including thought parts) for contents — Gemini requires thought_signature
    // to be preserved in the model turn when there are function calls (thinking mode).
    const turnParts: Record<string, unknown>[] = [];

    for await (const chunk of stream) {
      if (signal?.aborted) throw new Error('Request cancelled');

      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.thought) {
          if (part.text && onThinking) {
            onThinking(part.text);
          }

          turnParts.push(part as Record<string, unknown>);
        } else if (part.functionCall) {
          // Preserve the full part — thought_signature lives at the Part level, not inside functionCall
          turnParts.push(part as Record<string, unknown>);
        } else if (part.text) {
          fullText += part.text;
          onChunk(part.text);

          turnParts.push({ text: part.text });
        }
      }
    }

    const functionCallParts = turnParts.filter((p) => 'functionCall' in p) as {
      functionCall: { name?: string; args?: Record<string, unknown> };
    }[];

    if (functionCallParts.length === 0) break;

    // Add model turn to contents (excluding thought parts — Gemini doesn't accept them back)
    contents.push({ role: 'model', parts: turnParts });

    const contextCalls = functionCallParts.filter(
      (p) => p.functionCall.name === GET_OBJECT_INSTRUCTIONS
    );

    const canvasCalls = functionCallParts.filter(
      (p) => p.functionCall.name !== GET_OBJECT_INSTRUCTIONS
    );

    // Canvas tool calls are terminal — resolve and surface as ActionCards
    for (const { functionCall } of canvasCalls) {
      if (!onAction) continue;

      const toolName = functionCall.name ?? '';
      const args = (functionCall.args ?? {}) as Record<string, unknown>;
      const mode = toolNameToMode(toolName);
      const context = buildContextFromArgs(mode, args, getNodeById, nodeContext);

      try {
        const result = await runModeResolver(
          mode,
          (args.prompt as string) ?? '',
          context,
          signal ?? new AbortController().signal,
          () => {},
          () => {}
        );

        onAction({
          id: crypto.randomUUID(),
          mode,
          descriptor: getModeDescriptor(mode),
          result,
          state: 'pending'
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Tool call failed';
        const errText = `\n\n_Canvas action failed (${toolName}): ${msg}_`;

        onChunk(errText);
        fullText += errText;
      }
    }

    if (contextCalls.length === 0) break;

    // Respond to context-fetching calls and loop for continuation
    const functionResponses = contextCalls.map(({ functionCall }) => {
      const type = (functionCall.args?.type as string) ?? '';

      const instructions =
        getObjectSpecificInstructions(type) || `No specific instructions found for "${type}".`;

      return {
        functionResponse: {
          name: GET_OBJECT_INSTRUCTIONS,
          response: { instructions }
        }
      };
    });

    contents.push({ role: 'user', parts: functionResponses });
  }

  return fullText;
}

const NODE_SCOPED_MODES = new Set<AiPromptMode>([
  'edit',
  'turn-into',
  'fix-error',
  'make-consumer',
  'make-producer',
  'split',
  'fork'
]);

function buildContextFromArgs(
  mode: AiPromptMode,
  args: Record<string, unknown>,
  getNodeById?: (nodeId: string) => ChatNode | undefined,
  nodeContext?: ChatNodeContext | null
): AiModeContext {
  const context: AiModeContext = {};

  if (Array.isArray(args.errors)) {
    context.consoleErrors = args.errors as string[];
  }

  if (NODE_SCOPED_MODES.has(mode)) {
    const nodeId = args.nodeId as string | undefined;

    if (!nodeId) throw new Error(`Mode "${mode}" requires a nodeId`);

    // Fall back to the selected node context when the model hallucinates an ID
    const node =
      getNodeById?.(nodeId) ?? (nodeContext ? getNodeById?.(nodeContext.nodeId) : undefined);

    if (!node) throw new Error(`Node "${nodeId}" not found`);

    context.selectedNode = {
      id: node.id,
      type: node.type,
      data: node.data,
      position: { x: 0, y: 0 }
    };
  }

  return context;
}

/**
 * Generates a short descriptive title for a chat session based on the first user message.
 * Returns null if the API key is missing or the call fails.
 */
export async function generateChatTitle(userMessage: string): Promise<string | null> {
  const apiKey = localStorage.getItem('gemini-api-key');
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          text: `Generate a very short title (2-5 words) for a chat conversation that starts with this message. Reply with only the title, no quotes, no punctuation at the end:\n\n${userMessage}`
        }
      ]
    });

    const title = response.text?.trim();

    return title || null;
  } catch (err) {
    console.error('[generateChatTitle] failed:', err);
    return null;
  }
}
