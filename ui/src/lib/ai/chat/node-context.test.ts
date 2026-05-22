import { describe, expect, test } from 'vitest';

import {
  buildChatNodeContexts,
  buildNodeContextSystemInstruction,
  formatNodeContextLabel
} from './node-context';

describe('chat node context', () => {
  test('builds context for every selected node', () => {
    const contexts = buildChatNodeContexts(
      [
        { id: 'a', type: 'osc~', data: { name: 'Bass' } },
        { id: 'b', type: 'gain~', data: { title: 'Volume' } }
      ],
      (nodeId) => (nodeId === 'b' ? ['too loud'] : [])
    );

    expect(contexts).toEqual([
      { nodeId: 'a', nodeType: 'osc~', nodeData: { name: 'Bass' } },
      {
        nodeId: 'b',
        nodeType: 'gain~',
        nodeData: { title: 'Volume' },
        consoleErrors: ['too loud']
      }
    ]);
  });

  test('formats the context header with a remaining count', () => {
    expect(
      formatNodeContextLabel([
        { nodeId: 'a', nodeType: 'shaderpark' },
        { nodeId: 'b', nodeType: 'out~' }
      ])
    ).toBe('shaderpark and out~');

    expect(
      formatNodeContextLabel([
        { nodeId: 'a', nodeType: 'osc~', nodeData: { name: 'A' } },
        { nodeId: 'b', nodeType: 'gain~', nodeData: { title: 'B' } },
        { nodeId: 'c', nodeType: 'out~' },
        { nodeId: 'd', nodeType: 'scope~' }
      ])
    ).toBe('A, B and 2 more');
  });

  test('writes system prompt context for all selected nodes', () => {
    const instruction = buildNodeContextSystemInstruction([
      { nodeId: 'a', nodeType: 'osc~', nodeData: { freq: 110 } },
      {
        nodeId: 'b',
        nodeType: 'gain~',
        nodeData: { gain: 0.4 },
        consoleErrors: ['gain clipped']
      }
    ]);

    expect(instruction).toContain('The user currently has 2 nodes selected.');
    expect(instruction).toContain('1. "osc~" node (ID: "a")');
    expect(instruction).toContain('"freq": 110');
    expect(instruction).toContain('2. "gain~" node (ID: "b")');
    expect(instruction).toContain('"gain": 0.4');
    expect(instruction).toContain('The selected "gain~" node (ID: "b") has console errors:');
    expect(instruction).toContain('- gain clipped');
  });
});
