import { describe, expect, it } from 'vitest';
import { analyzePdPatch, createPdWrapper } from './pd-patch';

describe('analyzePdPatch', () => {
  it('discovers root abstraction ports in canvas order and literal named endpoints', () => {
    const source = `#N canvas 0 0 500 400 10;
#X obj 200 20 inlet~;
#X obj 50 20 inlet;
#X obj 70 80 r frequency;
#X obj 80 100 receive \\$0-private;
#N canvas 0 0 200 200 nested 0;
#X obj 10 10 inlet;
#X obj 10 40 s nested-send;
#X restore 300 200 pd nested;
#X obj 90 300 send meter;
#X obj 50 340 outlet;
#X obj 200 340 outlet~;`;

    expect(analyzePdPatch(source)).toEqual([
      {
        id: 'abstraction:in:0',
        kind: 'message-in',
        label: 'message inlet 1',
        source: 'abstraction',
        index: 0
      },
      {
        id: 'abstraction:in:1',
        kind: 'audio-in',
        label: 'audio inlet 1',
        source: 'abstraction',
        index: 1
      },
      {
        id: 'abstraction:out:0',
        kind: 'message-out',
        label: 'message outlet 1',
        source: 'abstraction',
        index: 0
      },
      {
        id: 'abstraction:out:1',
        kind: 'audio-out',
        label: 'audio outlet 1',
        source: 'abstraction',
        index: 1
      },
      {
        id: 'named:in:frequency',
        kind: 'message-in',
        label: 'frequency',
        source: 'named',
        name: 'frequency'
      },
      { id: 'named:out:meter', kind: 'message-out', label: 'meter', source: 'named', name: 'meter' }
    ]);
  });
});

describe('createPdWrapper', () => {
  it('wires selected abstraction message and stereo audio ports', () => {
    const ports = analyzePdPatch(`#N canvas 0 0 400 300 10;
#X obj 20 20 inlet;
#X obj 80 20 inlet~;
#X obj 140 20 inlet~;
#X obj 20 250 outlet;
#X obj 80 250 outlet~;
#X obj 140 250 outlet~;`);
    const source = createPdWrapper({
      abstraction: 'main patch',
      nodeId: 'node-1',
      ports,
      exposedPortIds: ports.map((port) => port.id)
    });

    expect(source).toContain('#X obj 180 120 main\\ patch;');
    expect(source).toContain('r __patchies_node_1_abstraction_in_0;');
    expect(source).toContain('#X connect 3 0 0 1;');
    expect(source).toContain('#X connect 3 1 0 2;');
    expect(source).toContain('#X connect 0 1 4 0;');
    expect(source).toContain('#X connect 0 2 4 1;');
  });
});
