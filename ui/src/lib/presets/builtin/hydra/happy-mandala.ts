import type { HydraPreset } from './types';

const code = `// Happy Mandala
// By Abhinay Khoparzi
// twitter/github/instagram: @khoparzi
voronoi(5,-0.1,5)
.add(osc(1,0,1)).kaleid(21)
.scale(1,1,2).colorama().out(o1)
src(o1).mult(src(s0).modulateRotate(o1,100), -0.5)
  .out(o0)`;

export const preset: HydraPreset = {
  type: 'hydra',
  data: {
    code: code.trim(),
    messageInletCount: 0,
    messageOutletCount: 0,
    videoInletCount: 0,
    videoOutletCount: 1
  }
};
