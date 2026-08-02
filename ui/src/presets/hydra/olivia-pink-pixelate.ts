import type { HydraPreset } from './types';

const code = `// by Olivia Jack
// https://ojack.github.io

osc(6, 0, 0.8)
  .color(1.14, 0.6,.80)
  .rotate(0.92, 0.3)
  .pixelate(20, 10)
  .mult(osc(40, 0.03).thresh(0.4).rotate(0, -0.02))
  .modulateRotate(osc(20, 0).thresh(0.3, 0.6), () => 0.1 + mouse.x * 0.002)
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
