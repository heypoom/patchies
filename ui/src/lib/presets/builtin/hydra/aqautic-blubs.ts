import type { HydraPreset } from './types';

const code = `// Aqautic blubs
// By Khoparzi
// https://khoparzi.com

gradient(0.25)
.add(noise(), ()=>Math.cos(time))
.modulateRotate(src(o0).rotate(0, -0.52), 0.2).mult(shape(360), 0.8)
.repeat(10,5).mult(shape(360).scale(()=>Math.sin(time)), 0.8).rotate(0, 0.2)
.diff(src(o0).rotate(0, -0.2), 0.2)
.out()`;

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
