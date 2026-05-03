import { SvelteMap } from 'svelte/reactivity';
import { get } from 'svelte/store';
import { match } from 'ts-pattern';
import { toast } from 'svelte-sonner';

import {
  streamChatMessage,
  generateChatTitle,
  type ChatMessage,
  type ChatAction,
  type ChatNode,
  type ChatGraphSummary,
  type ChatViewportSummary,
  type ChatNodeContext
} from '$lib/ai/chat/resolver';
import {
  CONTEXT_TOOL_NAMES,
  DIRECT_CANVAS_TOOL_NAMES,
  SUBTASK_TOOL_NAMES
} from '$lib/ai/chat/chat-tool-declarations';
import { modeDescriptors } from '$lib/ai/modes/descriptors';
import { toolNameToMode } from '$lib/ai/chat/canvas-tools';
import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
import type { ThreadMessage, ThreadActionRef, ThreadToolCall } from '$lib/ai/chat/types';
import { saveChatMessages, loadChatMessages, deleteChatMessages } from './chat-history.store';
import { flattenedPresets } from './preset-library.store';
import {
  BUILT_IN_PACKS,
  BUILT_IN_PRESET_PACKS,
  enabledPackIds,
  enabledPresetPackIds,
  togglePack,
  togglePresetPack,
  isPackLocked,
  isPresetPackLocked
} from './extensions.store';
import { getBuiltInPresetPackByPresetName } from '$lib/extensions/preset-pack-index';

class SessionState {
  messages = $state<ThreadMessage[]>([]);
  isLoading = $state(false);
  streamingText = $state('');
  thinkingText = $state('');
  streamingToolCalls = $state<ThreadToolCall[]>([]);
  pendingActions = $state<string[]>([]);
  abortController: AbortController | null = $state(null);

  actions = new SvelteMap<string, ChatAction>();
  loaded = $state(false);
}

const sessions = new SvelteMap<string, SessionState>();

function getOrCreateSession(sessionId: string): SessionState {
  let session = sessions.get(sessionId);

  if (!session) {
    session = new SessionState();
    sessions.set(sessionId, session);
  }

  return session;
}

const getToolCallLabel = (name: string, args: Record<string, unknown>): string =>
  match(name)
    .with('get_object_instructions', () => `Looking up ${args.type ?? 'object'} docs`)
    .with('get_graph_nodes', () => 'Reading patch graph')
    .with('get_viewport', () => 'Reading viewport')
    .with('get_object_data', () => `Reading object data`)
    .with('get_object_logs', () => `Checking object logs`)
    .with('get_object_errors', () => 'Checking object errors')
    .with('search_docs', () => `Searching: "${args.query ?? ''}"`)
    .with('get_doc_content', () => `Fetching ${args.kind ?? 'doc'}: ${args.slug ?? ''}`)
    .with('list_packs', () => 'Listing packs')
    .with('list_object_packs', () => 'Listing object packs')
    .with('list_preset_packs', () => 'Listing preset packs')
    .with('enable_pack', () => `${args.enable ? 'Enabling' : 'Disabling'} ${args.packId ?? 'pack'}`)
    .with('search_presets', () => `Searching presets: "${args.query ?? ''}"`)
    .with('get_preset_content', () => `Reading preset ${args.presetName ?? ''}`)
    .with('generate_object_data', () => `Generating ${args.type ?? 'object'} data`)
    .with('generate_object_graph', () => 'Generating object graph')
    .with('rewrite_object_data', () => `Rewriting ${args.type ?? 'object'} data`)
    .with('insert_object', () => `Adding ${args.type ?? 'object'}`)
    .with('insert_preset', () => `Adding preset ${args.presetName ?? ''}`)
    .with('insert_objects', () => 'Adding objects')
    .with('update_object_data', () => `Updating ${args.nodeId ?? 'object'}`)
    .with('replace_object', () => `Replacing ${args.nodeId ?? 'object'}`)
    .with('delete_objects', () => 'Deleting objects')
    .with('move_objects', () => 'Moving objects')
    .with('connect_edges', () => 'Connecting edges')
    .with('disconnect_edges', () => 'Disconnecting edges')
    .with('search_samples', () => `Searching samples: "${args.query ?? ''}"`)
    .with('search_freesound', () => `Searching Freesound: "${args.query ?? ''}"`)

    .otherwise(() => {
      const mode = modeDescriptors[toolNameToMode(name)];

      return mode?.label ?? name;
    });

