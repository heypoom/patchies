import { applyChatAction } from '$lib/ai/chat/apply-chat-action';
import {
  CONNECT_EDGES,
  DELETE_OBJECTS,
  DISCONNECT_EDGES,
  INSERT_OBJECT,
  INSERT_OBJECTS,
  MOVE_OBJECTS,
  REPLACE_OBJECT,
  UPDATE_OBJECT_DATA
} from '$lib/ai/chat/chat-tool-declarations';
import {
  resolveDeleteObjects,
  resolveInsertObject,
  resolveInsertObjects,
  resolveMoveObjects,
  resolveReplaceObject,
  resolveUpdateObjectData
} from '$lib/ai/chat/direct-tool-handlers';
import { resolveConnectEdges, resolveDisconnectEdges } from '$lib/ai/chat/edge-tool-handlers';
import type { ChatGraphSummary, ChatNode, ChatViewportSummary } from '$lib/ai/chat/resolver';
import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
import { getObjectSpecificInstructions } from '$lib/ai/object-descriptions';
import { generateHandleDocs } from '$lib/ai/generate-handle-docs';
import { topicMetas } from '$lib/docs/topic-index';
import { fetchTopicHelp } from '$lib/docs/fetch-topic-help';
import { fetchObjectHelp } from '$lib/objects/fetch-object-help';
import { objectSchemas } from '$lib/objects/schemas';
import { getNodeErrors, logger } from '$lib/utils/logger';
import {
  listVfsFiles,
  readVfsText,
  searchVfsFiles,
  statVfsFile
} from '$lib/ai/chat/vfs-tool-handlers';

export interface RemoteToolRequest {
  tool: string;
  args: Record<string, unknown>;
}

export type RemoteToolResponse = { ok: true; result: unknown } | { ok: false; error: string };

export interface RemoteChatToolAdapterOptions {
  callbacks: AiPromptCallbacks;
  getNodeById: (nodeId: string) => ChatNode | undefined;
  getGraphSummary: () => ChatGraphSummary;
  getViewportSummary: () => ChatViewportSummary;
}

/**
 * Adapts a deliberately small RPC surface to the existing chat tool handlers.
 * New remote capabilities should first be added as chat tools, then exposed here.
 */
export class RemoteChatToolAdapter {
  constructor(private readonly options: RemoteChatToolAdapterOptions) {}

