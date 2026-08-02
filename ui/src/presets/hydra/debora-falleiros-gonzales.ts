import type { HydraPreset } from './types';

const code = `// by Débora Falleiros Gonzales
// https://www.gonzalesdebora.com/

osc(5).add(noise(5, 2)).color(0, 0, 3).colorama(0.4).out()`;

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
