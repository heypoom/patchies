import { describe, expect, test } from 'vitest';
import type { Node } from '@xyflow/svelte';

import { syncVisualGroupMembership } from './grouping';

function node(
  id: string,
  type: string,
  position: { x: number; y: number },
  options: Partial<Node> = {}
): Node {
  return {
    id,
    type,
    position,
    data: {},
    ...options
  };
}

function group(id: string, position: { x: number; y: number }, options: Partial<Node> = {}): Node {
  return node(id, 'group', position, { width: 200, height: 160, ...options });
}

describe('syncVisualGroupMembership', () => {
  test('adds a moved top-level object when its center is inside a group', () => {
    const nodes = [
      node('a', 'js', { x: 120, y: 110 }, { width: 40, height: 30 }),
      group('group-1', { x: 100, y: 100 })
    ];

    const result = syncVisualGroupMembership(nodes, { activeNodeIds: ['a'] });

    expect(result.changed).toBe(true);
    expect(result.nodes.map((n) => n.id)).toEqual(['group-1', 'a']);
    expect(result.nodes.find((n) => n.id === 'a')).toMatchObject({
      parentId: 'group-1',
      position: { x: 20, y: 10 }
    });
  });

  test('removes a moved child object when its center is outside its parent group', () => {
    const nodes = [
      group('group-1', { x: 100, y: 100 }),
      node('a', 'js', { x: 230, y: 170 }, { parentId: 'group-1', width: 40, height: 30 })
    ];

    const result = syncVisualGroupMembership(nodes, { activeNodeIds: ['a'] });

    expect(result.changed).toBe(true);
    expect(result.nodes.find((n) => n.id === 'a')).toMatchObject({
      position: { x: 330, y: 270 }
    });
    expect(result.nodes.find((n) => n.id === 'a')?.parentId).toBeUndefined();
  });

  test('keeps a moved child object grouped while its center remains inside its parent group', () => {
    const nodes = [
      group('group-1', { x: 100, y: 100 }),
      node('a', 'js', { x: 120, y: 40 }, { parentId: 'group-1', width: 40, height: 30 })
    ];

    const result = syncVisualGroupMembership(nodes, { activeNodeIds: ['a'] });

    expect(result.changed).toBe(false);
    expect(result.nodes.find((n) => n.id === 'a')).toMatchObject({
      parentId: 'group-1',
      position: { x: 120, y: 40 }
    });
  });

  test('resizing a group adds top-level objects inside and removes children outside', () => {
    const nodes = [
      node('before', 'js', { x: 0, y: 0 }, { width: 40, height: 40 }),
      node('incoming', 'js', { x: 120, y: 120 }, { width: 40, height: 40 }),
      group('group-1', { x: 100, y: 100 }, { width: 140, height: 120 }),
      node('leaving', 'js', { x: 180, y: 130 }, { parentId: 'group-1', width: 40, height: 30 }),
      node('after', 'js', { x: 400, y: 400 }, { width: 40, height: 40 })
    ];

    const result = syncVisualGroupMembership(nodes, { activeGroupIds: ['group-1'] });

    expect(result.changed).toBe(true);
    expect(result.nodes.map((n) => n.id)).toEqual([
      'before',
      'group-1',
      'incoming',
      'leaving',
      'after'
    ]);
    expect(result.nodes.find((n) => n.id === 'incoming')).toMatchObject({
      parentId: 'group-1',
      position: { x: 20, y: 20 }
    });
    expect(result.nodes.find((n) => n.id === 'leaving')).toMatchObject({
      position: { x: 280, y: 230 }
    });
    expect(result.nodes.find((n) => n.id === 'leaving')?.parentId).toBeUndefined();
  });

  test('resizing a group uses explicit node dimensions over stale measured dimensions', () => {
    const nodes = [
      node('incoming', 'js', { x: 280, y: 120 }, { width: 40, height: 40 }),
      group(
        'group-1',
        { x: 100, y: 100 },
        { width: 240, height: 120, measured: { width: 80, height: 80 } }
      )
    ];

    const result = syncVisualGroupMembership(nodes, { activeGroupIds: ['group-1'] });

    expect(result.changed).toBe(true);
    expect(result.nodes.find((n) => n.id === 'incoming')).toMatchObject({
      parentId: 'group-1',
      position: { x: 180, y: 20 }
    });
  });

  test('does not sweep top-level objects into a group when only the group was moved', () => {
    const nodes = [
      group('group-1', { x: 100, y: 100 }),
      node('a', 'js', { x: 120, y: 120 }, { width: 40, height: 40 })
    ];

    const result = syncVisualGroupMembership(nodes, { activeNodeIds: ['group-1'] });

    expect(result.changed).toBe(false);
    expect(result.nodes.find((n) => n.id === 'a')?.parentId).toBeUndefined();
  });
});
