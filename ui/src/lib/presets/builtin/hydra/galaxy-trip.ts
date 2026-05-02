import type { HydraPreset } from './types';

const code = `// Galaxy Trip
// by Rangga Purnama Aji
// https://ranggapurnamaaji1.wixsite.com/portfolio

shape(1,1)
  .mult(voronoi(1000,2)
  .blend(o0).luma())
  .add(shape(3,0.125)
       .rotate(1,1).mult(voronoi(1000,1).luma())
       .rotate(1.5)).scrollX([0.1,-0.0625,0.005,0.00001],0)
  .scrollY([0.1,-0.0625,0.005,0.00001],0)
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
