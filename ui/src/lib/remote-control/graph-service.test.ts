import { beforeEach, describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/svelte';
import { CanvasContext } from '$lib/services/CanvasContext';
import { AddNodeCommand, HistoryManager, type CanvasStateAccessors } from '$lib/history';
import { RemoteControlGraphService, type GraphPorts } from './graph-service';

const wire = { source: 'a', sourceHandle: 'message-out', target: 'b', targetHandle: 'message-in' };

describe('remote graph control', () => {
  let nodes: Node[];
  let edges: Edge[];

  let history: HistoryManager;
  let graph: RemoteControlGraphService;
  let ports: GraphPorts;

  beforeEach(() => {
    nodes = ['a', 'b', 'c'].map((id) => ({
      id,
      type: 'button',
      position: { x: 0, y: 0 },
      data: {}
    }));

    edges = [{ id: 'original', ...wire, data: { preserve: true } }];
    history = new HistoryManager();

    ports = {
      ready: true,
      inlets: [{ id: 'message-in', kind: 'message' }],
      outlets: [{ id: 'message-out', kind: 'message' }]
    };

    const accessors: CanvasStateAccessors = {
      getNodes: () => nodes,
      setNodes: (value) => {
        nodes = value;
      },
      getEdges: () => edges,
      setEdges: (value) => {
        edges = value;
      }
    };

    const context = new CanvasContext(
      { get: accessors.getNodes, set: accessors.setNodes },
      { get: accessors.getEdges, set: accessors.setEdges },
      history
    );

    context.setNodeIdCounter(1);

    graph = new RemoteControlGraphService({
      accessors,
      history,
      ports: () => ports,
      settle: async () => {},
      create: (command) => {
        const id = context.nextNodeId(command.name);

        history.execute(
          new AddNodeCommand(
            {
              id,
              type: command.name,
              data: command.data ?? {},
              position: command.position ?? { x: 0, y: 0 }
            },
            accessors
          )
        );

        return id;
      }
    });
  });

  it('discovers nodes without code and all four wire endpoints', async () => {
    const result = await graph.execute({ kind: 'graph.query' });

    expect(result).toMatchObject({
      nodes: [{ id: 'a', sourcePaths: [], ports }, { id: 'b' }, { id: 'c' }],
      edges: [{ id: 'original', ...wire }]
    });

    expect(history.canUndo()).toBe(false);
  });

  it('creates with canvas incremental IDs and undoes deletion with attached edges', async () => {
    const created = await graph.execute({ kind: 'node.create', name: 'button' });
    expect(created).toMatchObject({ id: 'button-1' });

    history.undo();
    expect(nodes.some((node) => node.id === 'button-1')).toBe(false);

    history.redo();
    const second = await graph.execute({ kind: 'node.create', name: 'glsl' });
    const third = await graph.execute({ kind: 'node.create', name: 'hydra' });

    expect(second).toMatchObject({ id: 'glsl-2' });
    expect(third).toMatchObject({ id: 'hydra-3' });

    await graph.execute({ kind: 'node.delete', nodeIds: ['a'] });
    expect(edges).toEqual([]);
    expect(nodes.some((node) => node.id === 'a')).toBe(false);

    history.undo();
    expect(edges).toEqual([{ id: 'original', ...wire, data: { preserve: true } }]);
    expect(nodes.some((node) => node.id === 'a')).toBe(true);
  });

  it('preserves browser-only wires and undoes a whole file save as one action', async () => {
    edges.push({ id: 'browser-only', ...wire, target: 'c' });
    await graph.writeConnections('', 'a:message-out -> b:message-in\n');

    expect(edges.map((edge) => edge.id)).toEqual(['browser-only']);

    history.undo();
    expect(edges.map((edge) => edge.id).sort()).toEqual(['browser-only', 'original']);

    history.redo();
    expect(edges.map((edge) => edge.id)).toEqual(['browser-only']);
  });

  it('validates the entire delta before removing any existing edge', async () => {
    await expect(
      graph.execute({
        kind: 'wire.change',
        remove: [wire],
        add: [{ ...wire, target: 'c', targetHandle: 'message-in-999' }]
      })
    ).rejects.toThrow('not found');

    expect(edges.map((edge) => edge.id)).toEqual(['original']);
    expect(history.canUndo()).toBe(false);
  });

  it('rejects ports until ready and accepts message modulation of audio parameters', async () => {
    ports.ready = false;

    await expect(
      graph.execute({ kind: 'wire.change', add: [{ ...wire, target: 'c' }], remove: [] })
    ).rejects.toThrow('ports_not_ready');

    ports = {
      ready: true,
      inlets: [{ id: 'audio-in', kind: 'audio', isAudioParam: true }],
      outlets: [{ id: 'message-out', kind: 'message' }]
    };

    await graph.execute({
      kind: 'wire.change',
      add: [{ ...wire, target: 'c', targetHandle: 'audio-in' }],
      remove: []
    });

    expect(edges).toHaveLength(2);
  });

  it('keeps unchanged edge IDs and metadata and does not add history for duplicates', async () => {
    await graph.execute({ kind: 'wire.change', add: [wire], remove: [] });

    expect(edges).toEqual([{ id: 'original', ...wire, data: { preserve: true } }]);
    expect(history.canUndo()).toBe(false);
  });
});

it('reports a connections-file endpoint error at its original line', async () => {
  const history = new HistoryManager();

  const graph = new RemoteControlGraphService({
    accessors: { getNodes: () => [], getEdges: () => [], setNodes: () => {}, setEdges: () => {} },
    history,
    create: () => '',
    ports: () => ({ ready: false, inlets: [], outlets: [] }),
    settle: async () => {}
  });

  await expect(graph.writeConnections('# comment\na:out -> b:in\n', '')).rejects.toThrow(
    'Line 2: Node a not found'
  );

  expect(history.canUndo()).toBe(false);
});
