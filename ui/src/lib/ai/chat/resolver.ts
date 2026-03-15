import { getObjectSpecificInstructions } from '../object-descriptions';
import { JS_ENABLED_OBJECTS, jsRunnerInstructions } from '../object-prompts/shared-jsrunner';
import { buildCanvasToolDeclarations, toolNameToMode } from './canvas-tools';
import { runModeResolver } from '../modes/run-resolver';
import { getModeDescriptor } from '../modes/descriptors';
import type { AiModeContext, AiPromptMode, AiModeDescriptor, AiModeResult } from '../modes/types';
import { topicMetas } from '$lib/docs/topic-index';
import { objectSchemas } from '$lib/objects/schemas';
import { fetchTopicHelp } from '$lib/docs/fetch-topic-help';
import { fetchObjectHelp } from '$lib/objects/fetch-object-help';
import {
  SYSTEM_PROMPT,
  CONTEXT_TOOL_NAMES,
  CONNECT_EDGES,
  GET_OBJECT_INSTRUCTIONS,
  GET_GRAPH_NODES,
  GET_NODE_DATA,
  SEARCH_DOCS,
  GET_DOC_CONTENT,
  contextToolDeclarations,
  connectEdgesDeclaration
} from './chat-tool-declarations';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  thinking?: string;
  images?: Array<{ mimeType: string; data: string }>;
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

/** Lightweight node summary for graph-level context */
export interface ChatNodeSummary {
  id: string;
  type?: string;
  name?: string;
}

/**
 * Streams a chat message response. Calls onChunk for each text chunk and
 * onAction when a canvas tool call has been resolved (ready to apply/dismiss).
 *
 * @param getNodeById  - Looks up a node by ID for tool context (required for edit/replace/fix modes)
 * @param getAllNodes  - Returns all nodes in the graph (used for the get_graph_nodes context tool)
 * @param onAction    - Fired when a tool resolver completes with a pending ChatAction
 */
