import type { HydraPreset } from './types';

const code = `// Puertas II
// por Celeste Betancur
// https://github.com/essteban

osc(13,0,1)
  .kaleid()
  .mask(shape(4,0.3,1))
  .modulateRotate(shape(4,0.1,1))
  .modulateRotate(shape(4,0.1,0.9))
  .modulateRotate(shape(4,0.1,0.8))
  .scale(0.3)
  .add(shape(4,0.2,1).color(0.3,1,1,0.5))
  .rotate(()=>time)
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
