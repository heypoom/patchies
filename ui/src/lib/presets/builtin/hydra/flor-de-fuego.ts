import type { HydraPreset } from './types';

const code = `//Flor de Fuego

shape(200,0.5,1.5)
.scale(0.5,0.5)
.color([0.5,2].smooth(1),0.3,0)
.repeat(2,2)
.modulateScale(osc(3,0.5),-0.6)
.add(o0,0.5)
.scale(0.9)
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
