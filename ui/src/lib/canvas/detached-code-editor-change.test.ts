import type { Node } from '@xyflow/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { CodeEditorTarget } from '../../stores/code-editor-layout.store';
import { commitDetachedCodeEditorChange } from './detached-code-editor-change';

describe('detached code editor changes', () => {
  it('updates node data and invokes the target change callback', () => {
    const onchange = vi.fn();
    const target: CodeEditorTarget = {
      nodeId: 'bytebeat-1',
      dataKey: 'expr',
      language: 'javascript',
      nodeType: 'bytebeat~',
      onchange,
      mode: 'overlay'
    };
    const nodes = [
      {
        id: 'bytebeat-1',
        type: 'bytebeat~',
        position: { x: 0, y: 0 },
        data: { expr: 't' }
      }
    ] satisfies Node[];
    const events: string[] = [];
    let updatedNodes: Node[] = [];
    const setNodes = vi.fn((nextNodes: Node[]) => {
      events.push('setNodes');
      updatedNodes = nextNodes;
    });

    onchange.mockImplementation(() => {
      events.push('onchange');
    });

    commitDetachedCodeEditorChange(nodes, target, 't * 2', setNodes);

    expect(updatedNodes[0].data).toEqual({ expr: 't * 2' });
    expect(setNodes).toHaveBeenCalledOnce();
    expect(onchange).toHaveBeenCalledOnce();
    expect(onchange).toHaveBeenCalledWith('t * 2');
    expect(events).toEqual(['setNodes', 'onchange']);
  });
});
