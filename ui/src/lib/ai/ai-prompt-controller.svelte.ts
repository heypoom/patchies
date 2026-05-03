/**
 * AiPromptController — reactive controller for all AI prompt modes.
 *
 * Extracts all stateful AI operation logic out of AiObjectPrompt.svelte so the
 * component can stay thin and driven purely by the active mode descriptor.
 *
 * Canvas callbacks are injected at construction time so the controller can
 * apply results without the component needing to handle dispatch.
 */

import { toast } from 'svelte-sonner';
import type { Edge } from '@xyflow/svelte';
import type { AiObjectNode, SimplifiedEdge } from '$lib/ai/types';
import type { AiModeContext, AiModeResult, AiPromptMode } from './modes/types';
import { getModeDescriptor } from './modes/descriptors';
import { runModeResolver } from './modes/run-resolver';

export interface AiPromptCallbacks {
  onInsertObject: (
    type: string,
    data: Record<string, unknown>,
    position?: { x: number; y: number }
  ) => void;
  onInsertMultipleObjects: (nodes: AiObjectNode[], edges: SimplifiedEdge[]) => void;
  onEditObject: (nodeId: string, data: Record<string, unknown>) => void;
  onReplaceObject: (nodeId: string, newType: string, newData: Record<string, unknown>) => void;
  onConnectEdges: (edges: Edge[]) => void;
  onDisconnectEdges: (edgeIds: string[]) => void;
  onDeleteObjects: (nodeIds: string[]) => void;
  onMoveObjects: (positions: Array<{ nodeId: string; position: { x: number; y: number } }>) => void;
}

export function createAiPromptController(callbacks: AiPromptCallbacks) {
  // ── State ────────────────────────────────────────────────────────────────
  let mode = $state<AiPromptMode>('insert');
  let context = $state<AiModeContext>({});
  let promptText = $state('');
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);
  let resolvedObjectType = $state<string | null>(null);
  let isGeneratingConfig = $state(false);
  let thinkingText = $state<string | null>(null);
  let thinkingLog = $state<string[]>([]);
  let abortController: AbortController | null = null;

  // ── Derived ──────────────────────────────────────────────────────────────
  const descriptor = $derived(getModeDescriptor(mode));

  // ── Private helpers ──────────────────────────────────────────────────────
  function resetLoadingState() {
    thinkingText = null;
    thinkingLog = [];
    resolvedObjectType = null;
    isGeneratingConfig = false;
    errorMessage = null;
  }

  function onThinking(thought: string) {
    thinkingText = thought;
    thinkingLog = [...thinkingLog, thought];
  }

  function onProgress(status: string) {
    resolvedObjectType = status;
    isGeneratingConfig = true;
  }

  function applyResult(result: AiModeResult) {
    switch (result.kind) {
      case 'single':
        callbacks.onInsertObject(result.type, result.data, result.position);
        toast.success(`Created ${result.type}`);
        break;
      case 'multi':
        callbacks.onInsertMultipleObjects(result.nodes, result.edges);
        toast.success(`Created ${result.nodes.length} objects`);
        break;
      case 'edit':
        callbacks.onEditObject(result.nodeId, result.data);
        toast.success('Object updated');
        break;
      case 'replace':
        callbacks.onReplaceObject(result.nodeId, result.newType, result.newData);
        toast.success(`Replaced with ${result.newType}`);
        break;
      case 'connect-edges':
        callbacks.onConnectEdges(result.edges);
        if (result.edges.length > 0) {
          toast.success(
            `Connected ${result.edges.length} edge${result.edges.length === 1 ? '' : 's'}`
          );
        }
        if (result.invalidEdges && result.invalidEdges.length > 0) {
          toast.warning(
            `${result.invalidEdges.length} edge${result.invalidEdges.length === 1 ? '' : 's'} had invalid handles and ${result.invalidEdges.length === 1 ? 'was' : 'were'} skipped`,
            { description: 'You may need to connect some edges manually.' }
          );
        }
        break;
      case 'disconnect-edges':
        callbacks.onDisconnectEdges(result.edgeIds);

        if (result.edgeIds.length > 0) {
          toast.success(
            `Disconnected ${result.edgeIds.length} edge${result.edgeIds.length === 1 ? '' : 's'}`
          );
        }
        break;
      case 'delete-objects':
        callbacks.onDeleteObjects(result.nodeIds);

        if (result.nodeIds.length > 0) {
          toast.success(
            `Deleted ${result.nodeIds.length} object${result.nodeIds.length === 1 ? '' : 's'}`
          );
        }
        break;
      case 'move-objects':
        callbacks.onMoveObjects(result.positions);

        if (result.positions.length > 0) {
          toast.success(
            `Moved ${result.positions.length} object${result.positions.length === 1 ? '' : 's'}`
          );
        }
        break;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────
  return {
    get mode() {
      return mode;
    },
    get context() {
      return context;
    },
    get promptText() {
      return promptText;
    },
    set promptText(v: string) {
      promptText = v;
    },
    get isLoading() {
      return isLoading;
    },
    get errorMessage() {
      return errorMessage;
    },
    get resolvedObjectType() {
      return resolvedObjectType;
    },
    get isGeneratingConfig() {
      return isGeneratingConfig;
    },
    get thinkingText() {
      return thinkingText;
    },
    get thinkingLog() {
      return thinkingLog;
    },
    get descriptor() {
      return descriptor;
    },

    setMode(newMode: AiPromptMode, newContext?: AiModeContext) {
      mode = newMode;
      if (newContext) context = newContext;
    },

    open(newMode: AiPromptMode, newContext?: AiModeContext) {
      mode = newMode;
      context = newContext ?? {};
      promptText = '';
      errorMessage = null;
    },

    async submit() {
      const canSubmit = descriptor.promptOptional
        ? !isLoading
        : !isLoading && promptText.trim().length > 0;

      if (!canSubmit) return;

      isLoading = true;
      resetLoadingState();
      const current = new AbortController();
      abortController = current;

      try {
        const result = await runModeResolver(
          mode,
          promptText,
          context,
          current.signal,
          onThinking,
          onProgress
        );

        applyResult(result);
        return true; // signal success to component (so it can close)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        if (message !== 'Request cancelled') {
          errorMessage = message;
          toast.error(message);
        }
        return false;
      } finally {
        if (abortController === current) {
          isLoading = false;
          abortController = null;
        }
      }
    },

    cancel() {
      abortController?.abort();
    },

    reset() {
      promptText = '';
      errorMessage = null;
      resetLoadingState();
    }
  };
}
