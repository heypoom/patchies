import { describe, expect, it } from 'vitest';
import { getPdMessageInletLayout } from './pd-inlets';
import type { PdPort } from './pd-patch';

const customInput = (id: string, label: string): PdPort => ({
  id,
  kind: 'message-in',
  label,
  source: 'named',
  name: label
});

describe('getPdMessageInletLayout', () => {
  it('places custom inlets before the stable control inlet', () => {
    expect(
      getPdMessageInletLayout([
        customInput('named:in:frequency', 'frequency'),
        customInput('named:in:gain', 'gain')
      ])
    ).toEqual([
      { key: 'named:in:frequency', handleId: 2, position: 1, title: 'frequency' },
      { key: 'named:in:gain', handleId: 3, position: 2, title: 'gain' },
      { key: 'pd-controls', handleId: 1, position: 3, title: 'Pd controls (load/set)' }
    ]);
  });

  it('shows the control inlet directly after audio when no custom inlet is exposed', () => {
    expect(getPdMessageInletLayout([])).toEqual([
      { key: 'pd-controls', handleId: 1, position: 1, title: 'Pd controls (load/set)' }
    ]);
  });
});
