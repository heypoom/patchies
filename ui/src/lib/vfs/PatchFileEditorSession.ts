import { HistoryManager } from '$lib/history';
import { isObjectPath } from './ObjectFileProjection';
import type { VirtualFilesystem } from './VirtualFilesystem';
import { isEditableCodePath } from './patch-file-editor';

export type UnsavedChangesDecision = 'save' | 'discard' | 'cancel';

export const isEditorSaveShortcut = (event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>) =>
  event.key.toLowerCase() === 's' && (event.metaKey || event.ctrlKey);

/** Owns Patch-file drafts and live object-source editing gestures. */
export class PatchFileEditorSession {
  private pathValue: string | null = null;
  private listeners = new Set<() => void>();

  constructor(private vfs: VirtualFilesystem) {}

  get path(): string | null {
    return this.pathValue;
  }

  get savedContent(): string {
    return this.getState()?.savedContent ?? '';
  }

  get draft(): string {
    return this.getState()?.draft ?? '';
  }

  get revision(): number {
    return this.getState()?.revision ?? 0;
  }

  get isOpen(): boolean {
    return this.pathValue !== null;
  }

  get isDirty(): boolean {
    const state = this.getState();

    return !!state && state.draft !== state.savedContent;
  }

  open(path: string): void {
    if (!isEditableCodePath(path)) {
      throw new Error(`VFS: Code file is not editable: ${path}`);
    }

    this.pathValue = path;

    if (!this.states().has(path)) {
      const savedContent = this.vfs.readCodeFile(path);
      this.states().set(path, {
        savedContent,
        draft: savedContent,
        revision: this.vfs.getEntry(path)?.revision ?? 0,
        draftUndoStack: [],
        draftRedoStack: []
      });
    } else {
      this.syncSavedContent();
    }
  }

  async run(content = this.draft): Promise<void> {
    this.updateDraft(content);
    this.save();

    if (this.pathValue && isObjectPath(this.pathValue)) {
      await this.vfs.objectFiles.run(this.pathValue);
    }
  }

  updateDraft(content: string): void {
    const state = this.getState();
    if (!state) throw new Error('VFS: No code file is open');
    if (state.draft === content) return;

    if (this.pathValue && isObjectPath(this.pathValue)) {
      state.editStart ??= state.savedContent;
      this.vfs.objectFiles.write(this.pathValue, content, { recordHistory: false });
      state.savedContent = content;
      state.draft = content;
      state.revision = this.vfs.getEntry(this.pathValue)?.revision ?? state.revision;
      this.notify();
      return;
    }

    state.draftUndoStack.push(state.draft);
    state.draftRedoStack = [];
    state.draft = content;
    this.notify();
  }

  save(): boolean {
    const path = this.pathValue;
    const state = this.getState();
    if (!path || !state) return false;

    if (isObjectPath(path)) {
      const previousContent = state.editStart;
      if (
        !this.vfs.has(path) ||
        previousContent === undefined ||
        previousContent === state.savedContent
      ) {
        state.editStart = undefined;
        return false;
      }

      this.vfs.objectFiles.write(path, state.savedContent, { previousContent });
      state.editStart = undefined;
      return true;
    }

    if (!this.isDirty) return false;

    this.vfs.writeCodeFile(path, state.draft);
    state.savedContent = state.draft;
    state.revision = this.vfs.getEntry(path)?.revision ?? state.revision + 1;
    this.notify();

    return true;
  }

  discard(): void {
    const state = this.getState();
    if (!state || state.draft === state.savedContent) return;

    state.draftUndoStack.push(state.draft);
    state.draftRedoStack = [];
    state.draft = state.savedContent;
    this.notify();
  }

  close(): void {
    if (this.pathValue && isObjectPath(this.pathValue)) this.save();

    this.pathValue = null;
    this.notify();
  }

  rename(oldPath: string, newPath: string): void {
    const state = this.states().get(oldPath);
    if (state) {
      this.states().delete(oldPath);
      this.states().set(newPath, state);
    }

    const pathSessions = sessionsByPath.get(this.vfs);
    if (pathSessions?.get(oldPath) === this) {
      pathSessions.delete(oldPath);
      pathSessions.set(newPath, this);
    }

    if (this.pathValue === oldPath) {
      this.pathValue = newPath;
      this.notify();
    }
  }

