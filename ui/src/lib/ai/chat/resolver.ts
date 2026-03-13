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

  const contents = messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  const toolDeclarations = onAction ? buildCanvasToolDeclarations() : [];
  const tools = toolDeclarations.length > 0 ? [{ functionDeclarations: toolDeclarations }] : [];

  const response = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents,
    config: {
      systemInstruction,
      thinkingConfig: { includeThoughts: true },
      ...(tools.length > 0 ? { tools } : {})
    }
  });

  let fullText = '';

  for await (const chunk of response) {
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (part.thought) {
        if (part.text && onThinking) onThinking(part.text);
      } else if (part.functionCall && onAction) {
        // Tool call — run the resolver eagerly, surface result as ActionCard
        const toolName = part.functionCall.name ?? '';
        const args = (part.functionCall.args ?? {}) as Record<string, unknown>;
        const mode = toolNameToMode(toolName);
        const context = buildContextFromArgs(mode, args, getNodeById);

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
      } else if (part.text) {
        fullText += part.text;
        onChunk(part.text);
      }
    }
  }

  return fullText;
}

function buildContextFromArgs(
  mode: AiPromptMode,
  args: Record<string, unknown>,
  getNodeById?: (nodeId: string) => ChatNode | undefined
): AiModeContext {
  const nodeId = args.nodeId as string | undefined;
  if (!nodeId) return {};

  const node = getNodeById?.(nodeId);
  if (!node) return {};

  const context: AiModeContext = {
    selectedNode: {
      id: node.id,
      type: node.type,
      data: node.data,
      position: { x: 0, y: 0 }
    }
  };

  if (mode === 'fix-error' && Array.isArray(args.errors)) {
    context.consoleErrors = args.errors as string[];
  }

  return context;
}
