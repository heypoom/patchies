import { getObjectSpecificInstructions } from '../object-descriptions';
import { logger, getNodeErrors } from '$lib/utils/logger';
import { getTextProvider } from '../providers';
import type { ChatTurnMessage, ToolCall, ToolResult, ToolDeclaration } from '../providers/types';
import { JS_ENABLED_OBJECTS, jsRunnerInstructions } from '../object-prompts/shared-jsrunner';
import { buildCanvasToolDeclarations, toolNameToMode } from './canvas-tools';
import { runModeResolver } from '../modes/run-resolver';
import { getModeDescriptor, modeDescriptors } from '../modes/descriptors';
import type { AiModeContext, AiPromptMode, AiModeDescriptor, AiModeResult } from '../modes/types';
import { topicMetas } from '$lib/docs/topic-index';
import { objectSchemas } from '$lib/objects/schemas';
import { fetchTopicHelp } from '$lib/docs/fetch-topic-help';
import { fetchObjectHelp } from '$lib/objects/fetch-object-help';
import { generateHandleDocs } from '../generate-handle-docs';
import { resolveConnectEdges, resolveDisconnectEdges } from './edge-tool-handlers';
import {
  SYSTEM_PROMPT,
  CONTEXT_TOOL_NAMES,
  CONNECT_EDGES,
  DISCONNECT_EDGES,
  GET_GRAPH_NODES,
  GET_OBJECT_DATA,
  GET_OBJECT_LOGS,
  GET_OBJECT_ERRORS,
  SEARCH_DOCS,
  GET_DOC_CONTENT,
  LIST_PACKS,
  ENABLE_PACK,
  contextToolDeclarations,
  connectEdgesDeclaration,
  disconnectEdgesDeclaration
} from './chat-tool-declarations';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  thinking?: string;
  images?: Array<{ mimeType: string; data: string }>;
  youtubeUrls?: string[];
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
  result?: AiModeResult;
  state: 'pending' | 'applied' | 'dismissed' | 'failed';
  error?: string;
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

/** Lightweight edge summary for graph-level context */
export interface ChatEdgeSummary {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Combined graph summary (nodes + edges) */
export interface ChatGraphSummary {
  nodes: ChatNodeSummary[];
  edges: ChatEdgeSummary[];
}

/**
 * Streams a chat message response. Calls onChunk for each text chunk and
 * onAction when a canvas tool call has been resolved (ready to apply/dismiss).
 *
 * @param getNodeById  - Looks up a node by ID for tool context (required for edit/replace/fix modes)
 * @param getAllNodes  - Returns all nodes in the graph (used for the get_graph_nodes context tool)
 * @param onAction    - Fired when a tool resolver completes with a pending ChatAction
 */
export interface PackInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  locked: boolean;
}

export interface PacksState {
  objectPacks: PackInfo[];
  presetPacks: PackInfo[];
}

