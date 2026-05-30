import { get, writable } from 'svelte/store';
import { match } from 'ts-pattern';

export const activeDetachedOrcaNodeId = writable<string | null>(null);

export function openDetachedOrcaEditor(nodeId: string): void {
  activeDetachedOrcaNodeId.set(nodeId);
}

export function closeDetachedOrcaEditor(): void {
  activeDetachedOrcaNodeId.set(null);
}

export function isDetachedOrcaEditor(nodeId: string | undefined): boolean {
  return match(nodeId)
    .with(undefined, () => false)
    .otherwise((n) => get(activeDetachedOrcaNodeId) === n);
}
