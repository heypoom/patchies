import type { HydraPreset } from './types';

const code = `// @naoto_hieda
osc(20, 0.1, 0).color(0, 1, 2).rotate(1.57/2).out(o1)
osc(30, 0.01, 0).color(2, 0.7, 1).modulate(o1, 0).add(o1,1).modulatePixelate(o1,1,10).out(o0)`;

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