  syncSavedContent(): 'unchanged' | 'updated' | 'deleted' | 'conflict' {
    const path = this.pathValue;
    const state = this.getState();
    if (!path || !state) return 'unchanged';

    const entry = this.vfs.getEntry(path);
    if (!entry) {
      if (this.isDirty && !isObjectPath(path)) return 'conflict';

      this.states().delete(path);
      return 'deleted';
    }

    const nextContent = this.vfs.readCodeFile(path);
    const nextRevision = entry.revision ?? 0;

    if (nextContent === state.savedContent && nextRevision === state.revision) return 'unchanged';
    if (this.isDirty && !isObjectPath(path)) return 'conflict';

    state.editStart = undefined;
    state.savedContent = nextContent;
    state.draft = nextContent;
    state.revision = nextRevision;
    state.draftUndoStack = [];
    state.draftRedoStack = [];
    this.notify();

    return 'updated';
  }

  undoDraft(): boolean {
    if (this.pathValue && isObjectPath(this.pathValue)) {
      this.save();
      const undone = HistoryManager.getInstance().undo() !== null;
      this.syncSavedContent();
      return undone;
    }

    const state = this.getState();
    const previous = state?.draftUndoStack.pop();
    if (!state || previous === undefined) return false;

    state.draftRedoStack.push(state.draft);
    state.draft = previous;
    this.notify();

    return true;
  }

  redoDraft(): boolean {
    if (this.pathValue && isObjectPath(this.pathValue)) {
      const redone = HistoryManager.getInstance().redo() !== null;
      this.syncSavedContent();
      return redone;
    }

    const state = this.getState();
    const next = state?.draftRedoStack.pop();
    if (!state || next === undefined) return false;

    state.draftUndoStack.push(state.draft);
    state.draft = next;
    this.notify();

    return true;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  private states(): Map<string, PatchFileEditorState> {
    return getEditorStates(this.vfs);
  }

  private getState(): PatchFileEditorState | undefined {
    return this.pathValue ? this.states().get(this.pathValue) : undefined;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

type PatchFileEditorState = {
  savedContent: string;
  draft: string;
  revision: number;
  editStart?: string;
  draftUndoStack: string[];
  draftRedoStack: string[];
};

const sessions = new WeakMap<VirtualFilesystem, PatchFileEditorSession>();
const sessionsByPath = new WeakMap<VirtualFilesystem, Map<string, PatchFileEditorSession>>();
const editorStates = new WeakMap<VirtualFilesystem, Map<string, PatchFileEditorState>>();

const getEditorStates = (vfs: VirtualFilesystem): Map<string, PatchFileEditorState> => {
  let states = editorStates.get(vfs);

  if (!states) {
    states = new Map();
    editorStates.set(vfs, states);
  }

  return states;
};

/** Returns the one editor session for a patch VFS, shared by Files and mirrors. */
export const getPatchFileEditorSession = (
  vfs: VirtualFilesystem,
  path?: string
): PatchFileEditorSession => {
  if (path) {
    const activeSession = sessions.get(vfs);
    if (activeSession?.path === path) return activeSession;

    let pathSessions = sessionsByPath.get(vfs);

    if (!pathSessions) {
      pathSessions = new Map();
      sessionsByPath.set(vfs, pathSessions);
    }

    const existingSession = pathSessions.get(path);

    if (existingSession) {
      existingSession.open(path);

      return existingSession;
    }

    const renamedSession = [...pathSessions.values()].find((session) => session.path === path);

    if (renamedSession) {
      pathSessions.set(path, renamedSession);

      return renamedSession;
    }

    const session = new PatchFileEditorSession(vfs);
    session.open(path);
    pathSessions.set(path, session);

    return session;
  }

  let session = sessions.get(vfs);

  if (!session) {
    session = new PatchFileEditorSession(vfs);
    sessions.set(vfs, session);
  }

  return session;
};
