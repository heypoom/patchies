import { describe, expect, test } from 'vitest';

import { resolveInsertObject } from './direct-tool-handlers';

describe('direct chat tool handlers', () => {
  test('preserves optional position for insert_object', () => {
    const action = resolveInsertObject({
      type: 'p5',
      data: { code: 'function draw() {}' },
      position: { x: 120, y: -40 }
    });

    expect(action.result).toEqual({
      kind: 'single',
      type: 'p5',
      data: { code: 'function draw() {}' },
      position: { x: 120, y: -40 }
    });
  });
});
