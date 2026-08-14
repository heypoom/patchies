import { describe, expect, it, vi } from 'vitest';

import { logger } from '$lib/utils/logger';

import { GraphObserver } from './GraphObserver';
import type { RuntimeGraphSpec } from '../types/runtime-object';

describe('GraphObserver', () => {
  it('does not read the graph when there are no subscriptions', async () => {
    const getGraph = vi.fn(() => ({ objects: [], connections: [] }));
    const observer = new GraphObserver(getGraph);

    observer.notify({
      changedObjectIds: new Set(['fragment']),
      changedConnectionNodeIds: new Set()
    });

    await Promise.resolve();

    expect(getGraph).not.toHaveBeenCalled();
  });

  it('does not call a subscription when no nodes match its tags', async () => {
    const observer = new GraphObserver(() => ({
      objects: [{ id: 'output', type: 'glsl', data: { tags: ['shader/output'] } }],
      connections: []
    }));

    const snapshots: unknown[] = [];

    observer.subscribe({ tags: ['shader/foo/*'] }, (snapshot) => snapshots.push(snapshot));

    observer.notify({
      changedObjectIds: new Set(['compiler']),
      changedConnectionNodeIds: new Set()
    });

    await Promise.resolve();

    expect(snapshots).toEqual([]);
  });

  it('does not emit an empty snapshot after matching nodes disappear', async () => {
    let graph: RuntimeGraphSpec = {
      objects: [{ id: 'fragment', type: 'js', data: { tags: ['shader/foo/function'] } }],
      connections: []
    };

    const observer = new GraphObserver(() => graph);
    const snapshots: string[][] = [];

    observer.subscribe({ tags: ['shader/foo/*'] }, ({ nodes }) =>
      snapshots.push(nodes.map(({ id }) => id))
    );

    graph = { objects: [], connections: [] };

    observer.notify({
      changedObjectIds: new Set(['fragment']),
      changedConnectionNodeIds: new Set()
    });

    expect(snapshots).toEqual([['fragment']]);
  });

  it('notifies when a matching node changes', async () => {
    let graph: RuntimeGraphSpec = {
      objects: [
        { id: 'fragment', type: 'js', data: { tags: ['shader/foo/function'], code: 'v1' } }
      ],
      connections: []
    };

    const observer = new GraphObserver(() => graph);
    const snapshots: string[] = [];

    observer.subscribe({ tags: ['shader/foo/*'] }, ({ nodes }) => {
      const code = nodes[0].data.code;

      if (typeof code === 'string') snapshots.push(code);
    });

    graph = {
      ...graph,
      objects: [{ id: 'fragment', type: 'js', data: { tags: ['shader/foo/function'], code: 'v2' } }]
    };

    observer.notify({
      changedObjectIds: new Set(['fragment']),
      changedConnectionNodeIds: new Set()
    });

    await Promise.resolve();

    expect(snapshots).toEqual(['v1', 'v2']);
  });

  it('does not notify when an untagged node changes', async () => {
    let graph: RuntimeGraphSpec = {
      objects: [
        { id: 'fragment', type: 'js', data: { tags: ['shader/foo/function'], code: 'noise()' } },
        { id: 'compiler', type: 'js', data: { code: 'version one' } }
      ],
      connections: []
    };

    const observer = new GraphObserver(() => graph);
    const snapshots: string[][] = [];

    observer.subscribe({ tags: ['shader/foo/*'] }, ({ nodes }) =>
      snapshots.push(nodes.map(({ id }) => id))
    );

    graph = {
      ...graph,
      objects: [
        graph.objects[0],
        {
          id: 'compiler',
          type: 'js',
          data: { code: 'version two' }
        }
      ]
    };

    observer.notify({
      changedObjectIds: new Set(['compiler']),
      changedConnectionNodeIds: new Set()
    });

    expect(snapshots).toEqual([['fragment']]);
  });

  it('notifies when an edge between matching nodes changes', async () => {
    let graph: RuntimeGraphSpec = {
      objects: [
        { id: 'function', type: 'js', data: { tags: ['shader/foo/function'] } },
        { id: 'noise', type: 'js', data: { tags: ['shader/foo/noise'] } }
      ],
      connections: []
    };

    const observer = new GraphObserver(() => graph);
    const snapshots: string[][] = [];

    observer.subscribe({ tags: ['shader/foo/*'] }, ({ edges }) =>
      snapshots.push(edges.map(({ id }) => id))
    );

    graph = {
      ...graph,
      connections: [{ id: 'function-noise', source: 'function', target: 'noise' }]
    };

    observer.notify({
      changedObjectIds: new Set(),
      changedConnectionNodeIds: new Set(['function', 'noise'])
    });

    await Promise.resolve();

    expect(snapshots).toEqual([[], ['function-noise']]);
  });

  it('continues notifying subscriptions when a callback fails', () => {
    const observer = new GraphObserver(() => ({
      objects: [{ id: 'fragment', type: 'js', data: { tags: ['shader/foo/function'] } }],
      connections: []
    }));
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const snapshots: string[][] = [];

    try {
      observer.subscribe({ tags: ['shader/foo/*'] }, () => {
        throw new Error('broken callback');
      });
      observer.subscribe({ tags: ['shader/foo/*'] }, ({ nodes }) =>
        snapshots.push(nodes.map(({ id }) => id))
      );

      expect(snapshots).toEqual([['fragment']]);
    } finally {
      warn.mockRestore();
    }
  });

  it('immediately returns tagged nodes and only their internal edges', () => {
    const graph: RuntimeGraphSpec = {
      objects: [
        { id: 'function', type: 'js', data: { tags: ['shader/foo/function'] } },
        { id: 'noise', type: 'js', data: { tags: ['shader/foo/noise'] } },
        { id: 'output', type: 'glsl', data: { tags: ['shader/output'] } }
      ],
      connections: [
        { id: 'function-noise', source: 'function', outlet: 'message-out', target: 'noise' },
        { id: 'noise-output', source: 'noise', outlet: 'message-out', target: 'output' }
      ]
    };

    const observer = new GraphObserver(() => graph);
    const snapshots: unknown[] = [];

    observer.subscribe(
      {
        tags: ['shader/foo/*']
      },
      (snapshot) => snapshots.push(snapshot)
    );

    expect(snapshots).toEqual([
      {
        nodes: [
          {
            id: 'function',
            type: 'js',
            data: { tags: ['shader/foo/function'] },
            tags: ['shader/foo/function']
          },
          {
            id: 'noise',
            type: 'js',
            data: { tags: ['shader/foo/noise'] },
            tags: ['shader/foo/noise']
          }
        ],
        edges: [
          {
            id: 'function-noise',
            source: 'function',
            outlet: 'message-out',
            target: 'noise',
            inlet: undefined
          }
        ]
      }
    ]);
  });
});
