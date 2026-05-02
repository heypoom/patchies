import type { HydraPreset } from './types';

const code = `// moire
// by Olivia Jack
// twitter: @_ojack_

pattern = () => osc(200, 0).kaleid(200).scale(1, 0.4)
//
pattern()
  .scrollX(0.1, 0.01)
  .mult(pattern())
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
