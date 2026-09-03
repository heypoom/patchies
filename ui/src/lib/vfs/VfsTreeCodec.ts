import {
  type VFSEntry,
  type VFSTree,
  type VFSTreeNode,
  isVFSEntry,
  parseVFSPath,
  VFS_PREFIXES
} from './types';

type EntryValidator = (path: string, entry: VFSEntry) => void;

/** Converts between the flat runtime entry index and the serialized VFS tree. */
export class VfsTreeCodec {
  serialize(entries: Iterable<[string, VFSEntry]>): VFSTree {
    const tree: VFSTree = {};

    for (const [path, entry] of entries) {
      const parsed = parseVFSPath(path);
      if (!parsed) continue;

      if (parsed.namespace === 'obj') continue;

      const namespace = parsed.namespace === 'patch' ? 'patch' : 'user';
      tree[namespace] ??= {};

      this.setNestedEntry(tree[namespace], parsed.segments, { ...entry });
    }

    return tree;
  }

  deserialize(tree: VFSTree, validate: EntryValidator): Map<string, VFSEntry> {
    const entries = new Map<string, VFSEntry>();
    this.collectNamespace(entries, tree.patch, VFS_PREFIXES.PATCH, validate);
    this.collectNamespace(entries, tree.user, VFS_PREFIXES.USER, validate);

    return entries;
  }

  private collectNamespace(
    entries: Map<string, VFSEntry>,
    node: { [key: string]: VFSTreeNode } | undefined,
    prefix: string,
    validate: EntryValidator
  ): void {
    if (!node) return;

    for (const [key, value] of Object.entries(node)) {
      const path = `${prefix}${key}`;

      if (isVFSEntry(value)) {
        const entry = { ...value };
        validate(path, entry);

        entries.set(path, entry);
      } else {
        this.collectNamespace(entries, value, `${path}/`, validate);
      }
    }
  }

  private setNestedEntry(
    target: { [key: string]: VFSTreeNode },
    segments: string[],
    entry: VFSEntry
  ): void {
    if (segments.length === 0) return;

    if (segments.length === 1) {
      target[segments[0]] = entry;
      return;
    }

    const [first, ...rest] = segments;

    if (!target[first] || isVFSEntry(target[first])) {
      target[first] = {};
    }

    this.setNestedEntry(target[first] as { [key: string]: VFSTreeNode }, rest, entry);
  }
}
