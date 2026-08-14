import { describe, expect, it } from 'vitest';

import { PatchGraph } from './PatchGraph';

describe('PatchGraph', () => {
  it('does not report equivalent object data as changed', () => {
    const graph = new PatchGraph();

    expect(
      graph.setObjects([{ id: 'toggle-1', type: 'toggle', data: { value: false } }])
    ).toMatchObject({ changed: true, changedObjectIds: new Set(['toggle-1']) });

    expect(
      graph.setObjects([{ id: 'toggle-1', type: 'toggle', data: { value: false } }])
    ).toMatchObject({ changed: false, changedObjectIds: new Set() });
  });

  it('reports both old and new endpoints when a connection changes', () => {
    const graph = new PatchGraph();

    graph.setConnections([
      { id: 'connection', source: 'function', outlet: 'out', target: 'noise', inlet: 'in' }
    ]);

    expect(
      graph.setConnections([
        { id: 'connection', source: 'function', outlet: 'out', target: 'output', inlet: 'in' }
      ])
    ).toMatchObject({
      changed: true,
      changedConnectionNodeIds: new Set(['function', 'noise', 'output'])
    });
  });
});
