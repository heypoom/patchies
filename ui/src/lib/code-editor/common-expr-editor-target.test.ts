import { describe, expect, it, vi } from 'vitest';

import { createCommonExprEditorTarget } from './common-expr-editor-target';

describe('createCommonExprEditorTarget', () => {
  it('builds a detached target for expression-backed code editors', () => {
    const onrun = vi.fn();
    const customActions = vi.fn() as any;
    const customSettings = vi.fn() as any;

    expect(
      createCommonExprEditorTarget({
        nodeId: 'chuck-1',
        dataKey: 'expr',
        language: 'plain',
        nodeType: 'chuck~',
        title: 'chuck~',
        placeholder: 'SinOsc osc => dac;',
        onrun,
        customActions,
        customSettings
      })
    ).toEqual({
      nodeId: 'chuck-1',
      dataKey: 'expr',
      language: 'plain',
      nodeType: 'chuck~',
      title: 'chuck~',
      placeholder: 'SinOsc osc => dac;',
      onrun,
      customActions,
      customSettings
    });
  });
});
