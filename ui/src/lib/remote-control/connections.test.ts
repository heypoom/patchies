import { describe, expect, it } from 'vitest';
import { connectionDelta, parseConnections, serializeConnections } from './connections';

describe('connection declarations', () => {
  it('round trips quoted endpoint IDs, default handles, comments and duplicates', () => {
    const wires = [
      { source: 'node:with spaces', sourceHandle: '@default', target: 'b', targetHandle: null }
    ];
    const text = serializeConnections(wires);

    expect(parseConnections(`# wiring\n${text}${text}\n`)).toEqual(wires);
    expect(text).toContain('"node:with spaces":"@default" -> b:@default');
  });

  it('reports malformed declarations by line without dropping other lines', () => {
    expect(() => parseConnections('a:out -> b:in\nbad')).toThrow('Line 2');
    expect(() => parseConnections('a:out -> b:""')).toThrow('cannot be empty');
  });

  it('computes only the delta against the captured baseline', () => {
    const delta = connectionDelta('a:out -> b:in\n', 'a:out -> c:in\n');

    expect(delta.remove).toEqual([
      { source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'in' }
    ]);
    expect(delta.add).toEqual([
      { source: 'a', sourceHandle: 'out', target: 'c', targetHandle: 'in' }
    ]);
  });
});
