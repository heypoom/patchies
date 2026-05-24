import { get, writable } from 'svelte/store';

export const activeDetachedStrudelNodeId = writable<string | null>(null);

export function openDetachedStrudelEditor(nodeId: string): void {
  activeDetachedStrudelNodeId.set(nodeId);
}

export function closeDetachedStrudelEditor(): void {
  activeDetachedStrudelNodeId.set(null);
}

export function isDetachedStrudelEditor(nodeId: string | undefined): boolean {
  if (!nodeId) return false;

  return get(activeDetachedStrudelNodeId) === nodeId;
}
