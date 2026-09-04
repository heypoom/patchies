import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryManager } from '$lib/history';
import {
  PatchFileEditorSession,
  getPatchFileEditorSession,
  isEditorSaveShortcut
} from './PatchFileEditorSession';
import { VirtualFilesystem } from './VirtualFilesystem';

describe('PatchFileEditorSession', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
    HistoryManager.getInstance().clear();
  });

  it('keeps drafts isolated until explicit Save and records one global operation', () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();
    vfs.createEmbeddedFile('patch://shader.glsl', 'float value = 1.0;');
    history.clear();

    const session = new PatchFileEditorSession(vfs);
    session.open('patch://shader.glsl');
    session.updateDraft('float value = 2.0;');

    expect(session.isDirty).toBe(true);
    expect(vfs.readEmbeddedFile('patch://shader.glsl')).toBe('float value = 1.0;');

    expect(session.save()).toBe(true);
    expect(vfs.readEmbeddedFile('patch://shader.glsl')).toBe('float value = 2.0;');
    expect(history.peekUndo()).toBe('Write shader.glsl');

    history.undo();
    expect(session.syncSavedContent()).toBe('updated');
    expect(session.draft).toBe('float value = 1.0;');
  });

  it('reports conflicts without replacing a dirty draft', () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile('patch://shader.glsl', 'float value = 1.0;');

    const session = new PatchFileEditorSession(vfs);
    session.open('patch://shader.glsl');
    session.updateDraft('float draft = 2.0;');
    vfs.writeEmbeddedFile('patch://shader.glsl', 'float restored = 3.0;');

    expect(session.syncSavedContent()).toBe('conflict');
    expect(session.draft).toBe('float draft = 2.0;');
  });

  it('only recognizes platform Save shortcuts', () => {
    expect(isEditorSaveShortcut({ key: 's', metaKey: true, ctrlKey: false })).toBe(true);
    expect(isEditorSaveShortcut({ key: 'S', metaKey: false, ctrlKey: true })).toBe(true);
    expect(isEditorSaveShortcut({ key: 's', metaKey: false, ctrlKey: false })).toBe(false);
  });

  it('opens Patch JavaScript modules while keeping User files read-only', () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile('patch://module.js', 'export {}');

    const session = new PatchFileEditorSession(vfs);
    session.open('patch://module.js');

    expect(session.path).toBe('patch://module.js');
    expect(() => session.open('user://module.js')).toThrow('not editable');
  });

  it('reopens a cached Patch editor session after returning to the file tree', () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile('patch://module.js', 'export {}');

    const firstOpen = getPatchFileEditorSession(vfs, 'patch://module.js');
    firstOpen.close();

    const reopened = getPatchFileEditorSession(vfs, 'patch://module.js');

    expect(reopened).toBe(firstOpen);
    expect(reopened.path).toBe('patch://module.js');
    expect(reopened.draft).toBe('export {}');
  });

  it('shares a JavaScript module draft and its undo history across editor views', () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile('patch://module.js', 'export const value = 1');

    const filesSession = getPatchFileEditorSession(vfs);
    filesSession.open('patch://module.js');
    const mirrorSession = getPatchFileEditorSession(vfs, 'patch://module.js');
    const changes = vi.fn();
    const unsubscribe = mirrorSession.subscribe(changes);

    expect(mirrorSession).toBe(filesSession);

    filesSession.updateDraft('export const value = 2');
    expect(mirrorSession.draft).toBe('export const value = 2');
    expect(changes).toHaveBeenCalledTimes(1);

    expect(mirrorSession.undoDraft()).toBe(true);
    expect(filesSession.draft).toBe('export const value = 1');

    expect(filesSession.redoDraft()).toBe(true);
    expect(mirrorSession.draft).toBe('export const value = 2');

    unsubscribe();
  });
});
