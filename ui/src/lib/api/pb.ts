import { PATCH_SAVE_VERSION, type PatchSaveFormat } from '$lib/save-load/serialize-patch';
import type { Node, Edge } from '@xyflow/svelte';
import PocketBase from 'pocketbase';

const params = new URLSearchParams(window.location.search);

const DEFAULT_POCKETBASE_INSTANCE = 'https://api.patchies.app';

export const appHostUrl = import.meta.env.VITE_HOST_URL ?? location.origin;

const pocketbaseInstanceUrl =
	import.meta.env.VITE_POCKETBASE_INSTANCE ?? params.get('pb') ?? DEFAULT_POCKETBASE_INSTANCE;

export const pb = new PocketBase(pocketbaseInstanceUrl);

// @ts-expect-error -- for debugging
window.pb = pb;

export async function createShareablePatch(
	_name: string | null,
	nodes: Node[],
	edges: Edge[]
): Promise<string | null> {
	const name = _name || `Shared Patch ${new Date().toLocaleDateString()}`;

	const save: PatchSaveFormat = {
		name,
		nodes,
		edges,
		timestamp: Date.now(),
		version: PATCH_SAVE_VERSION
	};

	try {
		const result = await pb.collection('patches').create({
			name,
			patch: save,
			public: true
		});

		return result.id;
	} catch (error) {
		console.error('[share] cannot share patch:', error);
		return null;
	}
}

export async function getSharedPatchData(id: string): Promise<PatchSaveFormat | null> {
	const record = await pb.collection('patches').getOne(id);
	if (!record.patch) return null;

	return record.patch as PatchSaveFormat;
}
