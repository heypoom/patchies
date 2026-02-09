import type { Migration } from '../types';

/**
 * Migration 008: Clamp asm.value node addresses to new memory bounds
 *
 * The vasm memory layout was reduced from 128KB to 8KB (0x1000 = 4096 u16 values).
 * Old patches may have asm.value nodes with addresses that exceed the new bounds.
 *
 * This migration clamps addresses to the valid range [0, 0xFFF] (4095).
 */
export const migration008: Migration = {
  version: 8,
  name: 'asm-value-address-bounds',

  migrate(patch) {
    if (!patch.nodes) return patch;

    const MEMORY_SIZE = 0x1000; // 4096

    const migratedNodes = patch.nodes.map((node) => {
      // Only migrate asm.value nodes
      if (node.type !== 'asm.value') return node;

      const data = node.data as { address?: number } | undefined;
      if (!data?.address) return node;

      // Check if address is out of bounds
      if (data.address >= MEMORY_SIZE) {
        console.log(
          `[migration-008] Clamping asm.value address from ${data.address} to 0 (out of bounds)`
        );

        return {
          ...node,
          data: {
            ...data,
            address: 0 // Reset to start of memory
          }
        };
      }

      return node;
    });

    return {
      ...patch,
      nodes: migratedNodes
    };
  }
};
