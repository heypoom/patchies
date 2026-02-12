import type { Node, Edge } from '@xyflow/svelte';
import { get } from 'svelte/store';
import { serializePatch } from './serialize-patch';
import { addSavedPatch, savedPatches } from '../../stores/ui.store';

type SaveInfo = { nodes: Node[]; edges: Edge[] };

/**
 * Check if a patch name already exists in saved patches.
 */
export function patchNameExists(name: string): boolean {
  const patches = get(savedPatches);

  return patches.includes(name);
}

/**
 * Generate a unique patch name by appending (1), (2), etc. if the name already exists.
 * If currentPatchName matches the target name, returns the name as-is (intentional update).
 */
export function getUniquePatchName(name: string, currentPatchName: string | null): string {
  // If saving with the same name as current patch, allow overwrite (intentional update)
  if (currentPatchName === name) {
    return name;
  }

  // If name doesn't exist, use it directly
  if (!patchNameExists(name)) {
    return name;
  }

  // Find a unique name with (1), (2), etc.
  let counter = 1;
  let uniqueName = `${name} (${counter})`;

  while (patchNameExists(uniqueName)) {
    counter++;
    uniqueName = `${name} (${counter})`;
  }

  return uniqueName;
}

export function savePatchToLocalStorage({ name, nodes, edges }: SaveInfo & { name: string }) {
  if (!name.trim()) return;

  const patchJson = serializePatch({ name, nodes, edges });
  localStorage.setItem(`patchies-patch-${name}`, patchJson);

  // Update the reactive store (also persists to localStorage)
  addSavedPatch(name);
}
