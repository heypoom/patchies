import { match } from 'ts-pattern';
import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
import type { ChatAction } from './resolver';

/** Applies a resolved chat canvas action through the editor's authoritative callbacks. */
export function applyChatAction(action: ChatAction, callbacks: AiPromptCallbacks): void {
  if (!action.result) return;

  match(action.result)
    .with({ kind: 'single' }, (result) =>
      callbacks.onInsertObject(result.type, result.data, result.position)
    )
    .with({ kind: 'multi' }, (result) =>
      callbacks.onInsertMultipleObjects(result.nodes, result.edges, result.basePosition)
    )
    .with({ kind: 'edit' }, (result) => callbacks.onEditObject(result.nodeId, result.data))
    .with({ kind: 'replace' }, (result) =>
      callbacks.onReplaceObject(result.nodeId, result.newType, result.newData)
    )
    .with({ kind: 'connect-edges' }, (result) => callbacks.onConnectEdges(result.edges))
    .with({ kind: 'disconnect-edges' }, (result) => callbacks.onDisconnectEdges(result.edgeIds))
    .with({ kind: 'delete-objects' }, (result) => callbacks.onDeleteObjects(result.nodeIds))
    .with({ kind: 'move-objects' }, (result) => callbacks.onMoveObjects(result.positions))
    .exhaustive();
}
