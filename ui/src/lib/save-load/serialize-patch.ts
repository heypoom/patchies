import type { Edge, Node } from '@xyflow/svelte';
import { get } from 'svelte/store';

import { CURRENT_PATCH_VERSION } from '$lib/migration';
import type { VFSTree } from '$lib/vfs/types';
import { VirtualFilesystem } from '$lib/vfs/VirtualFilesystem';
import { currentPatchId } from '../../stores/ui.store';

export const PATCH_SAVE_VERSION = String(CURRENT_PATCH_VERSION);

export type PatchSaveFormat = {
  name: string;
  version: string;
  timestamp: number;
  nodes: Node[];
  edges: Edge[];
  files?: VFSTree;
  /** Unique ID for KV storage scoping. Added in v2. */
  patchId?: string;
};

export function serializePatch({
  name,
  nodes,
  edges
}: {
  name: string;
  nodes: Node[];
  edges: Edge[];
}) {
  const vfs = VirtualFilesystem.getInstance();
  const files = vfs.serialize();
  const patchId = get(currentPatchId);

  const patch: PatchSaveFormat = {
    name,
    version: PATCH_SAVE_VERSION,
    timestamp: Date.now(),
    nodes,
    edges,
    patchId,
    // Only include files if there are any entries
    ...(Object.keys(files.user || {}).length > 0 || Object.keys(files.objects || {}).length > 0
      ? { files }
      : {})
  };

  return JSON.stringify(patch);
}