  async handle(request: RemoteToolRequest): Promise<RemoteToolResponse> {
    try {
      return { ok: true, result: await this.handleRequest(request) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async handleRequest({ tool, args }: RemoteToolRequest): Promise<unknown> {
    if (tool === 'get_graph_nodes') return this.options.getGraphSummary();
    if (tool === 'get_viewport') return this.options.getViewportSummary();
    if (tool === 'get_object_instructions') return this.getObjectInstructions(args);
    if (tool === 'search_docs') return this.searchDocs(args);
    if (tool === 'get_doc_content') return await this.getDocContent(args);
    if (tool === 'list_vfs_files') return await listVfsFiles(args);
    if (tool === 'search_vfs_files') return await searchVfsFiles(args);
    if (tool === 'stat_vfs_file') return statVfsFile(args);
    if (tool === 'read_vfs_text') return await readVfsText(args);

    if (tool === 'get_object_data') {
      const objectId = typeof args.objectId === 'string' ? args.objectId : '';
      const node = this.options.getNodeById(objectId);

      if (!node) throw new Error(`Node "${objectId}" not found`);

      const connectedEdges = this.options
        .getGraphSummary()
        .edges.filter((edge) => edge.source === objectId || edge.target === objectId);

      return { id: node.id, type: node.type, data: node.data, connectedEdges };
    }

    if (tool === 'get_object_errors') {
      const objectIds = Array.isArray(args.objectIds) ? args.objectIds : [];
      const errors: Record<string, string[]> = {};

      for (const objectId of objectIds) {
        if (typeof objectId !== 'string') continue;

        const nodeErrors = getNodeErrors(objectId);
        if (nodeErrors.length > 0) errors[objectId] = nodeErrors;
      }

      return errors;
    }

    if (tool === 'get_object_logs') {
      const objectId = typeof args.objectId === 'string' ? args.objectId : '';
      const requestedCount = typeof args.count === 'number' ? args.count : 10;
      const count = Math.min(Math.max(requestedCount, 1), 50);
      const seen = new Set<string>();
      const errors = logger
        .getNodeLogs(objectId)
        .filter((entry) => entry.level === 'error' || entry.level === 'warn')
        .filter((entry) => {
          const key = `${entry.level}:${entry.message}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(-count)
        .map((entry) => ({
          level: entry.level,
          message: entry.message,
          timestamp: entry.timestamp.toISOString()
        }));

      return { nodeId: objectId, errors, total: errors.length };
    }

    const action = this.resolveCanvasAction(tool, args);
    applyChatAction(action, this.options.callbacks);

    return { actionId: action.id, state: 'applied' };
  }

  private getObjectInstructions(args: Record<string, unknown>) {
    const type = typeof args.type === 'string' ? args.type : '';
    const instructions =
      getObjectSpecificInstructions(type) || `No specific instructions found for "${type}".`;
    const handleReference = generateHandleDocs([type]);
    const schema = objectSchemas[type];

    return {
      type,
      instructions,
      ...(schema
        ? {
            schema: {
              type: schema.type,
              description: schema.description,
              category: schema.category,
              inlets: schema.inlets,
              outlets: schema.outlets,
              tags: schema.tags
            }
          }
        : {}),
      ...(handleReference ? { handleReference } : {})
    };
  }

  private searchDocs(args: Record<string, unknown>) {
    const query = typeof args.query === 'string' ? args.query.toLowerCase().trim() : '';
    if (!query) return { results: [], total: 0 };

    const topics = topicMetas
      .filter(
        (topic) =>
          topic.slug.includes(query) ||
          topic.title.toLowerCase().includes(query) ||
          topic.category.toLowerCase().includes(query)
      )
      .map((topic) => ({
        kind: 'topic',
        slug: topic.slug,
        title: topic.title,
        category: topic.category
      }));
    const objects = Object.values(objectSchemas)
      .filter(
        (schema) =>
          schema.type.toLowerCase().includes(query) ||
          schema.description.toLowerCase().includes(query) ||
          schema.category.toLowerCase().includes(query) ||
          schema.tags?.some((tag) => tag.toLowerCase().includes(query))
      )
      .map((schema) => ({
        kind: 'object',
        slug: schema.type,
        title: schema.type,
        category: schema.category,
        description: schema.description
      }));

    return { results: [...topics, ...objects], total: topics.length + objects.length };
  }

  private async getDocContent(args: Record<string, unknown>) {
    const kind = typeof args.kind === 'string' ? args.kind : '';
    const slug = typeof args.slug === 'string' ? args.slug : '';

    if (kind === 'topic') {
      const content = await fetchTopicHelp(slug);

      return content.markdown
        ? { kind: 'topic', slug, markdown: content.markdown }
        : { error: `No documentation found for topic "${slug}"` };
    }

    const content = await fetchObjectHelp(slug);

    return content.markdown
      ? { kind: 'object', slug, markdown: content.markdown }
      : { error: `No documentation found for object "${slug}"` };
  }

  private resolveCanvasAction(tool: string, args: Record<string, unknown>) {
    const { getNodeById, getGraphSummary, getViewportSummary } = this.options;

    if (tool === INSERT_OBJECT)
      return resolveInsertObject(args, { viewportSummary: getViewportSummary() });
    if (tool === INSERT_OBJECTS)
      return resolveInsertObjects(args, { viewportSummary: getViewportSummary() });
    if (tool === UPDATE_OBJECT_DATA) return resolveUpdateObjectData(args, { getNodeById });
    if (tool === REPLACE_OBJECT) return resolveReplaceObject(args, { getNodeById });
    if (tool === DELETE_OBJECTS) return resolveDeleteObjects(args, { getNodeById });
    if (tool === MOVE_OBJECTS) return resolveMoveObjects(args, { getNodeById });
    if (tool === CONNECT_EDGES) return resolveConnectEdges(args, { getNodeById, getGraphSummary });
    if (tool === DISCONNECT_EDGES)
      return resolveDisconnectEdges(args, { getNodeById, getGraphSummary });

    throw new Error(`Unsupported remote tool "${tool}"`);
  }
}
