import { describe, expect, it } from 'vitest';
import { getDetachedPdData, getPdEditorMode } from './pd-source';

describe('Pd source editing mode', () => {
  it('edits embedded patch files in place', () => {
    expect(getPdEditorMode({ sourceCode: null, vfsPath: 'patch://synth/main.pd' })).toBe('patch');
  });

  it('keeps user files and URLs read-only while mounted', () => {
    expect(getPdEditorMode({ sourceCode: null, vfsPath: 'user://main.pd' })).toBe('readonly');
    expect(getPdEditorMode({ sourceCode: null, sourceUrl: 'https://example.com/main.pd' })).toBe(
      'readonly'
    );
  });

  it('allows empty and detached nodes to edit inline', () => {
    expect(getPdEditorMode({ sourceCode: null })).toBe('inline');
    expect(
      getPdEditorMode({ sourceCode: '#N canvas 0 0 100 100 10;', vfsPath: 'user://main.pd' })
    ).toBe('inline');
  });

  it('clears mounted sources when detaching', () => {
    expect(getDetachedPdData('#N canvas 0 0 100 100 10;')).toEqual({
      vfsPath: '',
      sourceUrl: '',
      sourceCode: '#N canvas 0 0 100 100 10;',
      hasConfiguredPorts: false
    });
  });
});
