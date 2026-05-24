import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/svelte';
import type { CodeEditorTarget } from '../../stores/code-editor-layout.store';
import { getSecondaryOutputCodeOverlayState } from './use-secondary-output-code-overlay.svelte';

describe('secondary output code overlay composable', () => {
  it('mirrors detached Strudel code ahead of the active code editor target', () => {
    const nodes = [
      {
        id: 'strudel-1',
        type: 'strudel',
        position: { x: 0, y: 0 },
        data: { code: 's("bd")' }
      }
    ] satisfies Node[];
    const activeCodeEditorTarget: CodeEditorTarget = {
      nodeId: 'p5-1',
      dataKey: 'code',
      language: 'javascript',
      mode: 'overlay'
    };

    expect(
      getSecondaryOutputCodeOverlayState({
        nodes,
        activeDetachedStrudelNodeId: 'strudel-1',
        activeCodeEditorTarget,
        detachedCodeEditorValue: 'circle(20, 20, 10)',
        fontSizePx: 32,
        transparency: 0.6
      })
    ).toEqual({
      nodeId: 'strudel-1',
      dataKey: 'code',
      value: 's("bd")',
      language: 'javascript',
      nodeType: 'strudel',
      title: 'strudel',
      fontSizePx: 32,
      transparency: 0.6
    });
  });

  it('falls back to the active editor overlay state when there is no detached Strudel code', () => {
    const activeCodeEditorTarget: CodeEditorTarget = {
      nodeId: 'p5-1',
      dataKey: 'code',
      language: 'javascript',
      mode: 'overlay',
      nodeType: 'p5',
      title: 'p5'
    };

    expect(
      getSecondaryOutputCodeOverlayState({
        nodes: [],
        activeDetachedStrudelNodeId: null,
        activeCodeEditorTarget,
        detachedCodeEditorValue: 'circle(20, 20, 10)',
        fontSizePx: 28,
        transparency: 0.72
      })
    ).toEqual({
      nodeId: 'p5-1',
      dataKey: 'code',
      value: 'circle(20, 20, 10)',
      language: 'javascript',
      nodeType: 'p5',
      title: 'p5',
      fontSizePx: 28,
      transparency: 0.72
    });
  });

  it('returns null when no code overlay should be mirrored', () => {
    expect(
      getSecondaryOutputCodeOverlayState({
        nodes: [],
        activeDetachedStrudelNodeId: null,
        activeCodeEditorTarget: null,
        detachedCodeEditorValue: '',
        fontSizePx: 28,
        transparency: 0.72
      })
    ).toBeNull();
  });
});
