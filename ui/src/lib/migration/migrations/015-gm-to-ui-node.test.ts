import { describe, expect, test } from 'vitest';

import { migration015 } from './015-gm-to-ui-node';
import type { RawPatchData } from '../types';

describe('migration015', () => {
  test('converts gm~ text objects to the dedicated visual node', () => {
    const patch: RawPatchData = {
      version: '14',
      nodes: [
        {
          id: 'gm-1',
          type: 'object',
          position: { x: 0, y: 0 },
          data: {
            expr: 'gm~',
            name: 'gm~',
            params: []
          }
        },
        {
          id: 'other-1',
          type: 'object',
          position: { x: 0, y: 100 },
          data: {
            expr: 'gain~ 0.5',
            name: 'gain~',
            params: [0.5]
          }
        }
      ],
      edges: [
        {
          id: 'midi-to-gm',
          source: 'midi-1',
          target: 'gm-1',
          sourceHandle: 'message-out',
          targetHandle: 'message-in-0'
        },
        {
          id: 'gm-to-out',
          source: 'gm-1',
          target: 'out-1',
          sourceHandle: 'audio-out-0',
          targetHandle: 'audio-in'
        }
      ]
    };

    const migrated = migration015.migrate(patch);

    expect(migrated.nodes?.[0]).toMatchObject({
      id: 'gm-1',
      type: 'gm~',
      data: {
        settings: expect.objectContaining({ source: 'soundfont', kit: 'MusyngKite' })
      }
    });
    expect(migrated.nodes?.[1]).toMatchObject({
      id: 'other-1',
      type: 'object'
    });
    expect(migrated.edges).toEqual([
      expect.objectContaining({ id: 'midi-to-gm', targetHandle: 'message-in' }),
      expect.objectContaining({ id: 'gm-to-out', sourceHandle: 'audio-out' })
    ]);
  });
});
