import { describe, expect, test } from 'vitest';
import type { Node } from '@xyflow/svelte';

import {
  clearVisualGroupSelections,
  getVisualGroupIdsContainingPoint,
  syncVisualGroupMembership
} from './grouping';

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

  test('orders nested descendants after each ancestor when membership changes', () => {
    const nodes = [
      group('group-1', { x: 100, y: 100 }),
      node('intermediate', 'js', { x: 10, y: 10 }, { parentId: 'group-1', width: 80, height: 80 }),
      node('grandchild', 'js', { x: 4, y: 4 }, { parentId: 'child', width: 20, height: 20 }),
      node('child', 'js', { x: 8, y: 8 }, { parentId: 'intermediate', width: 40, height: 40 }),
      node('incoming', 'js', { x: 120, y: 120 }, { width: 40, height: 40 })
    ];

    const result = syncVisualGroupMembership(nodes, { activeGroupIds: ['group-1'] });

    expect(result.changed).toBe(true);
    expect(result.nodes.map((n) => n.id)).toEqual([
      'group-1',
      'intermediate',
      'child',
      'grandchild',
      'incoming'
    ]);
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

describe('getVisualGroupIdsContainingPoint', () => {
  test('finds a group whose frame contains a selection start point', () => {
    const nodes = [
      group('group-1', { x: 100, y: 100 }, { width: 200, height: 160 }),
      group('group-2', { x: 400, y: 100 }, { width: 200, height: 160 })
    ];

    expect(getVisualGroupIdsContainingPoint(nodes, { x: 150, y: 140 })).toEqual(['group-1']);
  });

  test('does not match points outside group frames', () => {
    expect(
      getVisualGroupIdsContainingPoint([group('group-1', { x: 100, y: 100 })], { x: 20, y: 20 })
    ).toEqual([]);
  });
});

describe('clearVisualGroupSelections', () => {
  test('clears selection on groups that contained the selection start point', () => {
    const nodes = [
      group('group-1', { x: 100, y: 100 }, { selected: true }),
      node('child', 'js', { x: 20, y: 20 }, { parentId: 'group-1', selected: true })
    ];

    const result = clearVisualGroupSelections(nodes, ['group-1']);

    expect(result.changed).toBe(true);
    expect(result.nodes.find((item) => item.id === 'group-1')?.selected).toBe(false);
    expect(result.nodes.find((item) => item.id === 'child')?.selected).toBe(true);
  });

  test('leaves groups selected when they did not contain the selection start point', () => {
    const nodes = [group('group-1', { x: 100, y: 100 }, { selected: true })];

    expect(clearVisualGroupSelections(nodes, ['group-2'])).toEqual({
      nodes,
      changed: false
    });
  });
});
