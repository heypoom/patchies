import type { HydraPreset } from './types';

const code = `// Tag & Sweep
// by Rangga Purnama Aji
// https://ranggapurnamaaji1.wixsite.com/portfolio

osc(5,0.125).colorama(1)
  .luma(0.125).add(shape(1,0.5).luma(2).diff(gradient(1)))
  .diff(osc(-1,-0.25)).blend(o0).color(0,2.5,1.75)
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
