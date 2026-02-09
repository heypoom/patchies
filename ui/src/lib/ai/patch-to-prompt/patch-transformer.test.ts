import { describe, expect, it } from 'vitest';
import { cleanPatch, patchToJson, type CleanedPatch } from './patch-transformer';
import type { Node, Edge } from '@xyflow/svelte';

describe('cleanPatch', () => {
  it('strips visual-only fields from nodes', () => {
    const nodes: Node[] = [
      {
        id: 'node-1',
        type: 'slider',
        position: { x: 100, y: 200 },
        data: { min: 0, max: 100, value: 50 },
        selected: true,
        dragging: false,
        measured: { width: 200, height: 50 }
      }
    ];

    const result = cleanPatch(nodes, []);

    expect(result.nodes).toHaveLength(1);

    expect(result.nodes[0]).toEqual({
      id: 'node-1',
      type: 'slider',
      data: { min: 0, max: 100, value: 50 }
    });

    // Should not have visual fields
    expect(result.nodes[0]).not.toHaveProperty('position');
    expect(result.nodes[0]).not.toHaveProperty('selected');
    expect(result.nodes[0]).not.toHaveProperty('measured');
  });

  it('strips visual-only fields from edges', () => {
    const edges: Edge[] = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'message-out',
        targetHandle: 'message-in',
        selected: true,
        animated: true,
        type: 'default'
      }
    ];

    const result = cleanPatch([], edges);

    expect(result.edges).toHaveLength(1);

    expect(result.edges[0]).toEqual({
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'message-out',
      targetHandle: 'message-in'
    });

    // Should not have visual fields
    expect(result.edges[0]).not.toHaveProperty('id');
    expect(result.edges[0]).not.toHaveProperty('selected');
    expect(result.edges[0]).not.toHaveProperty('animated');
  });

  it('omits sourceHandle/targetHandle if not present', () => {
    const edges: Edge[] = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2'
      }
    ];

    const result = cleanPatch([], edges);

    expect(result.edges[0]).toEqual({
      source: 'node-1',
      target: 'node-2'
    });
    expect(result.edges[0]).not.toHaveProperty('sourceHandle');
    expect(result.edges[0]).not.toHaveProperty('targetHandle');
  });

  it('generates correct metadata', () => {
    const nodes: Node[] = [
      { id: '1', type: 'slider', position: { x: 0, y: 0 }, data: {} },
      { id: '2', type: 'slider', position: { x: 0, y: 0 }, data: {} },
      { id: '3', type: 'tone~', position: { x: 0, y: 0 }, data: {} },
      { id: '4', type: 'object', position: { x: 0, y: 0 }, data: {} }
    ];

    const edges: Edge[] = [
      { id: 'e1', source: '1', target: '3' },
      { id: 'e2', source: '2', target: '3' },
      { id: 'e3', source: '3', target: '4' }
    ];

    const result = cleanPatch(nodes, edges);

    expect(result.metadata.nodeCount).toBe(4);
    expect(result.metadata.edgeCount).toBe(3);
    expect(result.metadata.nodeTypes).toEqual(['slider', 'tone~', 'object']);
  });

  it('handles nodes with undefined type', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} } // type is undefined
    ];

    const result = cleanPatch(nodes, []);

    expect(result.nodes[0].type).toBe('unknown');
  });

  it('preserves nested data objects', () => {
    const nodes: Node[] = [
      {
        id: '1',
        type: 'glsl',
        position: { x: 0, y: 0 },
        data: {
          code: 'void main() {}',
          uniforms: { time: 0, resolution: [800, 600] }
        }
      }
    ];

    const result = cleanPatch(nodes, []);

    expect(result.nodes[0].data).toEqual({
      code: 'void main() {}',
      uniforms: { time: 0, resolution: [800, 600] }
    });
  });

  it('strips internal state fields from node data', () => {
    const nodes: Node[] = [
      {
        id: '1',
        type: 'p5',
        position: { x: 0, y: 0 },
        data: {
          code: 'function draw() {}',
          _lastRender: 12345,
          _frameCount: 100,
          _initialized: true
        }
      }
    ];

    const result = cleanPatch(nodes, []);

    expect(result.nodes[0].data).toEqual({
      code: 'function draw() {}'
    });
    expect(result.nodes[0].data).not.toHaveProperty('_lastRender');
    expect(result.nodes[0].data).not.toHaveProperty('_frameCount');
  });
});

describe('patchToJson', () => {
  it('converts cleaned patch to formatted JSON', () => {
    const patch: CleanedPatch = {
      nodes: [{ id: '1', type: 'slider', data: { value: 50 } }],
      edges: [{ source: '1', target: '2' }],
      metadata: { nodeCount: 1, edgeCount: 1, nodeTypes: ['slider'] }
    };

    const json = patchToJson(patch);

    // Should be valid JSON
    const parsed = JSON.parse(json);
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.edges).toHaveLength(1);

    // Should not include metadata in output
    expect(parsed).not.toHaveProperty('metadata');
  });

  it('produces properly indented JSON', () => {
    const patch: CleanedPatch = {
      nodes: [{ id: '1', type: 'slider', data: {} }],
      edges: [],
      metadata: { nodeCount: 1, edgeCount: 0, nodeTypes: ['slider'] }
    };

    const json = patchToJson(patch);

    // Should contain newlines (formatted)
    expect(json).toContain('\n');

    // Should be indented with 2 spaces
    expect(json).toContain('  "nodes"');
  });
});
