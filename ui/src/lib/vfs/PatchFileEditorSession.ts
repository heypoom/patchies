import type { VirtualFilesystem } from './VirtualFilesystem';
import { isEditablePatchGlslPath } from '$lib/glsl-include/vfs-paths';

export type UnsavedChangesDecision = 'save' | 'discard' | 'cancel';

export const isEditorSaveShortcut = (event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>) =>
  event.key.toLowerCase() === 's' && (event.metaKey || event.ctrlKey);

/** Owns one Patch-file draft and keeps unsaved content outside the VFS. */
export class PatchFileEditorSession {
  path: string | null = null;
  savedContent = '';
  draft = '';
  revision = 0;

  constructor(private vfs: VirtualFilesystem) {}

  get isOpen(): boolean {
    return this.path !== null;
  }

  get isDirty(): boolean {
    return this.draft !== this.savedContent;
  }

  open(path: string): void {
    if (!isEditablePatchGlslPath(path)) {
      throw new Error(`VFS: Patch GLSL file is not editable: ${path}`);
    }

    this.path = path;
    this.savedContent = this.vfs.readEmbeddedFile(path);
    this.draft = this.savedContent;
    this.revision = this.vfs.getEntry(path)?.revision ?? 0;
  }

  updateDraft(content: string): void {
    if (!this.path) throw new Error('VFS: No Patch file is open');

    this.draft = content;
  }

  save(): boolean {
    if (!this.path || !this.isDirty) return false;

    this.vfs.writeEmbeddedFile(this.path, this.draft);
    this.savedContent = this.draft;
    this.revision = this.vfs.getEntry(this.path)?.revision ?? this.revision + 1;

    return true;
  }

  discard(): void {
    this.draft = this.savedContent;
  }

  close(): void {
    this.path = null;
    this.savedContent = '';
    this.draft = '';
    this.revision = 0;
  }

  rename(oldPath: string, newPath: string): void {
    if (this.path === oldPath) this.path = newPath;
  }

  syncSavedContent(): 'unchanged' | 'updated' | 'deleted' | 'conflict' {
    if (!this.path) return 'unchanged';

    const entry = this.vfs.getEntry(this.path);
    if (!entry) return this.isDirty ? 'conflict' : 'deleted';

    const nextContent = this.vfs.readEmbeddedFile(this.path);
    const nextRevision = entry.revision ?? 0;

    if (nextContent === this.savedContent && nextRevision === this.revision) return 'unchanged';
    if (this.isDirty) return 'conflict';

    this.savedContent = nextContent;
    this.draft = nextContent;
    this.revision = nextRevision;

    return 'updated';
  }
}
