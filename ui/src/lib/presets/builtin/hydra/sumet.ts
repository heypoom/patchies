import type { HydraPreset } from './types';

const code = `// Sumet
// by Rangga Purnama Aji
// https://ranggapurnamaaji1.wixsite.com/portfolio

osc(0.5,1.25).mult(shape(1,0.09).rotate(1.5))
  .diff(gradient())
  .add(shape(2,2).blend(gradient(1)))
  .modulate(noise()
            .modulate(noise().scrollY(1,0.0625)))
  .blend(o0)
  .color(1,-0.5,-0.75)
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
