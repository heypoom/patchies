import { describe, expect, test } from 'vitest';

import { migration015 } from './015-toggle-legacy-value';
import type { RawPatchData } from '../types';

describe('migration015', () => {
  test('copies a legacy toggle param into its runtime value', () => {
    const patch: RawPatchData = {
      version: '14',
      nodes: [
        {
          id: 'legacy-on-toggle',
          type: 'toggle',
          position: { x: 0, y: 0 },
          data: { params: [true] }
        }
      ]
    };

    const migrated = migration015.migrate(patch);

    expect(migrated.nodes?.[0]?.data).toEqual({ params: [true], value: true });
  });

  test('keeps an explicit toggle value over its legacy parameter', () => {
    const patch: RawPatchData = {
      version: '14',
      nodes: [
        {
          id: 'current-toggle',
          type: 'toggle',
          position: { x: 0, y: 0 },
          data: { value: false, params: [true] }
        }
      ]
    };

    const migrated = migration015.migrate(patch);

    expect(migrated.nodes?.[0]?.data).toEqual({ value: false, params: [true] });
  });
});
