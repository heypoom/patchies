import type { HydraPreset } from './types';

const code = `// Puertas III
// por Celeste Betancur
// https://github.com/essteban
 
osc(40,0.2,1)
  .modulateScale(osc(40,0,1).kaleid(8))
  .repeat(2,4)
  .modulate(o0,0.05)
  .modulateKaleid(shape(4,0.1,1))
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
