import type { Migration } from '../types';

/**
 * Migration 009: Rename assembly `receive` instruction to `recv`
 *
 * This migration renames the `receive` instruction to `recv` for consistency
 * with the rest of the app which uses `send/recv` naming convention.
 *
 * Changes:
 * 1. Replaces `receive` with `recv` in asm node code
 * 2. Only replaces in the instruction portion (before `;` comment marker)
 */
export const migration009: Migration = {
  version: 9,
  name: 'asm-receive-to-recv',

  migrate(patch) {
    if (!patch.nodes) return patch;

    const migratedNodes = patch.nodes.map((node) => {
      if (node.type !== 'asm') return node;
      if (!node.data?.code) return node;

      const code = node.data.code as string;
      const migratedCode = migrateAsmCode(code);

      if (code === migratedCode) return node;

      return {
        ...node,
        data: {
          ...node.data,
          code: migratedCode
        }
      };
    });

    return { ...patch, nodes: migratedNodes };
  }
};

/**
 * Replace `receive` with `recv` in asm code, preserving comments.
 * Comments start with `;` - only replace in the code portion before `;`
 */
function migrateAsmCode(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      const commentIndex = line.indexOf(';');

      if (commentIndex === -1) {
        // No comment - replace in entire line
        return line.replace(/\breceive\b/g, 'recv');
      }

      // Split into code and comment portions
      const codePart = line.slice(0, commentIndex);
      const commentPart = line.slice(commentIndex);

      // Only replace in the code portion
      return codePart.replace(/\breceive\b/g, 'recv') + commentPart;
    })
    .join('\n');
}
