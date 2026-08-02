import type { HydraPreset } from './types';

const code = `// Monochrome Memoar
// by Rangga Purnama Aji
// https://ranggapurnamaaji1.wixsite.com/portfolio

voronoi(50,1)
  .luma(0.5).add(shape(1,1).luma(1))
  .modulate(osc(-1000,-1)
            .modulate(osc().luma()))
  .blend(o0)
  .blend(o0)
  .blend(o0)
  .blend(o0)
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