const applyActionToCallbacks = (action: ChatAction, aiCallbacks: AiPromptCallbacks): void => {
  if (!action.result) return;
  match(action.result)
    .with({ kind: 'single' }, (r) => aiCallbacks.onInsertObject(r.type, r.data, r.position))
    .with({ kind: 'multi' }, (r) => aiCallbacks.onInsertMultipleObjects(r.nodes, r.edges))
    .with({ kind: 'edit' }, (r) => aiCallbacks.onEditObject(r.nodeId, r.data))
    .with({ kind: 'replace' }, (r) => aiCallbacks.onReplaceObject(r.nodeId, r.newType, r.newData))
    .with({ kind: 'connect-edges' }, (r) => {
      aiCallbacks.onConnectEdges(r.edges);
    })
    .with({ kind: 'disconnect-edges' }, (r) => {
      aiCallbacks.onDisconnectEdges(r.edgeIds);
    })
    .with({ kind: 'delete-objects' }, (r) => {
      aiCallbacks.onDeleteObjects(r.nodeIds);
    })
    .with({ kind: 'move-objects' }, (r) => {
      aiCallbacks.onMoveObjects(r.positions);
    })
    .exhaustive();
};

export interface StartStreamParams {
  chatHistory: ChatMessage[];
  nodeContext: ChatNodeContext | null;
  getNodeById?: (nodeId: string) => ChatNode | undefined;
  getGraphSummary?: () => ChatGraphSummary;
  getViewportSummary?: () => ChatViewportSummary;
  activePersonaPrompt?: string;
  aiCallbacks?: AiPromptCallbacks;
  autoApprove: boolean;
  onRename?: (name: string) => void;
  isFirstMessage: boolean;
  userContent: string;
}

function buildGetPacksState() {
  return () => {
    const enabledObj = get(enabledPackIds);
    const enabledPre = get(enabledPresetPackIds);

    return {
      objectPacks: BUILT_IN_PACKS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        enabled: enabledObj.includes(p.id),
        locked: isPackLocked(p.id)
      })),
      presetPacks: BUILT_IN_PRESET_PACKS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        enabled: enabledPre.includes(p.id),
        locked: isPresetPackLocked(p.id)
      }))
    };
  };
}

function buildOnEnablePack() {
  return (packId: string, kind: 'object' | 'preset', enable: boolean) => {
    if (kind === 'object') {
      if (isPackLocked(packId))
        return { success: false, error: `Pack "${packId}" is locked and cannot be changed.` };
      const enabled = get(enabledPackIds).includes(packId);
      if (enabled !== enable) togglePack(packId);
      return { success: true };
    } else {
      if (isPresetPackLocked(packId))
        return { success: false, error: `Pack "${packId}" is locked and cannot be changed.` };
      const enabled = get(enabledPresetPackIds).includes(packId);
      if (enabled !== enable) togglePresetPack(packId);
      return { success: true };
    }
  };
}

function buildGetAvailablePresets() {
  return () =>
    get(flattenedPresets).map((entry) => {
      const pack =
        entry.libraryId === 'built-in' ? getBuiltInPresetPackByPresetName(entry.preset.name) : null;

      return {
        path: entry.path,
        preset: entry.preset,
        libraryId: entry.libraryId,
        libraryName: entry.libraryName,
        ...(pack ? { pack: { id: pack.id, name: pack.name } } : {})
      };
    });
}

