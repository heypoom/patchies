import { describe, expect, test } from 'vitest';

import { DEFAULT_GROUP_HEIGHT, DEFAULT_GROUP_WIDTH } from '$lib/nodes/defaultNodeDimensions';
import { handleMultiObjectInsert } from './handle-multi-object-insert';

describe('handleMultiObjectInsert', () => {
  test('creates group nodes with explicit top-level dimensions', async () => {
    const result = await handleMultiObjectInsert({
      objectNodes: [{ type: 'group', data: {}, position: { x: 0, y: 0 } }],
      simplifiedEdges: [],
      basePosition: { x: 10, y: 20 },
      nodeIdCounter: 1,
      edgeIdCounter: 1
    });

    expect(result.newNodes[0]).toMatchObject({
      id: 'group-1',
      type: 'group',
      width: DEFAULT_GROUP_WIDTH,
      height: DEFAULT_GROUP_HEIGHT,
      data: {}
    });
  });
});
