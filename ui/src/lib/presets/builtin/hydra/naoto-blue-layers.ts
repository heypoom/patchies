import type { HydraPreset } from './types';

const code = `// @naoto_hieda
solid(0.2,0.6,0.9).layer(osc(31.4,0).thresh(0.7).luma().modulate(osc(4,1).rotate(1),0.05).color(0,0,0)).layer(osc(31.4,0).thresh(0.7).luma().modulate(osc(4,1).rotate(1),0.1)).out()`;

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