export async function streamChatMessage(
  messages: ChatMessage[],
  nodeContext: ChatNodeContext | null,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onThinking?: (thought: string) => void,
  getNodeById?: (nodeId: string) => ChatNode | undefined,
  onAction?: (action: ChatAction) => void,
  getGraphSummary?: () => ChatGraphSummary,
  persona?: string,
  onToolCall?: (name: string, args: Record<string, unknown>) => void,
  getPacksState?: () => PacksState,
  onEnablePack?: (
    packId: string,
    kind: 'object' | 'preset',
    enable: boolean
  ) => { success: boolean; error?: string },
  onToolCallOutput?: (callIndex: number, output: unknown) => void,
  onSubagentThinking?: (callIndex: number, thought: string) => void
): Promise<string> {
  const provider = getTextProvider();

  if (signal?.aborted) throw new Error('Request cancelled');

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

  // Convert ChatMessage[] to ChatTurnMessage[] for the provider abstraction
  const turnMessages: ChatTurnMessage[] = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    images: msg.images,
    youtubeUrls: msg.youtubeUrls
  }));

  const canvasDeclarations = onAction ? buildCanvasToolDeclarations(nodeContext) : [];
  const allCanvasDeclarations = onAction
    ? [...canvasDeclarations, connectEdgesDeclaration, disconnectEdgesDeclaration]
    : [];
  const tools = [...contextToolDeclarations, ...allCanvasDeclarations] as ToolDeclaration[];

  let fullText = '';
  let globalCallIndex = 0;

  // Multi-turn loop: runs until the model produces a pure text response (no tool calls)
  while (true) {
    if (signal?.aborted) throw new Error('Request cancelled');

    const { text, toolCalls, _rawModelTurn } = await provider.streamTurn(turnMessages, {
      systemPrompt: systemInstruction,
      tools,
      signal,
      onChunk,
      onThinking
    });

    fullText += text;

    if (toolCalls.length === 0) break;

    // Append model turn with tool calls (and _raw for thought_signature preservation)
    turnMessages.push({
      role: 'model',
      content: text,
      toolCalls,
      _raw: _rawModelTurn
    });

    const contextCalls = toolCalls.filter((tc) => CONTEXT_TOOL_NAMES.has(tc.name));
    const canvasCalls = toolCalls.filter((tc) => !CONTEXT_TOOL_NAMES.has(tc.name));

    // Assign global indices
    const callIndexMap = new Map<ToolCall, number>();
    for (const tc of toolCalls) {
      onToolCall?.(tc.name, tc.args);
      callIndexMap.set(tc, globalCallIndex++);
    }

    // Process canvas tool calls
    type CanvasCallStatus = { status: 'queued' | 'error'; message: string };
    const canvasResultMap = new Map<ToolCall, CanvasCallStatus>();

    for (const tc of canvasCalls) {
      const { name: toolName, args } = tc;

      if (!onAction) {
        canvasResultMap.set(tc, {
          status: 'queued',
          message: 'Action has been queued for user review.'
        });
        continue;
      }

      try {
        if (toolName === CONNECT_EDGES) {
          onAction(resolveConnectEdges(args, { getNodeById, getGraphSummary }));
        } else if (toolName === DISCONNECT_EDGES) {
          onAction(resolveDisconnectEdges(args, { getNodeById, getGraphSummary }));
        } else {
          const mode = toolNameToMode(toolName);
          const context = buildContextFromArgs(mode, args, getNodeById, nodeContext);
          const callIdx = callIndexMap.get(tc) ?? -1;
          const result = await runModeResolver(
            mode,
            (args.prompt as string) ?? '',
            context,
            signal ?? new AbortController().signal,
            (thought) => onSubagentThinking?.(callIdx, thought),
            () => {}
          );
          onAction({
            id: crypto.randomUUID(),
            mode,
            descriptor: getModeDescriptor(mode),
            result,
            state: 'pending'
          });
        }
        canvasResultMap.set(tc, {
          status: 'queued',
          message: 'Action has been queued for user review.'
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Tool call failed';
        let failMode: AiPromptMode;
        let failDescriptor: AiModeDescriptor;
        try {
          failMode = toolNameToMode(toolName);
          failDescriptor = getModeDescriptor(failMode);
        } catch {
          const fallbackMode = Object.keys(modeDescriptors)[0] as AiPromptMode;
          failMode = fallbackMode;
          failDescriptor = modeDescriptors[fallbackMode];
        }
        onAction({
          id: crypto.randomUUID(),
          mode: failMode,
          descriptor: failDescriptor,
          state: 'failed',
          error: msg
        });
        canvasResultMap.set(tc, { status: 'error', message: msg });
      }
    }

    // Resolve context tool calls
    const contextResults = await Promise.all(
      contextCalls.map(async (tc) => {
        const { name, args } = tc;
        const outputIndex = callIndexMap.get(tc) ?? -1;

        const respond = (response: unknown): ToolResult => {
          onToolCallOutput?.(outputIndex, response);
          return { callId: tc.id, name, result: response };
        };

        if (name === GET_GRAPH_NODES) {
          return respond(getGraphSummary?.() ?? { nodes: [], edges: [] });
        }

        if (name === GET_OBJECT_DATA) {
          const nodeId = (args.objectId as string) ?? '';
          const node = getNodeById?.(nodeId);
          if (!node) return respond({ error: `Node "${nodeId}" not found` });
          const graph = getGraphSummary?.() ?? { nodes: [], edges: [] };
          const connectedEdges = graph.edges.filter(
            (e) => e.source === nodeId || e.target === nodeId
          );
          return respond({ id: node.id, type: node.type, data: node.data, connectedEdges });
        }

        if (name === GET_OBJECT_LOGS) {
          const nodeId = (args.objectId as string) ?? '';
          const count = Math.min(Math.max((args.count as number) ?? 10, 1), 50);
          const seen = new Set<string>();
          const logs = logger
            .getNodeLogs(nodeId)
            .filter((e) => e.level === 'error' || e.level === 'warn')
            .filter((e) => {
              const key = `${e.level}:${e.message}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .slice(-count)
            .map((e) => ({
              level: e.level,
              message: e.message,
              timestamp: e.timestamp.toISOString()
            }));
          return respond({ nodeId, errors: logs, total: logs.length });
        }

        if (name === GET_OBJECT_ERRORS) {
          const nodeIds = (args.objectIds as string[]) ?? [];
          const result: Record<string, string[]> = {};
          for (const id of nodeIds) {
            const errors = getNodeErrors(id);
            if (errors.length > 0) result[id] = errors;
          }
          return respond(result);
        }

        if (name === SEARCH_DOCS) {
          const query = ((args.query as string) ?? '').toLowerCase().trim();
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
          return respond({
            results: [...matchingTopics, ...matchingObjects],
            total: matchingTopics.length + matchingObjects.length
          });
        }

        if (name === GET_DOC_CONTENT) {
          const kind = (args.kind as string) ?? '';
          const slug = (args.slug as string) ?? '';
          if (kind === 'topic') {
            const content = await fetchTopicHelp(slug);
            return respond(
              content.markdown
                ? { kind: 'topic', slug, markdown: content.markdown }
                : { error: `No documentation found for topic "${slug}"` }
            );
          }
          const content = await fetchObjectHelp(slug);
          return respond(
            content.markdown
              ? { kind: 'object', slug, markdown: content.markdown }
              : { error: `No documentation found for object "${slug}"` }
          );
        }

        if (name === LIST_PACKS) {
          return respond(getPacksState?.() ?? { objectPacks: [], presetPacks: [] });
        }

        if (name === ENABLE_PACK) {
          const packId = (args.packId as string) ?? '';
          const kind = (args.kind as 'object' | 'preset') ?? 'object';
          const enable = (args.enable as boolean) ?? true;
          if (!onEnablePack)
            return respond({
              success: false,
              error: 'Pack management is not available in this context.'
            });
          return respond(onEnablePack(packId, kind, enable));
        }

        // GET_OBJECT_INSTRUCTIONS
        const type = (args.type as string) ?? '';
        const instructions =
          getObjectSpecificInstructions(type) || `No specific instructions found for "${type}".`;
        const handleDocs = generateHandleDocs([type]);
        return respond({ instructions, ...(handleDocs ? { handleReference: handleDocs } : {}) });
      })
    );

    // Build canvas tool results
    const canvasToolResults: ToolResult[] = canvasCalls.map((tc) => ({
      callId: tc.id,
      name: tc.name,
      result: canvasResultMap.get(tc) ?? {
        status: 'queued',
        message: 'Action has been queued for user review.'
      }
    }));

    // Append user turn with all tool results
    turnMessages.push({
      role: 'user',
      content: '',
      toolResults: [...contextResults, ...canvasToolResults]
    });
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
  try {
    const provider = getTextProvider();
    const title = await provider.generateText([
      {
        role: 'user',
        content: `Generate a very short title (2-5 words) for a chat conversation that starts with this message. Reply with only the title, no quotes, no punctuation at the end:\n\n${userMessage}`
      }
    ]);
    return title.trim() || null;
  } catch (err) {
    console.error('[generateChatTitle] failed:', err);
    return null;
  }
}
