import type { HydraPreset } from './types';

const code = `// by Rodrigo Velasco
// https://yecto.github.io/

osc(107, 0, 0.7).color(1, 0, 1).rotate(0, -0.08).modulateRotate(o1, 0.4).out(o0)
osc(33).rotate(2, 0.8).modulateRotate(o0, () => (fft().a[0]*2)).out(o1)`;

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
