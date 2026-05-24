import { get, writable } from 'svelte/store';
import { match } from 'ts-pattern';

export const activeDetachedStrudelNodeId = writable<string | null>(null);

export function openDetachedStrudelEditor(nodeId: string): void {
  activeDetachedStrudelNodeId.set(nodeId);
}

export function closeDetachedStrudelEditor(): void {
  activeDetachedStrudelNodeId.set(null);
}

export function isDetachedStrudelEditor(nodeId: string | undefined): boolean {
  return match(nodeId)
    .with(undefined, () => false)
    .otherwise((n) => get(activeDetachedStrudelNodeId) === n);
}
