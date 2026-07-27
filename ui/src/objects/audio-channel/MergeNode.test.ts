import { describe, expect, it, vi } from 'vitest';

import { MergeNode } from './MergeNode';

describe('MergeNode', () => {
  it('connects its merged output to the target node', () => {
    const merger = { connect: vi.fn(), disconnect: vi.fn() } as unknown as ChannelMergerNode;
    const audioContext = {
      createChannelMerger: vi.fn(() => merger)
    } as unknown as AudioContext;
    const targetAudioNode = { connect: vi.fn() } as unknown as AudioNode;
    const target = { nodeId: 'out', audioNode: targetAudioNode };
    const node = new MergeNode('merge', audioContext);

    node.connect(target);

    expect(merger.connect).toHaveBeenCalledWith(targetAudioNode);
    expect(targetAudioNode.connect).not.toHaveBeenCalled();
  });
});
