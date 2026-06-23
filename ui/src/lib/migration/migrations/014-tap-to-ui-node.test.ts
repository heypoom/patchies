import { describe, expect, test } from 'vitest';

import { migration014 } from './014-tap-to-ui-node';
import type { RawPatchData } from '../types';

describe('migration014', () => {
  test('converts tap~ text objects to dedicated UI nodes with settings data', () => {
    const patch: RawPatchData = {
      version: '13',
      nodes: [
        {
          id: 'tap-1',
          type: 'object',
          position: { x: 0, y: 0 },
          data: {
            expr: 'tap~ 1024 xy 30',
            name: 'tap~',
            params: [1024, 'xy', 30]
          }
        },
        {
          id: 'tap-2',
          type: 'object',
          position: { x: 0, y: 100 },
          data: {
            expr: 'tap~',
            name: 'tap~',
            params: []
          }
        }
      ],
      edges: [
        {
          id: 'audio-in',
          source: 'osc-1',
          target: 'tap-1',
          sourceHandle: 'audio-out',
          targetHandle: 'audio-in'
        },
        {
          id: 'message-out',
          source: 'tap-1',
          target: 'canvas-1',
          sourceHandle: 'message-out',
          targetHandle: 'message-in'
        }
      ]
    };

    const migrated = migration014.migrate(patch);

    expect(migrated.nodes?.[0]).toMatchObject({
      id: 'tap-1',
      type: 'tap~',
      data: {
        bufferSize: 1024,
        mode: 'xy',
        fps: 30,
        zeroCrossing: true
      }
    });

    expect(migrated.nodes?.[1]).toMatchObject({
      id: 'tap-2',
      type: 'tap~',
      data: {
        bufferSize: 512,
        mode: 'wave',
        fps: 0,
        zeroCrossing: true
      }
    });

    expect(migrated.edges).toEqual([
      expect.objectContaining({ id: 'audio-in', targetHandle: 'audio-in-0' }),
      expect.objectContaining({ id: 'message-out', sourceHandle: 'message-out-0' })
    ]);
  });
});
