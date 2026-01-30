import type { Edge, Node } from '@xyflow/svelte';
import type { VFSTree } from '$lib/vfs/types';

/**
 * Raw patch data before migration (version may be missing or old)
 */
export type RawPatchData = {
  name?: string;
  version?: string;
  timestamp?: number;
  nodes?: Node[];
  edges?: Edge[];
  files?: VFSTree;
};

/**
 * A migration transforms patch data from one version to the next
 */
export type Migration = {
  /** Version number this migration upgrades TO */
  version: number;
  /** Human-readable name for the migration */
  name: string;
  /** Transform function - receives patch data and returns migrated data */
  migrate: (patch: RawPatchData) => RawPatchData;
};
