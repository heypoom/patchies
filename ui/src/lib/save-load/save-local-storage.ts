import type { Node, Edge } from '@xyflow/svelte';
import { serializePatch } from './serialize-patch';
import { addSavedPatch } from '../../stores/ui.store';

type SaveInfo = { nodes: Node[]; edges: Edge[] };

export function savePatchToLocalStorage({ name, nodes, edges }: SaveInfo & { name: string }) {
  if (!name.trim()) return;

  const patchJson = serializePatch({ name, nodes, edges });
  localStorage.setItem(`patchies-patch-${name}`, patchJson);

  // Update the reactive store (also persists to localStorage)
  addSavedPatch(name);
}
