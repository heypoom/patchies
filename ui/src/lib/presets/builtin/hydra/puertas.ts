import type { HydraPreset } from './types';

const code = `// Puertas
// por Celeste Betancur
// https://github.com/essteban

osc(13,0,1)
  .modulate(osc(21,0.25,0))
  .modulateScale(osc(34))
  .modulateKaleid(osc(55),0.1,1)
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
