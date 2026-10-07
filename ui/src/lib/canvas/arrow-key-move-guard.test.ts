import { expect, it, vi } from 'vitest';

import { installArrowKeyMoveGuard } from './arrow-key-move-guard';

it('restores every draggable flag even when XYFlow movement throws', () => {
  const inherited: { draggable?: boolean } = {};
  const draggable = { draggable: true };
  const fixed = { draggable: false };

  const move = vi.fn(() => {
    expect(inherited.draggable).toBe(false);
    expect(draggable.draggable).toBe(false);

    throw new Error('movement failed');
  });

  const store: Parameters<typeof installArrowKeyMoveGuard>[0] = {
    moveSelectedNodes: move,
    nodeLookup: new Map([
      ['inherited', inherited],
      ['draggable', draggable],
      ['fixed', fixed]
    ])
  };

  const guard = installArrowKeyMoveGuard(store);

  for (const nodeId of store.nodeLookup.keys()) {
    guard.handleInteractionUpdate({
      type: 'nodeInteractionUpdate',
      nodeId,
      mode: 'arrowKeyMove',
      enabled: false
    });
  }

  expect(() => store.moveSelectedNodes({ x: 1, y: 0 }, 4)).toThrow('movement failed');

  expect(inherited).not.toHaveProperty('draggable');
  expect(draggable.draggable).toBe(true);
  expect(fixed.draggable).toBe(false);

  guard.destroy();
  expect(store.moveSelectedNodes).toBe(move);
});
