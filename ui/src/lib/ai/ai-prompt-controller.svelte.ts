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
import type { AiObjectNode, SimplifiedEdge } from '$lib/ai/types';
import type { AiModeContext, AiModeResult, AiPromptMode } from './modes/types';
import { getModeDescriptor } from './modes/descriptors';
import { replaceResolver } from './modes/replace-resolver';
import { fixErrorResolver } from './modes/fix-error-resolver';
import { createConsumerResolver } from './modes/create-consumer-resolver';
import { createProducerResolver } from './modes/create-producer-resolver';
import { decomposeResolver } from './modes/decompose-resolver';
import { resolveObjectFromPrompt } from './single-object-resolver';
import { resolveMultipleObjectsFromPrompt } from './multi-object-resolver';
import { editObjectFromPrompt } from './edit-object-resolver';

export interface AiPromptCallbacks {
  onInsertObject: (type: string, data: Record<string, unknown>) => void;
  onInsertMultipleObjects: (nodes: AiObjectNode[], edges: SimplifiedEdge[]) => void;
  onEditObject: (nodeId: string, data: Record<string, unknown>) => void;
  onReplaceObject: (nodeId: string, newType: string, newData: Record<string, unknown>) => void;
}

export function createAiPromptController(callbacks: AiPromptCallbacks) {
  // ── State ────────────────────────────────────────────────────────────────
  let mode = $state<AiPromptMode>('single');
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
        callbacks.onInsertObject(result.type, result.data);
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
    }
  }

  async function runLegacyResolver(): Promise<AiModeResult> {
    if (mode === 'single') {
      const result = await resolveObjectFromPrompt(
        promptText,
        (objectType) => {
          resolvedObjectType = objectType;
          isGeneratingConfig = true;
        },
        abortController!.signal,
        onThinking
      );
      if (!result) throw new Error('Could not resolve object from prompt');
      return { kind: 'single', type: result.type, data: result.data as Record<string, unknown> };
    }

    if (mode === 'multi') {
      const result = await resolveMultipleObjectsFromPrompt(
        promptText,
        (objectTypes) => {
          resolvedObjectType = Array.from(new Set(objectTypes)).join(', ');
          isGeneratingConfig = true;
        },
        abortController!.signal,
        onThinking
      );
      if (!result || result.nodes.length === 0)
        throw new Error('Could not resolve objects from prompt');
      return { kind: 'multi', nodes: result.nodes, edges: result.edges };
    }

    if (mode === 'edit') {
      const { selectedNode } = context;
      if (!selectedNode) throw new Error('No node selected for edit');
      const result = await editObjectFromPrompt(
        promptText,
        selectedNode.type ?? 'unknown',
        (selectedNode.data as Record<string, unknown>) ?? {},
        abortController!.signal,
        onThinking
      );
      if (!result) throw new Error('Could not edit object');
      return {
        kind: 'edit',
        nodeId: selectedNode.id,
        data: result.data as Record<string, unknown>
      };
    }

    throw new Error(`Unhandled mode: ${mode}`);
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
      abortController = new AbortController();

      try {
        let result: AiModeResult;

        // Route to the appropriate resolver
        switch (mode) {
          case 'single':
          case 'multi':
          case 'edit':
            result = await runLegacyResolver();
            break;
          case 'replace':
            result = await replaceResolver(
              promptText,
              context,
              abortController.signal,
              onThinking,
              onProgress
            );
            break;
          case 'fix-error':
            result = await fixErrorResolver(
              promptText,
              context,
              abortController.signal,
              onThinking
            );
            break;
          case 'create-consumer':
            result = await createConsumerResolver(
              promptText,
              context,
              abortController.signal,
              onThinking,
              onProgress
            );
            break;
          case 'create-producer':
            result = await createProducerResolver(
              promptText,
              context,
              abortController.signal,
              onThinking,
              onProgress
            );
            break;
          case 'decompose':
            result = await decomposeResolver(
              promptText,
              context,
              abortController.signal,
              onThinking,
              onProgress
            );
            break;
          default:
            throw new Error(`Unknown mode: ${mode}`);
        }

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
        isLoading = false;
        abortController = null;
      }
    },

    cancel() {
      abortController?.abort();
      abortController = null;
      isLoading = false;
      errorMessage = 'Request cancelled';
    },

    reset() {
      promptText = '';
      errorMessage = null;
      resetLoadingState();
    }
  };
}