export async function streamChatMessage(
  messages: ChatMessage[],
  nodeContext: ChatNodeContext | null,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onThinking?: (thought: string) => void,
  getNodeById?: (nodeId: string) => ChatNode | undefined,
  onAction?: (action: ChatAction) => void,
  getAllNodes?: () => ChatNodeSummary[],
  persona?: string
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

  let systemInstruction = persona ? `${persona}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;

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
    parts: [
      ...(msg.images ?? []).map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.data }
      })),
      { text: msg.content }
    ]
  }));

  const canvasDeclarations = onAction ? buildCanvasToolDeclarations(nodeContext) : [];
  const allCanvasDeclarations = onAction ? [...canvasDeclarations, connectEdgesDeclaration] : [];
  const tools = [{ functionDeclarations: [...contextToolDeclarations, ...allCanvasDeclarations] }];

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

    // Race the stream against the abort signal so cancel takes effect immediately,
    // even if the stream is waiting for the next chunk from the server.
    const abortPromise = signal
      ? new Promise<never>((_, reject) => {
          if (signal.aborted) reject(new Error('Request cancelled'));
          signal.addEventListener('abort', () => reject(new Error('Request cancelled')), {
            once: true
          });
        })
      : null;

    const consumeStream = async () => {
      for await (const chunk of stream) {
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
    };

    await (abortPromise ? Promise.race([consumeStream(), abortPromise]) : consumeStream());

    const functionCallParts = turnParts.filter((p) => 'functionCall' in p) as {
      functionCall: { name?: string; args?: Record<string, unknown> };
    }[];

    if (functionCallParts.length === 0) break;

    // Add model turn to contents (excluding thought parts — Gemini doesn't accept them back)
    contents.push({ role: 'model', parts: turnParts });

    const contextCalls = functionCallParts.filter((p) =>
      CONTEXT_TOOL_NAMES.has(p.functionCall.name ?? '')
    );

    const canvasCalls = functionCallParts.filter(
      (p) => !CONTEXT_TOOL_NAMES.has(p.functionCall.name ?? '')
    );

    // Canvas tool calls are terminal — resolve and surface as ActionCards
    for (const { functionCall } of canvasCalls) {
      if (!onAction) continue;

      const toolName = functionCall.name ?? '';
      const args = (functionCall.args ?? {}) as Record<string, unknown>;

      try {
        // connect_edges is handled directly — no mode resolver needed
        if (toolName === CONNECT_EDGES) {
          const edgeSpecs = args.edges as Array<{
            source: string;
            target: string;
            sourceHandle?: string;
            targetHandle?: string;
          }>;

          if (!Array.isArray(edgeSpecs) || edgeSpecs.length === 0) {
            throw new Error('connect_edges requires a non-empty edges array');
          }

          // Validate that referenced nodes exist
          for (const spec of edgeSpecs) {
            if (!getNodeById?.(spec.source)) {
              throw new Error(`Source node "${spec.source}" not found`);
            }
            if (!getNodeById?.(spec.target)) {
              throw new Error(`Target node "${spec.target}" not found`);
            }
          }

          const edges = edgeSpecs.map((spec, i) => ({
            id: `ai-edge-${crypto.randomUUID().slice(0, 8)}-${i}`,
            source: spec.source,
            target: spec.target,
            sourceHandle: spec.sourceHandle ?? null,
            targetHandle: spec.targetHandle ?? null
          }));

          onAction({
            id: crypto.randomUUID(),
            mode: 'connect-edges' as AiPromptMode,
            descriptor: getModeDescriptor('connect-edges'),
            result: { kind: 'connect-edges', edges },
            state: 'pending'
          });
          continue;
        }

        const mode = toolNameToMode(toolName);
        const context = buildContextFromArgs(mode, args, getNodeById, nodeContext);

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
    const functionResponses = await Promise.all(
      contextCalls.map(async ({ functionCall }) => {
        const name = functionCall.name ?? '';

        if (name === GET_GRAPH_NODES) {
          const nodes = getAllNodes?.() ?? [];
          return {
            functionResponse: {
              name: GET_GRAPH_NODES,
              response: { nodes }
            }
          };
        }

        if (name === GET_NODE_DATA) {
          const nodeId = (functionCall.args?.nodeId as string) ?? '';
          const node = getNodeById?.(nodeId);
          return {
            functionResponse: {
              name: GET_NODE_DATA,
              response: node
                ? { id: node.id, type: node.type, data: node.data }
                : { error: `Node "${nodeId}" not found` }
            }
          };
        }

        if (name === SEARCH_DOCS) {
          const query = ((functionCall.args?.query as string) ?? '').toLowerCase().trim();
          const matchingTopics = topicMetas
            .filter(
              (t) =>
                t.slug.includes(query) ||
                t.title.toLowerCase().includes(query) ||
                t.category.toLowerCase().includes(query)
            )
            .map((t) => ({ kind: 'topic', slug: t.slug, title: t.title, category: t.category }));

          const matchingObjects = Object.values(objectSchemas)
            .filter(
              (s) =>
                s.type.toLowerCase().includes(query) ||
                s.description.toLowerCase().includes(query) ||
                s.category.toLowerCase().includes(query) ||
                s.tags?.some((tag) => tag.toLowerCase().includes(query))
            )
            .map((s) => ({
              kind: 'object',
              slug: s.type,
              title: s.type,
              category: s.category,
              description: s.description
            }));

          return {
            functionResponse: {
              name: SEARCH_DOCS,
              response: {
                results: [...matchingTopics, ...matchingObjects],
                total: matchingTopics.length + matchingObjects.length
              }
            }
          };
        }

        if (name === GET_DOC_CONTENT) {
          const kind = (functionCall.args?.kind as string) ?? '';
          const slug = (functionCall.args?.slug as string) ?? '';

          if (kind === 'topic') {
            const content = await fetchTopicHelp(slug);
            return {
              functionResponse: {
                name: GET_DOC_CONTENT,
                response: content.markdown
                  ? { kind: 'topic', slug, markdown: content.markdown }
                  : { error: `No documentation found for topic "${slug}"` }
              }
            };
          }

          // kind === 'object'
          const content = await fetchObjectHelp(slug);
          return {
            functionResponse: {
              name: GET_DOC_CONTENT,
              response: content.markdown
                ? { kind: 'object', slug, markdown: content.markdown }
                : { error: `No documentation found for object "${slug}"` }
            }
          };
        }

        // GET_OBJECT_INSTRUCTIONS
        const type = (functionCall.args?.type as string) ?? '';
        const instructions =
          getObjectSpecificInstructions(type) || `No specific instructions found for "${type}".`;
        return {
          functionResponse: {
            name: GET_OBJECT_INSTRUCTIONS,
            response: { instructions }
          }
        };
      })
    );

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
