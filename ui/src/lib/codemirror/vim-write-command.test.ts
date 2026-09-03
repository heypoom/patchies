import { describe, expect, it, vi } from 'vitest';

import { VimWriteCommandDispatcher } from './vim-write-command';

describe('VimWriteCommandDispatcher', () => {
  it('routes :w to the editor that invoked it when multiple editors exist', () => {
    const dispatcher = new VimWriteCommandDispatcher<object>();
    const firstSave = vi.fn();
    const secondSave = vi.fn();
    const firstEditor = {};
    const secondEditor = {};
    let writeCommand: ((view: object) => void) | undefined;

    dispatcher.register((command) => {
      writeCommand = command;
    });
    dispatcher.setHandler(firstEditor, firstSave);
    dispatcher.setHandler(secondEditor, secondSave);

    writeCommand?.(firstEditor);
    writeCommand?.(secondEditor);

    expect(firstSave).toHaveBeenCalledOnce();
    expect(secondSave).toHaveBeenCalledOnce();
  });

  it('registers the global :w command once and removes destroyed editors', () => {
    const dispatcher = new VimWriteCommandDispatcher<object>();
    const registerFirst = vi.fn();
    const registerSecond = vi.fn();
    const save = vi.fn();
    const editor = {};
    let writeCommand: ((view: object) => void) | undefined;

    dispatcher.register((command) => {
      writeCommand = command;
      registerFirst();
    });
    dispatcher.register(registerSecond);
    const removeHandler = dispatcher.setHandler(editor, save);

    removeHandler();
    writeCommand?.(editor);

    expect(registerFirst).toHaveBeenCalledOnce();
    expect(registerSecond).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
