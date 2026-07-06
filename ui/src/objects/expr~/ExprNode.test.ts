import { describe, expect, it, vi } from 'vitest';

import { ExprNode } from '$objects/expr~/ExprNode';
import { FExprNode } from '$objects/expr~/FExprNode';

function createFakeWorkletNode() {
  return {
    port: {
      onmessage: null as ((event: MessageEvent<{ type?: string }>) => void) | null,
      postMessage: vi.fn(),
      close: vi.fn()
    },
    disconnect: vi.fn()
  };
}

describe('ExprNode cleanup', () => {
  it('stops and releases the worklet when expr~ is destroyed', () => {
    const node = new ExprNode('expr-1', {} as AudioContext);
    const worklet = createFakeWorkletNode();

    node.audioNode = worklet as unknown as AudioWorkletNode;
    node.destroy();

    expect(worklet.port.postMessage).toHaveBeenCalledWith({ type: 'stop' });
    expect(worklet.disconnect).toHaveBeenCalled();
    expect(node.audioNode).toBeNull();
    expect(worklet.port.close).not.toHaveBeenCalled();

    worklet.port.onmessage?.({ data: { type: 'stopped' } } as MessageEvent<{ type?: string }>);

    expect(worklet.port.onmessage).toBeNull();
    expect(worklet.port.close).toHaveBeenCalled();
  });

  it('stops and releases the worklet when fexpr~ is destroyed', () => {
    const node = new FExprNode('fexpr-1', {} as AudioContext);
    const worklet = createFakeWorkletNode();

    node.audioNode = worklet as unknown as AudioWorkletNode;
    node.destroy();

    expect(worklet.port.postMessage).toHaveBeenCalledWith({ type: 'stop' });
    expect(worklet.disconnect).toHaveBeenCalled();
    expect(node.audioNode).toBeNull();
    expect(worklet.port.close).not.toHaveBeenCalled();

    worklet.port.onmessage?.({ data: { type: 'stopped' } } as MessageEvent<{ type?: string }>);

    expect(worklet.port.onmessage).toBeNull();
    expect(worklet.port.close).toHaveBeenCalled();
  });
});