export const chatStreamStore = {
  getSession(sessionId: string): SessionState {
    return getOrCreateSession(sessionId);
  },

  async init(sessionId: string): Promise<void> {
    const session = getOrCreateSession(sessionId);

    if (!session.loaded) {
      session.messages = await loadChatMessages(sessionId);
      session.loaded = true;
    }
  },

  addUserMessage(sessionId: string, message: ThreadMessage): void {
    const session = getOrCreateSession(sessionId);
    session.messages = [...session.messages, message];

    saveChatMessages(sessionId, session.messages);
  },

  async startStream(sessionId: string, params: StartStreamParams): Promise<void> {
    const session = getOrCreateSession(sessionId);

    if (params.isFirstMessage && params.onRename && params.userContent) {
      generateChatTitle(params.userContent).then((title) => {
        if (title) params.onRename!(title);
      });
    }

    session.streamingText = '';
    session.thinkingText = '';
    session.streamingToolCalls = [];
    session.pendingActions = [];
    session.abortController = new AbortController();
    session.isLoading = true;

    const abortSignal = session.abortController.signal;

    try {
      const fullText = await streamChatMessage(
        params.chatHistory,
        params.nodeContext,
        (chunk) => {
          session.streamingText += chunk;
        },
        abortSignal,
        (thought) => {
          session.thinkingText += thought;
        },
        params.getNodeById,
        params.aiCallbacks
          ? (action) => {
              session.actions.set(action.id, action);
              session.pendingActions = [...session.pendingActions, action.id];

              if (params.autoApprove && action.state !== 'failed') {
                applyActionToCallbacks(action, params.aiCallbacks!);
                const existing = session.actions.get(action.id);
                if (existing) session.actions.set(action.id, { ...existing, state: 'applied' });
              }
            }
          : undefined,
        params.getGraphSummary,
        params.getViewportSummary,
        params.activePersonaPrompt,
        (name, args) => {
          session.streamingToolCalls = [
            ...session.streamingToolCalls,
            {
              name,
              label: getToolCallLabel(name, args),
              args,
              isSubagent:
                SUBTASK_TOOL_NAMES.has(name) ||
                (!DIRECT_CANVAS_TOOL_NAMES.has(name) && !CONTEXT_TOOL_NAMES.has(name))
            }
          ];
        },
        buildGetPacksState(),
        buildOnEnablePack(),
        buildGetAvailablePresets(),
        (callIndex, output) => {
          session.streamingToolCalls = session.streamingToolCalls.map((c, i) =>
            i === callIndex ? { ...c, output } : c
          );
        },
        (callIndex, thought) => {
          session.streamingToolCalls = session.streamingToolCalls.map((c, i) =>
            i === callIndex ? { ...c, thinking: (c.thinking ?? '') + thought } : c
          );
        }
      );

      const completedActions: ThreadActionRef[] = session.pendingActions.map((id) => {
        const action = session.actions.get(id);

        if (action?.state === 'failed') {
          return { id, type: action.mode, state: 'failed' as const, error: action.error };
        }

        const summary = action?.result
          ? match(action.result)
              .with({ kind: 'single' }, (r) => `Created ${r.type}`)
              .with({ kind: 'multi' }, (r) => `Created ${r.nodes.length} objects`)
              .with({ kind: 'edit' }, () => `Edited object`)
              .with({ kind: 'replace' }, (r) => `Replaced with ${r.newType}`)
              .with(
                { kind: 'connect-edges' },
                (r) => `Connected ${r.edges.length} edge${r.edges.length === 1 ? '' : 's'}`
              )
              .with(
                { kind: 'disconnect-edges' },
                (r) => `Disconnected ${r.edgeIds.length} edge${r.edgeIds.length === 1 ? '' : 's'}`
              )
              .with(
                { kind: 'delete-objects' },
                (r) => `Deleted ${r.nodeIds.length} object${r.nodeIds.length === 1 ? '' : 's'}`
              )
              .with(
                { kind: 'move-objects' },
                (r) => `Moved ${r.positions.length} object${r.positions.length === 1 ? '' : 's'}`
              )
              .exhaustive()
          : undefined;

        return {
          id,
          type: action?.mode ?? 'unknown',
          summary,
          state: action?.state === 'dismissed' ? ('dismissed' as const) : ('applied' as const)
        };
      });

      session.messages = [
        ...session.messages,
        {
          role: 'model',
          content: fullText,
          thinking: session.thinkingText || undefined,
          actions: completedActions.length > 0 ? completedActions : undefined,
          toolCalls: session.streamingToolCalls.length > 0 ? session.streamingToolCalls : undefined
        }
      ];

      await saveChatMessages(sessionId, session.messages);

      session.streamingText = '';
      session.thinkingText = '';
      session.streamingToolCalls = [];
      session.pendingActions = [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === 'Request cancelled') {
        // Mark any in-flight subagent calls (no output yet) as aborted and persist the partial message
        const abortedCalls = session.streamingToolCalls.map((c) =>
          c.isSubagent && c.output === undefined ? { ...c, aborted: true } : c
        );

        if (abortedCalls.some((c) => c.aborted) || session.streamingText) {
          session.messages = [
            ...session.messages,
            {
              role: 'model' as const,
              content: session.streamingText,
              thinking: session.thinkingText || undefined,
              toolCalls: abortedCalls.length > 0 ? abortedCalls : undefined
            }
          ];
          await saveChatMessages(sessionId, session.messages);
        }
      } else {
        toast.error(message);
      }

      session.streamingText = '';
      session.thinkingText = '';
      session.streamingToolCalls = [];
      session.pendingActions = [];
    } finally {
      session.isLoading = false;
      session.abortController = null;
    }
  },

  cancel(sessionId: string): void {
    const session = sessions.get(sessionId);

    if (session) {
      session.abortController?.abort();
      session.abortController = null;
    }
  },

  updateActionState(sessionId: string, id: string, state: 'applied' | 'dismissed'): void {
    const session = getOrCreateSession(sessionId);

    const action = session.actions.get(id);
    if (!action) return;

    session.actions.set(id, { ...action, state });

    session.messages = session.messages.map((m) => {
      if (!m.actions) return m;
      const updated = m.actions.map((ref) => (ref.id === id ? { ...ref, state } : ref));
      return { ...m, actions: updated };
    });

    saveChatMessages(sessionId, session.messages);
  },

  async compact(sessionId: string): Promise<void> {
    const session = getOrCreateSession(sessionId);

    if (session.isLoading || session.messages.length === 0) return;

    const historyForSummary: ChatMessage[] = [
      ...session.messages.map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user' as const,
        content:
          'Please summarize our conversation so far into a concise context block. Capture key decisions, important context, code changes, and any open questions. This summary will replace the full conversation history to save context.'
      }
    ];

    session.streamingText = '';
    session.thinkingText = '';
    session.streamingToolCalls = [];
    session.pendingActions = [];
    session.abortController = new AbortController();
    session.isLoading = true;

    const abortSignal = session.abortController.signal;

    try {
      const summaryText = await streamChatMessage(
        historyForSummary,
        null,
        (chunk) => {
          session.streamingText += chunk;
        },
        abortSignal,
        (thought) => {
          session.thinkingText += thought;
        },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        (name, args) => {
          session.streamingToolCalls = [
            ...session.streamingToolCalls,
            { name, label: getToolCallLabel(name, args), args }
          ];
        },
        buildGetPacksState(),
        buildOnEnablePack(),
        buildGetAvailablePresets(),
        (callIndex, output) => {
          session.streamingToolCalls = session.streamingToolCalls.map((c, i) =>
            i === callIndex ? { ...c, output } : c
          );
        }
      );

      session.messages = [{ role: 'model', content: `**Conversation Summary**\n\n${summaryText}` }];
      session.actions.clear();

      await saveChatMessages(sessionId, session.messages);

      session.streamingText = '';
      session.thinkingText = '';
      session.streamingToolCalls = [];
      session.pendingActions = [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message !== 'Request cancelled') {
        toast.error(message);
      }

      session.streamingText = '';
      session.thinkingText = '';
      session.streamingToolCalls = [];
      session.pendingActions = [];
    } finally {
      session.isLoading = false;
      session.abortController = null;
    }
  },

  clear(sessionId: string): void {
    const session = getOrCreateSession(sessionId);

    session.messages = [];
    session.actions.clear();
    session.streamingText = '';

    deleteChatMessages(sessionId);
  },

  removeSession(sessionId: string): void {
    sessions.delete(sessionId);
  }
};
