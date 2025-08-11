import type { Node, Edge } from '@xyflow/svelte';
import { serializePatch } from './serialize-patch';

type SaveInfo = { nodes: Node[]; edges: Edge[] };

export function savePatchToLocalStorage({ name, nodes, edges }: SaveInfo & { name: string }) {
	if (!name.trim()) return;

	const patchData = serializePatch({ name, nodes, edges });

	const saved = localStorage.getItem('patchies-saved-patches') || '[]';
	let savedPatches: string[];

	try {
		savedPatches = JSON.parse(saved);
	} catch {
		savedPatches = [];
	}

	if (!savedPatches.includes(name)) {
		savedPatches.push(name);
		localStorage.setItem('patchies-saved-patches', JSON.stringify(savedPatches));
	}

	localStorage.setItem(`patchies-patch-${name}`, JSON.stringify(patchData));
}
