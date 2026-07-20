import type { Migration } from '../types';

/**
 * Migration 015: Preserve toggle state from the legacy positional parameter.
 *
 * Before the headless toggle runtime stored state in `data.value`, dedicated
 * toggle nodes persisted it as the first item in `data.params`.
 */
export const migration015: Migration = {
  version: 15,
  name: 'toggle-legacy-value',

  migrate(patch) {
    if (!patch.nodes) return patch;

    const migratedNodes = patch.nodes.map((node) => {
      if (node.type !== 'toggle') return node;

      const data = node.data as { value?: unknown; params?: unknown[] } | undefined;
      const legacyValue = data?.params?.[0];

      if (data?.value !== undefined || typeof legacyValue !== 'boolean') return node;

      return {
        ...node,
        data: { ...data, value: legacyValue }
      };
    });

    return { ...patch, nodes: migratedNodes };
  }
};
