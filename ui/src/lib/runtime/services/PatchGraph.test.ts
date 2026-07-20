import { describe, expect, it } from 'vitest';

import { PatchGraph } from './PatchGraph';

describe('PatchGraph', () => {
  it('does not report equivalent object data as changed', () => {
    const graph = new PatchGraph();

    expect(graph.setObjects([{ id: 'toggle-1', type: 'toggle', data: { value: false } }])).toBe(
      true
    );

    expect(graph.setObjects([{ id: 'toggle-1', type: 'toggle', data: { value: false } }])).toBe(
      false
    );
  });
});
