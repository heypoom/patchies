import { afterEach, describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/svelte';

import { VfsCanvasMirrors } from './VfsCanvasMirrors';

describe('VfsCanvasMirrors', () => {
  afterEach(() => VfsCanvasMirrors.register({ getNodes: () => [], setNodes: () => {} })());

  it('restores only mirrors in a VFS snapshot', () => {
    let nodes: Node[] = [
      { id: 'other', type: 'js', position: { x: 0, y: 0 }, data: {} },
      {
        id: 'renamed',
        type: 'js.module',
        position: { x: 0, y: 0 },
        data: { vfsPath: 'patch://new.js' }
      },
      {
        id: 'created-later',
        type: 'js.module',
        position: { x: 0, y: 0 },
        data: { vfsPath: 'patch://later.js' }
      }
    ];
    const snapshot: Node[] = [
      {
        id: 'renamed',
        type: 'js.module',
        position: { x: 0, y: 0 },
        data: { vfsPath: 'patch://old.js' }
      }
    ];
    const unregister = VfsCanvasMirrors.register({
      getNodes: () => nodes,
      setNodes: (next) => {
        nodes = next;
      }
    });

    VfsCanvasMirrors.restore(snapshot);

    expect(nodes.map((node) => node.id)).toEqual(['other', 'created-later', 'renamed']);
    expect(nodes.find((node) => node.id === 'renamed')?.data.vfsPath).toBe('patch://old.js');

    unregister();
  });
});
