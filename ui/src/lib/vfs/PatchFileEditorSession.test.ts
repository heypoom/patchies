import { beforeEach, describe, expect, it } from 'vitest';

import { HistoryManager } from '$lib/history';
import { PatchFileEditorSession, isEditorSaveShortcut } from './PatchFileEditorSession';
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

  it('keeps JavaScript and User GLSL files read-only in Stage 2', () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile('patch://module.js', 'export {}');

    const session = new PatchFileEditorSession(vfs);
    expect(() => session.open('patch://module.js')).toThrow('not editable');
  });
});
