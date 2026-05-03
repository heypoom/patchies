import { match } from 'ts-pattern';
import { getObjectSpecificInstructions } from '../object-descriptions';
import { logger, getNodeErrors } from '$lib/utils/logger';
import { getTextProvider } from '../providers';
import type { ChatTurnMessage, ToolCall, ToolResult, ToolDeclaration } from '../providers/types';
import { JS_ENABLED_OBJECTS, jsRunnerInstructions } from '../object-prompts/shared-jsrunner';
import { toolNameToMode } from './canvas-tools';
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
  resolveDeleteObjects,
  resolveInsertObject,
  resolveInsertObjects,
  resolveMoveObjects,
  resolveReplaceObject,
  resolveUpdateObjectData
} from './direct-tool-handlers';
import {
  getPresetContent,
  resolveInsertPreset,
  searchAvailablePresets,
  type AvailablePreset
} from './preset-tool-handlers';
import {
  resolveGenerateObjectGraphSubtask,
  resolveGenerateObjectDataSubtask,
  resolveRewriteObjectDataSubtask
} from './subtask-tool-handlers';
import {
  SYSTEM_PROMPT,
  CONTEXT_TOOL_NAMES,
  SUBTASK_TOOL_NAMES,
  CONNECT_EDGES,
  DELETE_OBJECTS,
  DISCONNECT_EDGES,
  MOVE_OBJECTS,
  GENERATE_OBJECT_GRAPH,
  GENERATE_OBJECT_DATA,
  INSERT_OBJECT,
  INSERT_PRESET,
  INSERT_OBJECTS,
  REPLACE_OBJECT,
  REWRITE_OBJECT_DATA,
  UPDATE_OBJECT_DATA,
  GET_GRAPH_NODES,
  GET_OBJECT_DATA,
  GET_OBJECT_LOGS,
  GET_OBJECT_ERRORS,
  SEARCH_DOCS,
  GET_DOC_CONTENT,
  GET_PRESET_CONTENT,
  LIST_OBJECT_PACKS,
  LIST_PRESET_PACKS,
  ENABLE_PACK,
  SEARCH_PRESETS,
  SEARCH_SAMPLES,
  SEARCH_FREESOUND,
  contextToolDeclarations,
  connectEdgesDeclaration,
  deleteObjectsDeclaration,
  disconnectEdgesDeclaration,
  insertObjectDeclaration,
  insertPresetDeclaration,
  insertObjectsDeclaration,
  moveObjectsDeclaration,
  replaceObjectDeclaration,
  subtaskToolDeclarations,
  updateObjectDataDeclaration
} from './chat-tool-declarations';
import { resolveSearchSamples, resolveSearchFreesound } from './sample-tool-handlers';

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
  position?: { x: number; y: number };
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

