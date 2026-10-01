import { describe, expect, it } from 'vitest';
import { compilePdComments } from './pd-comments';

describe('compilePdComments', () => {
  it('keeps item indices stable and removes connections to disabled items', () => {
    const source = `#N canvas 0 0 400 300 10;
#X obj 20 20 osc~ 440;
// #X obj 20 50 *~ 0.2;
#X obj 20 80 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 0 0 2 1;`;

    expect(compilePdComments(source)).toBe(`#N canvas 0 0 400 300 10;
#X obj 20 20 osc~ 440;
#X text 20 50 Patchies disabled;
#X obj 20 80 dac~;


#X connect 0 0 2 1;`);
  });

  it('removes explicitly commented connections without changing item indices', () => {
    const source = `#N canvas 0 0 400 300 10;
#X obj 20 20 osc~ 440;
#X obj 20 80 dac~;
// #X connect 0 0 1 0;`;

    expect(compilePdComments(source)).toBe(`#N canvas 0 0 400 300 10;
#X obj 20 20 osc~ 440;
#X obj 20 80 dac~;
`);
  });

  it('tracks disabled items separately inside nested canvases', () => {
    const source = `#N canvas 0 0 400 300 10;
#X obj 20 20 inlet~;
#N canvas 0 0 200 200 subpatch 0;
// #X obj 10 10 osc~ 220;
#X obj 10 40 outlet~;
#X connect 0 0 1 0;
#X restore 20 60 pd subpatch;
#X obj 20 100 outlet~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;`;

    expect(compilePdComments(source)).toBe(`#N canvas 0 0 400 300 10;
#X obj 20 20 inlet~;
#N canvas 0 0 200 200 subpatch 0;
#X text 10 10 Patchies disabled;
#X obj 10 40 outlet~;

#X restore 20 60 pd subpatch;
#X obj 20 100 outlet~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;`);
  });

  it('rejects structural canvas comments', () => {
    expect(() => compilePdComments('// #N canvas 0 0 400 300 10;')).toThrow(
      'Pd canvas records cannot be commented out (line 1).'
    );
  });
});
