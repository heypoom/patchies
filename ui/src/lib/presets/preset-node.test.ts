import type { Node } from '@xyflow/svelte';
import { describe, expect, test, vi } from 'vitest';
import { CanvasDragDropManager } from '$lib/canvas/CanvasDragDropManager';
import { createNodePreset } from './preset-node';

describe('preset node dimensions', () => {
  test('retains resized dimensions through JSON storage and canvas insertion', () => {
    const node: Node = {
      id: 'canvas.dom-1',
      type: 'canvas.dom',
      position: { x: 10, y: 20 },
      data: { code: 'draw()' },
      width: 640,
      height: 360,
      measured: { width: 641, height: 361 }
    };

    const preset = createNodePreset(node, 'Wide canvas');
    const storedPreset = JSON.parse(JSON.stringify(preset));
    const createNode = vi.fn();

    const manager = new CanvasDragDropManager({
      screenToFlowPosition: (position) => position,
      createNode,
      createNodeFromName: vi.fn()
    });

    node.width = 800;
    manager.insertPreset(storedPreset, { x: 100, y: 200 });

    expect(createNode).toHaveBeenCalledWith(
      'canvas.dom',
      { x: 100, y: 200 },
      { code: 'draw()' },
      { dimensions: { width: 640, height: 360 } }
    );
  });

  test('does not save automatic measurements as explicit dimensions', () => {
    const preset = createNodePreset(
      {
        id: 'text-1',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { text: 'hello' },
        measured: { width: 200, height: 80 }
      },
      'Greeting'
    );

    expect(preset).not.toHaveProperty('width');
    expect(preset).not.toHaveProperty('height');
  });

  test('retains a resize on only one axis', () => {
    const preset = createNodePreset(
      {
        id: 'slider-1',
        type: 'slider',
        position: { x: 0, y: 0 },
        data: {},
        width: 400
      },
      'Wide slider'
    );

    expect(preset.width).toBe(400);
    expect(preset).not.toHaveProperty('height');
  });
});