const MAX_TOOL_ROUNDS = 15;

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
  getAvailablePresets?: () => AvailablePreset[],
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

  const allCanvasDeclarations = onAction
    ? [
        insertObjectDeclaration,
        insertPresetDeclaration,
        insertObjectsDeclaration,
        updateObjectDataDeclaration,
        replaceObjectDeclaration,
        deleteObjectsDeclaration,
        moveObjectsDeclaration,
        connectEdgesDeclaration,
        disconnectEdgesDeclaration
      ]
    : [];
  const tools = [
    ...contextToolDeclarations,
    ...subtaskToolDeclarations,
    ...allCanvasDeclarations
  ] as ToolDeclaration[];

  let fullText = '';
  let globalCallIndex = 0;
  let toolRound = 0;

  // Accumulate search_samples URLs across multiple searches so we can auto-attach
  // them to insert calls for pads~/soundfile~.
  const MAX_CACHED_SAMPLE_URLS = 24;
  const sampleUrlCache: string[] = [];

  // Multi-turn loop: runs until the model produces a pure text response (no tool calls)
  while (true) {
    if (signal?.aborted) throw new Error('Request cancelled');

    if (++toolRound > MAX_TOOL_ROUNDS) {
      throw new Error(`Exceeded maximum tool rounds (${MAX_TOOL_ROUNDS})`);
    }

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

    const resultToolCalls = toolCalls.filter(
      (tc) => CONTEXT_TOOL_NAMES.has(tc.name) || SUBTASK_TOOL_NAMES.has(tc.name)
    );
    const canvasCalls = toolCalls.filter(
      (tc) => !CONTEXT_TOOL_NAMES.has(tc.name) && !SUBTASK_TOOL_NAMES.has(tc.name)
    );

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
        } else if (toolName === INSERT_OBJECT) {
          onAction(resolveInsertObject(args));
        } else if (toolName === INSERT_PRESET) {
          onAction(resolveInsertPreset(args, { presets: getAvailablePresets?.() ?? [] }));
        } else if (toolName === INSERT_OBJECTS) {
          onAction(resolveInsertObjects(args));
        } else if (toolName === UPDATE_OBJECT_DATA) {
          onAction(resolveUpdateObjectData(args, { getNodeById }));
        } else if (toolName === REPLACE_OBJECT) {
          onAction(resolveReplaceObject(args, { getNodeById }));
        } else if (toolName === DELETE_OBJECTS) {
          onAction(resolveDeleteObjects(args, { getNodeById }));
        } else if (toolName === MOVE_OBJECTS) {
          onAction(resolveMoveObjects(args, { getNodeById }));
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

          // Auto-attach cached sample URLs for pads~/soundfile~ inserts.
          // The AI cannot reliably pass URLs through tool args, so we
          // automatically wire in the last search_samples results.
          if (result && result.kind === 'single' && sampleUrlCache.length > 0) {
            if (result.type === 'pads~' && !result.data._initialUrls) {
              const urls: Record<string, string> = {};

              sampleUrlCache.forEach((url, i) => {
                urls[String(i)] = url;
              });

              result.data = { ...result.data, _initialUrls: urls };
            } else if (result.type === 'soundfile~' && !result.data._initialUrl) {
              result.data = { ...result.data, _initialUrl: sampleUrlCache[0] };
            }
          }

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
          failMode = modeForToolName(toolName);
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
    const settledContextResults = await Promise.allSettled(
      resultToolCalls.map(async (tc) => {
        const { name, args } = tc;
        const outputIndex = callIndexMap.get(tc) ?? -1;

        const respond = (response: unknown): ToolResult => {
          onToolCallOutput?.(outputIndex, response);

          return { callId: tc.id, name, result: response };
        };

        return await match(name)
          .with(GET_GRAPH_NODES, async () =>
            respond(getGraphSummary?.() ?? { nodes: [], edges: [] })
          )
          .with(GET_OBJECT_DATA, async () => {
            const nodeId = (args.objectId as string) ?? '';

            const node = getNodeById?.(nodeId);
            if (!node) return respond({ error: `Node "${nodeId}" not found` });

            const graph = getGraphSummary?.() ?? { nodes: [], edges: [] };
            const connectedEdges = graph.edges.filter(
              (e) => e.source === nodeId || e.target === nodeId
            );

            return respond({ id: node.id, type: node.type, data: node.data, connectedEdges });
          })
          .with(GET_OBJECT_LOGS, async () => {
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
          })
          .with(GET_OBJECT_ERRORS, async () => {
            const nodeIds = (args.objectIds as string[]) ?? [];
            const result: Record<string, string[]> = {};

            for (const id of nodeIds) {
              const errors = getNodeErrors(id);

              if (errors.length > 0) {
                result[id] = errors;
              }
            }

            return respond(result);
          })
          .with(SEARCH_DOCS, async () => {
            const query = ((args.query as string) ?? '').toLowerCase().trim();
            if (!query) return respond({ results: [], total: 0 });

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
          })
          .with(GET_DOC_CONTENT, async () => {
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
          })
          .with(LIST_OBJECT_PACKS, async () =>
            respond({ objectPacks: getPacksState?.().objectPacks ?? [] })
          )
          .with(LIST_PRESET_PACKS, async () =>
            respond({ presetPacks: getPacksState?.().presetPacks ?? [] })
          )
          .with(SEARCH_PRESETS, async () =>
            respond(searchAvailablePresets(args, getAvailablePresets?.() ?? []))
          )
          .with(GET_PRESET_CONTENT, async () =>
            respond(getPresetContent(args, getAvailablePresets?.() ?? []))
          )
          .with(SEARCH_SAMPLES, async () => {
            const result = await resolveSearchSamples(args);

            // Accumulate URLs for auto-attach to subsequent insert calls.
            // New results go to the end (latest = most relevant to next insert).
            // Evict oldest when over the cap.
            const res = result as { results?: Array<{ url?: string }> };

            const newUrls = (res.results ?? [])
              .map((r) => r.url)
              .filter((u): u is string => typeof u === 'string');

            const existing = new Set(sampleUrlCache);

            for (const url of newUrls) {
              if (!existing.has(url)) sampleUrlCache.push(url);
            }

            // Evict oldest entries if over cap
            if (sampleUrlCache.length > MAX_CACHED_SAMPLE_URLS) {
              sampleUrlCache.splice(0, sampleUrlCache.length - MAX_CACHED_SAMPLE_URLS);
            }

            return respond(result);
          })
          .with(SEARCH_FREESOUND, async () => respond(await resolveSearchFreesound(args)))
          .with(ENABLE_PACK, async () => {
            const packId = (args.packId as string) ?? '';
            const kind = (args.kind as string) ?? '';
            const enable = args.enable;
            if (!packId)
              return respond({ success: false, error: 'packId must be a non-empty string.' });
            if (kind !== 'object' && kind !== 'preset')
              return respond({
                success: false,
                error: `kind must be "object" or "preset", got "${kind}".`
              });
            if (typeof enable !== 'boolean')
              return respond({ success: false, error: 'enable must be a boolean.' });
            if (!onEnablePack)
              return respond({
                success: false,
                error: 'Pack management is not available in this context.'
              });
            return respond(onEnablePack(packId, kind as 'object' | 'preset', enable));
          })
          .with(GENERATE_OBJECT_DATA, async () =>
            respond(
              await resolveGenerateObjectDataSubtask(args, signal, (thought) =>
                onSubagentThinking?.(outputIndex, thought)
              )
            )
          )
          .with(GENERATE_OBJECT_GRAPH, async () =>
            respond(
              await resolveGenerateObjectGraphSubtask(args, signal, (thought) =>
                onSubagentThinking?.(outputIndex, thought)
              )
            )
          )
          .with(REWRITE_OBJECT_DATA, async () =>
            respond(
              await resolveRewriteObjectDataSubtask(args, signal, (thought) =>
                onSubagentThinking?.(outputIndex, thought)
              )
            )
          )
          .otherwise(async () => {
            // GET_OBJECT_INSTRUCTIONS
            const type = (args.type as string) ?? '';
            const instructions =
              getObjectSpecificInstructions(type) ||
              `No specific instructions found for "${type}".`;
            const handleDocs = generateHandleDocs([type]);
            const objectSchema = objectSchemas[type];
            return respond({
              type,
              instructions,
              ...(objectSchema
                ? {
                    schema: {
                      type: objectSchema.type,
                      description: objectSchema.description,
                      category: objectSchema.category,
                      inlets: objectSchema.inlets,
                      outlets: objectSchema.outlets,
                      tags: objectSchema.tags
                    }
                  }
                : {}),
              ...(handleDocs ? { handleReference: handleDocs } : {})
            });
          });
      })
    );

    const contextResults: ToolResult[] = settledContextResults.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      const tc = resultToolCalls[i];
      const outputIndex = callIndexMap.get(tc) ?? -1;
      const errorMsg =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      onToolCallOutput?.(outputIndex, { error: errorMsg });
      return { callId: tc.id, name: tc.name, result: { error: errorMsg } };
    });

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

function modeForToolName(name: string): AiPromptMode {
  return match(name)
    .with(INSERT_OBJECT, () => 'insert' as const)
    .with(INSERT_PRESET, () => 'insert' as const)
    .with(INSERT_OBJECTS, () => 'multi' as const)
    .with(UPDATE_OBJECT_DATA, () => 'edit' as const)
    .with(REPLACE_OBJECT, () => 'turn-into' as const)
    .with(DELETE_OBJECTS, () => 'delete-objects' as const)
    .with(MOVE_OBJECTS, () => 'move-objects' as const)
    .otherwise(() => toolNameToMode(name));
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
