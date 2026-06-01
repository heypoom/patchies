import { get, writable } from 'svelte/store';
import { match } from 'ts-pattern';

export const activeDetachedSheetNodeId = writable<string | null>(null);

export function openDetachedSheet(nodeId: string): void {
  activeDetachedSheetNodeId.set(nodeId);
}

export function closeDetachedSheet(): void {
  activeDetachedSheetNodeId.set(null);
}

export function isDetachedSheet(nodeId: string | undefined): boolean {
  return match(nodeId)
    .with(undefined, () => false)
    .otherwise((n) => get(activeDetachedSheetNodeId) === n);
}
