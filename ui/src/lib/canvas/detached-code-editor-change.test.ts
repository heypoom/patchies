import { describe, expect, it, vi } from 'vitest';
import type { CodeEditorTarget } from '../../stores/code-editor-layout.store';
import { commitDetachedCodeEditorChange } from './detached-code-editor-change';

describe('detached code editor changes', () => {
  it('updates xyflow node data and invokes the target change callback', () => {
    const onchange = vi.fn();
    const target: CodeEditorTarget = {
      nodeId: 'bytebeat-1',
      dataKey: 'expr',
      language: 'javascript',
      nodeType: 'bytebeat~',
      onchange,
      mode: 'overlay'
    };
    const events: string[] = [];
    const updateNodeData = vi.fn(() => {
      events.push('updateNodeData');
    });

    onchange.mockImplementation(() => {
      events.push('onchange');
    });

    commitDetachedCodeEditorChange(target, 't * 2', updateNodeData);

    expect(updateNodeData).toHaveBeenCalledOnce();
    expect(updateNodeData).toHaveBeenCalledWith('bytebeat-1', { expr: 't * 2' });
    expect(onchange).toHaveBeenCalledOnce();
    expect(onchange).toHaveBeenCalledWith('t * 2');
    expect(events).toEqual(['updateNodeData', 'onchange']);
  });
});
