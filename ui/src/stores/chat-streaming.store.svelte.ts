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
  type ChatNodeContext
} from '$lib/ai/chat/resolver';
import { CONTEXT_TOOL_NAMES } from '$lib/ai/chat/chat-tool-declarations';
import { modeDescriptors } from '$lib/ai/modes/descriptors';
import { toolNameToMode } from '$lib/ai/chat/canvas-tools';
import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
import type { ThreadMessage, ThreadActionRef, ThreadToolCall } from '$lib/ai/chat/types';
import { saveChatMessages, loadChatMessages, deleteChatMessages } from './chat-history.store';
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
    .with('get_object_data', () => `Reading object data`)
    .with('get_object_logs', () => `Checking object logs`)
    .with('get_object_errors', () => 'Checking object errors')
    .with('search_docs', () => `Searching: "${args.query ?? ''}"`)
    .with('get_doc_content', () => `Fetching ${args.kind ?? 'doc'}: ${args.slug ?? ''}`)
    .with('list_packs', () => 'Listing packs')
    .with('enable_pack', () => `${args.enable ? 'Enabling' : 'Disabling'} ${args.packId ?? 'pack'}`)
    .with('connect_edges', () => 'Connecting edges')
    .with('disconnect_edges', () => 'Disconnecting edges')
    .otherwise(() => {
      const mode = modeDescriptors[toolNameToMode(name)];

      return mode?.toolCallLabel ?? mode?.label ?? name;
    });

const applyActionToCallbacks = (action: ChatAction, aiCallbacks: AiPromptCallbacks): void => {
  if (!action.result) return;
  match(action.result)
    .with({ kind: 'single' }, (r) => aiCallbacks.onInsertObject(r.type, r.data))
    .with({ kind: 'multi' }, (r) => aiCallbacks.onInsertMultipleObjects(r.nodes, r.edges))
    .with({ kind: 'edit' }, (r) => aiCallbacks.onEditObject(r.nodeId, r.data))
    .with({ kind: 'replace' }, (r) => aiCallbacks.onReplaceObject(r.nodeId, r.newType, r.newData))
    .with({ kind: 'connect-edges' }, (r) => {
      aiCallbacks.onConnectEdges(r.edges);
    })
    .with({ kind: 'disconnect-edges' }, (r) => {
      aiCallbacks.onDisconnectEdges(r.edgeIds);
    })
    .exhaustive();
};

export interface StartStreamParams {
  chatHistory: ChatMessage[];
  nodeContext: ChatNodeContext | null;
  getNodeById?: (nodeId: string) => ChatNode | undefined;
  getGraphSummary?: () => ChatGraphSummary;
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
        params.activePersonaPrompt,
        (name, args) => {
          session.streamingToolCalls = [
            ...session.streamingToolCalls,
            {
              name,
              label: getToolCallLabel(name, args),
              args,
              isSubagent: !CONTEXT_TOOL_NAMES.has(name)
            }
          ];
        },
        buildGetPacksState(),
        buildOnEnablePack(),
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
        (name, args) => {
          session.streamingToolCalls = [
            ...session.streamingToolCalls,
            { name, label: getToolCallLabel(name, args), args }
          ];
        },
        buildGetPacksState(),
        buildOnEnablePack(),
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
